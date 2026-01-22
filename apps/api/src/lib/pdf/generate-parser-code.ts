/**
 * LLM-based parser code generation for PDF, CSV, and XLSX statements
 * Uses ToolLoopAgent for agentic retry: if code execution fails, agent sees error and fixes it
 * Includes validation against statement summary to catch parsing errors
 */

import { ToolLoopAgent, tool, stepCountIs, hasToolCall } from 'ai'
import { z } from 'zod'
import { createLLMClientFromSettings } from '../../llm'
import { logger } from '../logger'
import { runParser } from './execute-parser'
import type { ExpectedSummary, ExtractedTotals, RawPdfTransaction } from './types'
import type { FileType } from '../constants'

/**
 * Maximum retry attempts for fixing code errors
 */
const MAX_STEPS = 8

/**
 * Tolerance for amount comparison (to handle rounding differences)
 */
const AMOUNT_TOLERANCE = 10

/**
 * Base system prompt for PDF code generation
 */
const PDF_BASE_SYSTEM_PROMPT = `You are a bank statement parsing expert. Generate JavaScript code to extract transactions from bank/credit card statement text.

IMPORTANT RULES:
1. The code must be a function body (no function declaration) that:
   - Receives the full text as a variable named 'text'
   - MUST return an array of transaction objects using an explicit 'return' statement
2. Each transaction must have:
   - date (YYYY-MM-DD string)
   - amount (positive number)
   - type ('credit' or 'debit')
   - description (string)
   - balance (number or null) - the running balance AFTER this transaction, if available in the statement
3. Only use these built-ins: String, Number, Date, RegExp, Math, Array, Object, JSON, parseInt, parseFloat
4. NO imports, require, fetch, process, Bun, setTimeout, setInterval
5. Use regex and string methods for deterministic parsing
6. Handle multi-line descriptions if present
7. Skip summary rows, headers, totals, and opening/closing balance lines
8. Return empty array if no transactions found
9. IMPORTANT: Do not redeclare variables. Use unique variable names or reuse existing ones.

=== CRITICAL - DATE YEAR EXTRACTION ===
Many statements show dates WITHOUT the year (e.g., "November 26", "Dec 12", "12 Nov").
You MUST extract the year from the STATEMENT PERIOD at the top of the document.

STEP 1: Find the statement period (look for patterns like):
- "Statement Period: 26 Nov 2024 to 26 Dec 2024"
- "Statement Period From 27 Nov, 2024 to 26 Dec, 2024"
- "Period: 01/11/2024 - 30/11/2024"
- "From 01-Nov-24 To 30-Nov-24"

STEP 2: Extract the year(s) from the statement period
const periodMatch = text.match(/statement\\s*period[^\\d]*(\\d{4})[^\\d]*(\\d{4})?/i);
const statementYear = periodMatch ? parseInt(periodMatch[2] || periodMatch[1]) : new Date().getFullYear();

STEP 3: Handle year boundary (statements spanning Dec-Jan)
If statement period spans two years (e.g., "26 Dec 2024 to 25 Jan 2025"):
- December transactions → use the earlier year (2024)
- January transactions → use the later year (2025)

Example code for handling year:
// Extract statement period year(s)
let startYear, endYear;
const periodMatch = text.match(/(?:statement\\s*period|period|from)[^\\d]*(\\d{1,2})[^\\d]*(\\w+)[^\\d]*(\\d{4})[^\\d]*(?:to|-)[^\\d]*(\\d{1,2})[^\\d]*(\\w+)[^\\d]*(\\d{4})/i);
if (periodMatch) {
  startYear = parseInt(periodMatch[3]);
  endYear = parseInt(periodMatch[6]);
} else {
  // Fallback: try to find any 4-digit year near "statement" or "period"
  const yearMatch = text.match(/(?:statement|period)[^\\d]*\\d{1,2}[^\\d]*\\w+[^\\d]*(\\d{4})/i);
  startYear = endYear = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
}

// When parsing a transaction date like "November 26" or "Dec 12":
function getYearForMonth(monthName) {
  const month = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
    .indexOf(monthName.toLowerCase().substring(0,3));
  // If December and we have two different years, use startYear
  // If January and we have two different years, use endYear
  if (month === 11) return startYear; // December
  if (month === 0 && startYear !== endYear) return endYear; // January in cross-year statement
  return endYear; // Default to end year
}

=== CRITICAL - RETURN STATEMENT REQUIRED ===
Your code MUST end with an explicit return statement that returns the transactions array.
DO NOT use implicit returns. DO NOT forget the return statement.

CORRECT:
const transactions = [];
// ... parsing logic ...
return transactions;  // ← REQUIRED!

WRONG (will cause "undefined" error):
const transactions = [];
// ... parsing logic ...
transactions;  // ← WRONG! Missing 'return'

=== CRITICAL - CREDIT VS DEBIT DETECTION ===
This is the most important part. You MUST correctly identify whether each transaction is a credit (money IN) or debit (money OUT).

DETECTION METHOD 1 - EXPLICIT CR/DR INDICATORS (HIGHEST PRIORITY):
If the statement has explicit "CR" or "DR" markers, ALWAYS use them:
- "CR" = credit (money IN)
- "DR" = debit (money OUT)
Look for patterns like: "200.0 DR", "1870.0 CR", or a Type column with CR/DR values.

DETECTION METHOD 2 - SEPARATE COLUMNS:
If the statement has separate Withdrawal/Deposit or Debit/Credit columns:
- Value in Withdrawal/Debit column = debit
- Value in Credit/Deposit column = credit

DETECTION METHOD 3 - BALANCE-BASED DETECTION (when no CR/DR markers exist):
When there's no explicit CR/DR indicator, you MUST use the running balance to determine type.

STEP 1: DETERMINE TRANSACTION ORDER
First, check if transactions are listed in ASCENDING (oldest first) or DESCENDING (newest first) order:
- Look at the first few transaction dates and last few transaction dates
- If first date < last date → ASCENDING order (oldest first) - most common
- If first date > last date → DESCENDING order (newest first)

STEP 2: UNDERSTAND THE BALANCE FORMULA
For each transaction row, there's typically: Date, Description, Amount, Balance
The balance shown is the balance AFTER that transaction.

For ASCENDING order (oldest first, most common):
  balance_after = balance_before + credit_amount - debit_amount

  So: if (balance_after > balance_before) → CREDIT
      if (balance_after < balance_before) → DEBIT

  In code: type = (currentBalance > previousBalance) ? 'credit' : 'debit';

For DESCENDING order (newest first):
  When reading top-to-bottom, you're going backwards in time.
  The "previous" row (above) is actually a LATER transaction.

  So: if (currentBalance < previousBalance) → CREDIT  (going back, balance was lower before this deposit)
      if (currentBalance > previousBalance) → DEBIT   (going back, balance was higher before this withdrawal)

  In code: type = (currentBalance < previousBalance) ? 'credit' : 'debit';

STEP 3: HANDLE FIRST TRANSACTION
The first transaction has no previous balance to compare. Options:
a) Use Opening Balance from statement header if available
b) Skip type detection for first transaction and infer later
c) Use the expected summary counts to determine the type

COMPLETE EXAMPLE - Balance-based detection (ASCENDING order):
const transactions = [];
const lines = text.split('\\n');
let previousBalance = null;

// Try to find opening balance first
const openingMatch = text.match(/opening\\s*balance[:\\s]+([\\d,]+\\.\\d{2})/i);
if (openingMatch) {
  previousBalance = parseFloat(openingMatch[1].replace(/,/g, ''));
}

for (const line of lines) {
  // Match date at start of line (adjust pattern for your format)
  const dateMatch = line.match(/^(\\d{2}[\\/-]\\d{2}[\\/-]\\d{2,4})/);
  if (!dateMatch) continue;

  // Skip summary/header lines
  if (/opening|closing|balance\\s*b\\/f|total|summary/i.test(line)) continue;

  // Extract all amounts from the line
  const amounts = line.match(/[\\d,]+\\.\\d{2}/g) || [];
  if (amounts.length < 2) continue;  // Need at least amount + balance

  // Usually: last amount is balance, second-to-last is transaction amount
  const currentBalance = parseFloat(amounts[amounts.length - 1].replace(/,/g, ''));
  const txnAmount = parseFloat(amounts[amounts.length - 2].replace(/,/g, ''));

  // Determine type from balance change (ASCENDING order)
  let type = 'debit';  // default
  if (previousBalance !== null) {
    type = (currentBalance > previousBalance) ? 'credit' : 'debit';
  }

  // Extract description (text between date and first amount)
  const desc = line.substring(dateMatch[0].length).replace(/[\\d,]+\\.\\d{2}/g, '').trim();

  transactions.push({
    date: formatDate(dateMatch[1]),  // implement formatDate to convert to YYYY-MM-DD
    amount: txnAmount,
    type,
    description: desc,
    balance: currentBalance  // Include the running balance after this transaction
  });

  previousBalance = currentBalance;
}

return transactions;

IMPORTANT TIPS:
- NEVER rely on keywords like "UPI", "transfer", "payment" to determine type - these can be either credit or debit!
- The balance column is your most reliable indicator when no CR/DR markers exist
- Verify your logic by checking: opening_balance + total_credits - total_debits = closing_balance
- If validation fails, re-examine your balance comparison logic and transaction order assumption

WORKFLOW:
1. Scan the statement for CR/DR markers or separate debit/credit columns
2. If found, use those (Method 1 or 2)
3. If not found, determine transaction order (ascending/descending)
4. Implement balance-based detection (Method 3)
5. Submit code and check validation results
6. If validation fails, the issue is likely:
   - Wrong transaction order assumption (try flipping the comparison)
   - Including summary/total rows as transactions
   - Wrong column identification for balance vs amount`

