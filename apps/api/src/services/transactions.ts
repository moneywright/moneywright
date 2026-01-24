import { eq, and, desc, asc, like, or, sql, gte, lte } from 'drizzle-orm'
import { db, tables, dbType } from '../db'
import type { Transaction } from '../db'
import { logger } from '../lib/logger'
import { decryptOptional } from '../lib/encryption'

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
  isSubscription: boolean
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
  accountId?: string | string[]
  statementId?: string | string[]
  category?: string | string[]
  type?: 'credit' | 'debit'
  startDate?: string
  endDate?: string
  search?: string
  minAmount?: number
  maxAmount?: number
  isSubscription?: boolean
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
    isSubscription: txn.isSubscription ?? false,
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
    const accountIds = Array.isArray(filters.accountId) ? filters.accountId : [filters.accountId]
    if (accountIds.length === 1) {
      conditions.push(eq(tables.transactions.accountId, accountIds[0]!))
    } else if (accountIds.length > 1) {
      conditions.push(or(...accountIds.map((id) => eq(tables.transactions.accountId, id)))!)
    }
  }

  if (filters?.statementId) {
    const statementIds = Array.isArray(filters.statementId)
      ? filters.statementId
      : [filters.statementId]
    if (statementIds.length === 1) {
      conditions.push(eq(tables.transactions.statementId, statementIds[0]!))
    } else if (statementIds.length > 1) {
      conditions.push(or(...statementIds.map((id) => eq(tables.transactions.statementId, id)))!)
    }
  }

  if (filters?.category) {
    const categories = Array.isArray(filters.category) ? filters.category : [filters.category]
    if (categories.length === 1) {
      conditions.push(eq(tables.transactions.category, categories[0]!))
    } else if (categories.length > 1) {
      conditions.push(or(...categories.map((cat) => eq(tables.transactions.category, cat)))!)
    }
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

  if (filters?.isSubscription !== undefined) {
    conditions.push(eq(tables.transactions.isSubscription, filters.isSubscription))
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
    accountId?: string | string[]
    statementId?: string | string[]
    startDate?: string
    endDate?: string
    category?: string | string[]
    type?: 'credit' | 'debit'
    search?: string
    isSubscription?: boolean
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
    const accountIds = Array.isArray(filters.accountId) ? filters.accountId : [filters.accountId]
    if (accountIds.length === 1) {
      conditions.push(eq(tables.transactions.accountId, accountIds[0]!))
    } else if (accountIds.length > 1) {
      conditions.push(or(...accountIds.map((id) => eq(tables.transactions.accountId, id)))!)
    }
  }

  if (filters?.statementId) {
    const statementIds = Array.isArray(filters.statementId)
      ? filters.statementId
      : [filters.statementId]
    if (statementIds.length === 1) {
      conditions.push(eq(tables.transactions.statementId, statementIds[0]!))
    } else if (statementIds.length > 1) {
      conditions.push(or(...statementIds.map((id) => eq(tables.transactions.statementId, id)))!)
    }
  }

  if (filters?.startDate) {
    conditions.push(gte(tables.transactions.date, filters.startDate))
  }

  if (filters?.endDate) {
    conditions.push(lte(tables.transactions.date, filters.endDate))
  }

  if (filters?.category) {
    const categories = Array.isArray(filters.category) ? filters.category : [filters.category]
    if (categories.length === 1) {
      conditions.push(eq(tables.transactions.category, categories[0]!))
    } else if (categories.length > 1) {
      conditions.push(or(...categories.map((cat) => eq(tables.transactions.category, cat)))!)
    }
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

  if (filters?.isSubscription !== undefined) {
    conditions.push(eq(tables.transactions.isSubscription, filters.isSubscription))
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
  // Track both debits and credits per category to calculate net spending
  const categoryMap = new Map<string, { debits: number; credits: number; count: number }>()

  for (const txn of transactions) {
    const amount = typeof txn.amount === 'string' ? parseFloat(txn.amount) : Number(txn.amount)

    if (txn.type === 'credit') {
      totalCredits += amount
      creditCount++
    } else {
      totalDebits += amount
      debitCount++
    }

    // Track both debits and credits per category
    const existing = categoryMap.get(txn.category) || { debits: 0, credits: 0, count: 0 }
    if (txn.type === 'credit') {
      existing.credits += amount
    } else {
      existing.debits += amount
    }
    existing.count++
    categoryMap.set(txn.category, existing)
  }

  // Calculate net spending (debits - credits) per category
  // Only include categories where net spending is positive
  // Exclude NETTED_CATEGORIES (like credit_card_payment) as they are internal transfers
  const categoryBreakdown = Array.from(categoryMap.entries())
    .filter(([category]) => !NETTED_CATEGORIES.includes(category))
    .map(([category, data]) => ({
      category,
      total: data.debits - data.credits, // Net spending
      count: data.count,
    }))
    .filter((c) => c.total > 0) // Only show categories with positive net spending
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

// ============================================================================
// AI CATEGORY BREAKDOWN
// ============================================================================

/**
 * Category breakdown for AI analysis
 */
export interface CategoryBreakdown {
  period: {
    startDate: string
    endDate: string
  }
  categories: {
    category: string
    credits: number
    debits: number
    creditCount: number
    debitCount: number
    net: number // credits - debits (positive = net inflow, negative = net outflow)
  }[]
  totals: {
    credits: number
    debits: number
    creditCount: number
    debitCount: number
    net: number
  }
  currency: string
}

/**
 * Get category breakdown for AI chat
 *
 * Returns credits and debits for each category, letting the AI
 * determine what counts as income, expenses, investments, etc.
 */
export async function getCategoryBreakdown(
  userId: string,
  filters: {
    profileId: string
    startDate?: string
    endDate?: string
  }
): Promise<CategoryBreakdown> {
  const conditions = [
    eq(tables.transactions.userId, userId),
    eq(tables.transactions.profileId, filters.profileId),
  ]

  if (filters.startDate) {
    conditions.push(gte(tables.transactions.date, filters.startDate))
  }

  if (filters.endDate) {
    conditions.push(lte(tables.transactions.date, filters.endDate))
  }

  // Get all matching transactions
  const transactions = await db
    .select()
    .from(tables.transactions)
    .where(and(...conditions))

  // Track per category
  const categoryMap = new Map<
    string,
    { credits: number; debits: number; creditCount: number; debitCount: number }
  >()

  let totalCredits = 0
  let totalDebits = 0
  let totalCreditCount = 0
  let totalDebitCount = 0

  for (const txn of transactions) {
    const amount = typeof txn.amount === 'string' ? parseFloat(txn.amount) : Number(txn.amount)

    const existing = categoryMap.get(txn.category) || {
      credits: 0,
      debits: 0,
      creditCount: 0,
      debitCount: 0,
    }

    if (txn.type === 'credit') {
      existing.credits += amount
      existing.creditCount++
      totalCredits += amount
      totalCreditCount++
    } else {
      existing.debits += amount
      existing.debitCount++
      totalDebits += amount
      totalDebitCount++
    }

    categoryMap.set(txn.category, existing)
  }

  // Build category list sorted by total volume (debits + credits)
  const categories = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      credits: Math.round(data.credits * 100) / 100,
      debits: Math.round(data.debits * 100) / 100,
      creditCount: data.creditCount,
      debitCount: data.debitCount,
      net: Math.round((data.credits - data.debits) * 100) / 100,
    }))
    .sort((a, b) => b.debits + b.credits - (a.debits + a.credits))

  const currency = transactions[0]?.currency || 'INR'

  return {
    period: {
      startDate: filters.startDate || 'all time',
      endDate: filters.endDate || 'now',
    },
    categories,
    totals: {
      credits: Math.round(totalCredits * 100) / 100,
      debits: Math.round(totalDebits * 100) / 100,
      creditCount: totalCreditCount,
      debitCount: totalDebitCount,
      net: Math.round((totalCredits - totalDebits) * 100) / 100,
    },
    currency,
  }
}

