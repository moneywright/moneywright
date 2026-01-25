/**
 * LLM-based parser code generation for investment statements (PDF, CSV, XLSX)
 * Uses ToolLoopAgent for agentic retry: if code execution fails, agent sees error and fixes it
 * Includes validation against statement summary to catch parsing errors
 */

import { ToolLoopAgent, tool, stepCountIs, hasToolCall } from 'ai'
import { z } from 'zod'
import { createLLMClientFromSettings } from '../../llm'
import { logger } from '../logger'
import { runParser } from './execute-parser'
import type { InvestmentSourceType } from '../../llm/schemas'
import type { FileType } from '../constants'

/**
 * Maximum retry attempts for fixing code errors
 */
const MAX_STEPS = 8

/**
 * Tolerance for amount comparison (to handle rounding differences)
 */
const AMOUNT_TOLERANCE = 100

/**
 * Raw holding from parser
 */
export interface RawInvestmentHolding {
  investment_type: string
  symbol: string | null
  name: string
  isin: string | null
  units: number | null // null for balance-based holdings like PPF, EPF, FD
  average_cost: number | null
  current_price: number | null
  current_value: number
  invested_value: number | null
  folio_number: string | null
  maturity_date: string | null
  interest_rate: number | null
  currency: string | null // ISO currency code (USD, INR, etc.) - null uses source default
}

/**
 * Expected summary for validation
 */
export interface ExpectedInvestmentSummary {
  totalInvested: number | null
  totalCurrent: number | null
  holdingsCount: number | null
}

/**
 * Extracted totals for validation
 */
export interface ExtractedInvestmentTotals {
  totalInvested: number
  totalCurrent: number
  holdingsCount: number
}

/**
 * Base system prompt for investment PDF code generation
 */
const PDF_BASE_SYSTEM_PROMPT = `You are an investment statement parsing expert. Generate JavaScript code to extract holdings from investment/portfolio statement PDF text.

IMPORTANT RULES:
1. The code must be a function body (no function declaration) that:
   - Receives the full text as a variable named 'text'
   - MUST return an array of holding objects using an explicit 'return' statement
2. Each holding must have:
   - investment_type: 'stock' | 'mutual_fund' | 'etf' | 'bond' | 'ppf' | 'epf' | 'nps' | 'fd' | 'gold' | 'reit' | 'other'
   - symbol: string | null (stock ticker, scheme code)
   - name: string (full name of instrument)
   - isin: string | null (ISIN code if available)
   - units: number | null (quantity held - MUST be null for balance-based holdings like PPF, EPF, FD)
   - average_cost: number | null (cost per unit)
   - current_price: number | null (current NAV/price per unit)
   - current_value: number (total current market value)
   - invested_value: number | null (total cost basis)
   - folio_number: string | null (for mutual funds)
   - maturity_date: string | null (YYYY-MM-DD for FD/bonds)
   - interest_rate: number | null (for FD, PPF)
   - currency: string | null (ISO currency code like 'USD', 'INR' - detect from statement)

CRITICAL - CURRENCY DETECTION:
- Look for currency symbols: $ (USD), ₹ (INR), € (EUR), £ (GBP)
- Look for currency codes: USD, INR, EUR, GBP
- US brokers (Vested, Stockal, INDmoney US stocks): currency = 'USD'
- Indian brokers (Zerodha, Groww, MF Central): currency = 'INR'
- If currency is clearly indicated in the statement, output it. Otherwise, set to null.

CRITICAL - UNITS FIELD RULES:
- For stocks, mutual funds, ETFs, bonds, gold: units = actual quantity/shares held (a number)
- For PPF, EPF, FD, NPS balance accounts: units = null (these track balances, NOT units)
- NEVER use units = 1 as a placeholder! If the investment doesn't have tradeable units, set units = null
3. Only use these built-ins: String, Number, Date, RegExp, Math, Array, Object, JSON, parseInt, parseFloat
4. NO imports, require, fetch, process, Bun, setTimeout, setInterval
5. Use regex and string methods for deterministic parsing
6. Skip summary rows, headers, totals, and footer lines
7. Return empty array if no holdings found
8. IMPORTANT: Do not redeclare variables. Use unique variable names or reuse existing ones.

=== CRITICAL - RETURN STATEMENT REQUIRED ===
Your code MUST end with an explicit return statement that returns the holdings array.

CORRECT:
const holdings = [];
// ... parsing logic ...
return holdings;  // ← REQUIRED!

WRONG (will cause "undefined" error):
const holdings = [];
// ... parsing logic ...
holdings;  // ← WRONG! Missing 'return'

=== INVESTMENT TYPE DETECTION ===
Determine investment_type based on context:
- 'stock': Individual stocks, equity shares
- 'mutual_fund': Mutual fund schemes, NAV-based investments
- 'etf': Exchange traded funds
- 'bond': Government bonds, corporate bonds, SGBs
- 'ppf': Public Provident Fund
- 'epf': Employee Provident Fund
- 'nps': National Pension System
- 'fd': Fixed Deposits
- 'gold': Gold investments, gold bonds
- 'reit': Real Estate Investment Trusts
- 'other': Any other type

=== VALUE CALCULATIONS ===
- current_value = units × current_price (if both available)
- invested_value = units × average_cost (if both available)
- If only total values are shown without per-unit prices, use those directly

=== HANDLING DIFFERENT FORMATS ===
1. Tabular format: Parse table rows, identify columns for name, units, value, etc.
2. Transaction-based: Aggregate buy transactions to get holdings
3. Summary format: Extract totals, may not have per-holding breakdown

=== COMMON PATTERNS ===
1. Zerodha holdings: Table with Stock/ETF, Qty, Avg. cost, LTP, Cur. val, P&L, Net chg.
2. Groww portfolio: Card-based with scheme name, invested, current value, returns
3. MF Central CAS: Folio-wise breakdown with scheme, units, NAV, value
4. PPF passbook: Running balance with yearly contributions and interest
5. EPF passbook: Employee/employer contributions, interest credited`

