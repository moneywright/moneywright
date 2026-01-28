import { Hono } from 'hono'
import { z } from 'zod/v4'
import { auth, type AuthVariables } from '../middleware/auth'
import {
  getSourcesByUserId,
  getSourceById,
  createSource,
  updateSource,
  deleteSource,
} from '../services/investment-sources'
import {
  getHoldingsByUserId,
  getHoldingsBySourceId,
  getHoldingById,
  createHolding,
  updateHolding,
  deleteHolding,
  getInvestmentSummary,
} from '../services/investment-holdings'
import {
  getSnapshotsBySourceId,
  getSnapshotsByUserId,
  getSnapshotById,
  createSnapshot,
  deleteSnapshot,
} from '../services/investment-snapshots'
import {
  getInvestmentSourceTypesForCountry,
  INVESTMENT_HOLDING_TYPES,
  type CountryCode,
} from '../lib/constants'
import { findUserById } from '../services/user'

const investmentRoutes = new Hono<{ Variables: AuthVariables }>()

// Apply auth to all routes
investmentRoutes.use('*', auth())

// ============================================================================
// Investment Types
// ============================================================================

/**
 * GET /investments/types
 * Get available investment types (holdings, sources) for user's country
 */
investmentRoutes.get('/types', async (c) => {
  const userId = c.get('userId')

  const user = await findUserById(userId)
  if (!user) {
    return c.json({ error: 'not_found', message: 'User not found' }, 404)
  }

  const countryCode = (user.country || 'IN') as CountryCode
  const sourceTypes = getInvestmentSourceTypesForCountry(countryCode)

  return c.json({
    sourceTypes,
    holdingTypes: INVESTMENT_HOLDING_TYPES,
    countryCode,
  })
})

// ============================================================================
// Investment Summary
// ============================================================================

/**
 * GET /investments/summary
 * Get investment portfolio summary
 */
investmentRoutes.get('/summary', async (c) => {
  const userId = c.get('userId')
  const profileId = c.req.query('profileId')

  const summary = await getInvestmentSummary(userId, profileId || undefined)

  return c.json({ summary })
})

// ============================================================================
// Investment Sources
// ============================================================================

const createSourceSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  sourceType: z.string().min(1, 'Source type is required'),
  sourceName: z.string().min(1, 'Source name is required'),
  institution: z.string().optional().nullable(),
  accountIdentifier: z.string().optional().nullable(),
  countryCode: z.string().length(2).optional(),
  currency: z.string().length(3).optional(),
})

const updateSourceSchema = z.object({
  sourceName: z.string().min(1).optional(),
  institution: z.string().optional().nullable(),
  accountIdentifier: z.string().optional().nullable(),
  countryCode: z.string().length(2).optional(),
  currency: z.string().length(3).optional(),
})

/**
 * GET /investments/sources
 * List all investment sources for the user
 */
investmentRoutes.get('/sources', async (c) => {
  const userId = c.get('userId')
  const profileId = c.req.query('profileId')

  const sources = await getSourcesByUserId(userId, profileId || undefined)

  return c.json({ sources })
})

/**
 * POST /investments/sources
 * Create a new investment source
 */
investmentRoutes.post('/sources', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => ({}))

  const result = createSourceSchema.safeParse(body)
  if (!result.success) {
    return c.json(
      { error: 'validation_error', message: result.error.issues[0]?.message || 'Invalid request' },
      400
    )
  }

  try {
    const source = await createSource({ ...result.data, userId })
    return c.json({ source }, 201)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create source'
    return c.json({ error: 'create_failed', message }, 400)
  }
})

/**
 * GET /investments/sources/:id
 * Get a specific investment source
 */
investmentRoutes.get('/sources/:id', async (c) => {
  const userId = c.get('userId')
  const sourceId = c.req.param('id')

  const source = await getSourceById(sourceId, userId)
  if (!source) {
    return c.json({ error: 'not_found', message: 'Source not found' }, 404)
  }

  return c.json({ source })
})

/**
 * PATCH /investments/sources/:id
 * Update an investment source
 */
investmentRoutes.patch('/sources/:id', async (c) => {
  const userId = c.get('userId')
  const sourceId = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))

  const result = updateSourceSchema.safeParse(body)
  if (!result.success) {
    return c.json(
      { error: 'validation_error', message: result.error.issues[0]?.message || 'Invalid request' },
      400
    )
  }

  try {
    const source = await updateSource(sourceId, userId, result.data)
    return c.json({ source })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update source'
    if (message === 'Investment source not found') {
      return c.json({ error: 'not_found', message }, 404)
    }
    return c.json({ error: 'update_failed', message }, 400)
  }
})

/**
 * DELETE /investments/sources/:id
 * Delete an investment source
 */