/**
 * Monthly trend data point
 */
export interface MonthlyTrendData {
  month: string // YYYY-MM format
  monthLabel: string // e.g., "Jan 24"
  income: number
  expenses: number
  net: number
}

// Categories that should be netted (debits - credits) instead of counted separately
// These are typically internal transfers that shouldn't inflate income/expenses
const NETTED_CATEGORIES = ['credit_card_payment', 'transfer']

/**
 * Month transactions response for the modal
 */
export interface MonthTransactionsResponse {
  month: string
  monthLabel: string
  credits: TransactionResponse[]
  debits: TransactionResponse[]
  totals: {
    income: number
    expenses: number
    net: number
  }
  currency: string
}

/**
 * Get transactions for a specific month with netting and exclusions applied
 * Returns transactions grouped by type and totals matching the chart logic
 *
 * For netted categories (like credit_card_payment):
 * - If credits and debits are equal, hide them completely
 * - If there's a difference, show only the net amount on the appropriate side
 */
export async function getMonthTransactions(
  userId: string,
  profileId: string,
  month: string, // Format: YYYY-MM
  excludeCategories?: string[]
): Promise<MonthTransactionsResponse> {
  // Parse month and calculate date range
  // Use direct string construction to avoid timezone issues with toISOString()
  const [year, monthNum] = month.split('-').map(Number)
  const paddedMonth = String(monthNum).padStart(2, '0')
  const startDateStr = `${year}-${paddedMonth}-01`

  // Get last day of month by creating a date for day 0 of next month
  const lastDayOfMonth = new Date(year!, monthNum!, 0).getDate()
  const endDateStr = `${year}-${paddedMonth}-${String(lastDayOfMonth).padStart(2, '0')}`

  const monthLabel = new Date(year!, monthNum! - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
  })

  // Fetch all transactions for this month
  const transactions = await db
    .select()
    .from(tables.transactions)
    .where(
      and(
        eq(tables.transactions.userId, userId),
        eq(tables.transactions.profileId, profileId),
        gte(tables.transactions.date, startDateStr),
        lte(tables.transactions.date, endDateStr)
      )
    )
    .orderBy(desc(tables.transactions.date))

  // Filter out excluded categories
  const filteredTransactions = excludeCategories?.length
    ? transactions.filter((txn) => !excludeCategories.includes(txn.category))
    : transactions

  // Separate into credits and debits, excluding netted categories
  const credits: TransactionResponse[] = []
  const debits: TransactionResponse[] = []

  // Track totals with netting logic
  let income = 0
  let expenses = 0

  // Track netted categories separately
  const nettedData = new Map<
    string,
    {
      debits: number
      credits: number
      lastDebitTxn: TransactionResponse | null
      lastCreditTxn: TransactionResponse | null
    }
  >()

  for (const txn of filteredTransactions) {
    const response = toTransactionResponse(txn)
    const amount = response.amount

    if (NETTED_CATEGORIES.includes(txn.category)) {
      // Track netted categories separately - don't add to lists yet
      if (!nettedData.has(txn.category)) {
        nettedData.set(txn.category, {
          debits: 0,
          credits: 0,
          lastDebitTxn: null,
          lastCreditTxn: null,
        })
      }
      const data = nettedData.get(txn.category)!
      if (txn.type === 'credit') {
        data.credits += amount
        data.lastCreditTxn = response
      } else {
        data.debits += amount
        data.lastDebitTxn = response
      }
    } else {
      // Normal categories: add to lists directly
      if (txn.type === 'credit') {
        credits.push(response)
        income += amount
      } else {
        debits.push(response)
        expenses += amount
      }
    }
  }

  // Process netted categories - only show net difference if any
  const currency = filteredTransactions[0]?.currency || 'INR'

  for (const [category, data] of nettedData) {
    const net = data.debits - data.credits

    if (Math.abs(net) > 1) {
      // Only show if there's a meaningful difference (> 1 to handle rounding)
      // Create a synthetic transaction for the net difference
      const baseTxn = net > 0 ? data.lastDebitTxn : data.lastCreditTxn
      if (baseTxn) {
        const netTxn: TransactionResponse = {
          ...baseTxn,
          id: `${baseTxn.id}-net`,
          amount: Math.abs(net),
          type: net > 0 ? 'debit' : 'credit',
          summary: `Net ${category.replace(/_/g, ' ')}`,
          originalDescription: `Net difference for ${category.replace(/_/g, ' ')}`,
        }

        if (net > 0) {
          // More debits than credits - add to expenses
          debits.push(netTxn)
          expenses += Math.abs(net)
        } else {
          // More credits than debits - add to income
          credits.push(netTxn)
          income += Math.abs(net)
        }
      }
    }
    // If net is ~0, don't add anything (balanced, hide completely)
  }

  return {
    month,
    monthLabel,
    credits,
    debits,
    totals: {
      income: Math.round(income),
      expenses: Math.round(expenses),
      net: Math.round(income - expenses),
    },
    currency,
  }
}

