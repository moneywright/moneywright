/**
 * Dashboard components barrel export
 */

// Types
export * from './types'

// Utilities
export {
  formatCurrency,
  formatCompact,
  formatDate,
  getDateRange,
  getFiscalYearStartMonth,
  getFinancialYearRange,
} from './utils'

// Base components
export { MonthlyTrendsChart } from './monthly-trends-chart'
export { SubscriptionsList } from './subscriptions-list'
export { CategoryBreakdown } from './category-breakdown'
export { AccountBalanceCard } from './account-balance-card'
export { MonthDetailModal } from './month-detail-modal'

// Card components
export { IncomeExpensesCard } from './income-expenses-card'
export { SpendingByCategoryCard } from './spending-by-category-card'
export { SubscriptionsCard } from './subscriptions-card'
export { AccountBalancesCard } from './account-balances-card'
