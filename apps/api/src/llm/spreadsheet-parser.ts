/**
 * Spreadsheet statement parsing
 * Uses the new efficient approach:
 * 1. Extract metadata from file
 * 2. Generate parser config via LLM
 * 3. Extract transactions deterministically
 * 4. Categorize transactions in batches via LLM
 */

import { createHash } from 'crypto'
import { eq } from 'drizzle-orm'
import { db, tables, dbType } from '../db'
import { logger } from '../lib/logger'
import { type CountryCode } from '../lib/constants'
import {
  extractMetadata,
  extractSheetData,
  generateParserConfig,
  extractTransactions,
  categorizeTransactions,
  type CategorizedTransaction,
} from '../lib/spreadsheet'
import { updateStatementResults } from '../services/statements'

/**
 * Generate transaction hash for deduplication
 */
function generateTransactionHash(date: string, amount: number, description: string): string {
  const data = `${date}|${amount}|${description}`
  return createHash('sha256').update(data).digest('hex')
}

/**
 * Parse a spreadsheet statement (Excel/CSV)
 */
export async function parseSpreadsheetStatement(options: {
  statementId: string
  profileId: string
  userId: string
  countryCode: CountryCode
  buffer: Buffer
  fileName: string
  model?: string
}): Promise<void> {
  const {
    statementId,
    profileId,
    userId,
    countryCode,
    buffer,
    fileName,
    model: modelOverride,
  } = options

  const parseStartTime = Date.now()
  logger.debug(`[SpreadsheetParser] Starting parse for statement ${statementId} - ${fileName}`)

  // Get statement to find account
  const [statement] = await db
    .select()
    .from(tables.statements)
    .where(eq(tables.statements.id, statementId))
    .limit(1)

  if (!statement) {
    throw new Error('Statement not found')
  }

  if (!statement.accountId) {
    throw new Error('Statement has no associated account')
  }

  const accountId = statement.accountId

  // Phase 1: Extract metadata
  logger.debug(`[SpreadsheetParser] Phase 1: Extracting metadata`)
  const metadata = extractMetadata(buffer, fileName)
  logger.debug(
    `[SpreadsheetParser] Metadata: ${metadata.sheetsNumber} sheets, file type: ${metadata.fileType}`
  )

  // Phase 2: Extract sheet data
  logger.debug(`[SpreadsheetParser] Phase 2: Extracting sheet data`)
  const sheetData = extractSheetData(buffer)
  logger.debug(
    `[SpreadsheetParser] Sheet data: ${sheetData.totalRows} rows, ${sheetData.headers.length} columns`
  )

  if (sheetData.totalRows === 0) {
    throw new Error('No data found in spreadsheet')
  }

  // Phase 3: Generate parser config via LLM
  logger.debug(`[SpreadsheetParser] Phase 3: Generating parser config via LLM`)
  const parserConfig = await generateParserConfig(
    metadata,
    sheetData.data,
    sheetData.headers,
    modelOverride
  )
  logger.debug(`[SpreadsheetParser] Parser config generated: ${JSON.stringify(parserConfig)}`)

  // Phase 4: Extract transactions deterministically
  logger.debug(`[SpreadsheetParser] Phase 4: Extracting transactions`)
  const rawTransactions = extractTransactions(sheetData, parserConfig)
  logger.debug(`[SpreadsheetParser] Extracted ${rawTransactions.length} raw transactions`)

  if (rawTransactions.length === 0) {
    logger.warn(`[SpreadsheetParser] No transactions extracted from spreadsheet`)
    await updateStatementResults(statementId, {
      periodStart: null,
      periodEnd: null,
      summary: null,
      transactionCount: 0,
      parseStartedAt: new Date(parseStartTime),
      parseCompletedAt: new Date(),
    })
    return
  }

  // Phase 5: Categorize transactions in batches via LLM
  logger.debug(`[SpreadsheetParser] Phase 5: Categorizing transactions via LLM`)
  const categorizedTransactions = await categorizeTransactions(
    rawTransactions,
    countryCode,
    modelOverride
  )

  // Create a map for quick lookup
  const categoryMap = new Map<string, CategorizedTransaction>()
  for (const cat of categorizedTransactions) {
    categoryMap.set(cat.id, cat)
  }

  // Determine period dates from transactions
  const dates = rawTransactions.map((t) => t.date).sort()
  const periodStart = dates[0] || null
  const periodEnd = dates[dates.length - 1] || null

  // Get user's currency
  const [user] = await db.select().from(tables.users).where(eq(tables.users.id, userId)).limit(1)

  const currency = user?.country === 'IN' ? 'INR' : 'USD'

  // Phase 6: Insert transactions with deduplication
  logger.debug(`[SpreadsheetParser] Phase 6: Inserting transactions`)
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()
  let insertedCount = 0
  let skippedCount = 0

  for (const rawTxn of rawTransactions) {
    const hash = generateTransactionHash(rawTxn.date, rawTxn.amount, rawTxn.description)

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

    // Get categorization
    const categorized = categoryMap.get(rawTxn.id)

    try {
      await db.insert(tables.transactions).values({
        accountId,
        statementId,
        profileId,
        userId,
        date: rawTxn.date,
        type: rawTxn.type,
        amount: rawTxn.amount.toString(),
        currency,
        originalDescription: rawTxn.description,
        summary: categorized?.summary || rawTxn.description.slice(0, 100),
        category: categorized?.category || 'other',
        categoryConfidence: categorized?.confidence?.toString() || '0.5',
        hash,
        createdAt: now as Date,
        updatedAt: now as Date,
      })
      insertedCount++
    } catch {
      logger.debug(
        `[SpreadsheetParser] Skipped duplicate transaction: ${rawTxn.date} ${rawTxn.amount}`
      )
      skippedCount++
    }
  }

  logger.debug(
    `[SpreadsheetParser] Inserted ${insertedCount} transactions, skipped ${skippedCount} duplicates`
  )

  const parseEndTime = Date.now()
  const parseDurationMs = parseEndTime - parseStartTime
  const parseDurationSec = (parseDurationMs / 1000).toFixed(2)

  // Update statement with results
  await updateStatementResults(statementId, {
    periodStart,
    periodEnd,
    summary: null,
    transactionCount: insertedCount,
    parseStartedAt: new Date(parseStartTime),
    parseCompletedAt: new Date(parseEndTime),
  })

  logger.debug(
    `[SpreadsheetParser] Completed parsing statement ${statementId}: ${insertedCount} transactions in ${parseDurationSec}s`
  )
}
