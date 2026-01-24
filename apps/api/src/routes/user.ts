import { Hono } from 'hono'
import { z } from 'zod/v4'
import { auth, type AuthVariables } from '../middleware/auth'
import { updateUserCountry, findUserById, isOnboardingComplete } from '../services/user'

const userRoutes = new Hono<{ Variables: AuthVariables }>()

/**
 * Onboarding request schema
 */
const onboardingSchema = z.object({
  country: z.string().length(2, 'Country code must be 2 characters'),
})

/**
 * POST /user/onboarding
 * Set user's country during onboarding
 */
userRoutes.post('/onboarding', auth(), async (c) => {
  const userId = c.get('userId')

  const body = await c.req.json().catch(() => ({}))

  // Validate request body
  const result = onboardingSchema.safeParse(body)
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
    const user = await updateUserCountry(userId, result.data.country)

    return c.json({
      success: true,
      user: {
        id: user.id,
        country: user.country,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update country'
    return c.json({ error: 'update_failed', message }, 400)
  }
})

/**
 * GET /user/me
 * Get current user details
 */
userRoutes.get('/me', auth(), async (c) => {
  const userId = c.get('userId')
  const user = await findUserById(userId)

  if (!user) {
    return c.json({ error: 'user_not_found' }, 404)
  }

  const { complete: onboardingComplete } = await isOnboardingComplete(userId)

  return c.json({
    id: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    country: user.country,
    createdAt: user.createdAt,
    onboardingComplete,
  })
})

export default userRoutes
