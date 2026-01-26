/**
 * Statement parsing using LLM with intelligent caching
 *
 * ARCHITECTURE:
 * 1. Detect document type (bank/credit card OR investment statement)
 * 2. Branch to appropriate parsing flow:
 *
 * For bank/credit card statements:
 *   - Send full PDF to LLM → get account info and bank
 *   - Check app_config for cached parser code for this bank
 *   - If cached: try all versions (latest first) until one works
 *   - If no cache or all fail: generate new code, save as new version
 *   - Insert transactions with category=null
 *   - Stream categorization in real-time with mini-batches
 *
 * For investment statements:
 *   - Delegate to investment-parser.ts
 *   - Extract holdings, create/update source
 *   - Replace holdings (replace-all strategy)
 *   - Create snapshot
 */

import { generateObject } from 'ai'
import { createLLMClientFromSettings } from './index'
import {
  accountInfoSchema,
  documentInfoSchema,
  type AccountInfo,
  type DocumentInfo,
} from './schemas'
import {
  getAccountTypesForCountry,
  getInvestmentSourceTypesForCountry,
  formatInstitutionsForLLM,
  getInstitutionName,
  type CountryCode,
  type FileType,
} from '../lib/constants'
import { db, tables, dbType } from '../db'
import { eq } from 'drizzle-orm'
import { getAccountByIdRaw, findAccountByNumber } from '../services/accounts'
import {
  updateStatementResults,
  updateStatementStatus,
  type StatementSummary,
} from '../services/statements'
import { encryptOptional } from '../lib/encryption'
import { logger } from '../lib/logger'
import {
  generateParserCode,
  runParserWithVersions,
  insertRawTransactions,
  getParserCodes,
  saveParserCode,
  generateBankKey,
  type RawPdfTransaction,
} from '../lib/pdf'
import { parseInvestmentStatement } from './investment-parser'

/**
 * Maximum pages to include before truncating middle pages
 * If a statement has more than this many pages, we keep the first and last pages
 * and omit the middle to preserve account info and summary/closing balance
 */
const MAX_PAGES_BEFORE_TRUNCATION = 15

/**
 * Number of pages to keep from the beginning and end when truncating
 */
const PAGES_TO_KEEP_EACH_END = 7

/**
 * Maximum characters for account info extraction (safety fallback)
 * Applied after page-based truncation as a final safety limit
 */
const MAX_ACCOUNT_INFO_LENGTH = 80000

/**
 * Combine all pages into a single text with page markers (complete version)
 * Used for parser code execution where we need ALL transactions
 */
function combineAllPages(pages: string[]): string {
  return pages.map((page, idx) => `\n--- PAGE ${idx + 1} ---\n${page}`).join('\n')
}

/**
 * Combine pages for LLM extraction (truncated version for long documents)
 * For long documents (> MAX_PAGES_BEFORE_TRUNCATION), keeps first and last pages
 * and omits the middle to ensure we capture both account info and summary/closing balance
 * while staying within LLM context limits
 */
function combinePagesForLLM(pages: string[]): string {
  if (pages.length <= MAX_PAGES_BEFORE_TRUNCATION) {
    // Short document - include all pages
    return pages.map((page, idx) => `\n--- PAGE ${idx + 1} ---\n${page}`).join('\n')
  }

  // Long document - keep first N and last N pages, omit middle
  const firstPages = pages.slice(0, PAGES_TO_KEEP_EACH_END)
  const lastPages = pages.slice(-PAGES_TO_KEEP_EACH_END)
  const omittedCount = pages.length - PAGES_TO_KEEP_EACH_END * 2

  const firstPagesText = firstPages
    .map((page, idx) => `\n--- PAGE ${idx + 1} ---\n${page}`)
    .join('\n')

  const placeholderText = `\n\n--- PAGES ${PAGES_TO_KEEP_EACH_END + 1} TO ${pages.length - PAGES_TO_KEEP_EACH_END} OMITTED (${omittedCount} pages) ---
[These pages contain transaction rows in the same format as above. They were omitted because this is a long statement with ${pages.length} pages.]
\n`

  const lastPagesText = lastPages
    .map(
      (page, idx) => `\n--- PAGE ${pages.length - PAGES_TO_KEEP_EACH_END + idx + 1} ---\n${page}`
    )
    .join('\n')

  return firstPagesText + placeholderText + lastPagesText
}

/**
 * Extract period dates from the full text
 */