/**
 * Options for monthly trends query
 */
export interface MonthlyTrendsOptions {
  /** Number of months to fetch (default: 12, max: 120) - used if startDate/endDate not provided */
  months?: number
  /** Start date in YYYY-MM-DD format - takes precedence over months */
  startDate?: string
  /** End date in YYYY-MM-DD format - takes precedence over months */
  endDate?: string
  /** Categories to exclude from calculations */
  excludeCategories?: string[]
}

/**
 * Get monthly income and expense trends for the last N months
 * Only returns months that have actual transaction data
 */
export async function getMonthlyTrends(
  userId: string,
  profileId: string,
  options: MonthlyTrendsOptions = {}
): Promise<{ trends: MonthlyTrendData[]; currency: string }> {
  const { months = 12, startDate, endDate, excludeCategories } = options

  // Calculate date range - use startDate/endDate if provided, otherwise use months
  let startDateStr: string
  let endDateStr: string | undefined

  if (startDate) {
    // Use provided dates
    startDateStr = startDate
    endDateStr = endDate
  } else {
    // Calculate from months
    const now = new Date()
    const startYear = now.getFullYear()
    const startMonth = now.getMonth() - months + 1
    const adjustedDate = new Date(startYear, startMonth, 1)
    startDateStr = `${adjustedDate.getFullYear()}-${String(adjustedDate.getMonth() + 1).padStart(2, '0')}-01`
  }

  // Build query conditions
  const conditions = [
    eq(tables.transactions.userId, userId),
    eq(tables.transactions.profileId, profileId),
    gte(tables.transactions.date, startDateStr),
  ]

  if (endDateStr) {
    conditions.push(lte(tables.transactions.date, endDateStr))
  }

  // Fetch all transactions in the date range
  const transactions = await db
    .select()
    .from(tables.transactions)
    .where(and(...conditions))

  // Filter out excluded categories if specified
  const filteredTransactions = excludeCategories?.length
    ? transactions.filter((txn) => !excludeCategories.includes(txn.category))
    : transactions

  // Group by month - only include months with data
  const monthlyData = new Map<
    string,
    {
      income: number
      expenses: number
      nettedDebits: Map<string, number>
      nettedCredits: Map<string, number>
    }
  >()

  // Aggregate transactions by month
  // Extract month directly from date string to avoid timezone issues
  for (const txn of filteredTransactions) {
    const monthKey = txn.date.substring(0, 7) // "YYYY-MM" from "YYYY-MM-DD"

    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, {
        income: 0,
        expenses: 0,
        nettedDebits: new Map(),
        nettedCredits: new Map(),
      })
    }

    const data = monthlyData.get(monthKey)!
    const amount = typeof txn.amount === 'string' ? parseFloat(txn.amount) : Number(txn.amount)

    // Check if this category should be netted
    if (NETTED_CATEGORIES.includes(txn.category)) {
      // Track debits and credits separately for netted categories
      if (txn.type === 'credit') {
        data.nettedCredits.set(txn.category, (data.nettedCredits.get(txn.category) || 0) + amount)
      } else {
        data.nettedDebits.set(txn.category, (data.nettedDebits.get(txn.category) || 0) + amount)
      }
    } else {
      // Normal categories: add to income or expenses directly
      if (txn.type === 'credit') {
        data.income += amount
      } else {
        data.expenses += amount
      }
    }
  }

  // Now calculate net values for netted categories and add to income/expenses
  for (const [, data] of monthlyData) {
    for (const category of NETTED_CATEGORIES) {
      const debits = data.nettedDebits.get(category) || 0
      const credits = data.nettedCredits.get(category) || 0
      const net = debits - credits

      // If net > 0, more money went out than came in (add to expenses)
      // If net < 0, more money came in than went out (add to income)
      // If net = 0, balanced transfer (no effect)
      if (net > 0) {
        data.expenses += net
      } else if (net < 0) {
        data.income += Math.abs(net)
      }
    }
  }

  // Convert to array and format - sorted chronologically
  const trends: MonthlyTrendData[] = Array.from(monthlyData.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => {
      const [year, monthNum] = month.split('-')
      const date = new Date(parseInt(year!), parseInt(monthNum!) - 1, 1)
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })

      return {
        month,
        monthLabel,
        income: Math.round(data.income),
        expenses: Math.round(data.expenses),
        net: Math.round(data.income - data.expenses),
      }
    })

  // Get currency from transactions (default to INR)
  const currency = filteredTransactions[0]?.currency || 'INR'

  return { trends, currency }
}

