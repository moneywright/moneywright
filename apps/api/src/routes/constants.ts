import { Hono } from 'hono'
import { auth, type AuthVariables } from '../middleware/auth'
import { findUserById } from '../services/user'
import {
  getInstitutionsForCountry,
  getInsuranceProvidersForCountry,
  getInvestmentSourceTypesForCountry,
  getAccountTypesForCountry,
  getCategoriesForCountry,
  getInvestmentTypesForCountry,
  INVESTMENT_HOLDING_TYPES,
  SUPPORTED_COUNTRIES,
  type CountryCode,
} from '../lib/constants'

const constantsRoutes = new Hono<{ Variables: AuthVariables }>()

// Apply auth to all routes
constantsRoutes.use('*', auth())

/**
 * GET /constants
 * Get all constants for the user's country
 * Returns institutions, investment sources, account types, categories, etc.
 */
constantsRoutes.get('/', async (c) => {
  const userId = c.get('userId')

  // Get user's country
  const user = await findUserById(userId)
  if (!user) {
    return c.json({ error: 'not_found', message: 'User not found' }, 404)
  }

  const countryCode = (user.country || 'US') as CountryCode

  return c.json({
    countryCode,
    institutions: getInstitutionsForCountry(countryCode),
    insuranceProviders: getInsuranceProvidersForCountry(countryCode),
    investmentSourceTypes: getInvestmentSourceTypesForCountry(countryCode),
    accountTypes: getAccountTypesForCountry(countryCode),
    categories: getCategoriesForCountry(countryCode),
    investmentTypes: getInvestmentTypesForCountry(countryCode),
    investmentHoldingTypes: INVESTMENT_HOLDING_TYPES,
    countries: SUPPORTED_COUNTRIES,
  })
})

/**
 * GET /constants/institutions
 * Get institutions for the user's country
 */
constantsRoutes.get('/institutions', async (c) => {
  const userId = c.get('userId')

  const user = await findUserById(userId)
  if (!user) {
    return c.json({ error: 'not_found', message: 'User not found' }, 404)
  }

  const countryCode = (user.country || 'US') as CountryCode
  const institutions = getInstitutionsForCountry(countryCode)

  return c.json({ institutions, countryCode })
})

/**
 * GET /constants/investment-sources
 * Get investment source types for the user's country
 */
constantsRoutes.get('/investment-sources', async (c) => {
  const userId = c.get('userId')

  const user = await findUserById(userId)
  if (!user) {
    return c.json({ error: 'not_found', message: 'User not found' }, 404)
  }

  const countryCode = (user.country || 'US') as CountryCode
  const sourceTypes = getInvestmentSourceTypesForCountry(countryCode)

  return c.json({ sourceTypes, countryCode })
})

export default constantsRoutes