/**
 * Base system prompt for CSV/XLSX (spreadsheet) code generation
 * CSV/XLSX data is already structured, making parsing much easier
 */
const SPREADSHEET_BASE_SYSTEM_PROMPT = `You are a bank statement parsing expert. Generate JavaScript code to extract transactions from CSV/spreadsheet bank statement data.

IMPORTANT: The input is structured CSV data (comma-separated or converted from Excel), NOT raw PDF text.
This is MUCH EASIER to parse than PDF - the data is already in columns!

RULES:
1. The code must be a function body (no function declaration) that:
   - Receives the full CSV text as a variable named 'text'
   - MUST return an array of transaction objects using an explicit 'return' statement
2. Each transaction must have:
   - date (YYYY-MM-DD string)
   - amount (positive number)
   - type ('credit' or 'debit')
   - description (string)
   - balance (number or null) - the running balance AFTER this transaction, if available
3. Only use these built-ins: String, Number, Date, RegExp, Math, Array, Object, JSON, parseInt, parseFloat
4. NO imports, require, fetch, process, Bun, setTimeout, setInterval
5. Use simple string splitting and array operations for deterministic parsing
6. Return empty array if no transactions found
7. IMPORTANT: Do not redeclare variables. Use unique variable names or reuse existing ones.

=== CSV PARSING STRATEGY ===
1. Split by newlines to get rows: text.split('\\n')
2. Skip header row(s) - first 1-3 rows are usually headers
3. Split each row by comma: row.split(',')
4. Map column indices to fields

=== HANDLING QUOTED VALUES ===
CSV files often have quoted values with commas inside. Simple approach:
- If you see a quote, find the closing quote
- Or use a simple state machine to handle quotes

EXAMPLE CODE for CSV with columns: Date, Description, Debit, Credit, Balance
const transactions = [];
const lines = text.split('\\n');

// Find the header row and column indices
let headerIndex = 0;
for (let i = 0; i < Math.min(5, lines.length); i++) {
  if (lines[i].toLowerCase().includes('date') && lines[i].toLowerCase().includes('balance')) {
    headerIndex = i;
    break;
  }
}

// Parse each data row (skip header)
for (let i = headerIndex + 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  // Simple CSV split (handle quoted values if needed)
  const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));

  // Assuming: Date, Description, Debit, Credit, Balance
  const dateStr = cols[0];
  const description = cols[1] || '';
  const debit = parseFloat(cols[2]?.replace(/,/g, '')) || 0;
  const credit = parseFloat(cols[3]?.replace(/,/g, '')) || 0;
  const balance = parseFloat(cols[4]?.replace(/,/g, '')) || null;

  // Determine type and amount
  let type, amount;
  if (debit > 0) {
    type = 'debit';
    amount = debit;
  } else if (credit > 0) {
    type = 'credit';
    amount = credit;
  } else {
    continue; // Skip rows with no amount
  }

  // Parse date to YYYY-MM-DD
  // (implement date parsing based on the format you see)
  const date = formatDate(dateStr);
  if (!date) continue;

  transactions.push({ date, amount, type, description, balance });
}

return transactions;

=== CREDIT/DEBIT DETECTION FOR CSV ===
Most CSV bank exports have one of these patterns:

PATTERN 1 - Separate Debit/Credit columns:
Date, Description, Withdrawal, Deposit, Balance
→ If Withdrawal has value → debit, If Deposit has value → credit

PATTERN 2 - Single Amount column with Type indicator:
Date, Description, Amount, Type, Balance
→ Use the Type column (often "DR"/"CR" or "Debit"/"Credit")

PATTERN 3 - Signed Amount:
Date, Description, Amount, Balance
→ Negative amount = debit, Positive amount = credit (or vice versa based on convention)

PATTERN 4 - Balance-based (if no type indicator):
Use balance comparison like PDF parsing:
→ Balance increased = credit, Balance decreased = debit

=== IMPORTANT TIPS ===
- FIRST: Examine the header row to understand column positions
- Look for columns with names like: "Debit", "Credit", "Withdrawal", "Deposit", "Dr", "Cr", "Amount"
- Skip summary rows (usually have "Total", "Balance B/F", "Opening", "Closing")
- Handle different date formats (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD-Mon-YY)`

