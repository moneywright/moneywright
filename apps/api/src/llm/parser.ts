/**
 * Statement parsing using LLM
 * Uses CSV output format for transactions to reduce token usage by ~50%
 */

import { generateObject, generateText } from 'ai'
import { createLLMClientFromSettings } from './index'
import { accountInfoSchema, type AccountInfo, type TransactionParsed } from './schemas'
import {
  getCategoriesForCountry,
  getAccountTypesForCountry,
  type CountryCode,
} from '../lib/constants'
import { db, tables, dbType } from '../db'
import { eq } from 'drizzle-orm'
import { createHash } from 'crypto'
import { getAccountByIdRaw, findAccountByNumber } from '../services/accounts'
import { updateStatementResults, type StatementSummary } from '../services/statements'
import { encryptOptional } from '../lib/encryption'
import { logger } from '../lib/logger'

/**
 * Maximum characters to send to LLM per request
 * Most LLMs have context limits, and bank statements can be very long
 */
const MAX_TEXT_LENGTH = 8000

/**
 * Truncate text to a maximum length, trying to break at sentence/line boundaries
 */
function truncateText(text: string, maxLength: number = MAX_TEXT_LENGTH): string {
  if (text.length <= maxLength) return text

  // Try to break at a newline
  const truncated = text.slice(0, maxLength)
  const lastNewline = truncated.lastIndexOf('\n')
  if (lastNewline > maxLength * 0.7) {
    return truncated.slice(0, lastNewline) + '\n[...truncated]'
  }

  return truncated + '...[truncated]'
}

/**
 * Generate transaction hash for deduplication
 */
function generateTransactionHash(date: string, amount: number, description: string): string {
  const data = `${date}|${amount}|${description}`
  return createHash('sha256').update(data).digest('hex')
}

/**
 * Parse CSV response from LLM into transactions
 * CSV format: date,type,amount,original_description,summary,category,confidence
 */
function parseTransactionCSV(csvText: string, validCategories: string[]): TransactionParsed[] {
  const transactions: TransactionParsed[] = []
  const lines = csvText.trim().split('\n')

  for (const line of lines) {
    // Skip empty lines and header
    if (!line.trim() || line.toLowerCase().startsWith('date,')) continue

    // Parse CSV line - handle quoted fields
    const fields = parseCSVLine(line)
    if (fields.length < 6) {
      logger.warn(`[Parser] Skipping malformed CSV line: ${line}`)
      continue
    }

    const [date, type, amountStr, originalDesc, summary, category, confidenceStr] = fields

    // Validate date format (YYYY-MM-DD)
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      logger.warn(`[Parser] Skipping transaction with invalid date: ${date}`)
      continue
    }

    // Parse amount
    const amount = parseFloat(amountStr?.replace(/[^0-9.-]/g, '') || '0')
    if (isNaN(amount) || amount <= 0) {
      logger.warn(`[Parser] Skipping transaction with invalid amount: ${amountStr}`)
      continue
    }

    // Validate type
    const txnType = type?.toLowerCase().trim()
    if (txnType !== 'credit' && txnType !== 'debit') {
      logger.warn(`[Parser] Skipping transaction with invalid type: ${type}`)
      continue
    }

    // Validate category - use 'other' if invalid
    const categoryCode = category?.toLowerCase().trim() || 'other'
    const finalCategory = validCategories.includes(categoryCode) ? categoryCode : 'other'

    // Parse confidence
    const confidence = parseFloat(confidenceStr || '0.8')

    transactions.push({
      date: date.trim(),
      type: txnType as 'credit' | 'debit',
      amount,
      original_description: originalDesc?.trim() || '',
      summary: summary?.trim() || originalDesc?.trim() || '',
      category: finalCategory,
      category_confidence: isNaN(confidence) ? 0.8 : Math.min(1, Math.max(0, confidence)),
    })
  }

  return transactions
}

/**
 * Parse a CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"'
        i++
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current)

  return fields.map((f) => f.trim())
}

/**
 * Parse metadata from LLM response (period dates, summary)
 */
function parseMetadata(text: string): {
  periodStart: string | null
  periodEnd: string | null
  statementType: 'bank_statement' | 'credit_card_statement' | null
} {
  let periodStart: string | null = null
  let periodEnd: string | null = null
  let statementType: 'bank_statement' | 'credit_card_statement' | null = null

  // Look for period dates in format PERIOD_START:YYYY-MM-DD
  const startMatch = text.match(/PERIOD_START:\s*(\d{4}-\d{2}-\d{2})/i)
  const endMatch = text.match(/PERIOD_END:\s*(\d{4}-\d{2}-\d{2})/i)
  const typeMatch = text.match(/STATEMENT_TYPE:\s*(bank_statement|credit_card_statement)/i)

  if (startMatch) periodStart = startMatch[1]!
  if (endMatch) periodEnd = endMatch[1]!
  if (typeMatch)
    statementType = typeMatch[1]!.toLowerCase() as 'bank_statement' | 'credit_card_statement'

  return { periodStart, periodEnd, statementType }
}

/**
 * Parse a single page of a statement using CSV output format
 */