/**
 * Base system prompt for investment CSV/XLSX (spreadsheet) code generation
 * CSV/XLSX data is already structured, making parsing much easier
 */
const SPREADSHEET_BASE_SYSTEM_PROMPT = `You are an investment statement parsing expert. Generate JavaScript code to extract holdings from investment/portfolio CSV or spreadsheet data.

IMPORTANT: The input is structured CSV data (comma-separated or converted from Excel), NOT raw PDF text.
This is MUCH EASIER to parse than PDF - the data is already in columns!

RULES:
1. The code must be a function body (no function declaration) that:
   - Receives the full CSV text as a variable named 'text'
   - MUST return an array of holding objects using an explicit 'return' statement
2. Each holding must have:
   - investment_type: 'stock' | 'mutual_fund' | 'etf' | 'bond' | 'ppf' | 'epf' | 'nps' | 'fd' | 'gold' | 'reit' | 'other'
   - symbol: string | null (stock ticker, scheme code)
   - name: string (full name of instrument)
   - isin: string | null (ISIN code if available)
   - units: number | null (quantity held - MUST be null for balance-based holdings like PPF, EPF, FD)
   - average_cost: number | null (cost per unit)
   - current_price: number | null (current NAV/price per unit)
   - current_value: number (total current market value)
   - invested_value: number | null (total cost basis)
   - folio_number: string | null (for mutual funds)
   - maturity_date: string | null (YYYY-MM-DD for FD/bonds)
   - interest_rate: number | null (for FD, PPF)
   - currency: string | null (ISO currency code like 'USD', 'INR' - detect from statement)

CRITICAL - CURRENCY DETECTION:
- Look for currency columns, symbols ($, ₹, €, £), or codes (USD, INR, EUR, GBP)
- US brokers (Vested, Stockal, INDmoney US stocks): currency = 'USD'
- Indian brokers (Zerodha, Groww, MF Central): currency = 'INR'
- If currency is clearly indicated in the statement, output it. Otherwise, set to null.

CRITICAL - UNITS FIELD RULES:
- For stocks, mutual funds, ETFs, bonds, gold: units = actual quantity/shares held (a number)
- For PPF, EPF, FD, NPS balance accounts: units = null (these track balances, NOT units)
- NEVER use units = 1 as a placeholder! If the investment doesn't have tradeable units, set units = null
3. Only use these built-ins: String, Number, Date, RegExp, Math, Array, Object, JSON, parseInt, parseFloat
4. NO imports, require, fetch, process, Bun, setTimeout, setInterval
5. Use simple string splitting and array operations
6. Return empty array if no holdings found
7. IMPORTANT: Do not redeclare variables.

=== CSV PARSING STRATEGY ===
1. Split by newlines to get rows: text.split('\\n')
2. Skip header row(s) - first 1-3 rows are usually headers
3. Split each row by comma: row.split(',')
4. Map column indices to fields based on header names

=== EXAMPLE CODE for CSV with columns: Symbol, Name, Qty, Avg Cost, LTP, Current Value, P&L ===
const holdings = [];
const lines = text.split('\\n');

// Find header row and map column positions
let headerIndex = 0;
let cols = {};
for (let i = 0; i < Math.min(5, lines.length); i++) {
  const line = lines[i].toLowerCase();
  if (line.includes('symbol') || line.includes('name') || line.includes('qty') || line.includes('value')) {
    headerIndex = i;
    const headers = lines[i].split(',').map(h => h.trim().toLowerCase());
    headers.forEach((h, idx) => {
      if (h.includes('symbol') || h.includes('ticker')) cols.symbol = idx;
      if (h.includes('name') || h.includes('instrument')) cols.name = idx;
      if (h.includes('qty') || h.includes('quantity') || h.includes('units')) cols.units = idx;
      if (h.includes('avg') && h.includes('cost')) cols.avgCost = idx;
      if (h.includes('ltp') || h.includes('price') || h.includes('nav')) cols.price = idx;
      if (h.includes('current') && h.includes('value')) cols.currentValue = idx;
      if (h.includes('invested') || h.includes('cost')) cols.investedValue = idx;
      if (h.includes('isin')) cols.isin = idx;
    });
    break;
  }
}

// Parse data rows
for (let i = headerIndex + 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const parts = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));

  const name = parts[cols.name] || '';
  if (!name || name.toLowerCase().includes('total')) continue;

  const units = parseFloat(parts[cols.units]?.replace(/,/g, '')) || 0;
  const currentValue = parseFloat(parts[cols.currentValue]?.replace(/,/g, '')) || 0;

  if (units <= 0 && currentValue <= 0) continue;

  holdings.push({
    investment_type: 'stock', // Adjust based on context
    symbol: parts[cols.symbol] || null,
    name,
    isin: parts[cols.isin] || null,
    units,
    average_cost: parseFloat(parts[cols.avgCost]?.replace(/,/g, '')) || null,
    current_price: parseFloat(parts[cols.price]?.replace(/,/g, '')) || null,
    current_value: currentValue,
    invested_value: parseFloat(parts[cols.investedValue]?.replace(/,/g, '')) || null,
    folio_number: null,
    maturity_date: null,
    interest_rate: null,
  });
}

return holdings;

=== INVESTMENT TYPE DETECTION FOR CSV ===
Determine investment_type from column headers or sheet name:
- "Stock", "Equity", "Share" → 'stock'
- "Mutual Fund", "MF", "Scheme" → 'mutual_fund'
- "ETF" → 'etf'
- "Bond", "Debenture", "SGB" → 'bond'
- "FD", "Fixed Deposit" → 'fd'
- If sheet name says "Holdings" from Zerodha/Groww → likely 'stock' or 'mutual_fund'

=== COMMON CSV EXPORT PATTERNS ===
1. Zerodha CSV: Symbol, ISIN, Qty, Avg. cost, LTP, Cur. val, P&L, Net chg, Day chg
2. Groww CSV: Name, Type, Qty/Units, Avg Cost, LTP/NAV, Current Value, Returns
3. MF Central CSV: AMC, Scheme Name, Folio, Units, NAV, Value
4. Generic broker: Usually has Name/Symbol, Quantity, Price, Value columns

=== IMPORTANT TIPS ===
- FIRST: Examine the header row to understand column positions
- Skip summary/total rows (check for "Total", "Grand Total", "Net")
- Handle quoted values if commas appear in names
- Parse numbers by removing commas: parseFloat(str.replace(/,/g, ''))`