/**
 * Institution-specific parsing hints for PDFs
 * Only added to prompt when the institution is detected
 */
const INSTITUTION_HINTS: Record<string, string> = {
  HDFC: `
HDFC BANK STATEMENT SPECIFIC FORMAT:
1. TRANSACTION ORDER: Usually ASCENDING (oldest first) - verify by checking dates
2. NO CR/DR MARKERS: HDFC statements typically don't have CR/DR indicators
3. COLUMNS: Date | Narration | Chq./Ref.No. | Value Dt | Withdrawal Amt | Deposit Amt | Closing Balance
   - Sometimes shown as: Date | Narration | Withdrawal | Deposit | Balance
4. BALANCE-BASED DETECTION: Use the Closing Balance column to determine type:
   - If balance INCREASED from previous row → CREDIT (Deposit)
   - If balance DECREASED from previous row → DEBIT (Withdrawal)
5. FIRST TRANSACTION: Look for "Opening Balance" or "B/F" (Brought Forward) line to get starting balance
6. SKIP THESE LINES:
   - "Opening Balance" / "OPENING BALANCE" / "Balance B/F"
   - "Closing Balance" / "CLOSING BALANCE"
   - "STATEMENT SUMMARY" section
   - Any line with "Total" in it
7. DATE FORMAT: Usually DD/MM/YY or DD/MM/YYYY or DD-MMM-YY (like 01-Apr-24)
8. IMPORTANT: Some HDFC statements have Withdrawal and Deposit as separate columns. If you see two amount columns before the balance, use those directly instead of balance comparison.

=== HDFC CREDIT CARD STATEMENT SPECIFIC ===
9. EMI ELIGIBILITY PREFIX: In HDFC credit card statements, transactions above ₹3000 may have "EMI" written at the START of the transaction description.
   - This "EMI" prefix means the transaction is ELIGIBLE for EMI conversion, NOT an actual EMI payment
   - ONLY strip the "EMI " prefix at the BEGINNING of the description, do NOT remove "EMI" from middle of text
   - Use: description.replace(/^EMI\\s+/i, '') to strip only the leading "EMI " prefix
   - Example: "EMI AMAZON RETAIL INDIA" → "AMAZON RETAIL INDIA"
   - Example: "EMI SwiggyBengaluru" → "SwiggyBengaluru"
   - But keep "EMI" if it's part of the merchant name or in the middle of text
`,
  AMEX: `
AMERICAN EXPRESS SPECIFIC FORMAT:

1. DATE FORMAT - CRITICAL:
   AMEX shows dates as "Month Day" WITHOUT year (e.g., "November 22", "December 12").
   You MUST extract the year from the statement period header!

   Look for: "Statement Period From 27 Nov, 2024 to 26 Dec, 2024"
   Extract the year(s) and apply to transactions based on month:

   // Extract years from statement period
   const periodMatch = text.match(/Statement\\s*Period\\s*From\\s*\\d+\\s*\\w+,?\\s*(\\d{4})\\s*to\\s*\\d+\\s*\\w+,?\\s*(\\d{4})/i);
   const startYear = periodMatch ? parseInt(periodMatch[1]) : new Date().getFullYear();
   const endYear = periodMatch ? parseInt(periodMatch[2]) : startYear;

   // For cross-year statements (Nov-Dec 2024 to Jan 2025):
   // - November/December transactions → startYear (2024)
   // - January transactions → endYear (2025)

2. CR/DR INDICATOR: On the NEXT LINE after the transaction, not on same line!
   Example:
   "November 22 PAYMENT RECEIVED. THANK YOU 197,606.00"
   "Card Number XXXX-XXXXXX-01009 CR"  <-- CR is here!

3. SKIP THESE SUMMARY LINES (they have amounts but are NOT transactions):
   - "New domestic transactions for [NAME] [AMOUNT]"
   - "New overseas transactions for [NAME] [AMOUNT]"
   - "TOTAL OVERSEAS SPEND IN CURRENT MONTH [AMOUNT]"
   - Lines with "Opening Balance", "Closing Balance", "Credit Limit"

4. TRANSACTION AMOUNT: The last decimal number on the transaction line (before any currency code)
   For overseas: "RAILWAY SAN FRANCISCO 10.71 998.38" - amount is 998.38 (INR), 10.71 is foreign currency

5. LOOK AHEAD FOR CR: After finding a transaction line, check the next 1-2 lines for "CR" to determine if credit:
   const combinedText = line + ' ' + (lines[i+1] || '') + ' ' + (lines[i+2] || '');
   const type = /\\bCR\\b/.test(combinedText) ? 'credit' : 'debit';

EXAMPLE DATE PARSING FOR AMEX:
const months = {january:0, february:1, march:2, april:3, may:4, june:5, july:6, august:7, september:8, october:9, november:10, december:11};

function parseAmexDate(dateStr) {
  // dateStr like "November 26" or "December 12"
  const match = dateStr.match(/(\\w+)\\s+(\\d+)/);
  if (!match) return null;
  const monthName = match[1].toLowerCase();
  const day = parseInt(match[2]);
  const month = months[monthName];
  if (month === undefined) return null;

  // Use correct year based on month
  const year = (month >= 10) ? startYear : endYear; // Nov, Dec use startYear
  return \`\${year}-\${String(month + 1).padStart(2, '0')}-\${String(day).padStart(2, '0')}\`;
}
`,
}