async function parseStatementPage(
  pageText: string,
  countryCode: CountryCode,
  pageNumber: number,
  modelOverride?: string
): Promise<{
  transactions: TransactionParsed[]
  periodStart: string | null
  periodEnd: string | null
}> {
  logger.info(
    `[Parser] Parsing page ${pageNumber}, model: ${modelOverride || 'default'}, text length: ${pageText.length}`
  )

  // Truncate text if too long
  const truncatedText = truncateText(pageText)
  if (truncatedText.length < pageText.length) {
    logger.warn(
      `[Parser] Page ${pageNumber} text truncated from ${pageText.length} to ${truncatedText.length} chars`
    )
  }

  const model = await createLLMClientFromSettings(modelOverride)
  const categories = getCategoriesForCountry(countryCode)
  const categoryList = categories.map((c) => c.code).join(', ')
  const validCategories = categories.map((c) => c.code)

  const prompt = `Parse this bank/credit card statement and extract transactions in CSV format.

STATEMENT TEXT (Page ${pageNumber}):
---
${truncatedText}
---

OUTPUT FORMAT (CSV - one transaction per line):
date,type,amount,original_description,summary,category,confidence

RULES:
- date: YYYY-MM-DD format
- type: credit (money in) or debit (money out)
- amount: positive number with decimals
- original_description: exact text from statement
- summary: brief clear description (e.g. "Amazon purchase", "Salary from Acme")
- category: one of [${categoryList}]
- confidence: 0.0 to 1.0

At the end, add metadata lines:
PERIOD_START: YYYY-MM-DD (if found)
PERIOD_END: YYYY-MM-DD (if found)
STATEMENT_TYPE: bank_statement or credit_card_statement

If no transactions on this page, output: NO_TRANSACTIONS

Example output:
2024-01-15,debit,49.99,"AMAZON.COM*123","Amazon purchase",shopping,0.95
2024-01-16,credit,5000.00,"SALARY ACME CORP","Monthly salary",salary,1.0
PERIOD_START: 2024-01-01
PERIOD_END: 2024-01-31
STATEMENT_TYPE: bank_statement`

  logger.debug(`[Parser] Prompt length: ${prompt.length} chars`)

  try {
    const { text } = await generateText({
      model,
      prompt,
      maxTokens: 4000,
    })

    logger.debug(`[Parser] Page ${pageNumber} raw response (${text.length} chars):\n${text}`)

    // Check for no transactions
    if (text.includes('NO_TRANSACTIONS')) {
      logger.info(`[Parser] Page ${pageNumber}: no transactions found`)
      const metadata = parseMetadata(text)
      return {
        transactions: [],
        periodStart: metadata.periodStart,
        periodEnd: metadata.periodEnd,
      }
    }

    // Parse transactions from CSV
    const transactions = parseTransactionCSV(text, validCategories)
    const metadata = parseMetadata(text)

    logger.info(`[Parser] Page ${pageNumber} parsed: ${transactions.length} transactions found`)
    return {
      transactions,
      periodStart: metadata.periodStart,
      periodEnd: metadata.periodEnd,
    }
  } catch (error) {
    logger.error(`[Parser] Error parsing page ${pageNumber}:`, error)
    throw error
  }
}

/**
 * Extract account info from the first page
 */
async function extractAccountInfo(
  firstPageText: string,
  countryCode: CountryCode,
  modelOverride?: string
): Promise<AccountInfo> {
  logger.info(
    `[Parser] Extracting account info, model: ${modelOverride || 'default'}, text length: ${firstPageText.length}`
  )

  // Only use first portion for account info - it's usually at the top
  const truncatedText = truncateText(firstPageText, 4000)
  if (truncatedText.length < firstPageText.length) {
    logger.debug(
      `[Parser] Account info text truncated from ${firstPageText.length} to ${truncatedText.length} chars`
    )
  }

  const model = await createLLMClientFromSettings(modelOverride)
  const accountTypes = getAccountTypesForCountry(countryCode)
  const accountTypeList = accountTypes.map((t) => t.code).join(', ')

  const prompt = `Extract account information from this bank/credit card statement:

${truncatedText}

Look for:
- Account type: one of ${accountTypeList}
- Bank/institution name
- Account number or card number (full number if visible)
- Account holder name (use null if not found)

If you cannot find certain information, use null for nullable fields or make your best guess for required fields.`

  logger.debug(`[Parser] Account info prompt length: ${prompt.length} chars`)

  try {
    const { object } = await generateObject({
      model,
      schema: accountInfoSchema,
      prompt,
    })

    logger.info(`[Parser] Account info extracted: ${object.institution} - ${object.account_type}`)
    logger.debug(`[Parser] Account info LLM response:`, JSON.stringify(object, null, 2))
    return object
  } catch (error) {
    logger.error(`[Parser] Error extracting account info:`, error)
    throw error
  }
}

/**
 * Parse a full statement (main entry point)
 */
