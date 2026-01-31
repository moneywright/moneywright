import { Hono } from 'hono'
import { z } from 'zod/v4'
import { auth, type AuthVariables } from '../middleware/auth'
import {
  getAccountsWithBalances,
  getAccountById,
  createAccount,
  updateAccount,
  deleteAccount,
} from '../services/accounts'
import { getAccountTypesForCountry, type CountryCode } from '../lib/constants'
import { findUserById } from '../services/user'

const accountRoutes = new Hono<{ Variables: AuthVariables }>()

// Apply auth to all routes
accountRoutes.use('*', auth())

/**
 * Create account request schema
 */
const createAccountSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  type: z.string().min(1, 'Account type is required'),
  institution: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  accountName: z.string().optional().nullable(),
  currency: z.string().min(1, 'Currency is required').max(3),
  statementPassword: z.string().optional().nullable(),
})

/**
 * Update account request schema
 */
const updateAccountSchema = z.object({
  accountName: z.string().min(1).optional(),
  productName: z.string().optional().nullable(),
  institution: z.string().optional().nullable(),
  statementPassword: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

/**
 * GET /accounts
 * List all accounts for the current user with latest balances
 * Query params: profileId (optional)
 */
accountRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const profileId = c.req.query('profileId')

  const accounts = await getAccountsWithBalances(userId, profileId || undefined)

  return c.json({ accounts })
})

/**
 * GET /accounts/types
 * Get available account types for the user's country
 */
accountRoutes.get('/types', async (c) => {
  const userId = c.get('userId')

  // Get user's country
  const user = await findUserById(userId)
  if (!user) {
    return c.json({ error: 'not_found', message: 'User not found' }, 404)
  }

  const countryCode = (user.country || 'US') as CountryCode
  const accountTypes = getAccountTypesForCountry(countryCode)

  return c.json({ accountTypes })
})

/**
 * POST /accounts
 * Create a new account
 */
accountRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => ({}))

  // Validate request body
  const result = createAccountSchema.safeParse(body)
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
    const account = await createAccount({
      ...result.data,
      userId,
    })

    return c.json({ account }, 201)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create account'
    return c.json({ error: 'create_failed', message }, 400)
  }
})

/**
 * GET /accounts/:id
 * Get a specific account
 */
accountRoutes.get('/:id', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')

  const account = await getAccountById(accountId, userId)

  if (!account) {
    return c.json({ error: 'not_found', message: 'Account not found' }, 404)
  }

  return c.json({ account })
})

/**
 * PATCH /accounts/:id
 * Update an account
 */
accountRoutes.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))

  // Validate request body
  const result = updateAccountSchema.safeParse(body)
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
    const account = await updateAccount(accountId, userId, result.data)
    return c.json({ account })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update account'

    if (message === 'Account not found') {
      return c.json({ error: 'not_found', message }, 404)
    }

    return c.json({ error: 'update_failed', message }, 400)
  }
})

/**
 * DELETE /accounts/:id
 * Delete an account
 */
accountRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')

  try {
    await deleteAccount(accountId, userId)
    return c.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete account'

    if (message === 'Account not found') {
      return c.json({ error: 'not_found', message }, 404)
    }

    return c.json({ error: 'delete_failed', message }, 400)
  }
})

/**
 * GET /accounts/:id/payment-history
 * Get payment history for a credit card account
 */
accountRoutes.get('/:id/payment-history', async (c) => {
  const userId = c.get('userId')
  const accountId = c.req.param('id')

  try {
    const { getCreditCardPaymentHistory } = await import('../services/entity-linking')
    const payments = await getCreditCardPaymentHistory(accountId, userId)
    return c.json({ payments })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get payment history'
    return c.json({ error: 'fetch_failed', message }, 400)
  }
})

export default accountRoutes