/**
 * Get the full system prompt, with institution-specific hints if applicable
 */
function getSystemPrompt(
  institutionId?: string,
  expectedSummary?: ExpectedSummary,
  fileType: FileType = 'pdf'
): string {
  // Use appropriate base prompt based on file type
  const isSpreadsheet = fileType === 'csv' || fileType === 'xlsx'
  let prompt = isSpreadsheet ? SPREADSHEET_BASE_SYSTEM_PROMPT : PDF_BASE_SYSTEM_PROMPT

  // Add institution hints only for PDF (they're PDF-specific formats)
  if (!isSpreadsheet) {
    const hints = institutionId ? INSTITUTION_HINTS[institutionId.toUpperCase()] : undefined
    if (hints) {
      prompt += '\n\n' + hints
    }
  }

  // Add validation context if we have expected summary
  if (expectedSummary && hasValidationData(expectedSummary)) {
    prompt += `

VALIDATION REQUIREMENT:
The statement has a printed summary that we will use to verify your parser's accuracy.
Expected values from statement summary:
${expectedSummary.debitCount !== null ? `- Debit count: ${expectedSummary.debitCount}` : ''}
${expectedSummary.creditCount !== null ? `- Credit count: ${expectedSummary.creditCount}` : ''}
${expectedSummary.totalDebits !== null ? `- Total debits: ${expectedSummary.totalDebits}` : ''}
${expectedSummary.totalCredits !== null ? `- Total credits: ${expectedSummary.totalCredits}` : ''}
${expectedSummary.openingBalance !== null ? `- Opening balance: ${expectedSummary.openingBalance}` : ''}
${expectedSummary.closingBalance !== null ? `- Closing balance: ${expectedSummary.closingBalance}` : ''}

After submitting code, you will see how your extracted totals compare to these expected values.
If there's a mismatch, investigate why and fix your code. Common issues:
- Including summary/total rows as transactions
- Missing transactions (check regex patterns)
- Wrong credit/debit classification
- Counting header rows`
  }

  return prompt
}

