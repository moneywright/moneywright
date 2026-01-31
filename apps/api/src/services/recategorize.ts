/**
 * Recategorization service
 * Handles recategorizing transactions for accounts or statements
 */

import { eq, and, inArray } from 'drizzle-orm'
import { db, tables, dbType } from '../db'
import { logger } from '../lib/logger'
import { categorizeStatements } from '../lib/pdf'
import { linkEntitiesForAccount } from './entity-linking'
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
  /** User-provided hints for categorization (e.g., "FX transactions are investments") */
  categorizationHints?: string
  /** If true, include manually categorized transactions (default: false) */
  includeManual?: boolean
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
    categorizationHints,
    includeManual,
  } = options

  if (!accountId && !statementId) {
    throw new Error('Either accountId or statementId must be provided')
  }

  logger.debug(
    `[Recategorize] Starting recategorization for ${accountId ? `account ${accountId}` : `statement ${statementId}`}${includeManual ? ' (including manual)' : ''}`
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

  // Build conditions for selecting transactions to recategorize
  const selectConditions = [inArray(tables.transactions.statementId, statementIds)]

  // By default, skip manually categorized transactions unless includeManual is true
  if (!includeManual) {
    selectConditions.push(eq(tables.transactions.isManuallyCategorized, false))
  }

  // Get transaction IDs for these statements to reset their categories
  const transactions = await db
    .select({ id: tables.transactions.id })
    .from(tables.transactions)
    .where(and(...selectConditions))

  if (transactions.length === 0) {
    logger.debug(`[Recategorize] No transactions found to recategorize`)
    return { totalCount: 0, categorizedCount: 0 }
  }

  // Reset summaries to null so categorizeStatements will process them
  // Also reset isManuallyCategorized since they'll be AI-categorized again
  const transactionIds = transactions.map((t) => t.id)
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  await db
    .update(tables.transactions)
    .set({
      summary: null,
      category: 'other',
      categoryConfidence: null,
      isSubscription: false,
      isManuallyCategorized: false,
      linkedEntityId: null,
      linkedEntityType: null,
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
    profileId,
    categorizationHints
  )

  logger.debug(
    `[Recategorize] Completed: ${result.categorizedCount}/${result.totalCount} transactions categorized`
  )

  // Re-run entity linking after recategorization
  // Get the account ID(s) to re-link
  let accountIdsToLink: string[] = []

  if (accountId) {
    accountIdsToLink = [accountId]
  } else if (statementId) {
    // Get account ID from the statement
    const [statement] = await db
      .select({ accountId: tables.statements.accountId })
      .from(tables.statements)
      .where(eq(tables.statements.id, statementId))
      .limit(1)

    if (statement?.accountId) {
      accountIdsToLink = [statement.accountId]
    }
  }

  // Run entity linking for each account
  for (const accId of accountIdsToLink) {
    if (accId !== 'no-account') {
      try {
        await linkEntitiesForAccount(accId, userId, categorizationModel)
        logger.debug(`[Recategorize] Entity linking completed for account ${accId}`)
      } catch (linkError) {
        logger.error(`[Recategorize] Entity linking failed for account ${accId}:`, linkError)
      }
    }
  }

  return {
    totalCount: result.totalCount,
    categorizedCount: result.categorizedCount,
  }
}
