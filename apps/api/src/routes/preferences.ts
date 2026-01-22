import { Hono } from 'hono'
import { z } from 'zod/v4'
import { auth, type AuthVariables } from '../middleware/auth'
import {
  getPreference,
  setPreference,
  deletePreference,
  getAllPreferences,
  PREFERENCE_KEYS,
  type PreferenceKey,
} from '../services/preferences'

const preferencesRoutes = new Hono<{ Variables: AuthVariables }>()

// Apply auth to all routes
preferencesRoutes.use('*', auth())

/**
 * Schema for setting a preference
 */
const setPreferenceSchema = z.object({
  key: z.string().min(1),
  value: z.string(), // Can be JSON string for complex values
  profileId: z.string().optional().nullable(),
})

/**
 * GET /preferences
 * Get all preferences for the user (optionally filtered by profile)
 */
preferencesRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const profileId = c.req.query('profileId')

  const preferences = await getAllPreferences(userId, profileId || null)

  return c.json({ preferences })
})

/**
 * GET /preferences/:key
 * Get a specific preference
 */
preferencesRoutes.get('/:key', async (c) => {
  const userId = c.get('userId')
  const key = c.req.param('key') as PreferenceKey
  const profileId = c.req.query('profileId')

  const value = await getPreference(userId, key, profileId || null)

  return c.json({ key, value, profileId: profileId || null })
})

/**
 * PUT /preferences
 * Set a preference
 */
preferencesRoutes.put('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => ({}))

  const result = setPreferenceSchema.safeParse(body)
  if (!result.success) {
    return c.json(
      {
        error: 'validation_error',
        message: result.error.issues[0]?.message || 'Invalid request',
      },
      400
    )
  }

  const { key, value, profileId } = result.data

  await setPreference(userId, key as PreferenceKey, value, profileId)

  return c.json({ success: true, key, profileId: profileId || null })
})

/**
 * DELETE /preferences/:key
 * Delete a preference
 */
preferencesRoutes.delete('/:key', async (c) => {
  const userId = c.get('userId')
  const key = c.req.param('key') as PreferenceKey
  const profileId = c.req.query('profileId')

  await deletePreference(userId, key, profileId || null)

  return c.json({ success: true })
})

export default preferencesRoutes

// Export preference keys for frontend use
export { PREFERENCE_KEYS }