investmentRoutes.delete('/sources/:id', async (c) => {
  const userId = c.get('userId')
  const sourceId = c.req.param('id')

  try {
    await deleteSource(sourceId, userId)
    return c.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete source'
    if (message === 'Investment source not found') {
      return c.json({ error: 'not_found', message }, 404)
    }
    return c.json({ error: 'delete_failed', message }, 400)
  }
})

/**
 * GET /investments/sources/:id/holdings
 * Get all holdings for a specific source
 */
investmentRoutes.get('/sources/:id/holdings', async (c) => {
  const userId = c.get('userId')
  const sourceId = c.req.param('id')

  // Verify source exists and user owns it
  const source = await getSourceById(sourceId, userId)
  if (!source) {
    return c.json({ error: 'not_found', message: 'Source not found' }, 404)
  }

  const holdings = await getHoldingsBySourceId(sourceId, userId)

  return c.json({ holdings })
})

/**
 * GET /investments/sources/:id/snapshots
 * Get snapshot history for a specific source
 */
investmentRoutes.get('/sources/:id/snapshots', async (c) => {
  const userId = c.get('userId')
  const sourceId = c.req.param('id')
  const startDate = c.req.query('startDate')
  const endDate = c.req.query('endDate')
  const limit = c.req.query('limit')

  // Verify source exists and user owns it
  const source = await getSourceById(sourceId, userId)
  if (!source) {
    return c.json({ error: 'not_found', message: 'Source not found' }, 404)
  }

  const snapshots = await getSnapshotsBySourceId(sourceId, userId, {
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
  })

  return c.json({ snapshots })
})

// ============================================================================
// Investment Holdings
// ============================================================================

const createHoldingSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  sourceId: z.string().optional().nullable(),
  investmentType: z.string().min(1, 'Investment type is required'),
  name: z.string().min(1, 'Name is required'),
  units: z.number().positive('Units must be positive').optional().nullable(),
  currentValue: z.number().min(0, 'Current value must be non-negative'),
  currency: z.string().length(3, 'Currency must be 3 characters'),
  asOfDate: z.string().min(1, 'As of date is required'),
  symbol: z.string().optional().nullable(),
  isin: z.string().optional().nullable(),
  averageCost: z.number().optional().nullable(),
  currentPrice: z.number().optional().nullable(),
  investedValue: z.number().optional().nullable(),
  folioNumber: z.string().optional().nullable(),
  maturityDate: z.string().optional().nullable(),
  interestRate: z.number().optional().nullable(),
})

const updateHoldingSchema = z.object({
  investmentType: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  units: z.number().positive().optional().nullable(),
  currentValue: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  asOfDate: z.string().min(1).optional(),
  symbol: z.string().optional().nullable(),
  isin: z.string().optional().nullable(),
  averageCost: z.number().optional().nullable(),
  currentPrice: z.number().optional().nullable(),
  investedValue: z.number().optional().nullable(),
  folioNumber: z.string().optional().nullable(),
  maturityDate: z.string().optional().nullable(),
  interestRate: z.number().optional().nullable(),
})

/**
 * GET /investments/holdings
 * List all holdings for the user
 */
investmentRoutes.get('/holdings', async (c) => {
  const userId = c.get('userId')
  const profileId = c.req.query('profileId')
  const sourceId = c.req.query('sourceId')

  const holdings = await getHoldingsByUserId(userId, {
    profileId: profileId || undefined,
    sourceId: sourceId || undefined,
  })

  return c.json({ holdings })
})

/**
 * POST /investments/holdings
 * Create a new holding (for manual entry)
 */
investmentRoutes.post('/holdings', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => ({}))

  const result = createHoldingSchema.safeParse(body)
  if (!result.success) {
    return c.json(
      { error: 'validation_error', message: result.error.issues[0]?.message || 'Invalid request' },
      400
    )
  }

  // Calculate gain/loss if we have both values
  let gainLoss: number | null = null
  let gainLossPercent: number | null = null
  const investedValue = result.data.investedValue ?? null

  if (investedValue !== null && result.data.currentValue !== null) {
    gainLoss = result.data.currentValue - investedValue
    if (investedValue > 0) {
      gainLossPercent = (gainLoss / investedValue) * 100
    }
  }

  try {
    const holding = await createHolding({
      ...result.data,
      userId,
      gainLoss,
      gainLossPercent,
    })
    return c.json({ holding }, 201)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create holding'
    return c.json({ error: 'create_failed', message }, 400)
  }
})

/**
 * GET /investments/holdings/:id
 * Get a specific holding
 */
