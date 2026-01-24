import { useState, useMemo, useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  useAuth,
  useCategories,
  useMonthlyTrends,
  usePreferences,
  useSetPreference,
  useTransactionStats,
} from '@/hooks'
import { AppLayout } from '@/components/domain/app-layout'
import { ProfileSelector } from '@/components/domain/profile-selector'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Upload, TrendingUp, Wallet, CreditCard, Banknote } from 'lucide-react'
import { PREFERENCE_KEYS } from '@/lib/api'
import { getSummary, getAccounts, getMonthTransactions, getSubscriptions } from '@/lib/api'
import type { Profile, MonthlyTrendData } from '@/lib/api'

import {
  type TimeframeKey,
  type ChartTimeframeKey,
  TIMEFRAME_OPTIONS,
  CHART_TIMEFRAME_OPTIONS,
  formatCompact,
  getDateRange,
  getFinancialYearRange,
  IncomeExpensesCard,
  SpendingByCategoryCard,
  SubscriptionsCard,
  AccountBalancesCard,
  MonthDetailModal,
} from '@/components/dashboard'

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

function DashboardPage() {
  const { user, defaultProfile, isAuthenticated } = useAuth()
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [showFamilyView, setShowFamilyView] = useState(false)
  const [timeframe] = useState<TimeframeKey>('this_month')
  const [chartTimeframe, setChartTimeframe] = useState<ChartTimeframeKey>('1y')
  const [selectedMonth, setSelectedMonth] = useState<MonthlyTrendData | null>(null)
  const [customDateRange, setCustomDateRange] = useState<{
    startDate: string
    endDate: string
  } | null>(null)

  // Spending by Category state
  const [categoryTimeframe, setCategoryTimeframe] = useState<ChartTimeframeKey>('1y')
  const [categoryDateRange, setCategoryDateRange] = useState<{
    startDate: string
    endDate: string
  } | null>(null)
  const [showMonthlyAverage, setShowMonthlyAverage] = useState(false)

  const selectedProfile = selectedProfileId ? { id: selectedProfileId } : defaultProfile
  const profileId = selectedProfile?.id

  // Get date range for selected timeframe
  const dateRange = getDateRange(timeframe)
  const selectedTimeframeOption = TIMEFRAME_OPTIONS.find((t) => t.key === timeframe)!

  // Calculate chart date range
  const chartDateOptions = useMemo(() => {
    const option = CHART_TIMEFRAME_OPTIONS.find((t) => t.key === chartTimeframe)

    if (chartTimeframe === 'custom' && customDateRange) {
      return { startDate: customDateRange.startDate, endDate: customDateRange.endDate }
    }
    if (chartTimeframe === 'current_fy') {
      const fy = getFinancialYearRange(user?.country, 0)
      return { startDate: fy.startDate, endDate: fy.endDate }
    }
    if (chartTimeframe === 'last_fy') {
      const fy = getFinancialYearRange(user?.country, -1)
      return { startDate: fy.startDate, endDate: fy.endDate }
    }
    return { months: option?.months || 12 }
  }, [chartTimeframe, customDateRange, user?.country])

  // Calculate category date range
  const categoryDateOptions = useMemo(() => {
    const option = CHART_TIMEFRAME_OPTIONS.find((t) => t.key === categoryTimeframe)

    if (categoryTimeframe === 'custom' && categoryDateRange) {
      return { startDate: categoryDateRange.startDate, endDate: categoryDateRange.endDate }
    }
    if (categoryTimeframe === 'current_fy') {
      const fy = getFinancialYearRange(user?.country, 0)
      return { startDate: fy.startDate, endDate: fy.endDate }
    }
    if (categoryTimeframe === 'last_fy') {
      const fy = getFinancialYearRange(user?.country, -1)
      return { startDate: fy.startDate, endDate: fy.endDate }
    }

    const months = option?.months || 12
    const now = new Date()
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
    return {
      startDate: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01`,
      endDate: now.toISOString().split('T')[0],
    }
  }, [categoryTimeframe, categoryDateRange, user?.country])

  // Calculate total months for monthly average
  const categoryTotalMonths = useMemo(() => {
    if (categoryDateOptions.startDate && categoryDateOptions.endDate) {
      const start = new Date(categoryDateOptions.startDate)
      const end = new Date(categoryDateOptions.endDate)
      return Math.max(
        1,
        (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1
      )
    }
    const option = CHART_TIMEFRAME_OPTIONS.find((t) => t.key === categoryTimeframe)
    return option?.months || 12
  }, [categoryDateOptions, categoryTimeframe])

  // Fetch categories (only when authenticated)
  const { data: categoriesData } = useCategories(isAuthenticated)
  const categories = useMemo(() => categoriesData?.categories || [], [categoriesData?.categories])

  // Fetch preferences (only when authenticated)
  const { data: preferences } = usePreferences(profileId, isAuthenticated)
  const setPreferenceMutation = useSetPreference()

  // Category helpers
  const getCategoryLabel = useCallback(
    (code: string) => {
      const cat = categories.find((c) => c.code === code)
      return cat?.label || code.replace(/_/g, ' ')
    },
    [categories]
  )

  const getCategoryColor = useCallback(
    (code: string) => {
      const cat = categories.find((c) => c.code === code)
      return cat?.color || 'zinc'
    },
    [categories]
  )

  // Derive excluded categories from preferences
  const incomeExpensesExcluded = useMemo(() => {
    const prefValue = preferences?.[PREFERENCE_KEYS.INCOME_EXPENSES_EXCLUDED_CATEGORIES]
    if (prefValue) {
      try {
        return JSON.parse(prefValue) as string[]
      } catch {
        return []
      }
    }
    return []
  }, [preferences])

  const spendingByCategoryExcluded = useMemo(() => {
    const prefValue = preferences?.[PREFERENCE_KEYS.SPENDING_BY_CATEGORY_EXCLUDED_CATEGORIES]
    if (prefValue) {
      try {
        return JSON.parse(prefValue) as string[]
      } catch {
        return []
      }
    }
    return []
  }, [preferences])

  // Toggle handlers
  const toggleIncomeExpensesExclusion = useCallback(
    (categoryCode: string) => {
      const newExcluded = incomeExpensesExcluded.includes(categoryCode)
        ? incomeExpensesExcluded.filter((c) => c !== categoryCode)
        : [...incomeExpensesExcluded, categoryCode]

      setPreferenceMutation.mutate({
        key: PREFERENCE_KEYS.INCOME_EXPENSES_EXCLUDED_CATEGORIES,
        value: JSON.stringify(newExcluded),
        profileId,
      })
    },
    [incomeExpensesExcluded, profileId, setPreferenceMutation]
  )

  const clearIncomeExpensesExclusions = useCallback(() => {
    setPreferenceMutation.mutate({
      key: PREFERENCE_KEYS.INCOME_EXPENSES_EXCLUDED_CATEGORIES,
      value: JSON.stringify([]),
      profileId,
    })
  }, [profileId, setPreferenceMutation])

  const toggleSpendingByCategoryExclusion = useCallback(
    (categoryCode: string) => {
      const newExcluded = spendingByCategoryExcluded.includes(categoryCode)
        ? spendingByCategoryExcluded.filter((c) => c !== categoryCode)
        : [...spendingByCategoryExcluded, categoryCode]

      setPreferenceMutation.mutate({
        key: PREFERENCE_KEYS.SPENDING_BY_CATEGORY_EXCLUDED_CATEGORIES,
        value: JSON.stringify(newExcluded),
        profileId,
      })
    },
    [spendingByCategoryExcluded, profileId, setPreferenceMutation]
  )

  const clearSpendingByCategoryExclusions = useCallback(() => {
    setPreferenceMutation.mutate({
      key: PREFERENCE_KEYS.SPENDING_BY_CATEGORY_EXCLUDED_CATEGORIES,
      value: JSON.stringify([]),
      profileId,
    })
  }, [profileId, setPreferenceMutation])

  // Fetch summary
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['summary', profileId, timeframe],
    queryFn: () => getSummary(profileId!, dateRange),
    enabled: !!profileId,
  })

  // Fetch accounts
  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts', profileId],
    queryFn: () => getAccounts(profileId!),
    enabled: !!profileId,
  })

  // Fetch monthly trends
  const trendsOptions = useMemo(
    () => ({
      ...chartDateOptions,
      excludeCategories: incomeExpensesExcluded.length > 0 ? incomeExpensesExcluded : undefined,
    }),
    [chartDateOptions, incomeExpensesExcluded]
  )
  const { data: trendsData, isLoading: trendsLoading } = useMonthlyTrends(profileId, trendsOptions)

  // Fetch month transactions for modal
  const { data: monthTransactionsData, isLoading: monthTransactionsLoading } = useQuery({
    queryKey: ['month-transactions', profileId, selectedMonth?.month, incomeExpensesExcluded],
    queryFn: () =>
      getMonthTransactions(
        profileId!,
        selectedMonth!.month,
        incomeExpensesExcluded.length > 0 ? incomeExpensesExcluded : undefined
      ),
    enabled: !!profileId && !!selectedMonth,
  })

  // Fetch category stats
  const categoryStatsFilters = useMemo(
    () => ({
      profileId: profileId!,
      startDate: categoryDateOptions.startDate,
      endDate: categoryDateOptions.endDate,
    }),
    [profileId, categoryDateOptions]
  )
  const { data: categoryStatsRaw, isLoading: categoryStatsLoading } = useTransactionStats(
    profileId ? categoryStatsFilters : undefined
  )

  // Filter category stats
  const categoryStats = useMemo(() => {
    if (!categoryStatsRaw) return undefined
    if (!spendingByCategoryExcluded.length) return categoryStatsRaw

    const filteredBreakdown = categoryStatsRaw.categoryBreakdown.filter(
      (cat) => !spendingByCategoryExcluded.includes(cat.category)
    )
    const filteredTotal = filteredBreakdown.reduce((sum, cat) => sum + cat.total, 0)

    return {
      ...categoryStatsRaw,
      categoryBreakdown: filteredBreakdown,
      totalDebits: filteredTotal,
    }
  }, [categoryStatsRaw, spendingByCategoryExcluded])

  // Fetch subscriptions
  const { data: subscriptionsData, isLoading: subscriptionsLoading } = useQuery({
    queryKey: ['subscriptions', profileId],
    queryFn: () => getSubscriptions(profileId!),
    enabled: !!profileId,
  })

  // Handlers
  const handleMonthClick = useCallback((month: MonthlyTrendData) => {
    setSelectedMonth(month)
  }, [])

  const handleProfileChange = (profile: Profile) => {
    setSelectedProfileId(profile.id)
    setShowFamilyView(false)
  }

  const accountsCount = accounts?.length || 0
  const hasData = summary && (summary.netWorth.accounts.length > 0 || accountsCount > 0)

  return (
    <AppLayout>
      <PageHeader
        title="Dashboard"
        description="Your financial overview"
        actions={
          <ProfileSelector
            selectedProfileId={selectedProfile?.id || null}
            onProfileChange={handleProfileChange}
            showFamilyView={showFamilyView}
            onFamilyViewChange={setShowFamilyView}
          />
        }
      />

      {/* Main Stats Grid */}
      <StatCardGrid className="mb-6">
        <StatCard
          label="Net Worth"
          value={summary?.totals.totalWealth}
          currency={summary?.totals.currency}
          subtitle={
            summary?.investments.totalCurrent && summary.investments.totalCurrent > 0
              ? `${formatCompact(summary.netWorth.netWorth, summary.netWorth.currency)} cash + ${formatCompact(summary.investments.totalCurrent, summary.totals.currency)} investments`
              : 'Across all accounts'
          }
          icon={Banknote}
          loading={summaryLoading}
          trend={
            summary?.totals.totalWealth
              ? summary.totals.totalWealth > 0
                ? 'up'
                : 'down'
              : undefined
          }
        />
        <StatCard
          label={timeframe === 'this_month' ? 'Monthly Expenses' : 'Expenses'}
          value={summary?.transactions.totalExpenses}
          currency={summary?.transactions.currency}
          subtitle={
            summary?.transactions.expenseCount
              ? `${summary.transactions.expenseCount} transactions`
              : selectedTimeframeOption.shortLabel
          }
          icon={CreditCard}
          loading={summaryLoading}
        />
        <StatCard
          label="Investments"
          value={summary?.investments.totalCurrent}
          currency={summary?.totals.currency}
          subtitle={
            summary?.investments.totalInvested &&
            summary.investments.totalInvested > 0 &&
            summary.investments.gainLossPercent !== undefined
              ? `${summary.investments.gainLossPercent > 0 ? '+' : ''}${summary.investments.gainLossPercent.toFixed(1)}% returns`
              : 'Total portfolio'
          }
          icon={TrendingUp}
          loading={summaryLoading}
          trend={
            summary?.investments.totalInvested &&
            summary.investments.totalInvested > 0 &&
            summary?.investments.totalGainLoss
              ? summary.investments.totalGainLoss > 0
                ? 'up'
                : 'down'
              : undefined
          }
        />
        <StatCard
          label="Accounts"
          value={accountsCount}
          subtitle="Connected accounts"
          icon={Wallet}
          loading={accountsLoading}
          isCount
        />
      </StatCardGrid>

      {/* Income vs Expenses Chart */}
      <IncomeExpensesCard
        trendsData={trendsData}
        isLoading={trendsLoading}
        chartTimeframe={chartTimeframe}
        onChartTimeframeChange={setChartTimeframe}
        customDateRange={customDateRange}
        onCustomDateRangeChange={setCustomDateRange}
        excludedCategories={incomeExpensesExcluded}
        onToggleExclusion={toggleIncomeExpensesExclusion}
        onClearExclusions={clearIncomeExpensesExclusions}
        categories={categories}
        userCountry={user?.country}
        onMonthClick={handleMonthClick}
      />

      {/* Spending by Category & Subscriptions Row */}
      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <SpendingByCategoryCard
          categoryStats={categoryStats}
          isLoading={categoryStatsLoading}
          categoryTimeframe={categoryTimeframe}
          onCategoryTimeframeChange={setCategoryTimeframe}
          categoryDateRange={categoryDateRange}
          onCategoryDateRangeChange={setCategoryDateRange}
          showMonthlyAverage={showMonthlyAverage}
          onShowMonthlyAverageChange={setShowMonthlyAverage}
          totalMonths={categoryTotalMonths}
          excludedCategories={spendingByCategoryExcluded}
          onToggleExclusion={toggleSpendingByCategoryExclusion}
          onClearExclusions={clearSpendingByCategoryExclusions}
          categories={categories}
          userCountry={user?.country}
          getCategoryLabel={getCategoryLabel}
          getCategoryColor={getCategoryColor}
        />

        <SubscriptionsCard
          subscriptions={subscriptionsData?.subscriptions || []}
          totalMonthly={subscriptionsData?.totalMonthly || 0}
          currency={subscriptionsData?.currency || 'INR'}
          getCategoryLabel={getCategoryLabel}
          isLoading={subscriptionsLoading}
          countryCode={user?.country?.toLowerCase() || 'in'}
        />
      </div>

      {/* Account Balances */}
      <AccountBalancesCard accounts={summary?.netWorth.accounts || []} />

      {/* Empty State */}
      {!summaryLoading && !hasData && (
        <EmptyState
          icon={Upload}
          title="Get started with Moneywright"
          description="Upload your bank statements or credit card statements to unlock powerful financial insights and track your spending automatically."
          action={{
            label: 'Upload Your First Statement',
            href: '/statements?upload=true',
            icon: Upload,
          }}
          size="lg"
        />
      )}

      {/* Month Detail Modal */}
      <MonthDetailModal
        month={selectedMonth}
        data={monthTransactionsData}
        isLoading={monthTransactionsLoading}
        getCategoryLabel={getCategoryLabel}
        onClose={() => setSelectedMonth(null)}
      />
    </AppLayout>
  )
}