function extractPeriodDates(text: string): {
  periodStart: string | null
  periodEnd: string | null
} {
  let periodStart: string | null = null
  let periodEnd: string | null = null

  // Try to find date ranges in common formats
  const periodMatch = text.match(
    /(?:statement\s*period|period|from)\s*:?\s*(\d{1,2}[-/]\w{3}[-/]\d{2,4})\s*(?:to|[-–])\s*(\d{1,2}[-/]\w{3}[-/]\d{2,4})/i
  )

  if (periodMatch) {
    periodStart = parseFlexibleDate(periodMatch[1]!)
    periodEnd = parseFlexibleDate(periodMatch[2]!)
  }

  return { periodStart, periodEnd }
}

/**
 * Parse flexible date formats to YYYY-MM-DD
 */
function parseFlexibleDate(dateStr: string): string | null {
  const months: Record<string, string> = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12',
  }

  const match = dateStr.match(/(\d{1,2})[-/](\w{3})[-/](\d{2,4})/i)
  if (match) {
    const day = match[1]!.padStart(2, '0')
    const month = months[match[2]!.toLowerCase()]
    let year = match[3]!
    if (year.length === 2) {
      year = parseInt(year) > 50 ? `19${year}` : `20${year}`
    }
    if (month) {
      return `${year}-${month}-${day}`
    }
  }

  return null
}

/**
 * Truncate text to a maximum length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text

  const truncated = text.slice(0, maxLength)
  const lastNewline = truncated.lastIndexOf('\n')
  if (lastNewline > maxLength * 0.7) {
    return truncated.slice(0, lastNewline) + '\n[...truncated]'
  }

  return truncated + '...[truncated]'
}

/**
 * Detect document type and extract basic info from the statement
 * This determines which parsing flow to use (bank/credit card vs investment)
 */
async function detectDocumentType(
  fullText: string,
  countryCode: CountryCode,
  modelOverride?: string
): Promise<DocumentInfo> {
  logger.debug(
    `[Parser] Detecting document type, model: ${modelOverride || 'default'}, text length: ${fullText.length}`
  )

  const truncatedText = truncateText(fullText, MAX_ACCOUNT_INFO_LENGTH)
  if (truncatedText.length < fullText.length) {
    logger.debug(
      `[Parser] Document text truncated from ${fullText.length} to ${truncatedText.length} chars`
    )
  }

  const model = await createLLMClientFromSettings(modelOverride)
  const accountTypes = getAccountTypesForCountry(countryCode)
  const accountTypeList = accountTypes.map((t) => t.code).join(', ')
  const institutionList = formatInstitutionsForLLM(countryCode)
  const sourceTypes = getInvestmentSourceTypesForCountry(countryCode)
  const sourceTypeList = sourceTypes.map((t) => `${t.code}: ${t.label}`).join(', ')

  const prompt = `Analyze this financial document and extract information.

DOCUMENT TEXT:
${truncatedText}

=== STEP 1: DETECT DOCUMENT TYPE ===
Determine what type of document this is:

1. **bank_statement**: A statement from a bank showing transactions in a savings, current, or checking account.
   - Has transaction history with dates, descriptions, amounts
   - Shows running balance
   - From banks like HDFC, ICICI, SBI, etc.

2. **credit_card_statement**: A credit card billing statement.
   - Shows card transactions, total due, minimum due
   - Has payment due date
   - From credit card issuers

3. **investment_statement**: A portfolio/holdings statement showing investments.
   - Shows stocks, mutual funds, ETFs, bonds, PPF, EPF, NPS, FD holdings
   - From brokers like Zerodha, Groww, or fund houses
   - Has units/shares, current value, NAV
   - CAS (Consolidated Account Statement) from CAMS/KFintech/MF Central
   - Passbooks for PPF, EPF
   - NPS statements

=== STEP 2: EXTRACT INFORMATION BASED ON TYPE ===

**For bank_statement / credit_card_statement:**
- Extract bank name from: ${institutionList}
- Account type from: ${accountTypeList}
- Extract account number, account type
- Extract statement period dates
- Extract summary (opening/closing balance, transaction counts, totals)
- Leave investment fields as null

**For investment_statement:**
- Identify the source platform from: ${sourceTypeList}
- Extract source name (human readable like "Zerodha Holdings")
- Extract account identifier (Demat ID, Client ID, PAN, Folio number)
- Extract statement date (as-of date for holdings)
- Identify if it has holdings table and/or transaction history
- Extract portfolio summary if shown (total invested, current value, holdings count)
- Leave bank/credit card fields as null

=== IMPORTANT RULES ===
- All dates should be in YYYY-MM-DD format
- All amounts should be numbers (not strings), remove commas
- For nullable fields, return null if not found
- Be accurate - the document type determines which parsing flow to use`

  logger.debug(`[Parser] Document type detection prompt length: ${prompt.length} chars`)

  try {
    const { object } = await generateObject({
      model,
      schema: documentInfoSchema,
      prompt,
    })

    logger.debug(`[Parser] Document type detected: ${object.document_type}`)
    if (object.document_type === 'investment_statement') {
      logger.debug(
        `[Parser] Investment source: ${object.source_type}, identifier: ${object.account_identifier}`
      )
    } else {
      logger.debug(
        `[Parser] Bank: ${object.institution_id} (${object.institution_name}) - ${object.account_type}`
      )
    }
    logger.debug(`[Parser] Document info:`, JSON.stringify(object, null, 2))
    return object
  } catch (error) {
    logger.error(`[Parser] Error detecting document type:`, error)
    throw error
  }
}