/**
 * Detected subscription
 */
export interface DetectedSubscription {
  name: string
  category: string
  amount: number
  frequency: 'monthly' | 'quarterly' | 'yearly' | 'unknown'
  lastChargeDate: string
  chargeCount: number
  transactions: Array<{ id: string; date: string; amount: number }>
  // Account info
  accountId: string | null
  accountLast4: string | null
  accountType: string | null
  institution: string | null
  // Active status
  isActive: boolean
}

/**
 * Get detected subscriptions from transaction data
 * Groups transactions marked as subscriptions by their summary/description
 */
export async function getDetectedSubscriptions(
  userId: string,
  profileId: string
): Promise<{ subscriptions: DetectedSubscription[]; totalMonthly: number; currency: string }> {
  // Fetch all subscription transactions with account info (last 12 months for pattern detection)
  const now = new Date()
  const startDate = new Date(now.getFullYear(), now.getMonth() - 12, 1)
  const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01`

  const transactionsWithAccounts = await db
    .select({
      transaction: tables.transactions,
      account: {
        id: tables.accounts.id,
        accountNumber: tables.accounts.accountNumber,
        type: tables.accounts.type,
        institution: tables.accounts.institution,
      },
    })
    .from(tables.transactions)
    .leftJoin(tables.accounts, eq(tables.transactions.accountId, tables.accounts.id))
    .where(
      and(
        eq(tables.transactions.userId, userId),
        eq(tables.transactions.profileId, profileId),
        eq(tables.transactions.isSubscription, true),
        eq(tables.transactions.type, 'debit'),
        gte(tables.transactions.date, startDateStr)
      )
    )
    .orderBy(desc(tables.transactions.date))

  // Group by summary (LLM-generated clean name) or fallback to original description
  const subscriptionGroups = new Map<
    string,
    {
      name: string
      category: string
      transactions: Array<{ id: string; date: string; amount: number }>
      accountId: string | null
      accountLast4: string | null
      accountType: string | null
      institution: string | null
    }
  >()

  for (const row of transactionsWithAccounts) {
    const txn = row.transaction
    const account = row.account

    // Use summary if available, otherwise use first 50 chars of description
    const name = txn.summary || txn.originalDescription.substring(0, 50).trim()
    // Group by first word only (lowercase) to handle inconsistent naming like "Furlenco rent" vs "Furlenco rental"
    const firstWord = name.split(/\s+/)[0] || name
    const groupKey = firstWord.toLowerCase().trim()

    // Get last 4 digits of account number (decrypt first since it's encrypted in DB)
    const decryptedAccountNumber = account?.accountNumber
      ? decryptOptional(account.accountNumber)
      : null
    const accountLast4 = decryptedAccountNumber ? decryptedAccountNumber.slice(-4) : null

    if (!subscriptionGroups.has(groupKey)) {
      subscriptionGroups.set(groupKey, {
        name: firstWord, // Use just the first word as the display name
        category: txn.category,
        transactions: [],
        accountId: account?.id || null,
        accountLast4,
        accountType: account?.type || null,
        institution: account?.institution || null,
      })
    }

    const group = subscriptionGroups.get(groupKey)!
    const amount = typeof txn.amount === 'string' ? parseFloat(txn.amount) : Number(txn.amount)
    group.transactions.push({
      id: txn.id,
      date: txn.date,
      amount,
    })
  }

  // Calculate frequency and build subscription objects
  const subscriptions: DetectedSubscription[] = []
  const today = new Date()

  for (const [, group] of subscriptionGroups) {
    if (group.transactions.length === 0) continue

    // Sort transactions by date (newest first)
    group.transactions.sort((a, b) => b.date.localeCompare(a.date))

    // Group transactions by month to handle multiple charges per month (e.g., Furlenco with 3 furniture items)
    const monthlyTotals = new Map<string, number>()
    for (const txn of group.transactions) {
      const monthKey = txn.date.substring(0, 7) // "YYYY-MM"
      monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) || 0) + txn.amount)
    }

    // Calculate average monthly cost (using last 3 months if available)
    const monthlyAmounts = Array.from(monthlyTotals.values())
    const recentMonths = monthlyAmounts.slice(0, 3)
    const avgAmount = recentMonths.reduce((sum, a) => sum + a, 0) / recentMonths.length

    // Individual transaction amounts for potential future CV calculation
    const _amounts = group.transactions.map((t) => t.amount)

    // Get last charge date info
    const lastChargeDate = new Date(group.transactions[0]!.date)
    const daysSinceLastCharge = Math.floor(
      (today.getTime() - lastChargeDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Detect frequency by analyzing gaps between transactions
    let frequency: DetectedSubscription['frequency'] = 'unknown'

    // Get unique months sorted (newest first)
    const uniqueMonths = Array.from(monthlyTotals.keys()).sort((a, b) => b.localeCompare(a))

    if (uniqueMonths.length >= 2) {
      // Calculate gaps between months (not individual transactions)
      // This handles cases like Furlenco where there are multiple charges per month
      const monthGaps: number[] = []
      for (let i = 0; i < uniqueMonths.length - 1; i++) {
        const [year1, month1] = uniqueMonths[i]!.split('-').map(Number)
        const [year2, month2] = uniqueMonths[i + 1]!.split('-').map(Number)
        const monthsDiff = (year1! - year2!) * 12 + (month1! - month2!)
        monthGaps.push(monthsDiff)
      }

      const avgMonthGap = monthGaps.reduce((sum, g) => sum + g, 0) / monthGaps.length

      // Calculate coefficient of variation (CV) for intervals and monthly amounts
      // CV = standard deviation / mean - measures consistency
      const calcCV = (values: number[]): number => {
        if (values.length < 2) return 0
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length
        if (mean === 0) return 0
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
        const stdDev = Math.sqrt(variance)
        return stdDev / mean
      }

      const intervalCV = calcCV(monthGaps)
      const monthlyAmountCV = calcCV(monthlyAmounts)

      // If BOTH intervals and monthly amounts are highly inconsistent, this is not a true subscription
      // (e.g., random purchases from same vendor like Namecheap domain renewals)
      // CV > 0.5 means standard deviation is more than 50% of mean
      if (intervalCV > 0.5 && monthlyAmountCV > 0.5 && uniqueMonths.length >= 3) {
        continue // Skip this group - not a true subscription
      }

      // Detect frequency based on average month gap
      if (avgMonthGap <= 1.5) {
        frequency = 'monthly'
      } else if (avgMonthGap <= 4) {
        frequency = 'quarterly'
      } else if (avgMonthGap <= 13) {
        frequency = 'yearly'
      }
    } else {
      // Single transaction: if at least 2 months old, consider yearly
      // Otherwise we don't know yet
      if (daysSinceLastCharge >= 60) {
        frequency = 'yearly'
      }
      // If less than 2 months old, keep as 'unknown' - we can't determine yet
    }

    // Determine if subscription is active based on frequency
    let isActive = true
    switch (frequency) {
      case 'monthly':
        // Inactive if no charges in last 2 months (60 days)
        isActive = daysSinceLastCharge <= 60
        break
      case 'quarterly':
        // Inactive if no charges in last 4 months (120 days)
        isActive = daysSinceLastCharge <= 120
        break
      case 'yearly':
        // Inactive if no charges in last 14 months (425 days)
        isActive = daysSinceLastCharge <= 425
        break
      case 'unknown':
        // For unknown frequency, consider active if charged in last 3 months
        isActive = daysSinceLastCharge <= 90
        break
    }

    subscriptions.push({
      name: group.name,
      category: group.category,
      amount: Math.round(avgAmount),
      frequency,
      lastChargeDate: group.transactions[0]!.date,
      chargeCount: group.transactions.length,
      transactions: group.transactions, // Keep all transactions
      accountId: group.accountId,
      accountLast4: group.accountLast4,
      accountType: group.accountType,
      institution: group.institution,
      isActive,
    })
  }

  // Helper to get monthly equivalent price
  const getMonthlyPrice = (sub: DetectedSubscription): number => {
    switch (sub.frequency) {
      case 'quarterly':
        return sub.amount / 3
      case 'yearly':
        return sub.amount / 12
      default:
        return sub.amount
    }
  }

  // Sort by monthly equivalent price descending (highest monthly cost first)
  subscriptions.sort((a, b) => getMonthlyPrice(b) - getMonthlyPrice(a))

  // Calculate total monthly cost (only for active subscriptions)
  let totalMonthly = 0
  for (const sub of subscriptions) {
    // Only count active subscriptions toward monthly cost
    if (!sub.isActive) continue

    switch (sub.frequency) {
      case 'monthly':
        totalMonthly += sub.amount
        break
      case 'quarterly':
        totalMonthly += sub.amount / 3
        break
      case 'yearly':
        totalMonthly += sub.amount / 12
        break
      case 'unknown':
        // For unknown frequency, don't include in monthly total
        // since we can't reliably estimate the recurring cost
        break
    }
  }

  const currency = transactionsWithAccounts[0]?.transaction.currency || 'INR'

  return {
    subscriptions,
    totalMonthly: Math.round(totalMonthly),
    currency,
  }
}
