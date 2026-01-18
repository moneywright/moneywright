import { Hono } from 'hono'
import { z } from 'zod/v4'
import { auth, type AuthVariables } from '../middleware/auth'
import {
  getProfilesByUserId,
  getProfileById,
  createProfile,
  updateProfile,
  deleteProfile,
} from '../services/profiles'
import { RELATIONSHIP_TYPES } from '../lib/constants'

const profileRoutes = new Hono<{ Variables: AuthVariables }>()

// Apply auth to all routes
profileRoutes.use('*', auth())

/**
 * Create profile request schema
 */
const createProfileSchema = z.object({
  name: z
    .string()
    .min(1, 'Profile name is required')
    .max(50, 'Profile name must be 50 characters or less'),
  relationship: z.enum(RELATIONSHIP_TYPES).optional().nullable(),
  isDefault: z.boolean().optional(),
})

/**
 * Update profile request schema
 */
const updateProfileSchema = z.object({
  name: z
    .string()
    .min(1, 'Profile name is required')
    .max(50, 'Profile name must be 50 characters or less')
    .optional(),
  relationship: z.enum(RELATIONSHIP_TYPES).optional().nullable(),
  isDefault: z.boolean().optional(),
})

/**
 * GET /profiles
 * List all profiles for the current user
 */
profileRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const profiles = await getProfilesByUserId(userId)

  return c.json({
    profiles: profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      relationship: profile.relationship,
      isDefault: profile.isDefault,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    })),
  })
})

/**
 * POST /profiles
 * Create a new profile
 */
profileRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => ({}))

  // Validate request body
  const result = createProfileSchema.safeParse(body)
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
    const profile = await createProfile({
      userId,
      name: result.data.name,
      relationship: result.data.relationship,
      isDefault: result.data.isDefault,
    })

    return c.json(
      {
        profile: {
          id: profile.id,
          name: profile.name,
          relationship: profile.relationship,
          isDefault: profile.isDefault,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        },
      },
      201
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create profile'
    return c.json({ error: 'create_failed', message }, 400)
  }
})

/**
 * GET /profiles/:id
 * Get a specific profile
 */
profileRoutes.get('/:id', async (c) => {
  const userId = c.get('userId')
  const profileId = c.req.param('id')

  const profile = await getProfileById(profileId, userId)

  if (!profile) {
    return c.json({ error: 'not_found', message: 'Profile not found' }, 404)
  }

  return c.json({
    profile: {
      id: profile.id,
      name: profile.name,
      relationship: profile.relationship,
      isDefault: profile.isDefault,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    },
  })
})

/**
 * PATCH /profiles/:id
 * Update a profile
 */
profileRoutes.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const profileId = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))

  // Validate request body
  const result = updateProfileSchema.safeParse(body)
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
    const profile = await updateProfile(profileId, userId, {
      name: result.data.name,
      relationship: result.data.relationship,
      isDefault: result.data.isDefault,
    })

    return c.json({
      profile: {
        id: profile.id,
        name: profile.name,
        relationship: profile.relationship,
        isDefault: profile.isDefault,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update profile'

    if (message === 'Profile not found') {
      return c.json({ error: 'not_found', message }, 404)
    }

    return c.json({ error: 'update_failed', message }, 400)
  }
})

/**
 * DELETE /profiles/:id
 * Delete a profile
 */
profileRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const profileId = c.req.param('id')

  try {
    await deleteProfile(profileId, userId)
    return c.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete profile'

    if (message === 'Profile not found') {
      return c.json({ error: 'not_found', message }, 404)
    }

    return c.json({ error: 'delete_failed', message }, 400)
  }
})

export default profileRoutes