/**
 * Source-specific parsing hints for PDFs
 */
const SOURCE_HINTS: Partial<Record<InvestmentSourceType, string>> = {
  zerodha: `
ZERODHA HOLDINGS FORMAT:
1. Look for "Holdings" or "Positions" section
2. TABLE COLUMNS: Stock/ETF | Qty | Avg. cost | LTP | Cur. val | P&L | Net chg. | Day chg.
3. investment_type: 'stock' for equities, 'etf' for ETFs
4. symbol: The stock ticker (e.g., "RELIANCE", "INFY")
5. ISIN may be in a separate column or linked
6. Skip header row and any summary/total rows
7. Amount format: Usually Indian format with commas (1,00,000.00)
`,
  groww: `
GROWW PORTFOLIO FORMAT:
1. May have both Stocks and Mutual Funds sections
2. MUTUAL FUNDS: Scheme name, Invested amount, Current value, Returns
3. STOCKS: Name, Qty, Avg price, LTP, Investment, Current value
4. Look for "Portfolio" or "Investments" heading
5. investment_type: 'mutual_fund' for MF, 'stock' for stocks
`,
  mf_central: `
MF CENTRAL / CAMS / KFINTECH CAS (Consolidated Account Statement) FORMAT:
1. Organized by AMC (Asset Management Company)
2. Each folio has: Folio Number, Scheme Name, Units, NAV, Current Value
3. Look for "Statement of Transactions" or "Account Statement"
4. investment_type: Always 'mutual_fund'
5. folio_number: Critical - extract for each holding
6. May show transaction history - aggregate to get final holdings
7. NAV date is usually mentioned - use as statement_date
`,
  ppf: `
PPF PASSBOOK FORMAT:
1. Single investment type: 'ppf'
2. Look for: Account Number, Balance, Interest Rate
3. Yearly entries with: Opening Balance, Deposits, Interest, Closing Balance
4. The latest Closing Balance is the current_value
5. Total deposits over years is invested_value
6. interest_rate: Usually 7-8% (varies by year)
7. maturity_date: 15 years from account opening
8. IMPORTANT: units MUST be null for PPF (it's a balance account, not unit-based)
`,
  epf: `
EPF PASSBOOK / UAN STATEMENT FORMAT:
1. Single investment type: 'epf'
2. Contains: Employee contribution, Employer contribution, Pension contribution
3. Interest credited yearly
4. The "Total Balance" or "Closing Balance" is current_value
5. Sum of all contributions is invested_value
6. May have multiple establishments (employers)
7. IMPORTANT: units MUST be null for EPF (it's a balance account, not unit-based)
`,
  nps: `
NPS STATEMENT FORMAT:
1. investment_type: 'nps'
2. May have Tier I and Tier II accounts (treat as separate holdings)
3. Shows: Units, NAV, Value for each fund
4. Different scheme options: E (Equity), C (Corporate), G (Government)
5. Sum of all scheme values is the total NPS value
`,
  vested: `
VESTED PORTFOLIO FORMAT:
1. US stocks held by Indian investors via Vested platform
2. investment_type: 'stock' or 'etf'
3. CRITICAL: All values are in USD (US Dollars) - set currency = 'USD' for ALL holdings
4. May show INR equivalent for reference but USE USD values
5. Look for: Symbol, Shares/Quantity, Avg Cost, Current Price, Market Value
6. Common US stocks: AAPL, GOOGL, MSFT, AMZN, NVDA, META, TSLA, etc.
`,
  fd: `
FIXED DEPOSIT STATEMENT FORMAT:
1. investment_type: 'fd'
2. Look for: Principal, Interest Rate, Tenure, Maturity Date, Maturity Value
3. current_value: Principal + accrued interest, or maturity value
4. invested_value: Principal amount
5. interest_rate: Annual rate (e.g., 7.1 for 7.1%)
6. maturity_date: In YYYY-MM-DD format
7. IMPORTANT: units MUST be null for FD (it's a balance-based investment, not unit-based)
`,
}