/**
 * Check if we have any validation data
 */
function hasValidationData(summary: ExpectedSummary): boolean {
  return (
    summary.debitCount !== null ||
    summary.creditCount !== null ||
    summary.totalDebits !== null ||
    summary.totalCredits !== null
  )
}

/**
 * Calculate totals from extracted transactions
 */
function calculateTotals(transactions: RawPdfTransaction[]): ExtractedTotals {
  let debitCount = 0
  let creditCount = 0
  let totalDebits = 0
  let totalCredits = 0

  for (const txn of transactions) {
    if (txn.type === 'debit') {
      debitCount++
      totalDebits += txn.amount
    } else {
      creditCount++
      totalCredits += txn.amount
    }
  }

  return {
    debitCount,
    creditCount,
    totalDebits: Math.round(totalDebits * 100) / 100,
    totalCredits: Math.round(totalCredits * 100) / 100,
  }
}

/**
 * Compare extracted totals with expected summary
 * Returns validation result with details
 */
function validateTotals(
  extracted: ExtractedTotals,
  expected: ExpectedSummary
): { isValid: boolean; message: string; details: string[] } {
  const issues: string[] = []

  // Check debit count (exact match required)
  if (expected.debitCount !== null && extracted.debitCount !== expected.debitCount) {
    issues.push(
      `Debit count: extracted ${extracted.debitCount}, expected ${expected.debitCount} (diff: ${extracted.debitCount - expected.debitCount})`
    )
  }

  // Check credit count (exact match required)
  if (expected.creditCount !== null && extracted.creditCount !== expected.creditCount) {
    issues.push(
      `Credit count: extracted ${extracted.creditCount}, expected ${expected.creditCount} (diff: ${extracted.creditCount - expected.creditCount})`
    )
  }

  // Check total debits (tolerance allowed)
  if (expected.totalDebits !== null) {
    const diff = Math.abs(extracted.totalDebits - expected.totalDebits)
    if (diff > AMOUNT_TOLERANCE) {
      issues.push(
        `Total debits: extracted ${extracted.totalDebits}, expected ${expected.totalDebits} (diff: ${diff.toFixed(2)})`
      )
    }
  }

  // Check total credits (tolerance allowed)
  if (expected.totalCredits !== null) {
    const diff = Math.abs(extracted.totalCredits - expected.totalCredits)
    if (diff > AMOUNT_TOLERANCE) {
      issues.push(
        `Total credits: extracted ${extracted.totalCredits}, expected ${expected.totalCredits} (diff: ${diff.toFixed(2)})`
      )
    }
  }

  if (issues.length === 0) {
    return {
      isValid: true,
      message: 'All validation checks passed!',
      details: [],
    }
  }

  return {
    isValid: false,
    message: `Validation failed with ${issues.length} issue(s)`,
    details: issues,
  }
}

