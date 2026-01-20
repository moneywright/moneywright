/**
 * Statement parsing using LLM with intelligent caching
 *
 * ARCHITECTURE:
 * 1. Send page 1 to LLM → get account info and bank
 * 2. Check app_config for cached parser code for this bank
 * 3. If cached: try all versions (latest first) until one works
 * 4. If no cache or all fail: generate new code, save as new version
 * 5. Insert transactions with category=null
 * 6. Stream categorization in real-time with mini-batches
 */

import { generateObject } from 'ai'
import { createLLMClientFromSettings } from './index'
import { accountInfoSchema, type AccountInfo } from './schemas'
import { getAccountTypesForCountry, type CountryCode } from '../lib/constants'
import { formatInstitutionsForLLM, getInstitutionName } from '../lib/institutions'
import { db, tables, dbType } from '../db'
import { eq } from 'drizzle-orm'
import { getAccountByIdRaw, findAccountByNumber } from '../services/accounts'
import { updateStatementResults, type StatementSummary } from '../services/statements'
import { encryptOptional } from '../lib/encryption'
import { logger } from '../lib/logger'
import {
  generateParserCode,
  runParserWithVersions,
  insertRawTransactions,
  categorizeTransactionsStreaming,
  getParserCodes,
  saveParserCode,
  generateBankKey,
  type RawPdfTransaction,
} from '../lib/pdf'

/**
 * Maximum characters for account info extraction (full PDF)
 * Increased to allow full statement for summary extraction
 */
const MAX_ACCOUNT_INFO_LENGTH = 80000

/**
 * Combine all pages into a single text with page markers
 */
