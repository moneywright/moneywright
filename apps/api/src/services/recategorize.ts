/**
 * Recategorization service
 * Handles recategorizing transactions for accounts or statements
 */

import { eq, and, inArray } from 'drizzle-orm'
import { db, tables, dbType } from '../db'
import { logger } from '../lib/logger'
import { categorizeStatements } from '../lib/pdf'
import type { CountryCode } from '../lib/constants'

/**
 * Result from recategorization
 */
export interface RecategorizeResult {
  totalCount: number
  categorizedCount: number
}

/**
 * Options for recategorization
 */
export interface RecategorizeOptions {
  profileId: string
  userId: string
  countryCode: CountryCode
  /** Account ID to recategorize (all transactions for this account) */
  accountId?: string
  /** Statement ID to recategorize (all transactions for this statement) */
  statementId?: string
  /** Model for categorization (required) */
  categorizationModel: string
  /** Progress callback */
  onProgress?: (processed: number, total: number) => void
}

/**
 * Recategorize transactions for an account or statement
 * This overwrites all existing categories by resetting summaries and re-running categorization
 */
export async function recategorizeTransactions(
  options: RecategorizeOptions
): Promise<RecategorizeResult> {
  const {
    profileId,
    userId,
    countryCode,
    accountId,
    statementId,
    categorizationModel,
    onProgress,
  } = options

  if (!accountId && !statementId) {
    throw new Error('Either accountId or statementId must be provided')
  }

  logger.debug(
    `[Recategorize] Starting recategorization for ${accountId ? `account ${accountId}` : `statement ${statementId}`}`
  )

  // Get statement IDs to recategorize
  let statementIds: string[] = []

  if (statementId) {
    statementIds = [statementId]
  } else if (accountId) {
    // Get all statement IDs for this account
    const statements = await db
      .select({ id: tables.statements.id })
      .from(tables.statements)
      .where(
        and(
          eq(tables.statements.accountId, accountId),
          eq(tables.statements.userId, userId),
          eq(tables.statements.profileId, profileId)
        )
      )
    statementIds = statements.map((s) => s.id)
  }

  if (statementIds.length === 0) {
    logger.debug(`[Recategorize] No statements found to recategorize`)
    return { totalCount: 0, categorizedCount: 0 }
  }

  logger.debug(`[Recategorize] Found ${statementIds.length} statements to recategorize`)

  // Get all transaction IDs for these statements to reset their categories
  const transactions = await db
    .select({ id: tables.transactions.id })
    .from(tables.transactions)
    .where(inArray(tables.transactions.statementId, statementIds))

  if (transactions.length === 0) {
    logger.debug(`[Recategorize] No transactions found to recategorize`)
    return { totalCount: 0, categorizedCount: 0 }
  }

  // Reset all summaries to null so categorizeStatements will process them
  const transactionIds = transactions.map((t) => t.id)
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  await db
    .update(tables.transactions)
    .set({
      summary: null,
      category: 'other',
      categoryConfidence: null,
      isSubscription: false,
      updatedAt: now as Date,
    })
    .where(inArray(tables.transactions.id, transactionIds))

  logger.debug(`[Recategorize] Reset ${transactionIds.length} transactions for recategorization`)

  // Use categorizeStatements for consistent categorization logic
  const result = await categorizeStatements(
    statementIds,
    countryCode,
    categorizationModel,
    onProgress,
    profileId
  )

  logger.debug(
    `[Recategorize] Completed: ${result.categorizedCount}/${result.totalCount} transactions categorized`
  )

  return {
    totalCount: result.totalCount,
    categorizedCount: result.categorizedCount,
  }
}