/**
 * Truncate PDF text for LLM context
 */
function truncatePdfText(pdfText: string): string {
  const maxTextLength = 80000
  if (pdfText.length <= maxTextLength) return pdfText

  logger.warn(`[PDFParser] Text truncated from ${pdfText.length} to ${maxTextLength} chars`)
  return pdfText.slice(0, maxTextLength) + '\n\n[...TEXT TRUNCATED...]'
}

/**
 * Result from agentic code generation
 */
export interface AgenticParserResult {
  code: string
  detectedFormat: string
  dateFormat: string
  confidence: number
  attempts: number
  finalError?: string
  /** Transactions from the successful test run (avoids re-running parser) */
  transactions?: Array<{
    date: string
    amount: number
    type: 'credit' | 'debit'
    description: string
  }>
}

/**
 * Generate parser code using ToolLoopAgent with agentic retry
 * Agent generates code, tests it via tool, and fixes errors automatically
 * Includes validation against expected statement summary to catch parsing errors
 *
 * @param statementText - The full statement text to parse (PDF text, CSV, or converted XLSX)
 * @param modelOverride - Optional model override
 * @param institutionId - Optional institution ID for institution-specific hints (e.g., "AMEX", "HDFC")
 * @param expectedSummary - Optional expected summary from statement for validation
 * @param fileType - File type (pdf, csv, xlsx) - affects prompt and parsing strategy
 */
