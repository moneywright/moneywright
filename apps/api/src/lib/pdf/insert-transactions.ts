/**
 * Batch insert transactions extracted from PDF
 * Handles deduplication via hash and bulk inserts
 */

import { createHash } from 'crypto'
import { eq } from 'drizzle-orm'
import { db, tables, dbType } from '../../db'
import { logger } from '../logger'
import type { RawPdfTransaction, InsertResult } from './types'

/**
 * Batch size for inserts
 */
const INSERT_BATCH_SIZE = 100

/**
 * Generate transaction hash for deduplication
 * Hash is based on account, date, amount, description, and position within the statement
 * Position is included to allow identical transactions (same date/amount/description)
 * that appear multiple times in the same statement (e.g., two identical purchases)
 */
function generateTransactionHash(
  accountId: string,
  date: string,
  amount: number,
  description: string,
  position: number
): string {
  const data = `${accountId}|${date}|${amount}|${description}|${position}`
  return createHash('sha256').update(data).digest('hex')
}

/**
 * Insert raw transactions into the database
 * Returns IDs of inserted transactions for categorization step
 */
export async function insertRawTransactions(
  transactions: RawPdfTransaction[],
  context: {
    statementId: string
    accountId: string
    profileId: string
    userId: string
    currency: string
  }
): Promise<InsertResult> {
  const { statementId, accountId, profileId, userId, currency } = context
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  logger.debug(`[InsertTransactions] Inserting ${transactions.length} transactions`)

  const insertedIds: string[] = []
  let skippedCount = 0

  // Process in batches
  for (let i = 0; i < transactions.length; i += INSERT_BATCH_SIZE) {
    const batch = transactions.slice(i, i + INSERT_BATCH_SIZE)

    for (let j = 0; j < batch.length; j++) {
      const txn = batch[j]!
      const position = i + j // Global position in the transaction list
      const hash = generateTransactionHash(
        accountId,
        txn.date,
        txn.amount,
        txn.description,
        position
      )

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
        // Insert with null summary - will be set by categorization
        // summary=null indicates transaction hasn't been categorized yet
        const [inserted] = await db
          .insert(tables.transactions)
          .values({
            accountId,
            statementId,
            profileId,
            userId,
            date: txn.date,
            type: txn.type,
            amount: txn.amount.toString(),
            currency,
            balance: txn.balance != null ? txn.balance.toString() : null,
            originalDescription: txn.description,
            summary: null, // null = not yet categorized
            category: 'other', // Default, will be updated by categorization
            categoryConfidence: null,
            hash,
            createdAt: now as Date,
            updatedAt: now as Date,
          })
          .returning({ id: tables.transactions.id })

        if (inserted) {
          insertedIds.push(inserted.id)
        }
      } catch {
        // Likely a duplicate constraint violation, skip
        logger.debug(
          `[InsertTransactions] Skipped duplicate transaction: ${txn.date} ${txn.amount}`
        )
        skippedCount++
      }
    }
  }

  logger.debug(
    `[InsertTransactions] Inserted ${insertedIds.length} transactions, skipped ${skippedCount} duplicates`
  )

  return {
    insertedCount: insertedIds.length,
    skippedDuplicates: skippedCount,
    transactionIds: insertedIds,
  }
}

/**
 * Update transactions with categorization results
 */
export async function updateTransactionCategories(
  categorizations: Array<{
    id: string
    category: string
    confidence: number
    summary: string
  }>
): Promise<void> {
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  logger.debug(`[InsertTransactions] Updating ${categorizations.length} transaction categories`)

  for (const cat of categorizations) {
    try {
      await db
        .update(tables.transactions)
        .set({
          category: cat.category,
          categoryConfidence: cat.confidence.toString(),
          summary: cat.summary,
          updatedAt: now as Date,
        })
        .where(eq(tables.transactions.id, cat.id))
    } catch (error) {
      logger.warn(`[InsertTransactions] Failed to update category for ${cat.id}:`, error)
    }
  }

  logger.debug(`[InsertTransactions] Category updates complete`)
}