/**
 * Get the full system prompt with source-specific hints
 */
function getSystemPrompt(
  sourceType?: InvestmentSourceType,
  expectedSummary?: ExpectedInvestmentSummary,
  fileType: FileType = 'pdf'
): string {
  // Use appropriate base prompt based on file type
  const isSpreadsheet = fileType === 'csv' || fileType === 'xlsx'
  let prompt = isSpreadsheet ? SPREADSHEET_BASE_SYSTEM_PROMPT : PDF_BASE_SYSTEM_PROMPT

  // Add source hints only for PDF (they're PDF-specific formats)
  if (!isSpreadsheet) {
    const hints = sourceType ? SOURCE_HINTS[sourceType] : undefined
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
${expectedSummary.holdingsCount !== null ? `- Holdings count: ${expectedSummary.holdingsCount}` : ''}
${expectedSummary.totalInvested !== null ? `- Total invested: ${expectedSummary.totalInvested}` : ''}
${expectedSummary.totalCurrent !== null ? `- Total current value: ${expectedSummary.totalCurrent}` : ''}

After submitting code, you will see how your extracted totals compare to these expected values.
If there's a mismatch, investigate why and fix your code. Common issues:
- Including summary/header rows as holdings
- Missing holdings (check regex patterns)
- Wrong value extraction (units vs total value confusion)
- Duplicate holdings`
  }

  return prompt
}

/**
 * Check if we have any validation data
 */
function hasValidationData(summary: ExpectedInvestmentSummary): boolean {
  return (
    summary.holdingsCount !== null ||
    summary.totalInvested !== null ||
    summary.totalCurrent !== null
  )
}

/**
 * Calculate totals from extracted holdings
 */
function calculateTotals(holdings: RawInvestmentHolding[]): ExtractedInvestmentTotals {
  let totalInvested = 0
  let totalCurrent = 0

  for (const h of holdings) {
    totalCurrent += h.current_value || 0
    totalInvested += h.invested_value || 0
  }

  return {
    totalInvested: Math.round(totalInvested * 100) / 100,
    totalCurrent: Math.round(totalCurrent * 100) / 100,
    holdingsCount: holdings.length,
  }
}

/**
 * Compare extracted totals with expected summary
 */
function validateTotals(
  extracted: ExtractedInvestmentTotals,
  expected: ExpectedInvestmentSummary
): { isValid: boolean; message: string; details: string[] } {
  const issues: string[] = []

  // Check holdings count
  if (expected.holdingsCount !== null && extracted.holdingsCount !== expected.holdingsCount) {
    issues.push(
      `Holdings count: extracted ${extracted.holdingsCount}, expected ${expected.holdingsCount}`
    )
  }

  // Check total invested (tolerance allowed)
  if (expected.totalInvested !== null) {
    const diff = Math.abs(extracted.totalInvested - expected.totalInvested)
    if (diff > AMOUNT_TOLERANCE) {
      issues.push(
        `Total invested: extracted ${extracted.totalInvested}, expected ${expected.totalInvested} (diff: ${diff.toFixed(2)})`
      )
    }
  }

  // Check total current (tolerance allowed)
  if (expected.totalCurrent !== null) {
    const diff = Math.abs(extracted.totalCurrent - expected.totalCurrent)
    if (diff > AMOUNT_TOLERANCE) {
      issues.push(
        `Total current: extracted ${extracted.totalCurrent}, expected ${expected.totalCurrent} (diff: ${diff.toFixed(2)})`
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

  logger.debug(`[InvestmentParser] Text truncated from ${pdfText.length} to ${maxTextLength} chars`)
  return pdfText.slice(0, maxTextLength) + '\n\n[...TEXT TRUNCATED...]'
}

/**
 * Result from agentic code generation
 */
export interface AgenticInvestmentParserResult {
  code: string
  detectedFormat: string
  confidence: number
  attempts: number
  finalError?: string
  /** Holdings from the successful test run */
  holdings?: RawInvestmentHolding[]
}

/**
 * Generate investment parser code using ToolLoopAgent with agentic retry
 */
export async function generateInvestmentParserCode(
  statementText: string,
  modelOverride?: string,
  sourceType?: InvestmentSourceType,
  expectedSummary?: ExpectedInvestmentSummary,
  fileType: FileType = 'pdf'
): Promise<AgenticInvestmentParserResult> {
  const isSpreadsheet = fileType === 'csv' || fileType === 'xlsx'
  const formatLabel = isSpreadsheet ? 'CSV/Spreadsheet' : 'PDF'

  logger.debug(
    `[InvestmentParser] Generating parser code with agent, format: ${formatLabel}, text length: ${statementText.length} chars, source: ${sourceType || 'unknown'}`
  )
  if (expectedSummary && hasValidationData(expectedSummary)) {
    logger.debug(
      `[InvestmentParser] Validation enabled: expecting ${expectedSummary.holdingsCount} holdings, ${expectedSummary.totalCurrent} total value`
    )
  }

  const model = await createLLMClientFromSettings(modelOverride)
  const truncatedText = truncatePdfText(statementText)
  const systemPrompt = getSystemPrompt(sourceType, expectedSummary, fileType)

  // Track state across tool calls
  let lastCode = ''
  let detectedFormat = 'Unknown'
  let confidence = 0.5
  let attempts = 0
  let lastError: string | undefined
  let lastSuccessfulHoldings: RawInvestmentHolding[] | undefined
  let validationPassed = false

  // Create the agent with tools
  const agent = new ToolLoopAgent({
    model,
    instructions: systemPrompt,
    tools: {
      // Tool for submitting and testing parser code
      submitCode: tool({
        description:
          'Submit parser code to test. Returns success with holdings count and validation results, or error message to fix.',
        inputSchema: z.object({
          parserCode: z
            .string()
            .describe('JavaScript function body that parses holdings from text'),
          detectedFormat: z
            .string()
            .describe('Statement format identified (e.g., "Zerodha Holdings Report")'),
          confidence: z.number().min(0).max(1).describe('Confidence in the parsing approach'),
        }),
        execute: async ({ parserCode, detectedFormat: fmt, confidence: conf }) => {
          attempts++
          lastCode = parserCode
          detectedFormat = fmt
          confidence = conf

          logger.debug(`[InvestmentParser] Testing code attempt ${attempts}, format: ${fmt}`)
          logger.debug(`[InvestmentParser] Code:\n${parserCode}`)

          // Test the code (use 'holding' mode for investment parsing)
          const result = await runParser(parserCode, statementText, 'holding')

          if (result.success && result.holdings) {
            const holdings = result.holdings

            if (holdings.length > 0) {
              lastSuccessfulHoldings = holdings
              logger.debug(`[InvestmentParser] Code works! Found ${holdings.length} holdings`)

              // Calculate extracted totals
              const extractedTotals = calculateTotals(holdings)

              // Show sample holdings
              const samples = holdings.slice(0, 5)
              const sampleStr = samples
                .map(
                  (h) =>
                    `  ${h.investment_type.padEnd(12)} | ${(h.symbol || '-').padEnd(10)} | ${h.name.slice(0, 25).padEnd(25)} | ${String(h.units).padStart(10)} | ${String(h.current_value).padStart(12)}`
                )
                .join('\n')

              // Build response
              let response = `SUCCESS: Found ${holdings.length} holdings.

EXTRACTED TOTALS:
- Holdings count: ${extractedTotals.holdingsCount}
- Total invested: ${extractedTotals.totalInvested}
- Total current value: ${extractedTotals.totalCurrent}

Sample holdings:
${sampleStr}
`

              // Validate against expected summary
              if (expectedSummary && hasValidationData(expectedSummary)) {
                const validation = validateTotals(extractedTotals, expectedSummary)

                if (validation.isValid) {
                  validationPassed = true
                  lastError = undefined
                  response += `
VALIDATION: ✅ PASSED - All totals match the statement summary!
You can now call the 'done' tool.`
                  logger.debug(`[InvestmentParser] Validation passed!`)
                } else {
                  validationPassed = false
                  lastError = validation.message
                  response += `
VALIDATION: ❌ FAILED - Totals don't match the statement summary!

EXPECTED:
- Holdings count: ${expectedSummary.holdingsCount}
- Total invested: ${expectedSummary.totalInvested}
- Total current value: ${expectedSummary.totalCurrent}

YOUR EXTRACTED:
- Holdings count: ${extractedTotals.holdingsCount}
- Total invested: ${extractedTotals.totalInvested}
- Total current value: ${extractedTotals.totalCurrent}

Please fix the code and call submitCode again.`
                  logger.warn(
                    `[InvestmentParser] Validation failed: ${validation.details.join(', ')}`
                  )
                }
              } else {
                validationPassed = true
                lastError = undefined
                response += `
No statement summary available for validation.
If these look correct, call the 'done' tool.`
              }

              return response
            }
          }

          const error = result.error || 'No holdings found - check your regex patterns'
          lastError = error
          validationPassed = false
          logger.warn(`[InvestmentParser] Code failed: ${error}`)
          return `ERROR: ${error}\n\nPlease fix the code and call submitCode again.`
        },
      }),

      // Tool to signal completion
      done: tool({
        description: 'Call this when the parser code is working AND validation has passed.',
        inputSchema: z.object({
          summary: z.string().describe('Brief summary of what the parser does'),
        }),
      }),
    },
    stopWhen: [stepCountIs(MAX_STEPS), hasToolCall('done')],
  })

  const dataTypeDescription = isSpreadsheet
    ? 'This is CSV/spreadsheet data (structured, comma-separated). Parsing should be straightforward - split by lines and commas, identify columns from header.'
    : 'This is PDF-extracted text. Use regex patterns to find and parse holdings rows.'

  const userPrompt = `Analyze this investment/portfolio statement and generate JavaScript code to parse all holdings.

FILE FORMAT: ${formatLabel}
${dataTypeDescription}

STATEMENT DATA:
---
${truncatedText}
---

Generate a function body that extracts all holdings from this specific format.
The code receives 'text' variable and must return array of holding objects.

Use the submitCode tool to test your code. If it fails or validation fails, fix and resubmit. When working AND validated, call done.`

  try {
    const result = await agent.generate({
      prompt: userPrompt,
    })

    logger.debug(
      `[InvestmentParser] Agent completed in ${attempts} attempt(s), validation: ${validationPassed ? 'passed' : 'failed/skipped'}`
    )
    logger.debug(`[InvestmentParser] Final result steps: ${result.steps.length}`)

    return {
      code: lastCode,
      detectedFormat,
      confidence,
      attempts,
      finalError: lastError,
      holdings: lastSuccessfulHoldings,
    }
  } catch (error) {
    logger.error(`[InvestmentParser] Agent error:`, error)
    throw error
  }
}