function combinePages(pages: string[]): string {
  return pages.map((page, idx) => `\n--- PAGE ${idx + 1} ---\n${page}`).join('\n')
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
 * Extract account info and statement summary from the FULL statement
 * Sends all pages to LLM to find the summary section with exact totals
 */
async function extractAccountInfo(
  fullText: string,
  countryCode: CountryCode,
  modelOverride?: string
): Promise<AccountInfo> {
  logger.info(
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

    logger.info(
      `[Parser] Account info extracted: ${object.institution_id} (${object.institution_name}) - ${object.account_type}`
    )
    logger.info(
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
 * 1. Extract account info from page 1
 * 2. Check for cached parser code for this bank
 * 3. Try cached versions (latest first) or generate new
 * 4. Insert transactions with null category
 * 5. Stream categorization with mini-batches
 */
export async function parseStatement(options: {
  statementId: string
  profileId: string
  userId: string
  countryCode: CountryCode
  pages: string[]
  /** Model for statement parsing (code generation) */
  parsingModel?: string
  /** Model for transaction categorization */
  categorizationModel?: string
}): Promise<void> {
  const { statementId, profileId, userId, countryCode, pages, parsingModel, categorizationModel } =
    options

  // Use specific models if provided
  const effectiveParsingModel = parsingModel
  const effectiveCategorizationModel = categorizationModel

  logger.info(
    `[Parser] Models - parsing: ${effectiveParsingModel || 'default'}, categorization: ${effectiveCategorizationModel || 'default'}`
  )

  const parseStartTime = Date.now()
  logger.info(`[Parser] Starting parse for statement ${statementId} with ${pages.length} pages`)

  // Get statement to find account
  const [statement] = await db
    .select()
    .from(tables.statements)
    .where(eq(tables.statements.id, statementId))
    .limit(1)

  if (!statement) {
    throw new Error('Statement not found')
  }

  // Combine all pages first (needed for account info extraction)
  const fullText = combinePages(pages)
  logger.info(`[Parser] Combined ${pages.length} pages into ${fullText.length} chars`)

  // Step 1: Extract account info and statement summary from FULL PDF
  let accountInfo: AccountInfo | null = null
  try {
    accountInfo = await extractAccountInfo(fullText, countryCode, effectiveParsingModel)
    logger.debug(`[Parser] Extracted account info:`, accountInfo)
  } catch (error) {
    logger.warn(`[Parser] Could not extract account info:`, error)
  }

  // Handle account - either update placeholder or link to existing account
  const account = await getAccountByIdRaw(statement.accountId, userId)
  if (account && account.accountName?.startsWith('Pending -') && accountInfo) {
    const existingAccount = await findAccountByNumber(profileId, accountInfo.account_number)

    if (existingAccount) {
      logger.info(
        `[Parser] Found existing account ${existingAccount.id} for account number, using it instead of placeholder`
      )

      await db
        .update(tables.statements)
        .set({ accountId: existingAccount.id })
        .where(eq(tables.statements.id, statementId))

      await db.delete(tables.accounts).where(eq(tables.accounts.id, statement.accountId))
      statement.accountId = existingAccount.id

      logger.debug(
        `[Parser] Deleted placeholder account ${account.id}, using existing account ${existingAccount.id}`
      )
    } else {
      const now = dbType === 'postgres' ? new Date() : new Date().toISOString()
      // Use institution_name for display, institution_id for storage
      const institutionDisplayName = getInstitutionName(countryCode, accountInfo.institution_id)
      const accountTypeName = accountInfo.account_type
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())

      // For credit cards with product name, use "Institution ProductName" format
      // For bank accounts, use "Institution - AccountType" format
      let accountName = `${institutionDisplayName} - ${accountTypeName}`
      if (accountInfo.account_type === 'credit_card' && accountInfo.product_name) {
        accountName = `${institutionDisplayName} ${accountInfo.product_name}`
      }

      await db
        .update(tables.accounts)
        .set({
          type: accountInfo.account_type,
          institution: accountInfo.institution_id, // Store ID for consistent lookups
          accountNumber: encryptOptional(accountInfo.account_number),
          accountName,
          productName: accountInfo.product_name || null, // Stores product name for both cards and bank accounts
          updatedAt: now as Date,
        })
        .where(eq(tables.accounts.id, statement.accountId))

      logger.debug(`[Parser] Updated account ${statement.accountId} with extracted info`)
    }
  }

  // Generate bank key for caching using institution ID
  const bankKey = accountInfo
    ? generateBankKey(accountInfo.institution_id, accountInfo.account_type)
    : 'unknown_unknown'

  logger.info(`[Parser] Bank key: ${bankKey}`)

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
    logger.info(`[Parser] Found ${cachedCodes.length} cached parser versions for ${bankKey}`)

    // Step 3: Try cached versions (latest first) with validation
    // runParserWithVersions now handles validation internally - it tries all versions
    // until one both executes successfully AND passes validation (if expected summary provided)
    const result = await runParserWithVersions(cachedCodes, fullText, bankKey, expectedSummary)

    if (result.success && result.transactions && result.transactions.length > 0) {
      rawTransactions = result.transactions
      usedCachedCode = true
      const validationStatus = result.validationPassed ? 'validation passed' : 'no validation data'
      logger.info(
        `[Parser] Used cached code v${result.usedVersion}: ${rawTransactions.length} transactions (${validationStatus})`
      )
    } else {
      logger.warn(
        `[Parser] All ${cachedCodes.length} cached versions failed (tried: ${result.triedVersions.join(', ')}), generating new code`
      )
    }
  } else {
    logger.info(`[Parser] No cached parser code for ${bankKey}`)
  }

  // Step 4: Generate new code if no cache or all cached versions failed validation
  if (!usedCachedCode) {
    logger.info(`[Parser] Generating new parser code with agentic retry...`)

    const agentResult = await generateParserCode(
      fullText,
      effectiveParsingModel,
      accountInfo?.institution_id,
      expectedSummary
    )

    logger.info(
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
    logger.info(`[Parser] Using ${rawTransactions.length} transactions from agent test run`)

    // Save new code as new version
    const newVersion = await saveParserCode(bankKey, agentResult.code, {
      detectedFormat: agentResult.detectedFormat,
      dateFormat: agentResult.dateFormat,
      confidence: agentResult.confidence,
    })
    logger.info(`[Parser] Saved parser code as ${bankKey} v${newVersion}`)
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
        logger.info(
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
        logger.info(
          `[Parser] Derived opening balance from first transaction (${chronologicallyFirst.date}): ${openingBalance}`
        )
      }
    }
  }

  // Get user's currency
  const [user] = await db.select().from(tables.users).where(eq(tables.users.id, userId)).limit(1)
  const currency = user?.country === 'IN' ? 'INR' : 'USD'

  // Step 5: Insert transactions (category will be null initially, updated by streaming categorization)
  logger.info(`[Parser] Inserting transactions...`)
  const insertResult = await insertRawTransactions(rawTransactions, {
    statementId,
    accountId: statement.accountId,
    profileId,
    userId,
    currency,
  })

  logger.info(
    `[Parser] Inserted ${insertResult.insertedCount} transactions, skipped ${insertResult.skippedDuplicates} duplicates`
  )

  // Get account type for categorization context
  const accountType = accountInfo?.account_type || account?.type || undefined

  // Step 6: Stream categorization with mini-batches
  if (insertResult.transactionIds.length > 0) {
    logger.info(
      `[Parser] Starting streaming categorization for ${insertResult.transactionIds.length} transactions (account type: ${accountType || 'unknown'})...`
    )

    const catResult = await categorizeTransactionsStreaming(
      insertResult.transactionIds,
      countryCode,
      effectiveCategorizationModel,
      0, // Start from beginning
      (categorized, total) => {
        logger.debug(`[Parser] Categorization progress: ${categorized}/${total}`)
      },
      accountType
    )

    if (catResult.failedAtIndex !== undefined) {
      logger.warn(
        `[Parser] Categorization partially completed: ${catResult.categorizedCount} of ${insertResult.transactionIds.length}`
      )
      // Note: Transactions after failedAtIndex still have category=null
      // They can be categorized later by resuming from failedAtIndex
    } else {
      logger.info(`[Parser] Categorization complete: ${catResult.categorizedCount} transactions`)
    }
  }

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

  logger.info(
    `[Parser] Completed parsing statement ${statementId}: ${insertResult.insertedCount} transactions in ${parseDurationSec}s`
  )
}