/**
 * Extract account info and statement summary from the FULL statement
 * Sends all pages to LLM to find the summary section with exact totals
 */
async function extractAccountInfo(
  fullText: string,
  countryCode: CountryCode,
  modelOverride?: string
): Promise<AccountInfo> {
  logger.debug(
    `[Parser] Extracting account info and summary, model: ${modelOverride || 'default'}, text length: ${fullText.length}`
  )

  const truncatedText = truncateText(fullText, MAX_ACCOUNT_INFO_LENGTH)
  if (truncatedText.length < fullText.length) {
    logger.debug(
      `[Parser] Account info text truncated from ${fullText.length} to ${truncatedText.length} chars`
    )
  }

  const model = await createLLMClientFromSettings(modelOverride)
  const accountTypes = getAccountTypesForCountry(countryCode)
  const accountTypeList = accountTypes.map((t) => t.code).join(', ')
  const institutionList = formatInstitutionsForLLM(countryCode)

  const prompt = `Extract account information AND statement summary from this bank/credit card statement.

STATEMENT TEXT:
${truncatedText}

AVAILABLE INSTITUTIONS (ID: Name):
${institutionList}

=== PART 1: ACCOUNT INFORMATION ===
Look for:
- Account type: one of ${accountTypeList}
- Institution ID: match the bank name to one of the IDs above (e.g., HDFC for HDFC Bank, ICICI for ICICI Bank)
- Institution name: full name of the bank/financial institution
- Account number or card number
- Account holder name (use null if not found)
- Statement period start date (YYYY-MM-DD format)
- Statement period end date (YYYY-MM-DD format)

=== PART 2: STATEMENT SUMMARY (CRITICAL) ===
Find the STATEMENT SUMMARY section of the document. This is usually a box or table showing:
- Opening Balance
- Closing Balance (or "Closing Bal")
- Number of Debits/Withdrawals (often shown as "Dr Count" or "No. of Debits")
- Number of Credits/Deposits (often shown as "Cr Count" or "No. of Credits")
- Total Debits amount
- Total Credits amount

IMPORTANT: Return the EXACT numbers printed in the summary section. Do NOT count transactions yourself.
These numbers are pre-calculated by the bank and printed on the statement.

Example of what to look for:
"STATEMENT SUMMARY
 Opening Balance: 2,493,023.24
 Dr Count: 56  Cr Count: 122
 Debits: 3,632,459.58  Credits: 3,679,494.92
 Closing Bal: 2,540,058.58"

From this, you would extract:
- opening_balance: 2493023.24
- closing_balance: 2540058.58
- debit_count: 56
- credit_count: 122
- total_debits: 3632459.58
- total_credits: 3679494.92

=== BALANCE EXTRACTION (IMPORTANT) ===
If the statement does NOT have a summary section with opening/closing balance, you MUST extract balances from the transaction table:

1. **Closing Balance**: Look at the MOST RECENT transaction (by date, not row position) in the transaction table.
   The balance shown for that transaction IS the closing balance.

2. **Opening Balance**: Look at the OLDEST transaction (by date, not row position) in the transaction table.
   Calculate: opening_balance = that transaction's balance +/- its amount
   - If oldest transaction is a CREDIT: opening_balance = balance - amount
   - If oldest transaction is a DEBIT: opening_balance = balance + amount

Note: Transaction tables can be in ascending (oldest first) OR descending (newest first) order.
Always determine the chronological order by looking at the DATES, not row position.

Example transaction table (descending order - newest first):
"Date        Description      Debit    Credit   Balance
 31-Dec-22   ATM Withdrawal   500               9,500
 15-Dec-22   Salary                    50,000   10,000
 01-Dec-22   Opening Balance                    -40,000"

From this:
- closing_balance: 9500 (balance of most recent date: 31-Dec-22)
- The oldest transaction is 15-Dec-22 with balance 10,000 and credit 50,000
- opening_balance: 10000 - 50000 = -40,000

ALWAYS try to extract opening_balance and closing_balance - they are critical for validation.

=== FOR CREDIT CARDS ===
Additionally look for:
- Total dues: total amount due / statement balance
- Minimum dues: minimum payment due
- Payment due date (YYYY-MM-DD format)

=== CARD NUMBER IDENTIFICATION ===
For credit card statements, look for the CARD NUMBER or MEMBERSHIP NUMBER, NOT other reference numbers.
- Credit card numbers are typically 15-16 digits
- Look for labels like "Card Number", "Membership Number", "Account Number"
- IGNORE statement numbers, customer IDs, or reference numbers

=== IMPORTANT RULES ===
- Match the institution to the closest ID from the list above
- If the institution is not in the list, use "OTHER" as the institution_id
- All dates should be in YYYY-MM-DD format
- All amounts should be numbers (not strings), remove commas
- For summary fields, return null if that specific value is not printed on the statement
- Do NOT calculate or estimate summary values - only return what's explicitly printed

If you cannot find certain information, use null for nullable fields or make your best guess for required fields.`

  logger.debug(`[Parser] Account info prompt length: ${prompt.length} chars`)

  try {
    const { object } = await generateObject({
      model,
      schema: accountInfoSchema,
      prompt,
    })

    logger.debug(
      `[Parser] Account info extracted: ${object.institution_id} (${object.institution_name}) - ${object.account_type}`
    )
    logger.debug(
      `[Parser] Statement summary: debits=${object.summary.debit_count}/${object.summary.total_debits}, credits=${object.summary.credit_count}/${object.summary.total_credits}`
    )
    logger.debug(`[Parser] Account info LLM response:`, JSON.stringify(object, null, 2))
    return object
  } catch (error) {
    logger.error(`[Parser] Error extracting account info:`, error)
    throw error
  }
}

