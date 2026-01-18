import { eq, and, desc, asc, like, or, sql, gte, lte } from 'drizzle-orm'
import { db, tables, dbType } from '../db'
import type { Transaction } from '../db'
import { logger } from '../lib/logger'

/**
 * Transaction service
 * Handles transaction CRUD and cross-account linking
 */

/**
 * Transaction response type
 */
export interface TransactionResponse {
  id: string
  accountId: string
  statementId: string
  profileId: string
  userId: string
  date: string
  type: 'credit' | 'debit'
  amount: number
  currency: string
  originalDescription: string
  summary: string | null
  category: string
  categoryConfidence: number | null
  linkedTransactionId: string | null
  linkType: string | null
  createdAt: string | Date
  updatedAt: string | Date
}

/**
 * Transaction filters
 */
export interface TransactionFilters {
  profileId?: string
  accountId?: string
  statementId?: string
  category?: string
  type?: 'credit' | 'debit'
  startDate?: string
  endDate?: string
  search?: string
  minAmount?: number
  maxAmount?: number
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number
  limit?: number
  sortBy?: 'date' | 'amount' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

/**
 * Transform transaction to response format
 */
function toTransactionResponse(txn: Transaction): TransactionResponse {
  return {
    id: txn.id,
    accountId: txn.accountId,
    statementId: txn.statementId,
    profileId: txn.profileId,
    userId: txn.userId,
    date: typeof txn.date === 'string' ? txn.date : txn.date,
    type: txn.type as 'credit' | 'debit',
    amount: typeof txn.amount === 'string' ? parseFloat(txn.amount) : Number(txn.amount),
    currency: txn.currency,
    originalDescription: txn.originalDescription,
    summary: txn.summary,
    category: txn.category,
    categoryConfidence: txn.categoryConfidence
      ? typeof txn.categoryConfidence === 'string'
        ? parseFloat(txn.categoryConfidence)
        : Number(txn.categoryConfidence)
      : null,
    linkedTransactionId: txn.linkedTransactionId,
    linkType: txn.linkType,
    createdAt: txn.createdAt,
    updatedAt: txn.updatedAt,
  }
}

/**
 * Get transactions with filters and pagination
 */
export async function getTransactions(
  userId: string,
  filters?: TransactionFilters,
  pagination?: PaginationOptions
): Promise<{ transactions: TransactionResponse[]; total: number; page: number; limit: number }> {
  const page = pagination?.page || 1
  const limit = pagination?.limit || 50
  const offset = (page - 1) * limit
  const sortBy = pagination?.sortBy || 'date'
  const sortOrder = pagination?.sortOrder || 'desc'

  // Build conditions
  const conditions = [eq(tables.transactions.userId, userId)]

  if (filters?.profileId) {
    conditions.push(eq(tables.transactions.profileId, filters.profileId))
  }

  if (filters?.accountId) {
    conditions.push(eq(tables.transactions.accountId, filters.accountId))
  }

  if (filters?.statementId) {
    conditions.push(eq(tables.transactions.statementId, filters.statementId))
  }

  if (filters?.category) {
    conditions.push(eq(tables.transactions.category, filters.category))
  }

  if (filters?.type) {
    conditions.push(eq(tables.transactions.type, filters.type))
  }

  if (filters?.startDate) {
    conditions.push(gte(tables.transactions.date, filters.startDate))
  }

  if (filters?.endDate) {
    conditions.push(lte(tables.transactions.date, filters.endDate))
  }

  if (filters?.search) {
    const searchTerm = `%${filters.search}%`
    conditions.push(
      or(
        like(tables.transactions.originalDescription, searchTerm),
        like(tables.transactions.summary, searchTerm)
      )!
    )
  }

  // Build sort
  const sortColumn =
    sortBy === 'date'
      ? tables.transactions.date
      : sortBy === 'amount'
        ? tables.transactions.amount
        : tables.transactions.createdAt

  const orderFn = sortOrder === 'asc' ? asc : desc

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(tables.transactions)
    .where(and(...conditions))

  const total = Number(countResult[0]?.count || 0)

  // Get transactions
  const transactions = await db
    .select()
    .from(tables.transactions)
    .where(and(...conditions))
    .orderBy(orderFn(sortColumn))
    .limit(limit)
    .offset(offset)

  return {
    transactions: transactions.map(toTransactionResponse),
    total,
    page,
    limit,
  }
}

/**
 * Get a transaction by ID
 */
export async function getTransactionById(
  transactionId: string,
  userId: string
): Promise<TransactionResponse | null> {
  const [txn] = await db
    .select()
    .from(tables.transactions)
    .where(and(eq(tables.transactions.id, transactionId), eq(tables.transactions.userId, userId)))
    .limit(1)

  return txn ? toTransactionResponse(txn) : null
}

/**
 * Update a transaction (category only for now)
 */
export async function updateTransaction(
  transactionId: string,
  userId: string,
  data: {
    category?: string
    summary?: string
  }
): Promise<TransactionResponse> {
  // Verify ownership
  const existing = await getTransactionById(transactionId, userId)
  if (!existing) {
    throw new Error('Transaction not found')
  }

  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  const updateData: Partial<Transaction> = {
    updatedAt: now as Date,
  }

  if (data.category !== undefined) {
    updateData.category = data.category
    // Reset confidence since user manually changed it
    updateData.categoryConfidence = '1.00' as unknown as typeof updateData.categoryConfidence
  }

  if (data.summary !== undefined) {
    updateData.summary = data.summary
  }

  const [updated] = await db
    .update(tables.transactions)
    .set(updateData)
    .where(eq(tables.transactions.id, transactionId))
    .returning()

  if (!updated) {
    throw new Error('Failed to update transaction')
  }

  logger.debug(`[Transaction] Updated transaction ${transactionId}`)
  return toTransactionResponse(updated)
}

/**
 * Link two transactions (payment, transfer, refund)
 */
export async function linkTransactions(
  transactionId1: string,
  transactionId2: string,
  linkType: 'payment' | 'transfer' | 'refund',
  userId: string
): Promise<void> {
  // Verify ownership of both transactions
  const txn1 = await getTransactionById(transactionId1, userId)
  const txn2 = await getTransactionById(transactionId2, userId)

  if (!txn1 || !txn2) {
    throw new Error('One or both transactions not found')
  }

  // Validate link makes sense
  // Payment: debit from bank, credit to credit card
  // Transfer: debit from one account, credit to another
  // Refund: credit card credit, matching earlier debit

  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  // Update both transactions to link to each other
  await db
    .update(tables.transactions)
    .set({
      linkedTransactionId: transactionId2,
      linkType,
      updatedAt: now as Date,
    })
    .where(eq(tables.transactions.id, transactionId1))

  await db
    .update(tables.transactions)
    .set({
      linkedTransactionId: transactionId1,
      linkType,
      updatedAt: now as Date,
    })
    .where(eq(tables.transactions.id, transactionId2))

  logger.debug(
    `[Transaction] Linked transactions ${transactionId1} <-> ${transactionId2} (${linkType})`
  )
}

/**
 * Unlink transactions
 */
export async function unlinkTransaction(transactionId: string, userId: string): Promise<void> {
  const txn = await getTransactionById(transactionId, userId)
  if (!txn) {
    throw new Error('Transaction not found')
  }

  if (!txn.linkedTransactionId) {
    throw new Error('Transaction is not linked')
  }

  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  // Unlink both sides
  await db
    .update(tables.transactions)
    .set({
      linkedTransactionId: null,
      linkType: null,
      updatedAt: now as Date,
    })
    .where(eq(tables.transactions.id, transactionId))

  await db
    .update(tables.transactions)
    .set({
      linkedTransactionId: null,
      linkType: null,
      updatedAt: now as Date,
    })
    .where(eq(tables.transactions.id, txn.linkedTransactionId))

  logger.debug(`[Transaction] Unlinked transaction ${transactionId}`)
}

/**
 * Find potential link candidates for a transaction
 * Used for auto-suggesting links
 */
export async function findLinkCandidates(
  transactionId: string,
  userId: string
): Promise<TransactionResponse[]> {
  const txn = await getTransactionById(transactionId, userId)
  if (!txn) {
    throw new Error('Transaction not found')
  }

  // Look for transactions with:
  // - Same amount
  // - Opposite type (debit <-> credit)
  // - Within 3 days
  // - Different account
  // - Not already linked

  const oppositeType = txn.type === 'credit' ? 'debit' : 'credit'

  // Date range: ±3 days
  const txnDate = new Date(txn.date)
  const startDate = new Date(txnDate)
  startDate.setDate(startDate.getDate() - 3)
  const endDate = new Date(txnDate)
  endDate.setDate(endDate.getDate() + 3)

  const startDateStr = startDate.toISOString().split('T')[0]!
  const endDateStr = endDate.toISOString().split('T')[0]!

  const candidates = await db
    .select()
    .from(tables.transactions)
    .where(
      and(
        eq(tables.transactions.userId, userId),
        eq(tables.transactions.type, oppositeType),
        eq(tables.transactions.amount, txn.amount.toString()),
        gte(tables.transactions.date, startDateStr),
        lte(tables.transactions.date, endDateStr),
        sql`${tables.transactions.accountId} != ${txn.accountId}`,
        sql`${tables.transactions.linkedTransactionId} IS NULL`
      )
    )
    .limit(10)

  return candidates.map(toTransactionResponse)
}

/**
 * Get transaction summary statistics
 */
export async function getTransactionStats(
  userId: string,
  filters?: {
    profileId?: string
    accountId?: string
    startDate?: string
    endDate?: string
    category?: string
    type?: 'credit' | 'debit'
    search?: string
  }
): Promise<{
  totalCredits: number
  totalDebits: number
  creditCount: number
  debitCount: number
  netAmount: number
  currency: string
  categoryBreakdown: { category: string; total: number; count: number }[]
}> {
  const conditions = [eq(tables.transactions.userId, userId)]

  if (filters?.profileId) {
    conditions.push(eq(tables.transactions.profileId, filters.profileId))
  }

  if (filters?.accountId) {
    conditions.push(eq(tables.transactions.accountId, filters.accountId))
  }

  if (filters?.startDate) {
    conditions.push(gte(tables.transactions.date, filters.startDate))
  }

  if (filters?.endDate) {
    conditions.push(lte(tables.transactions.date, filters.endDate))
  }

  if (filters?.category) {
    conditions.push(eq(tables.transactions.category, filters.category))
  }

  if (filters?.type) {
    conditions.push(eq(tables.transactions.type, filters.type))
  }

  if (filters?.search) {
    const searchTerm = `%${filters.search}%`
    conditions.push(
      or(
        like(tables.transactions.originalDescription, searchTerm),
        like(tables.transactions.summary, searchTerm)
      )!
    )
  }

  // Get all matching transactions
  const transactions = await db
    .select()
    .from(tables.transactions)
    .where(and(...conditions))

  // Calculate stats
  let totalCredits = 0
  let totalDebits = 0
  let creditCount = 0
  let debitCount = 0
  const categoryMap = new Map<string, { total: number; count: number }>()

  for (const txn of transactions) {
    const amount = typeof txn.amount === 'string' ? parseFloat(txn.amount) : Number(txn.amount)

    if (txn.type === 'credit') {
      totalCredits += amount
      creditCount++
    } else {
      totalDebits += amount
      debitCount++
    }

    // Category breakdown
    const existing = categoryMap.get(txn.category) || { total: 0, count: 0 }
    existing.total += amount
    existing.count++
    categoryMap.set(txn.category, existing)
  }

  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.total - a.total)

  // Get currency from transactions (default to INR if no transactions)
  const currency = transactions[0]?.currency || 'INR'

  return {
    totalCredits,
    totalDebits,
    creditCount,
    debitCount,
    netAmount: totalCredits - totalDebits,
    currency,
    categoryBreakdown,
  }
}
