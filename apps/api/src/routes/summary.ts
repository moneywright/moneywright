import { Hono } from 'hono'
import { auth, type AuthVariables } from '../middleware/auth'
import { calculateNetWorth } from '../services/accounts'
import { getInvestmentSummary } from '../services/investment-holdings'
import {
  getTransactionStats,
  getMonthlyTrends,
  getMonthTransactions,
  getDetectedSubscriptions,
} from '../services/transactions'
import { fetchFxRates, getConversionRate } from '../services/fx-rates'
import { getDashboardExcludedCategories } from '../services/preferences'

const summaryRoutes = new Hono<{ Variables: AuthVariables }>()

// Apply auth to all routes
summaryRoutes.use('*', auth())

/**
 * GET /summary
 * Get comprehensive financial summary for a profile or all profiles (family view)
 * Query params:
 *   - profileId (optional): Profile to get summary for. If not provided, aggregates all profiles.
 *   - startDate (optional): Start date for transaction stats (YYYY-MM-DD)
 *   - endDate (optional): End date for transaction stats (YYYY-MM-DD)
 */
summaryRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const profileId = c.req.query('profileId') || undefined
  const startDate = c.req.query('startDate')
  const endDate = c.req.query('endDate')

  // Only apply date filters if explicitly provided
  // If no dates provided, fetch all time data
  const effectiveStartDate = startDate || undefined
  const effectiveEndDate = endDate || undefined

  // Fetch all summaries in parallel
  const [netWorth, investments, transactionStats] = await Promise.all([
    calculateNetWorth(userId, profileId),
    getInvestmentSummary(userId, profileId),
    getTransactionStats(userId, {
      profileId,
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
    }),
  ])

  // Calculate true net worth: (cash assets + investments) - liabilities
  const totalAssets = netWorth.totalAssets + investments.totalCurrent
  const totalNetWorth = totalAssets - netWorth.totalLiabilities

  // Calculate credit card liabilities
  const creditCardLiabilities = netWorth.accounts
    .filter((a) => a.isLiability)
    .reduce((sum, a) => sum + (a.latestBalance || 0), 0)

  // Calculate loan liabilities
  const loanLiabilities = netWorth.loans
    .filter((l) => l.status === 'active')
    .reduce((sum, l) => sum + l.outstandingBalance, 0)

  return c.json({
    // Net worth = total assets (cash + investments) - total liabilities
    netWorth: {
      total: totalNetWorth,
      totalAssets,
      totalLiabilities: netWorth.totalLiabilities,
      currency: netWorth.currency,
      calculatedAt: netWorth.calculatedAt,

      // Breakdown by asset/liability type
      breakdown: {
        cash: {
          total: netWorth.totalAssets,
          accounts: netWorth.accounts.filter((a) => !a.isLiability),
        },
        investments: {
          total: investments.totalCurrent,
          invested: investments.totalInvested,
          gainLoss: investments.totalGainLoss,
          gainLossPercent: investments.gainLossPercent,
          holdingsCount: investments.holdingsCount,
          sourcesCount: investments.sourcesCount,
          byType: investments.byType,
          byCurrency: investments.byCurrency,
        },
        liabilities: {
          total: netWorth.totalLiabilities,
          creditCards: {
            total: creditCardLiabilities,
            accounts: netWorth.accounts.filter((a) => a.isLiability),
          },
          loans: {
            total: loanLiabilities,
            items: netWorth.loans.filter((l) => l.status === 'active'),
          },
        },
      },
    },

    // Transaction stats for the period (cash flow, separate from net worth)
    transactions: {
      period: {
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
      },
      totalIncome: transactionStats.totalCredits,
      totalExpenses: transactionStats.totalDebits,
      incomeCount: transactionStats.creditCount,
      expenseCount: transactionStats.debitCount,
      netCashFlow: transactionStats.netAmount,
      currency: transactionStats.currency,
      categoryBreakdown: transactionStats.categoryBreakdown,
    },
  })
})

/**
 * GET /summary/monthly-trends
 * Get monthly income/expense trends
 * Query params:
 *   - profileId (optional): Profile to get trends for. If not provided, aggregates all profiles.
 *   - months (optional): Number of months to fetch (default: 12, max: 120)
 *   - startDate (optional): Start date in YYYY-MM-DD format (takes precedence over months)
 *   - endDate (optional): End date in YYYY-MM-DD format
 *   - excludeCategories (optional): Comma-separated list of category codes to exclude
 *     If not provided, uses user's saved preferences
 */
