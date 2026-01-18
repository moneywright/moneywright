import { Hono } from 'hono'
import { auth, type AuthVariables } from '../middleware/auth'
import { findUserById } from '../services/user'
import { getCategoriesForCountry, type CountryCode } from '../lib/constants'

const categoryRoutes = new Hono<{ Variables: AuthVariables }>()

// Apply auth to all routes
categoryRoutes.use('*', auth())

/**
 * GET /categories
 * Get transaction categories for the user's country
 */
categoryRoutes.get('/', async (c) => {
  const userId = c.get('userId')

  // Get user's country
  const user = await findUserById(userId)
  if (!user) {
    return c.json({ error: 'not_found', message: 'User not found' }, 404)
  }

  const countryCode = (user.country || 'US') as CountryCode
  const categories = getCategoriesForCountry(countryCode)

  return c.json({ categories, countryCode })
})

export default categoryRoutes
