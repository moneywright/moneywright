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
  const categoryBreakdown = Array.from(categoryMap.entries())
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
const NETTED_CATEGORIES = ['credit_card_payment']

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
 * Get monthly income and expense trends for the last N months
 * Only returns months that have actual transaction data
 */
export async function getMonthlyTrends(
  userId: string,
  profileId: string,
  months: number = 12,
  excludeCategories?: string[]
): Promise<{ trends: MonthlyTrendData[]; currency: string }> {
  // Calculate date range for the last N months
  // Use direct string construction to avoid timezone issues
  const now = new Date()
  const startYear = now.getFullYear()
  const startMonth = now.getMonth() - months + 1
  const adjustedDate = new Date(startYear, startMonth, 1)
  const startDateStr = `${adjustedDate.getFullYear()}-${String(adjustedDate.getMonth() + 1).padStart(2, '0')}-01`

  // Fetch all transactions in the date range
  const transactions = await db
    .select()
    .from(tables.transactions)
    .where(
      and(
        eq(tables.transactions.userId, userId),
        eq(tables.transactions.profileId, profileId),
        gte(tables.transactions.date, startDateStr)
      )
    )

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
