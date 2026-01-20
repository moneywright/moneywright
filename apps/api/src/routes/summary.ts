import { Hono } from 'hono'
import { auth, type AuthVariables } from '../middleware/auth'
import { calculateNetWorth } from '../services/accounts'
import { getInvestmentSummary } from '../services/investments'
import { getTransactionStats } from '../services/transactions'

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

  // Calculate current month date range if not provided
  const now = new Date()
  const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0]
  const defaultEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split('T')[0]

  const effectiveStartDate = startDate || defaultStartDate
  const effectiveEndDate = endDate || defaultEndDate

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
      totalPurchaseValue: investments.totalPurchaseValue,
      totalCurrentValue: investments.totalCurrentValue,
      totalGainLoss: investments.totalGainLoss,
      gainLossPercentage: investments.gainLossPercentage,
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
      totalWealth: netWorth.netWorth + investments.totalCurrentValue,
      currency: netWorth.currency,
    },
  })
})

export default summaryRoutes