/**
 * Parse a full statement (main entry point)
 *
 * Flow:
 * 1. Detect document type (bank/credit card vs investment)
 * 2. For investments: delegate to parseInvestmentStatement
 * 3. For bank/credit card:
 *    - Extract account info
 *    - Check for cached parser code
 *    - Try cached versions or generate new
 *    - Insert transactions with null category
 *    - Stream categorization
 */
export async function parseStatement(options: {
  statementId: string
  profileId: string
  userId: string
  countryCode: CountryCode
  pages: string[]
  /** File type (pdf, csv, xlsx) - affects cache key and parsing strategy */
  fileType: FileType
  /** Document type specified by user (skips auto-detection if provided) */
  documentType?: 'bank_statement' | 'investment_statement'
  /** For investment statements: source type specified by user */
  sourceType?: string
  /** Model for statement parsing (code generation) */
  parsingModel?: string
  /** Model for transaction categorization */
  categorizationModel?: string
}): Promise<void> {
  const {
    statementId,
    profileId,
    userId,
    countryCode,
    pages,
    fileType,
    documentType,
    sourceType,
    parsingModel,
    categorizationModel,
  } = options

  // Use specific models if provided
  const effectiveParsingModel = parsingModel
  const effectiveCategorizationModel = categorizationModel

  logger.debug(
    `[Parser] Models - parsing: ${effectiveParsingModel || 'default'}, categorization: ${effectiveCategorizationModel || 'default'}`
  )

  const parseStartTime = Date.now()
  logger.debug(
    `[Parser] Starting parse for statement ${statementId} with ${pages.length} pages, docType: ${documentType || 'auto-detect'}`
  )

  // Get statement to find account
  const [statement] = await db
    .select()
    .from(tables.statements)
    .where(eq(tables.statements.id, statementId))
    .limit(1)

  if (!statement) {
    throw new Error('Statement not found')
  }

  // Combine pages - two versions:
  // 1. Full text for parser execution (all pages, all transactions)
  // 2. Truncated text for LLM calls (first + last pages for account info/summary)
  const fullText = combineAllPages(pages)
  const llmText = combinePagesForLLM(pages)

  if (pages.length > MAX_PAGES_BEFORE_TRUNCATION) {
    const omittedPages = pages.length - PAGES_TO_KEEP_EACH_END * 2
    logger.debug(
      `[Parser] Long document: ${pages.length} pages (${fullText.length} chars total), LLM uses ${PAGES_TO_KEEP_EACH_END * 2} pages (${omittedPages} omitted, ${llmText.length} chars)`
    )
  } else {
    logger.debug(`[Parser] Combined ${pages.length} pages into ${fullText.length} chars`)
  }

  // Step 0: Detect document type (skip if user already specified)
  let documentInfo: DocumentInfo | null = null
  const effectiveDocumentType = documentType || null

  if (!effectiveDocumentType) {
    // Auto-detect document type
    try {
      documentInfo = await detectDocumentType(llmText, countryCode, effectiveParsingModel)
      logger.debug(`[Parser] Auto-detected document type: ${documentInfo.document_type}`)
    } catch (error) {
      logger.warn(`[Parser] Could not detect document type, defaulting to bank_statement:`, error)
    }
  } else {
    logger.debug(`[Parser] Using user-specified document type: ${effectiveDocumentType}`)
  }

  // Determine which flow to use
  const isInvestment =
    effectiveDocumentType === 'investment_statement' ||
    documentInfo?.document_type === 'investment_statement'

  // Branch based on document type
  if (isInvestment) {
    logger.debug(`[Parser] Routing to investment statement parser`)

    try {
      const result = await parseInvestmentStatement({
        statementId,
        profileId,
        userId,
        countryCode,
        pages,
        fileType,
        documentInfo,
        sourceType, // User-specified source type
        parsingModel: effectiveParsingModel,
      })

      logger.debug(
        `[Parser] Investment parsing complete: sourceId=${result.sourceId}, holdings=${result.holdingsCount}, snapshotId=${result.snapshotId}`
      )
      return
    } catch (error) {
      logger.error(`[Parser] Investment parsing failed:`, error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await updateStatementStatus(statementId, 'failed', errorMessage)
      throw error
    }
  }

  // Continue with bank/credit card statement parsing
  logger.debug(`[Parser] Processing as bank/credit card statement`)

  // For bank/credit card statements without accountId, we need to create a placeholder
  // that will be updated with real info during parsing
  let accountIdToUse = statement.accountId
  if (!accountIdToUse) {
    // Import createAccount to create placeholder
    const { createAccount } = await import('../services/accounts')
    const [user] = await db.select().from(tables.users).where(eq(tables.users.id, userId)).limit(1)

    const tempAccount = await createAccount({
      profileId,
      userId,
      type: 'other',
      institution: null,
      accountNumber: null,
      accountName: `Pending - ${statement.originalFilename}`,
      currency: user?.country === 'IN' ? 'INR' : 'USD',
    })
    accountIdToUse = tempAccount.id

    // Update statement with the new account ID
    const now = dbType === 'postgres' ? new Date() : new Date().toISOString()
    await db
      .update(tables.statements)
      .set({ accountId: accountIdToUse, updatedAt: now as Date })
      .where(eq(tables.statements.id, statementId))

    logger.debug(`[Parser] Created placeholder account ${accountIdToUse} for bank statement`)
  }

  // Step 1: Extract account info and statement summary from FULL PDF
  // We can use documentInfo if available, otherwise extract fresh
  let accountInfo: AccountInfo | null = null
  if (documentInfo && documentInfo.institution_id && documentInfo.account_number) {
    // Convert documentInfo to AccountInfo format
    accountInfo = {
      account_type: documentInfo.account_type || 'other',
      institution_id: documentInfo.institution_id,
      institution_name: documentInfo.institution_name || documentInfo.institution_id,
      account_number: documentInfo.account_number,
      account_holder_name: documentInfo.account_holder_name,
      product_name: documentInfo.product_name,
      period_start: documentInfo.period_start,
      period_end: documentInfo.period_end,
      summary: documentInfo.bank_summary || {
        debit_count: null,
        credit_count: null,
        total_debits: null,
        total_credits: null,
        opening_balance: null,
        closing_balance: null,
      },
      total_dues: documentInfo.total_dues,
      minimum_dues: documentInfo.minimum_dues,
      payment_due_date: documentInfo.payment_due_date,
    }
    logger.debug(`[Parser] Using account info from document detection:`, accountInfo)
  } else {
    // Retry account info extraction up to 3 times before failing
    const MAX_ACCOUNT_INFO_RETRIES = 3
    let lastError: unknown = null

    for (let attempt = 1; attempt <= MAX_ACCOUNT_INFO_RETRIES; attempt++) {
      try {
        accountInfo = await extractAccountInfo(llmText, countryCode, effectiveParsingModel)
        logger.debug(`[Parser] Extracted account info:`, accountInfo)
        break // Success, exit retry loop
      } catch (error) {
        lastError = error
        logger.warn(
          `[Parser] Account info extraction attempt ${attempt}/${MAX_ACCOUNT_INFO_RETRIES} failed:`,
          error instanceof Error ? error.message : error
        )

        if (attempt < MAX_ACCOUNT_INFO_RETRIES) {
          // Wait before retrying (exponential backoff: 1s, 2s, 4s)
          const delayMs = 1000 * Math.pow(2, attempt - 1)
          logger.debug(`[Parser] Retrying account info extraction in ${delayMs}ms...`)
          await new Promise((resolve) => setTimeout(resolve, delayMs))
        }
      }
    }

    // If all retries failed, fail the statement parsing
    if (!accountInfo) {
      const errorMessage =
        lastError instanceof Error ? lastError.message : 'Failed to extract account info'
      logger.error(
        `[Parser] All ${MAX_ACCOUNT_INFO_RETRIES} account info extraction attempts failed`
      )
      await updateStatementStatus(statementId, 'failed', errorMessage)
      throw new Error(
        `Account info extraction failed after ${MAX_ACCOUNT_INFO_RETRIES} attempts: ${errorMessage}`
      )
    }
  }

  // Handle account - either update placeholder or link to existing account
  // This is where we link the statement to the correct account after extracting account info
  const account = await getAccountByIdRaw(accountIdToUse, userId)

  logger.debug(
    `[Parser] Account handling: accountIdToUse=${accountIdToUse}, accountName="${account?.accountName}", isPending=${account?.accountName?.startsWith('Pending -')}, hasAccountInfo=${!!accountInfo}`
  )

  if (account && account.accountName?.startsWith('Pending -') && accountInfo) {
    // Look for existing account with same account number
    const existingAccount = await findAccountByNumber(profileId, accountInfo.account_number)

    logger.debug(
      `[Parser] Checking for existing account with number ending in ...${accountInfo.account_number.slice(-4)}: found=${!!existingAccount}, existingId=${existingAccount?.id || 'none'}`
    )

    if (existingAccount) {
      // Found existing account - use it and delete the placeholder
      logger.debug(
        `[Parser] Found existing account ${existingAccount.id} for account number ...${accountInfo.account_number.slice(-4)}, using it instead of placeholder ${accountIdToUse}`
      )

      await db
        .update(tables.statements)
        .set({ accountId: existingAccount.id })
        .where(eq(tables.statements.id, statementId))

      await db.delete(tables.accounts).where(eq(tables.accounts.id, accountIdToUse))
      accountIdToUse = existingAccount.id

      logger.debug(
        `[Parser] Deleted placeholder account ${account.id}, now using existing account ${existingAccount.id}`
      )
    } else {
      // No existing account found - double-check before updating placeholder
      // (defensive: re-query in case another statement just created the account)
      const doubleCheckAccount = await findAccountByNumber(profileId, accountInfo.account_number)
      if (doubleCheckAccount && doubleCheckAccount.id !== accountIdToUse) {
        // Race condition detected! Another process created the account
        logger.warn(
          `[Parser] Race condition detected! Account ${doubleCheckAccount.id} was just created. Using it instead of placeholder ${accountIdToUse}`
        )

        await db
          .update(tables.statements)
          .set({ accountId: doubleCheckAccount.id })
          .where(eq(tables.statements.id, statementId))

        await db.delete(tables.accounts).where(eq(tables.accounts.id, accountIdToUse))
        accountIdToUse = doubleCheckAccount.id
      } else {
        // Safe to update placeholder with real info
        const now = dbType === 'postgres' ? new Date() : new Date().toISOString()
        // Lowercase institution ID for consistent storage
        const institutionId = accountInfo.institution_id.toLowerCase()
        // Use institution_name for display
        const institutionDisplayName = getInstitutionName(countryCode, institutionId)

        // Get last 4 digits of account number for display
        const accountNumber = accountInfo.account_number
        const last4Digits = accountNumber.slice(-4)

        // For credit cards: "Institution ProductName" (e.g., "HDFC Bank Regalia")
        // For bank accounts: "Institution Name (last 4)" (e.g., "HDFC Bank (5955)")
        let accountName: string
        if (accountInfo.account_type === 'credit_card') {
          accountName = accountInfo.product_name
            ? `${institutionDisplayName} ${accountInfo.product_name}`
            : `${institutionDisplayName} Credit Card (${last4Digits})`
        } else {
          accountName = `${institutionDisplayName} (${last4Digits})`
        }

        logger.debug(
          `[Parser] Updating placeholder account ${accountIdToUse} -> "${accountName}" with number ...${last4Digits}`
        )

        await db
          .update(tables.accounts)
          .set({
            type: accountInfo.account_type,
            institution: institutionId, // Store lowercase ID for consistent lookups
            accountNumber: encryptOptional(accountInfo.account_number),
            accountName,
            productName: accountInfo.product_name || null,
            updatedAt: now as Date,
          })
          .where(eq(tables.accounts.id, accountIdToUse))

        logger.debug(`[Parser] Updated account ${accountIdToUse} with extracted info`)
      }
    }
  }

  // Generate bank key for caching using institution ID and file type
  // accountInfo is guaranteed to be non-null at this point (we throw if extraction fails)
  if (!accountInfo) {
    const errorMessage = 'Account info is required but was not extracted'
    logger.error(`[Parser] ${errorMessage}`)
    await updateStatementStatus(statementId, 'failed', errorMessage)
    throw new Error(errorMessage)
  }

  const bankKey = generateBankKey(accountInfo.institution_id, accountInfo.account_type, fileType)
  logger.debug(`[Parser] Bank key: ${bankKey} (file type: ${fileType})`)

  // Build expected summary for validation (from Step 1 account info extraction)
  const expectedSummary = accountInfo?.summary
    ? {
        debitCount: accountInfo.summary.debit_count,
        creditCount: accountInfo.summary.credit_count,
        totalDebits: accountInfo.summary.total_debits,
        totalCredits: accountInfo.summary.total_credits,
        openingBalance: accountInfo.summary.opening_balance,
        closingBalance: accountInfo.summary.closing_balance,
      }
    : undefined

  // Step 2: Check for cached parser code
  let rawTransactions: RawPdfTransaction[] = []
  let usedCachedCode = false

  const cachedCodes = await getParserCodes(bankKey)
  if (cachedCodes.length > 0) {
    logger.debug(`[Parser] Found ${cachedCodes.length} cached parser versions for ${bankKey}`)

    // Step 3: Try cached versions (latest first) with validation
    // runParserWithVersions now handles validation internally - it tries all versions
    // until one both executes successfully AND passes validation (if expected summary provided)
    const result = await runParserWithVersions(cachedCodes, fullText, bankKey, expectedSummary)

    if (result.success && result.transactions && result.transactions.length > 0) {
      rawTransactions = result.transactions
      usedCachedCode = true
      const validationStatus = result.validationPassed ? 'validation passed' : 'no validation data'
      logger.debug(
        `[Parser] Used cached code v${result.usedVersion}: ${rawTransactions.length} transactions (${validationStatus})`
      )
    } else {
      logger.warn(
        `[Parser] All ${cachedCodes.length} cached versions failed (tried: ${result.triedVersions.join(', ')}), generating new code`
      )
    }
  } else {
    logger.debug(`[Parser] No cached parser code for ${bankKey}`)
  }

  // Step 4: Generate new code if no cache or all cached versions failed validation
  if (!usedCachedCode) {
    logger.debug(`[Parser] Generating new parser code with agentic retry...`)

    const agentResult = await generateParserCode(
      fullText,
      llmText,
      effectiveParsingModel,
      accountInfo?.institution_id,
      expectedSummary,
      fileType
    )

    logger.debug(
      `[Parser] Generated code for format: ${agentResult.detectedFormat} (confidence: ${agentResult.confidence}, attempts: ${agentResult.attempts})`
    )

    // Check if agent succeeded
    if (
      agentResult.finalError ||
      !agentResult.transactions ||
      agentResult.transactions.length === 0
    ) {
      logger.error(
        `[Parser] Agent failed after ${agentResult.attempts} attempts: ${agentResult.finalError || 'No transactions found'}`
      )
      throw new Error(
        `Parser generation failed: ${agentResult.finalError || 'No transactions found'}`
      )
    }

    // Use transactions from the successful test run (no need to re-run parser)
    rawTransactions = agentResult.transactions
    logger.debug(`[Parser] Using ${rawTransactions.length} transactions from agent test run`)

    // Save new code as new version
    const newVersion = await saveParserCode(bankKey, agentResult.code, {
      detectedFormat: agentResult.detectedFormat,
      dateFormat: agentResult.dateFormat,
      confidence: agentResult.confidence,
    })
    logger.debug(`[Parser] Saved parser code as ${bankKey} v${newVersion}`)
  }

  if (rawTransactions.length === 0) {
    logger.warn(`[Parser] No transactions found in statement`)
  }

  // Use period dates from account info extraction (more reliable than regex)
  // Fall back to regex extraction if LLM didn't find them
  let periodStart = accountInfo?.period_start || null
  let periodEnd = accountInfo?.period_end || null
  if (!periodStart || !periodEnd) {
    const regexDates = extractPeriodDates(fullText)
    periodStart = periodStart || regexDates.periodStart
    periodEnd = periodEnd || regexDates.periodEnd
  }

  // Extract balances from account info (now inside summary)
  // If not available from summary, try to derive from transaction running balances
  let openingBalance = accountInfo?.summary?.opening_balance ?? null
  let closingBalance = accountInfo?.summary?.closing_balance ?? null

  // If balances not in summary, derive from transactions sorted by date
  if ((closingBalance === null || openingBalance === null) && rawTransactions.length > 0) {
    // Filter transactions that have a balance
    const txnsWithBalance = rawTransactions.filter((t) => t.balance != null)

    if (txnsWithBalance.length > 0) {
      // Sort by date to find chronologically first and last transactions
      const sortedByDate = [...txnsWithBalance].sort((a, b) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime()
      })

      const chronologicallyFirst = sortedByDate[0]
      const chronologicallyLast = sortedByDate[sortedByDate.length - 1]

      // Derive closing balance from the chronologically LAST transaction
      if (closingBalance === null && chronologicallyLast?.balance != null) {
        closingBalance = chronologicallyLast.balance
        logger.debug(
          `[Parser] Derived closing balance from last transaction (${chronologicallyLast.date}): ${closingBalance}`
        )
      }

      // Derive opening balance from the chronologically FIRST transaction
      if (openingBalance === null && chronologicallyFirst?.balance != null) {
        // Opening balance = first transaction balance - credit + debit
        if (chronologicallyFirst.type === 'credit') {
          openingBalance = chronologicallyFirst.balance - chronologicallyFirst.amount
        } else {
          openingBalance = chronologicallyFirst.balance + chronologicallyFirst.amount
        }
        logger.debug(
          `[Parser] Derived opening balance from first transaction (${chronologicallyFirst.date}): ${openingBalance}`
        )
      }
    }
  }

  // Get user's currency
  const [user] = await db.select().from(tables.users).where(eq(tables.users.id, userId)).limit(1)
  const currency = user?.country === 'IN' ? 'INR' : 'USD'

  // Step 5: Insert transactions (category will be null initially, updated by streaming categorization)
  logger.debug(`[Parser] Inserting transactions...`)
  const insertResult = await insertRawTransactions(rawTransactions, {
    statementId,
    accountId: accountIdToUse,
    profileId,
    userId,
    currency,
  })

  logger.debug(
    `[Parser] Inserted ${insertResult.insertedCount} transactions, skipped ${insertResult.skippedDuplicates} duplicates`
  )

  const parseEndTime = Date.now()
  const parseDurationMs = parseEndTime - parseStartTime
  const parseDurationSec = (parseDurationMs / 1000).toFixed(2)

  // Build statement summary based on account type
  let statementSummary: StatementSummary | null = null
  const isCreditCard = accountInfo?.account_type === 'credit_card'

  if (isCreditCard && accountInfo) {
    // Credit card statement summary
    statementSummary = {
      type: 'credit_card_statement',
      totalDue: accountInfo.total_dues ?? undefined,
      minimumDue: accountInfo.minimum_dues ?? undefined,
      dueDate: accountInfo.payment_due_date ?? undefined,
    }
  } else if (accountInfo && (openingBalance != null || closingBalance != null)) {
    // Bank statement summary
    statementSummary = {
      type: 'bank_statement',
      openingBalance: openingBalance ?? undefined,
      closingBalance: closingBalance ?? undefined,
    }
  }

  // Update statement with results
  await updateStatementResults(statementId, {
    periodStart,
    periodEnd,
    openingBalance,
    closingBalance,
    summary: statementSummary,
    transactionCount: insertResult.insertedCount,
    parseStartedAt: new Date(parseStartTime),
    parseCompletedAt: new Date(parseEndTime),
  })

  logger.debug(
    `[Parser] Completed parsing statement ${statementId}: ${insertResult.insertedCount} transactions in ${parseDurationSec}s`
  )
}

/**
 * Parse options for a single statement
 */
export interface ParseStatementOptions {
  statementId: string
  profileId: string
  userId: string
  countryCode: CountryCode
  pages: string[]
  fileType: FileType
  documentType?: 'bank_statement' | 'investment_statement'
  sourceType?: string
  parsingModel?: string
}

/**
 * Parse multiple statements serially (for caching benefits)
 * Does NOT categorize - call categorizeStatements separately after all parsing is done
 */
export async function parseStatements(statements: ParseStatementOptions[]): Promise<void> {
  logger.debug(`[Parser] Starting batch parse of ${statements.length} statements`)

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]!
    logger.debug(`[Parser] Processing statement ${i + 1}/${statements.length}: ${stmt.statementId}`)

    try {
      await parseStatement(stmt)
    } catch (error) {
      // Log error but continue with next statement
      logger.error(`[Parser] Failed to parse statement ${stmt.statementId}:`, error)
      // The parseStatement function already updates the statement status to 'failed'
    }
  }

  logger.debug(`[Parser] Batch parse complete for ${statements.length} statements`)
}