summaryRoutes.get('/monthly-trends', async (c) => {
  const userId = c.get('userId')
  const profileId = c.req.query('profileId') || undefined
  const monthsParam = c.req.query('months')
  const startDate = c.req.query('startDate')
  const endDate = c.req.query('endDate')
  const excludeCategoriesParam = c.req.query('excludeCategories')

  // Support up to 10 years (120 months) for "all time" view
  const months = Math.min(Math.max(parseInt(monthsParam || '12', 10) || 12, 1), 120)

  // Get excluded categories from query param or user preferences
  let excludeCategories: string[] | undefined
  if (excludeCategoriesParam) {
    excludeCategories = excludeCategoriesParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  } else {
    // Use saved preferences
    excludeCategories = await getDashboardExcludedCategories(userId, profileId)
    if (excludeCategories.length === 0) {
      excludeCategories = undefined
    }
  }

  const result = await getMonthlyTrends(userId, profileId, {
    months,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    excludeCategories,
  })

  return c.json({ ...result, excludedCategories: excludeCategories || [] })
})

/**
 * GET /summary/month-transactions
 * Get transactions for a specific month with netting and exclusions applied
 * Query params:
 *   - profileId (optional): Profile to get transactions for. If not provided, aggregates all profiles.
 *   - month (required): Month in YYYY-MM format
 *   - excludeCategories (optional): Comma-separated list of category codes to exclude
 *     If not provided, uses user's saved preferences
 */
summaryRoutes.get('/month-transactions', async (c) => {
  const userId = c.get('userId')
  const profileId = c.req.query('profileId') || undefined
  const month = c.req.query('month')
  const excludeCategoriesParam = c.req.query('excludeCategories')

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return c.json(
      { error: 'validation_error', message: 'month is required in YYYY-MM format' },
      400
    )
  }

  // Get excluded categories from query param or user preferences
  let excludeCategories: string[] | undefined
  if (excludeCategoriesParam) {
    excludeCategories = excludeCategoriesParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  } else {
    excludeCategories = await getDashboardExcludedCategories(userId, profileId)
    if (excludeCategories.length === 0) {
      excludeCategories = undefined
    }
  }

  const result = await getMonthTransactions(userId, profileId, month, excludeCategories)

  return c.json({ ...result, excludedCategories: excludeCategories || [] })
})

/**
 * GET /summary/subscriptions
 * Get detected recurring subscriptions
 * Query params:
 *   - profileId (optional): Profile to get subscriptions for. If not provided, aggregates all profiles.
 */
summaryRoutes.get('/subscriptions', async (c) => {
  const userId = c.get('userId')
  const profileId = c.req.query('profileId') || undefined

  const result = await getDetectedSubscriptions(userId, profileId)

  return c.json(result)
})

/**
 * GET /summary/fx-rates
 * Get foreign exchange rates
 * Query params:
 *   - base (optional): Base currency (default: USD)
 */
summaryRoutes.get('/fx-rates', async (c) => {
  const base = c.req.query('base') || 'usd'

  try {
    const rates = await fetchFxRates(base)

    return c.json({
      success: true,
      data: {
        date: rates.date,
        baseCurrency: rates.baseCurrency.toUpperCase(),
        rates: {
          // Return commonly used currencies
          INR: rates.rates['inr'],
          USD: rates.rates['usd'] ?? 1,
          EUR: rates.rates['eur'],
          GBP: rates.rates['gbp'],
          JPY: rates.rates['jpy'],
          AUD: rates.rates['aud'],
          CAD: rates.rates['cad'],
          SGD: rates.rates['sgd'],
          AED: rates.rates['aed'],
        },
        fetchedAt: rates.fetchedAt,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch FX rates'
    return c.json({ success: false, error: message }, 500)
  }
})

/**
 * GET /summary/fx-rate
 * Get conversion rate between two currencies
 * Query params:
 *   - from (required): Source currency (e.g., USD)
 *   - to (required): Target currency (e.g., INR)
 */
summaryRoutes.get('/fx-rate', async (c) => {
  const from = c.req.query('from')
  const to = c.req.query('to')

  if (!from || !to) {
    return c.json({ success: false, error: 'Both "from" and "to" query params are required' }, 400)
  }

  try {
    const rate = await getConversionRate(from, to)

    return c.json({
      success: true,
      data: {
        from: from.toUpperCase(),
        to: to.toUpperCase(),
        rate,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get conversion rate'
    return c.json({ success: false, error: message }, 500)
  }
})

export default summaryRoutes
