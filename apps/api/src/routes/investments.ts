import { Hono } from 'hono'
import { z } from 'zod/v4'
import { auth, type AuthVariables } from '../middleware/auth'
import {
  getInvestmentsByUserId,
  getInvestmentById,
  createInvestment,
  updateInvestment,
  deleteInvestment,
} from '../services/investments'
import { getInvestmentTypesForCountry, type CountryCode } from '../lib/constants'
import { findUserById } from '../services/user'

const investmentRoutes = new Hono<{ Variables: AuthVariables }>()

// Apply auth to all routes
investmentRoutes.use('*', auth())

/**
 * Create investment request schema
 */
const createInvestmentSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  type: z.string().min(1, 'Investment type is required'),
  name: z.string().min(1, 'Investment name is required'),
  currency: z.string().min(1, 'Currency is required').max(3),
  institution: z.string().optional().nullable(),
  units: z.number().positive().optional().nullable(),
  purchaseValue: z.number().positive().optional().nullable(),
  currentValue: z.number().positive().optional().nullable(),
  folioNumber: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  maturityDate: z.string().optional().nullable(), // YYYY-MM-DD format
  interestRate: z.number().min(0).max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
})

/**
 * Update investment request schema
 */
const updateInvestmentSchema = z.object({
  type: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  institution: z.string().optional().nullable(),
  units: z.number().positive().optional().nullable(),
  purchaseValue: z.number().positive().optional().nullable(),
  currentValue: z.number().positive().optional().nullable(),
  currency: z.string().min(1).max(3).optional(),
  folioNumber: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  maturityDate: z.string().optional().nullable(),
  interestRate: z.number().min(0).max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
})

/**
 * GET /investments
 * List all investments for the current user
 * Query params: profileId (optional)
 */
investmentRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const profileId = c.req.query('profileId')

  const investments = await getInvestmentsByUserId(userId, profileId || undefined)

  return c.json({ investments })
})

/**
 * GET /investments/types
 * Get available investment types for the user's country
 */
investmentRoutes.get('/types', async (c) => {
  const userId = c.get('userId')

  // Get user's country
  const user = await findUserById(userId)
  if (!user) {
    return c.json({ error: 'not_found', message: 'User not found' }, 404)
  }

  const countryCode = (user.country || 'US') as CountryCode
  const investmentTypes = getInvestmentTypesForCountry(countryCode)

  return c.json({ investmentTypes, countryCode })
})

/**
 * POST /investments
 * Create a new investment
 */
investmentRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => ({}))

  // Validate request body
  const result = createInvestmentSchema.safeParse(body)
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
    const investment = await createInvestment({
      ...result.data,
      userId,
    })

    return c.json({ investment }, 201)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create investment'
    return c.json({ error: 'create_failed', message }, 400)
  }
})

/**
 * GET /investments/:id
 * Get a specific investment
 */
investmentRoutes.get('/:id', async (c) => {
  const userId = c.get('userId')
  const investmentId = c.req.param('id')

  const investment = await getInvestmentById(investmentId, userId)

  if (!investment) {
    return c.json({ error: 'not_found', message: 'Investment not found' }, 404)
  }

  return c.json({ investment })
})

/**
 * PATCH /investments/:id
 * Update an investment
 */
investmentRoutes.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const investmentId = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))

  // Validate request body
  const result = updateInvestmentSchema.safeParse(body)
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
    const investment = await updateInvestment(investmentId, userId, result.data)
    return c.json({ investment })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update investment'

    if (message === 'Investment not found') {
      return c.json({ error: 'not_found', message }, 404)
    }

    return c.json({ error: 'update_failed', message }, 400)
  }
})

/**
 * DELETE /investments/:id
 * Delete an investment
 */
investmentRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const investmentId = c.req.param('id')

  try {
    await deleteInvestment(investmentId, userId)
    return c.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete investment'

    if (message === 'Investment not found') {
      return c.json({ error: 'not_found', message }, 404)
    }

    return c.json({ error: 'delete_failed', message }, 400)
  }
})

export default investmentRoutes