export async function parseStatement(options: {
  statementId: string
  profileId: string
  userId: string
  countryCode: CountryCode
  pages: string[]
  model?: string
}): Promise<void> {
  const { statementId, profileId, userId, countryCode, pages, model: modelOverride } = options

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

  // Extract account info from first page
  let accountInfo: AccountInfo | null = null
  const firstPage = pages[0]
  if (firstPage) {
    try {
      accountInfo = await extractAccountInfo(firstPage, countryCode, modelOverride)
      logger.debug(`[Parser] Extracted account info:`, accountInfo)
    } catch (error) {
      logger.warn(`[Parser] Could not extract account info:`, error)
    }
  }

  // Handle account - either update placeholder or link to existing account
  const account = await getAccountByIdRaw(statement.accountId, userId)
  if (account && account.accountName?.startsWith('Pending -') && accountInfo) {
    // Check if an account with this account number already exists
    const existingAccount = await findAccountByNumber(profileId, accountInfo.account_number)

    if (existingAccount) {
      // Account already exists! Update statement to use existing account and delete placeholder
      logger.info(
        `[Parser] Found existing account ${existingAccount.id} for account number, using it instead of placeholder`
      )

      await db
        .update(tables.statements)
        .set({ accountId: existingAccount.id })
        .where(eq(tables.statements.id, statementId))

      // Delete the placeholder account
      await db.delete(tables.accounts).where(eq(tables.accounts.id, statement.accountId))

      // Update statement reference for transaction insertion
      statement.accountId = existingAccount.id

      logger.debug(
        `[Parser] Deleted placeholder account ${account.id}, using existing account ${existingAccount.id}`
      )
    } else {
      // No existing account found, update placeholder with real info
      const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

      await db
        .update(tables.accounts)
        .set({
          type: accountInfo.account_type,
          institution: accountInfo.institution,
          accountNumber: encryptOptional(accountInfo.account_number),
          accountName: `${accountInfo.institution} - ${accountInfo.account_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`,
          updatedAt: now as Date,
        })
        .where(eq(tables.accounts.id, statement.accountId))

      logger.debug(`[Parser] Updated account ${statement.accountId} with extracted info`)
    }
  }

  // Parse each page
  const allTransactions: TransactionParsed[] = []
  const statementSummary: StatementSummary | null = null
  let periodStart: string | null = null
  let periodEnd: string | null = null

  for (let i = 0; i < pages.length; i++) {
    const pageText = pages[i]
    if (!pageText || !pageText.trim()) continue

    try {
      logger.debug(`[Parser] Parsing page ${i + 1}/${pages.length}`)
      const result = await parseStatementPage(pageText, countryCode, i + 1, modelOverride)

      // Collect transactions
      if (result.transactions && result.transactions.length > 0) {
        allTransactions.push(...result.transactions)
      }

      // Get period dates
      if (!periodStart && result.periodStart) {
        periodStart = result.periodStart
      }
      if (!periodEnd && result.periodEnd) {
        periodEnd = result.periodEnd
      }
    } catch (error) {
      logger.error(`[Parser] Error parsing page ${i + 1}:`, error)
      // Continue with other pages
    }
  }

  logger.debug(`[Parser] Extracted ${allTransactions.length} transactions`)

  // Get user's currency
  const [user] = await db.select().from(tables.users).where(eq(tables.users.id, userId)).limit(1)

  const currency = user?.country === 'IN' ? 'INR' : 'USD'

  // Insert transactions with deduplication
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()
  let insertedCount = 0
  let skippedCount = 0

  for (const txn of allTransactions) {
    const hash = generateTransactionHash(txn.date, txn.amount, txn.original_description)

    // Check for duplicate
    const [existing] = await db
      .select({ id: tables.transactions.id })
      .from(tables.transactions)
      .where(eq(tables.transactions.hash, hash))
      .limit(1)

    if (existing) {
      skippedCount++
      continue
    }

    try {
      await db.insert(tables.transactions).values({
        accountId: statement.accountId,
        statementId,
        profileId,
        userId,
        date: txn.date,
        type: txn.type,
        amount: txn.amount.toString(),
        currency,
        originalDescription: txn.original_description,
        summary: txn.summary,
        category: txn.category,
        categoryConfidence: txn.category_confidence?.toString() || null,
        hash,
        createdAt: now as Date,
        updatedAt: now as Date,
      })
      insertedCount++
    } catch {
      // Likely a duplicate constraint violation, skip
      logger.debug(`[Parser] Skipped duplicate transaction: ${txn.date} ${txn.amount}`)
      skippedCount++
    }
  }

  logger.debug(
    `[Parser] Inserted ${insertedCount} transactions, skipped ${skippedCount} duplicates`
  )

  const parseEndTime = Date.now()
  const parseDurationMs = parseEndTime - parseStartTime
  const parseDurationSec = (parseDurationMs / 1000).toFixed(2)

  // Update statement with results including parse timing
  await updateStatementResults(statementId, {
    periodStart,
    periodEnd,
    summary: statementSummary,
    transactionCount: insertedCount,
    parseStartedAt: new Date(parseStartTime),
    parseCompletedAt: new Date(parseEndTime),
  })

  logger.info(
    `[Parser] Completed parsing statement ${statementId}: ${insertedCount} transactions in ${parseDurationSec}s`
  )
}