export async function generateParserCode(
  statementText: string,
  modelOverride?: string,
  institutionId?: string,
  expectedSummary?: ExpectedSummary,
  fileType: FileType = 'pdf'
): Promise<AgenticParserResult> {
  const isSpreadsheet = fileType === 'csv' || fileType === 'xlsx'
  const formatLabel = isSpreadsheet ? 'CSV/Spreadsheet' : 'PDF'

  logger.info(
    `[Parser] Generating parser code with agent, format: ${formatLabel}, text length: ${statementText.length} chars, institution: ${institutionId || 'unknown'}`
  )
  if (expectedSummary && hasValidationData(expectedSummary)) {
    logger.info(
      `[Parser] Validation enabled: expecting ${expectedSummary.debitCount} debits, ${expectedSummary.creditCount} credits`
    )
  }

  const model = await createLLMClientFromSettings(modelOverride)
  const truncatedText = truncatePdfText(statementText)
  const systemPrompt = getSystemPrompt(institutionId, expectedSummary, fileType)

  // Track state across tool calls
  let lastCode = ''
  let detectedFormat = 'Unknown'
  let dateFormat = 'Unknown'
  let confidence = 0.5
  let attempts = 0
  let lastError: string | undefined
  let lastSuccessfulTransactions: AgenticParserResult['transactions'] | undefined
  let validationPassed = false

  // Create the agent with tools
  const agent = new ToolLoopAgent({
    model,
    instructions: systemPrompt,
    tools: {
      // Tool for submitting and testing parser code
      submitCode: tool({
        description:
          'Submit parser code to test. Returns success with transaction count and validation results, or error message to fix.',
        inputSchema: z.object({
          parserCode: z
            .string()
            .describe('JavaScript function body that parses transactions from text'),
          detectedFormat: z
            .string()
            .describe('Bank/statement format identified (e.g., "HDFC Bank Statement")'),
          dateFormat: z.string().describe('Date format pattern found (e.g., "DD-MMM-YYYY")'),
          confidence: z.number().min(0).max(1).describe('Confidence in the parsing approach'),
        }),
        execute: async ({ parserCode, detectedFormat: fmt, dateFormat: df, confidence: conf }) => {
          attempts++
          lastCode = parserCode
          detectedFormat = fmt
          dateFormat = df
          confidence = conf

          logger.info(`[PDFParser] Testing code attempt ${attempts}, format: ${fmt}`)
          logger.debug(`[PDFParser] Code:\n${parserCode}`)

          // Test the code using the same executor we'll use in production
          const result = await runParser(parserCode, statementText)

          if (result.success && result.transactions && result.transactions.length > 0) {
            lastSuccessfulTransactions = result.transactions
            logger.info(`[PDFParser] Code works! Found ${result.transactions.length} transactions`)

            // Calculate extracted totals
            const extractedTotals = calculateTotals(result.transactions)

            // Show sample transactions so agent can verify correctness
            const samples = result.transactions.slice(0, 5)
            const sampleStr = samples
              .map(
                (t) =>
                  `  ${t.date} | ${t.type.padEnd(6)} | ${String(t.amount).padStart(10)} | ${t.description.slice(0, 40)}`
              )
              .join('\n')

            // Build response with extraction summary
            let response = `SUCCESS: Found ${result.transactions.length} transactions.

EXTRACTED TOTALS:
- Debit count: ${extractedTotals.debitCount}
- Credit count: ${extractedTotals.creditCount}
- Total debits: ${extractedTotals.totalDebits}
- Total credits: ${extractedTotals.totalCredits}

Sample transactions:
${sampleStr}
`

            // Validate against expected summary if available
            if (expectedSummary && hasValidationData(expectedSummary)) {
              const validation = validateTotals(extractedTotals, expectedSummary)

              if (validation.isValid) {
                validationPassed = true
                lastError = undefined
                response += `
VALIDATION: ✅ PASSED - All totals match the statement summary!
You can now call the 'done' tool.`
                logger.info(`[PDFParser] Validation passed!`)
              } else {
                validationPassed = false
                lastError = validation.message

                // Analyze the mismatch to give specific guidance
                const totalTxnCount = extractedTotals.debitCount + extractedTotals.creditCount
                const expectedTotalCount =
                  (expectedSummary.debitCount || 0) + (expectedSummary.creditCount || 0)
                const countMatch = totalTxnCount === expectedTotalCount
                const debitCountDiff =
                  extractedTotals.debitCount - (expectedSummary.debitCount || 0)

                let guidance = ''
                if (countMatch && debitCountDiff !== 0) {
                  // Total count matches but debit/credit split is wrong
                  guidance = `
DIAGNOSIS: Total transaction count is correct (${totalTxnCount}), but credit/debit classification is wrong.
${debitCountDiff > 0 ? `You're marking ${debitCountDiff} extra transactions as DEBIT that should be CREDIT.` : `You're marking ${-debitCountDiff} extra transactions as CREDIT that should be DEBIT.`}

LIKELY CAUSE: Your balance comparison logic is inverted.
FIX: If using balance-based detection, try flipping the comparison:
  - If you have: type = (currentBalance > previousBalance) ? 'credit' : 'debit'
  - Try: type = (currentBalance > previousBalance) ? 'debit' : 'credit'
  OR you may have the transaction order wrong (ascending vs descending dates).`
                } else if (!countMatch) {
                  guidance = `
DIAGNOSIS: Transaction count mismatch. You found ${totalTxnCount} but expected ${expectedTotalCount}.
${
  totalTxnCount > expectedTotalCount
    ? `You have ${totalTxnCount - expectedTotalCount} extra transactions - likely including summary/header rows.`
    : `You're missing ${expectedTotalCount - totalTxnCount} transactions - your regex may be too strict.`
}

FIX:
- Check for and skip lines containing: "Opening Balance", "Closing Balance", "Total", "Summary", "B/F"
- Make sure your date regex matches all transaction date formats in the statement`
                }

                response += `
VALIDATION: ❌ FAILED - Totals don't match the statement summary!

EXPECTED (from statement summary):
- Debit count: ${expectedSummary.debitCount}
- Credit count: ${expectedSummary.creditCount}
- Total debits: ${expectedSummary.totalDebits}
- Total credits: ${expectedSummary.totalCredits}

YOUR EXTRACTED:
- Debit count: ${extractedTotals.debitCount}
- Credit count: ${extractedTotals.creditCount}
- Total debits: ${extractedTotals.totalDebits}
- Total credits: ${extractedTotals.totalCredits}
${guidance}

Please fix the code and call submitCode again.`
                logger.warn(`[PDFParser] Validation failed: ${validation.details.join(', ')}`)
              }
            } else {
              // No validation data - just check if it looks reasonable
              validationPassed = true
              lastError = undefined
              response += `
No statement summary available for validation.
If these look correct (amounts, credit/debit types, descriptions), call the 'done' tool.
If something looks wrong (e.g., summary lines included, wrong amounts), fix the code and resubmit.`
            }

            return response
          } else {
            const error = result.error || 'No transactions found - check your regex patterns'
            lastError = error
            validationPassed = false
            logger.warn(`[PDFParser] Code failed: ${error}`)
            return `ERROR: ${error}\n\nPlease fix the code and call submitCode again.`
          }
        },
      }),

      // Tool to signal completion
      done: tool({
        description:
          'Call this when the parser code is working AND validation has passed (or no validation data is available).',
        inputSchema: z.object({
          summary: z.string().describe('Brief summary of what the parser does'),
        }),
        // No execute function - this stops the loop
      }),
    },
    stopWhen: [stepCountIs(MAX_STEPS), hasToolCall('done')],
  })

  const dataTypeDescription = isSpreadsheet
    ? 'This is CSV/spreadsheet data (structured, comma-separated). Parsing should be straightforward - split by lines and commas.'
    : 'This is PDF-extracted text. Use regex patterns to find and parse transaction rows.'

  const userPrompt = `Analyze this bank/credit card statement and generate JavaScript code to parse all transactions.

FILE FORMAT: ${formatLabel}
${dataTypeDescription}

STATEMENT DATA:
---
${truncatedText}
---

Generate a function body that extracts all transactions from this specific format.
The code receives 'text' variable and must return array of: { date: 'YYYY-MM-DD', amount: number, type: 'credit'|'debit', description: string, balance: number|null }

Use the submitCode tool to test your code. If it fails or validation fails, fix and resubmit. When working AND validated, call done.`

  try {
    const result = await agent.generate({
      prompt: userPrompt,
    })

    logger.info(
      `[PDFParser] Agent completed in ${attempts} attempt(s), validation: ${validationPassed ? 'passed' : 'failed/skipped'}`
    )
    logger.debug(`[PDFParser] Final result steps: ${result.steps.length}`)

    // Return the result including transactions from successful test run
    return {
      code: lastCode,
      detectedFormat,
      dateFormat,
      confidence,
      attempts,
      finalError: lastError,
      transactions: lastSuccessfulTransactions,
    }
  } catch (error) {
    logger.error(`[PDFParser] Agent error:`, error)
    throw error
  }
}

// Legacy export for compatibility - just wraps the new function
export { generateParserCode as generateParserCodeWithRetry }
