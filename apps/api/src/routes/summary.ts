import { Hono } from 'hono'
import { auth, type AuthVariables } from '../middleware/auth'
import { calculateNetWorth } from '../services/accounts'
import { getInvestmentSummary } from '../services/investment-holdings'
import { getTransactionStats } from '../services/transactions'
import { fetchFxRates, getConversionRate } from '../services/fx-rates'

const summaryRoutes = new Hono<{ Variables: AuthVariables }>()

// Apply auth to all routes
summaryRoutes.use('*', auth())

/**
 * GET /summary
 * Get comprehensive financial summary for a profile
 * Query params:
 *   - profileId (required): Profile to get summary for
 *   - startDate (optional): Start date for transaction stats (YYYY-MM-DD)
 *   - endDate (optional): End date for transaction stats (YYYY-MM-DD)
 */
summaryRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const profileId = c.req.query('profileId')
  const startDate = c.req.query('startDate')
  const endDate = c.req.query('endDate')

  if (!profileId) {
    return c.json({ error: 'validation_error', message: 'profileId is required' }, 400)
  }

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

  return c.json({
    // Net worth from account balances
    netWorth: {
      totalAssets: netWorth.totalAssets,
      totalLiabilities: netWorth.totalLiabilities,
      netWorth: netWorth.netWorth,
      currency: netWorth.currency,
      accounts: netWorth.accounts,
      calculatedAt: netWorth.calculatedAt,
    },

    // Investment portfolio summary
    investments: {
      totalInvested: investments.totalInvested,
      totalCurrent: investments.totalCurrent,
      totalGainLoss: investments.totalGainLoss,
      gainLossPercent: investments.gainLossPercent,
      holdingsCount: investments.holdingsCount,
      sourcesCount: investments.sourcesCount,
      byType: investments.byType,
      byCurrency: investments.byCurrency,
    },

    // Transaction stats for the period
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

    // Combined totals
    totals: {
      // Total wealth = net worth from accounts + current investment value
      totalWealth: netWorth.netWorth + investments.totalCurrent,
      currency: netWorth.currency,
    },
  })
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
