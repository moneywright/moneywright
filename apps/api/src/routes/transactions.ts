import { Hono } from 'hono'
import { z } from 'zod/v4'
import { auth, type AuthVariables } from '../middleware/auth'
import {
  getTransactions,
  getTransactionById,
  updateTransaction,
  linkTransactions,
  unlinkTransaction,
  findLinkCandidates,
  getTransactionStats,
} from '../services/transactions'
import { TRANSACTION_LINK_TYPES } from '../lib/constants'

const transactionRoutes = new Hono<{ Variables: AuthVariables }>()

// Apply auth to all routes
transactionRoutes.use('*', auth())

/**
 * Update transaction request schema
 */
const updateTransactionSchema = z.object({
  category: z.string().min(1).optional(),
  summary: z.string().optional(),
})

/**
 * Link transactions request schema
 */
const linkTransactionsSchema = z.object({
  transactionId1: z.string().min(1, 'Transaction ID 1 is required'),
  transactionId2: z.string().min(1, 'Transaction ID 2 is required'),
  linkType: z.enum(TRANSACTION_LINK_TYPES),
})

/**
 * Parse comma-separated query param into array
 */
function parseMultiValue(value: string | undefined): string[] | undefined {
  if (!value) return undefined
  const values = value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
  return values.length > 0 ? values : undefined
}

/**
 * GET /transactions
 * List transactions with filters and pagination
 */
transactionRoutes.get('/', async (c) => {
  const userId = c.get('userId')

  // Parse query params
  const profileId = c.req.query('profileId')
  const accountId = c.req.query('accountId')
  const statementId = c.req.query('statementId')
  const category = c.req.query('category')
  const type = c.req.query('type') as 'credit' | 'debit' | undefined
  const startDate = c.req.query('startDate')
  const endDate = c.req.query('endDate')
  const search = c.req.query('search')
  const minAmount = c.req.query('minAmount')
  const maxAmount = c.req.query('maxAmount')
  const page = parseInt(c.req.query('page') || '1', 10)
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100)
  const sortBy = c.req.query('sortBy') as 'date' | 'amount' | 'createdAt' | undefined
  const sortOrder = c.req.query('sortOrder') as 'asc' | 'desc' | undefined

  // Parse multi-value filters (comma-separated)
  const statementIds = parseMultiValue(statementId)
  const categories = parseMultiValue(category)

  const result = await getTransactions(
    userId,
    {
      profileId: profileId || undefined,
      accountId: accountId || undefined,
      statementId: statementIds,
      category: categories,
      type: type && ['credit', 'debit'].includes(type) ? type : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      search: search || undefined,
      minAmount: minAmount ? parseFloat(minAmount) : undefined,
      maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
    },
    {
      page,
      limit,
      sortBy: sortBy || undefined,
      sortOrder: sortOrder || undefined,
    }
  )

  return c.json(result)
})

/**
 * GET /transactions/stats
 * Get transaction statistics
 */
transactionRoutes.get('/stats', async (c) => {
  const userId = c.get('userId')

  const profileId = c.req.query('profileId')
  const accountId = c.req.query('accountId')
  const startDate = c.req.query('startDate')
  const endDate = c.req.query('endDate')
  const category = c.req.query('category')
  const statementId = c.req.query('statementId')
  const type = c.req.query('type')
  const search = c.req.query('search')

  // Parse multi-value filters
  const categories = parseMultiValue(category)
  const statementIds = parseMultiValue(statementId)

  const stats = await getTransactionStats(userId, {
    profileId: profileId || undefined,
    accountId: accountId || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    category: categories,
    statementId: statementIds,
    type: type && ['credit', 'debit'].includes(type) ? (type as 'credit' | 'debit') : undefined,
    search: search || undefined,
  })

  return c.json(stats)
})

/**
 * GET /transactions/:id
 * Get a specific transaction
 */
transactionRoutes.get('/:id', async (c) => {
  const userId = c.get('userId')
  const transactionId = c.req.param('id')

  const transaction = await getTransactionById(transactionId, userId)

  if (!transaction) {
    return c.json({ error: 'not_found', message: 'Transaction not found' }, 404)
  }

  return c.json({ transaction })
})

/**
 * GET /transactions/:id/link-candidates
 * Find potential transactions to link with
 */
transactionRoutes.get('/:id/link-candidates', async (c) => {
  const userId = c.get('userId')
  const transactionId = c.req.param('id')

  try {
    const candidates = await findLinkCandidates(transactionId, userId)
    return c.json({ candidates })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to find candidates'

    if (message === 'Transaction not found') {
      return c.json({ error: 'not_found', message }, 404)
    }

    return c.json({ error: 'failed', message }, 400)
  }
})

/**
 * PATCH /transactions/:id
 * Update a transaction (category, summary)
 */
transactionRoutes.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const transactionId = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))

  // Validate request body
  const result = updateTransactionSchema.safeParse(body)
  if (!result.success) {
    return c.json(
      {
        error: 'validation_error',
        message: result.error.issues[0]?.message || 'Invalid request',
      },
      400
    )
  }

  try {
    const transaction = await updateTransaction(transactionId, userId, result.data)
    return c.json({ transaction })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update transaction'

    if (message === 'Transaction not found') {
      return c.json({ error: 'not_found', message }, 404)
    }

    return c.json({ error: 'update_failed', message }, 400)
  }
})

/**
 * POST /transactions/link
 * Link two transactions
 */
transactionRoutes.post('/link', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => ({}))

  // Validate request body
  const result = linkTransactionsSchema.safeParse(body)
  if (!result.success) {
    return c.json(
      {
        error: 'validation_error',
        message: result.error.issues[0]?.message || 'Invalid request',
      },
      400
    )
  }

  try {
    await linkTransactions(
      result.data.transactionId1,
      result.data.transactionId2,
      result.data.linkType,
      userId
    )
    return c.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to link transactions'

    if (message.includes('not found')) {
      return c.json({ error: 'not_found', message }, 404)
    }

    return c.json({ error: 'link_failed', message }, 400)
  }
})

/**
 * DELETE /transactions/:id/link
 * Unlink a transaction
 */
transactionRoutes.delete('/:id/link', async (c) => {
  const userId = c.get('userId')
  const transactionId = c.req.param('id')

  try {
    await unlinkTransaction(transactionId, userId)
    return c.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to unlink transaction'

    if (message === 'Transaction not found') {
      return c.json({ error: 'not_found', message }, 404)
    }

    if (message === 'Transaction is not linked') {
      return c.json({ error: 'not_linked', message }, 400)
    }

    return c.json({ error: 'unlink_failed', message }, 400)
  }
})

export default transactionRoutes