investmentRoutes.get('/holdings/:id', async (c) => {
  const userId = c.get('userId')
  const holdingId = c.req.param('id')

  const holding = await getHoldingById(holdingId, userId)
  if (!holding) {
    return c.json({ error: 'not_found', message: 'Holding not found' }, 404)
  }

  return c.json({ holding })
})

/**
 * PATCH /investments/holdings/:id
 * Update a holding
 */
investmentRoutes.patch('/holdings/:id', async (c) => {
  const userId = c.get('userId')
  const holdingId = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))

  const result = updateHoldingSchema.safeParse(body)
  if (!result.success) {
    return c.json(
      { error: 'validation_error', message: result.error.issues[0]?.message || 'Invalid request' },
      400
    )
  }

  // Calculate gain/loss if updating values
  const updateData: typeof result.data & {
    gainLoss?: number | null
    gainLossPercent?: number | null
  } = { ...result.data }

  if (result.data.investedValue !== undefined || result.data.currentValue !== undefined) {
    // Get existing holding to compute gain/loss
    const existing = await getHoldingById(holdingId, userId)
    if (existing) {
      const investedValue = result.data.investedValue ?? existing.investedValue
      const currentValue = result.data.currentValue ?? existing.currentValue

      if (investedValue !== null && currentValue !== null) {
        updateData.gainLoss = currentValue - investedValue
        if (investedValue > 0) {
          updateData.gainLossPercent = (updateData.gainLoss / investedValue) * 100
        }
      }
    }
  }

  try {
    const holding = await updateHolding(holdingId, userId, updateData)
    return c.json({ holding })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update holding'
    if (message === 'Holding not found') {
      return c.json({ error: 'not_found', message }, 404)
    }
    return c.json({ error: 'update_failed', message }, 400)
  }
})

/**
 * DELETE /investments/holdings/:id
 * Delete a holding
 */
investmentRoutes.delete('/holdings/:id', async (c) => {
  const userId = c.get('userId')
  const holdingId = c.req.param('id')

  try {
    await deleteHolding(holdingId, userId)
    return c.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete holding'
    if (message === 'Holding not found') {
      return c.json({ error: 'not_found', message }, 404)
    }
    return c.json({ error: 'delete_failed', message }, 400)
  }
})

// ============================================================================
// Investment Snapshots
// ============================================================================

const createSnapshotSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  sourceId: z.string().optional().nullable(),
  snapshotDate: z.string().min(1, 'Snapshot date is required'),
  snapshotType: z.enum(['statement_import', 'manual', 'scheduled']),
  totalCurrent: z.number().min(0),
  holdingsCount: z.number().int().min(0),
  currency: z.string().length(3),
  totalInvested: z.number().optional().nullable(),
  totalGainLoss: z.number().optional().nullable(),
  gainLossPercent: z.number().optional().nullable(),
})

/**
 * GET /investments/snapshots
 * List all snapshots for the user
 */
investmentRoutes.get('/snapshots', async (c) => {
  const userId = c.get('userId')
  const profileId = c.req.query('profileId')
  const startDate = c.req.query('startDate')
  const endDate = c.req.query('endDate')
  const limit = c.req.query('limit')

  const snapshots = await getSnapshotsByUserId(userId, {
    profileId: profileId || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
  })

  return c.json({ snapshots })
})

/**
 * POST /investments/snapshots
 * Create a manual snapshot
 */
investmentRoutes.post('/snapshots', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => ({}))

  const result = createSnapshotSchema.safeParse(body)
  if (!result.success) {
    return c.json(
      { error: 'validation_error', message: result.error.issues[0]?.message || 'Invalid request' },
      400
    )
  }

  try {
    const snapshot = await createSnapshot({ ...result.data, userId })
    return c.json({ snapshot }, 201)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create snapshot'
    return c.json({ error: 'create_failed', message }, 400)
  }
})

/**
 * GET /investments/snapshots/:id
 * Get a specific snapshot
 */
investmentRoutes.get('/snapshots/:id', async (c) => {
  const userId = c.get('userId')
  const snapshotId = c.req.param('id')

  const snapshot = await getSnapshotById(snapshotId, userId)
  if (!snapshot) {
    return c.json({ error: 'not_found', message: 'Snapshot not found' }, 404)
  }

  return c.json({ snapshot })
})

/**
 * DELETE /investments/snapshots/:id
 * Delete a snapshot
 */
investmentRoutes.delete('/snapshots/:id', async (c) => {
  const userId = c.get('userId')
  const snapshotId = c.req.param('id')

  try {
    await deleteSnapshot(snapshotId, userId)
    return c.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete snapshot'
    if (message === 'Snapshot not found') {
      return c.json({ error: 'not_found', message }, 404)
    }
    return c.json({ error: 'delete_failed', message }, 400)
  }
})

export default investmentRoutes
