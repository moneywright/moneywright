import { useState, useMemo, useCallback } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  useProfiles,
  useCategories,
  useMonthlyTrends,
  usePreferences,
  useSetPreference,
  useAuthStatus,
  useTransactionStats,
} from '@/hooks'
import { AppLayout } from '@/components/domain/app-layout'
import { ProfileSelector } from '@/components/domain/profile-selector'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { InlineEmptyState, EmptyState as SharedEmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MonthlyTrendsChart, SubscriptionsList } from '@/components/dashboard'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Upload,
  TrendingUp,
  Wallet,
  CreditCard,
  Banknote,
  PieChart,
  ChevronRight,
  Building2,
  Calendar,
  ChevronDown,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PREFERENCE_KEYS } from '@/lib/api'
import { getCategoryColorClasses } from '@/lib/category-colors'
import { getSummary, getAccounts, getMonthTransactions, getSubscriptions } from '@/lib/api'
import type {
  Profile,
  Transaction,
  FinancialSummary,
  MonthlyTrendData,
  MonthTransactionsResponse,
} from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

// Currency formatter
function formatCurrency(amount: number, currency: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Format large numbers compactly
function formatCompact(amount: number, currency: string = 'INR'): string {
  if (Math.abs(amount) >= 10000000) {
    return `${currency === 'INR' ? '₹' : '$'}${(amount / 10000000).toFixed(2)}Cr`
  }
  if (Math.abs(amount) >= 100000) {
    return `${currency === 'INR' ? '₹' : '$'}${(amount / 100000).toFixed(2)}L`
  }
  return formatCurrency(amount, currency)
}

// Date formatter
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  })
}

// Timeframe options
type TimeframeKey =
  | 'this_month'
  | 'this_year'
  | 'last_7d'
  | 'last_30d'
  | 'last_3m'
  | 'last_6m'
  | 'last_1y'
  | 'last_3y'
  | 'all_time'

const TIMEFRAME_OPTIONS: { key: TimeframeKey; label: string; shortLabel: string }[] = [
  { key: 'this_month', label: 'This Month', shortLabel: 'This Month' },
  { key: 'this_year', label: 'This Year', shortLabel: 'This Year' },
  { key: 'last_7d', label: 'Last 7 Days', shortLabel: 'Last 7d' },
  { key: 'last_30d', label: 'Last 30 Days', shortLabel: 'Last 30d' },
  { key: 'last_3m', label: 'Last 3 Months', shortLabel: 'Last 3m' },
  { key: 'last_6m', label: 'Last 6 Months', shortLabel: 'Last 6m' },
  { key: 'last_1y', label: 'Last 1 Year', shortLabel: 'Last 1y' },
  { key: 'last_3y', label: 'Last 3 Years', shortLabel: 'Last 3y' },
  { key: 'all_time', label: 'All Time', shortLabel: 'All Time' },
]

function getDateRange(timeframe: TimeframeKey): { startDate?: string; endDate?: string } {
  const now = new Date()
  const formatDate = (d: Date) => d.toISOString().split('T')[0]

  switch (timeframe) {
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { startDate: formatDate(start), endDate: formatDate(end) }
    }
    case 'this_year': {
      const start = new Date(now.getFullYear(), 0, 1)
      return { startDate: formatDate(start), endDate: formatDate(now) }
    }
    case 'last_7d': {
      const start = new Date(now)
      start.setDate(start.getDate() - 7)
      return { startDate: formatDate(start), endDate: formatDate(now) }
    }
    case 'last_30d': {
      const start = new Date(now)
      start.setDate(start.getDate() - 30)
      return { startDate: formatDate(start), endDate: formatDate(now) }
    }
    case 'last_3m': {
      const start = new Date(now)
      start.setMonth(start.getMonth() - 3)
      return { startDate: formatDate(start), endDate: formatDate(now) }
    }
    case 'last_6m': {
      const start = new Date(now)
      start.setMonth(start.getMonth() - 6)
      return { startDate: formatDate(start), endDate: formatDate(now) }
    }
    case 'last_1y': {
      const start = new Date(now)
      start.setFullYear(start.getFullYear() - 1)
      return { startDate: formatDate(start), endDate: formatDate(now) }
    }
    case 'last_3y': {
      const start = new Date(now)
      start.setFullYear(start.getFullYear() - 3)
      return { startDate: formatDate(start), endDate: formatDate(now) }
    }
    case 'all_time':
      return {} // No date filter
  }
}

// Chart timeframe options
type ChartTimeframeKey =
  | '6m'
  | '1y'
  | '2y'
  | '3y'
  | '5y'
  | 'all'
  | 'current_fy'
  | 'last_fy'
  | 'custom'

interface ChartTimeframeOption {
  key: ChartTimeframeKey
  label: string
  months?: number
  isFiscal?: boolean
}

const CHART_TIMEFRAME_OPTIONS: ChartTimeframeOption[] = [
  { key: '6m', label: 'Last 6 months', months: 6 },
  { key: '1y', label: 'Last 1 year', months: 12 },
  { key: '2y', label: 'Last 2 years', months: 24 },
  { key: '3y', label: 'Last 3 years', months: 36 },
  { key: '5y', label: 'Last 5 years', months: 60 },
  { key: 'all', label: 'All time', months: 120 },
  { key: 'current_fy', label: 'Current FY', isFiscal: true },
  { key: 'last_fy', label: 'Last FY', isFiscal: true },
  { key: 'custom', label: 'Custom range' },
]

/**
 * Get financial year start month based on country
 * Returns 0-indexed month (0 = January, 3 = April, etc.)
 */
function getFiscalYearStartMonth(country: string | null | undefined): number {
  switch (country) {
    case 'IN': // India: April 1 - March 31
    case 'AU': // Australia: July 1 - June 30 (but commonly April for some)
    case 'GB': // UK: April 6 - April 5 (we'll use April 1 for simplicity)
    case 'NZ': // New Zealand: April 1 - March 31
      return 3 // April
    case 'US': // USA: Calendar year (Jan 1 - Dec 31) for individuals
    default:
      return 0 // January
  }
}

/**
 * Calculate financial year date range
 */
function getFinancialYearRange(
  country: string | null | undefined,
  offset: number = 0 // 0 = current FY, -1 = last FY
): { startDate: string; endDate: string; label: string } {
  const fyStartMonth = getFiscalYearStartMonth(country)
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  // Determine which FY we're currently in
  let fyStartYear = currentYear
  if (currentMonth < fyStartMonth) {
    // We're in the FY that started last calendar year
    fyStartYear = currentYear - 1
  }

  // Apply offset (negative for past FYs)
  fyStartYear += offset

  const fyEndYear = fyStartYear + 1

  // Format dates
  const startDate = `${fyStartYear}-${String(fyStartMonth + 1).padStart(2, '0')}-01`

  // End date is the day before the next FY starts
  let endMonth = fyStartMonth
  let endYear = fyEndYear
  if (fyStartMonth === 0) {
    // For calendar year FY, end on Dec 31
    endMonth = 11
    endYear = fyStartYear
  } else {
    // End on the last day of the month before FY start
    endMonth = fyStartMonth - 1
  }
  const lastDayOfMonth = new Date(endYear, endMonth + 1, 0).getDate()
  const endDate = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`

  // Create label
  const label =
    fyStartMonth === 0 ? `FY ${fyStartYear}` : `FY ${fyStartYear}-${String(fyEndYear).slice(-2)}`

  return { startDate, endDate, label }
}

function DashboardPage() {
  const { defaultProfile } = useProfiles()
  const { user } = useAuthStatus()
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [showFamilyView, setShowFamilyView] = useState(false)
  const [timeframe, _setTimeframe] = useState<TimeframeKey>('this_month')
  const [chartTimeframe, setChartTimeframe] = useState<ChartTimeframeKey>('1y')
  const [selectedMonth, setSelectedMonth] = useState<MonthlyTrendData | null>(null)
  const [customDateRange, setCustomDateRange] = useState<{
    startDate: string
    endDate: string
  } | null>(null)

  // Spending by Category timeframe
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

  // Calculate chart date range based on selected timeframe
  const chartDateOptions = useMemo(() => {
    const option = CHART_TIMEFRAME_OPTIONS.find((t) => t.key === chartTimeframe)

    if (chartTimeframe === 'custom' && customDateRange) {
      return {
        startDate: customDateRange.startDate,
        endDate: customDateRange.endDate,
      }
    }

    if (chartTimeframe === 'current_fy') {
      const fy = getFinancialYearRange(user?.country, 0)
      return { startDate: fy.startDate, endDate: fy.endDate }
    }

    if (chartTimeframe === 'last_fy') {
      const fy = getFinancialYearRange(user?.country, -1)
      return { startDate: fy.startDate, endDate: fy.endDate }
    }

    // For month-based options
    return { months: option?.months || 12 }
  }, [chartTimeframe, customDateRange, user?.country])

  // Get label for chart timeframe
  const chartTimeframeLabel = useMemo(() => {
    if (chartTimeframe === 'custom' && customDateRange) {
      const start = new Date(customDateRange.startDate)
      const end = new Date(customDateRange.endDate)
      return `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })} - ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}`
    }

    if (chartTimeframe === 'current_fy') {
      return getFinancialYearRange(user?.country, 0).label
    }

    if (chartTimeframe === 'last_fy') {
      return getFinancialYearRange(user?.country, -1).label
    }

    return CHART_TIMEFRAME_OPTIONS.find((t) => t.key === chartTimeframe)?.label || 'Last 1 year'
  }, [chartTimeframe, customDateRange, user?.country])

  // Calculate category date range based on selected timeframe
  const categoryDateOptions = useMemo(() => {
    const option = CHART_TIMEFRAME_OPTIONS.find((t) => t.key === categoryTimeframe)

    if (categoryTimeframe === 'custom' && categoryDateRange) {
      return {
        startDate: categoryDateRange.startDate,
        endDate: categoryDateRange.endDate,
      }
    }

    if (categoryTimeframe === 'current_fy') {
      const fy = getFinancialYearRange(user?.country, 0)
      return { startDate: fy.startDate, endDate: fy.endDate }
    }

    if (categoryTimeframe === 'last_fy') {
      const fy = getFinancialYearRange(user?.country, -1)
      return { startDate: fy.startDate, endDate: fy.endDate }
    }

    // For month-based options, calculate start date
    const months = option?.months || 12
    const now = new Date()
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
    return {
      startDate: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01`,
      endDate: now.toISOString().split('T')[0],
    }
  }, [categoryTimeframe, categoryDateRange, user?.country])

  // Get label for category timeframe
  const categoryTimeframeLabel = useMemo(() => {
    if (categoryTimeframe === 'custom' && categoryDateRange) {
      const start = new Date(categoryDateRange.startDate)
      const end = new Date(categoryDateRange.endDate)
      return `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })} - ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}`
    }

    if (categoryTimeframe === 'current_fy') {
      return getFinancialYearRange(user?.country, 0).label
    }

    if (categoryTimeframe === 'last_fy') {
      return getFinancialYearRange(user?.country, -1).label
    }

    return CHART_TIMEFRAME_OPTIONS.find((t) => t.key === categoryTimeframe)?.label || 'Last 1 year'
  }, [categoryTimeframe, categoryDateRange, user?.country])

  // Calculate total months in category date range for monthly average
  const categoryTotalMonths = useMemo(() => {
    if (categoryDateOptions.startDate && categoryDateOptions.endDate) {
      const start = new Date(categoryDateOptions.startDate)
      const end = new Date(categoryDateOptions.endDate)
      return Math.max(
        1,
        (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1
      )
    }
    // Fallback to option months
    const option = CHART_TIMEFRAME_OPTIONS.find((t) => t.key === categoryTimeframe)
    return option?.months || 12
  }, [categoryDateOptions, categoryTimeframe])

  // Fetch categories for proper labels
  const { data: categoriesData } = useCategories()
  const categories = categoriesData?.categories || []

  // Fetch preferences
  const { data: preferences } = usePreferences(profileId)
  const setPreferenceMutation = useSetPreference()

  // Helper to get category label
  const getCategoryLabel = (code: string) => {
    const cat = categories.find((c) => c.code === code)
    return cat?.label || code.replace(/_/g, ' ')
  }

  // Helper to get category color
  const getCategoryColor = (code: string) => {
    const cat = categories.find((c) => c.code === code)
    return cat?.color || 'zinc'
  }

  // Derive excluded categories for each card from preferences
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

  // Toggle category exclusion for Income vs Expenses
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

  // Toggle category exclusion for Spending by Category
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

  // Fetch summary data with timeframe
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['summary', profileId, timeframe],
    queryFn: () => getSummary(profileId!, dateRange),
    enabled: !!profileId,
  })

  // Fetch accounts count
  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts', profileId],
    queryFn: () => getAccounts(profileId!),
    enabled: !!profileId,
  })

  // Fetch monthly trends for chart (uses Income vs Expenses exclusions)
  const trendsOptions = useMemo(
    () => ({
      ...chartDateOptions,
      excludeCategories: incomeExpensesExcluded.length > 0 ? incomeExpensesExcluded : undefined,
    }),
    [chartDateOptions, incomeExpensesExcluded]
  )
  const { data: trendsData, isLoading: trendsLoading } = useMonthlyTrends(profileId, trendsOptions)

  // Fetch transactions for selected month (with netting and exclusions applied)
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

  // Fetch category stats for Spending by Category section
  // Note: useTransactionStats doesn't support excludeCategories directly,
  // so we filter the results on the frontend
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

  // Filter category stats to exclude categories (uses Spending by Category exclusions)
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

  // Fetch detected subscriptions
  const { data: subscriptionsData, isLoading: subscriptionsLoading } = useQuery({
    queryKey: ['subscriptions', profileId],
    queryFn: () => getSubscriptions(profileId!),
    enabled: !!profileId,
  })

  // Handle month click from chart
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
      {/* Page Header */}
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

      {/* Monthly Trends Chart */}
      <Card className="mb-6 border-border-subtle hover:border-border-hover transition-colors">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Income vs Expenses
            </CardTitle>
            <div className="flex items-center gap-1">
              {/* Category Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'h-7 text-xs text-muted-foreground hover:text-foreground',
                      incomeExpensesExcluded.length > 0 && 'text-primary'
                    )}
                  >
                    <SlidersHorizontal className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-3">
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-medium mb-1">Exclude Categories</h4>
                      <p className="text-xs text-muted-foreground">
                        Hide these categories from the chart
                      </p>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {categories.map((cat) => (
                        <label
                          key={cat.code}
                          className="flex items-center gap-2 text-sm cursor-pointer hover:text-foreground"
                        >
                          <Checkbox
                            checked={incomeExpensesExcluded.includes(cat.code)}
                            onCheckedChange={() => toggleIncomeExpensesExclusion(cat.code)}
                          />
                          <span
                            className={cn(
                              incomeExpensesExcluded.includes(cat.code) &&
                                'line-through text-muted-foreground'
                            )}
                          >
                            {cat.label}
                          </span>
                        </label>
                      ))}
                    </div>
                    {incomeExpensesExcluded.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-7 text-xs"
                        onClick={() => {
                          setPreferenceMutation.mutate({
                            key: PREFERENCE_KEYS.INCOME_EXPENSES_EXCLUDED_CATEGORIES,
                            value: JSON.stringify([]),
                            profileId,
                          })
                        }}
                      >
                        Clear all
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Timeframe Selector */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Calendar className="mr-1.5 h-3 w-3" />
                    {chartTimeframeLabel}
                    <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-3">
                  <div className="space-y-3">
                    {/* Standard time ranges */}
                    <div className="grid grid-cols-2 gap-1.5">
                      {CHART_TIMEFRAME_OPTIONS.filter((o) => o.months).map((option) => (
                        <button
                          key={option.key}
                          onClick={() => {
                            setChartTimeframe(option.key)
                            setCustomDateRange(null)
                          }}
                          className={cn(
                            'px-3 py-2 text-sm font-medium rounded-lg transition-colors text-left',
                            chartTimeframe === option.key
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-surface-elevated hover:bg-surface-hover text-foreground'
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-border-subtle" />

                    {/* Financial year options */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Financial Year
                      </Label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => {
                            setChartTimeframe('current_fy')
                            setCustomDateRange(null)
                          }}
                          className={cn(
                            'px-3 py-2 text-sm font-medium rounded-lg transition-colors text-left',
                            chartTimeframe === 'current_fy'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-surface-elevated hover:bg-surface-hover text-foreground'
                          )}
                        >
                          {getFinancialYearRange(user?.country, 0).label}
                        </button>
                        <button
                          onClick={() => {
                            setChartTimeframe('last_fy')
                            setCustomDateRange(null)
                          }}
                          className={cn(
                            'px-3 py-2 text-sm font-medium rounded-lg transition-colors text-left',
                            chartTimeframe === 'last_fy'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-surface-elevated hover:bg-surface-hover text-foreground'
                          )}
                        >
                          {getFinancialYearRange(user?.country, -1).label}
                        </button>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-border-subtle" />

                    {/* Custom date range */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Custom Range
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">From</Label>
                          <Input
                            type="date"
                            value={customDateRange?.startDate || ''}
                            onChange={(e) => {
                              if (e.target.value) {
                                setCustomDateRange((prev) => ({
                                  startDate: e.target.value,
                                  endDate: prev?.endDate || new Date().toISOString().split('T')[0]!,
                                }))
                                setChartTimeframe('custom')
                              }
                            }}
                            className="h-8 rounded-lg text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">To</Label>
                          <Input
                            type="date"
                            value={customDateRange?.endDate || ''}
                            onChange={(e) => {
                              if (e.target.value) {
                                setCustomDateRange((prev) => ({
                                  startDate: prev?.startDate || '2020-01-01',
                                  endDate: e.target.value,
                                }))
                                setChartTimeframe('custom')
                              }
                            }}
                            className="h-8 rounded-lg text-sm"
                          />
                        </div>
                      </div>
                      {customDateRange && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-muted-foreground h-7 text-xs"
                          onClick={() => {
                            setCustomDateRange(null)
                            setChartTimeframe('1y')
                          }}
                        >
                          <X className="mr-1.5 h-3 w-3" />
                          Clear custom range
                        </Button>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <MonthlyTrendsChart
            data={trendsData?.trends || []}
            currency={trendsData?.currency || 'INR'}
            isLoading={trendsLoading}
            onMonthClick={handleMonthClick}
          />
        </CardContent>
      </Card>

      {/* Spending by Category & Subscriptions Row */}
      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        {/* Spending by Category */}
        <Card className="border-border-subtle hover:border-border-hover transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Spending by Category
              </CardTitle>
              <div className="flex items-center gap-1">
                {/* Monthly Average Toggle */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMonthlyAverage(!showMonthlyAverage)}
                  className={cn(
                    'h-7 text-xs',
                    showMonthlyAverage
                      ? 'text-primary hover:text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {showMonthlyAverage ? '/mo' : 'Total'}
                </Button>
                {/* Category Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'h-7 text-xs text-muted-foreground hover:text-foreground',
                        spendingByCategoryExcluded.length > 0 && 'text-primary'
                      )}
                    >
                      <SlidersHorizontal className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64 p-3">
                    <div className="space-y-3">
                      <div>
                        <h4 className="text-sm font-medium mb-1">Exclude Categories</h4>
                        <p className="text-xs text-muted-foreground">
                          Hide these categories from the chart
                        </p>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {categories.map((cat) => (
                          <label
                            key={cat.code}
                            className="flex items-center gap-2 text-sm cursor-pointer hover:text-foreground"
                          >
                            <Checkbox
                              checked={spendingByCategoryExcluded.includes(cat.code)}
                              onCheckedChange={() => toggleSpendingByCategoryExclusion(cat.code)}
                            />
                            <span
                              className={cn(
                                spendingByCategoryExcluded.includes(cat.code) &&
                                  'line-through text-muted-foreground'
                              )}
                            >
                              {cat.label}
                            </span>
                          </label>
                        ))}
                      </div>
                      {spendingByCategoryExcluded.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full h-7 text-xs"
                          onClick={() => {
                            setPreferenceMutation.mutate({
                              key: PREFERENCE_KEYS.SPENDING_BY_CATEGORY_EXCLUDED_CATEGORIES,
                              value: JSON.stringify([]),
                              profileId,
                            })
                          }}
                        >
                          Clear all
                        </Button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                {/* Timeframe Selector */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Calendar className="mr-1.5 h-3 w-3" />
                      {categoryTimeframeLabel}
                      <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 p-3">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-1.5">
                        {CHART_TIMEFRAME_OPTIONS.filter((o) => o.months).map((option) => (
                          <button
                            key={option.key}
                            onClick={() => {
                              setCategoryTimeframe(option.key)
                              setCategoryDateRange(null)
                            }}
                            className={cn(
                              'px-3 py-2 text-sm font-medium rounded-lg transition-colors text-left',
                              categoryTimeframe === option.key
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-surface-elevated hover:bg-surface-hover text-foreground'
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <div className="h-px bg-border-subtle" />
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Financial Year
                        </Label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={() => {
                              setCategoryTimeframe('current_fy')
                              setCategoryDateRange(null)
                            }}
                            className={cn(
                              'px-3 py-2 text-sm font-medium rounded-lg transition-colors text-left',
                              categoryTimeframe === 'current_fy'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-surface-elevated hover:bg-surface-hover text-foreground'
                            )}
                          >
                            {getFinancialYearRange(user?.country, 0).label}
                          </button>
                          <button
                            onClick={() => {
                              setCategoryTimeframe('last_fy')
                              setCategoryDateRange(null)
                            }}
                            className={cn(
                              'px-3 py-2 text-sm font-medium rounded-lg transition-colors text-left',
                              categoryTimeframe === 'last_fy'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-surface-elevated hover:bg-surface-hover text-foreground'
                            )}
                          >
                            {getFinancialYearRange(user?.country, -1).label}
                          </button>
                        </div>
                      </div>
                      <div className="h-px bg-border-subtle" />
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Custom Range
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">From</Label>
                            <Input
                              type="date"
                              value={categoryDateRange?.startDate || ''}
                              onChange={(e) => {
                                if (e.target.value) {
                                  setCategoryDateRange((prev) => ({
                                    startDate: e.target.value,
                                    endDate:
                                      prev?.endDate || new Date().toISOString().split('T')[0]!,
                                  }))
                                  setCategoryTimeframe('custom')
                                }
                              }}
                              className="h-8 rounded-lg text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">To</Label>
                            <Input
                              type="date"
                              value={categoryDateRange?.endDate || ''}
                              onChange={(e) => {
                                if (e.target.value) {
                                  setCategoryDateRange((prev) => ({
                                    startDate: prev?.startDate || '2020-01-01',
                                    endDate: e.target.value,
                                  }))
                                  setCategoryTimeframe('custom')
                                }
                              }}
                              className="h-8 rounded-lg text-sm"
                            />
                          </div>
                        </div>
                        {categoryDateRange && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-muted-foreground h-7 text-xs"
                            onClick={() => {
                              setCategoryDateRange(null)
                              setCategoryTimeframe('1y')
                            }}
                          >
                            <X className="mr-1.5 h-3 w-3" />
                            Clear custom range
                          </Button>
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {categoryStatsLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-3.5 w-16" />
                    </div>
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                ))}
              </div>
            ) : categoryStats?.categoryBreakdown && categoryStats.categoryBreakdown.length > 0 ? (
              <CategoryBreakdown
                categoryBreakdown={categoryStats.categoryBreakdown}
                total={categoryStats.totalDebits}
                currency={categoryStats.currency}
                getCategoryLabel={getCategoryLabel}
                getCategoryColor={getCategoryColor}
                showMonthlyAverage={showMonthlyAverage}
                totalMonths={categoryTotalMonths}
              />
            ) : (
              <InlineEmptyState
                icon={PieChart}
                title="No spending data"
                description="Categories appear after importing transactions"
              />
            )}
          </CardContent>
        </Card>

        {/* Detected Subscriptions */}
        <Card className="border-border-subtle hover:border-border-hover transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Detected Subscriptions
              </CardTitle>
              {(subscriptionsData?.subscriptions?.length || 0) > 0 && (
                <Link to="/subscriptions">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  >
                    View all
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <SubscriptionsList
              subscriptions={subscriptionsData?.subscriptions || []}
              totalMonthly={subscriptionsData?.totalMonthly || 0}
              currency={subscriptionsData?.currency || 'INR'}
              getCategoryLabel={getCategoryLabel}
              isLoading={subscriptionsLoading}
              countryCode={user?.country?.toLowerCase() || 'in'}
            />
          </CardContent>
        </Card>
      </div>

      {/* Account Balances Row */}
      {summary?.netWorth.accounts && summary.netWorth.accounts.length > 0 && (
        <Card className="mb-6 border-border-subtle hover:border-border-hover transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Account Balances
              </CardTitle>
              <Link to="/accounts">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  Manage accounts
                  <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {summary.netWorth.accounts.map((account) => (
                <AccountBalanceCard key={account.accountId} account={account} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State CTA - show when no data */}
      {!summaryLoading && !hasData && (
        <SharedEmptyState
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

// Category Breakdown Component - Matching subscriptions card layout
function CategoryBreakdown({
  categoryBreakdown,
  total,
  currency,
  getCategoryLabel,
  getCategoryColor,
  showMonthlyAverage = false,
  totalMonths = 1,
}: {
  categoryBreakdown: { category: string; total: number; count: number }[]
  total: number
  currency: string
  getCategoryLabel: (code: string) => string
  getCategoryColor: (code: string) => string
  showMonthlyAverage?: boolean
  totalMonths?: number
}) {
  // Sort by total and take top 6 to match subscriptions card
  const topCategories = [...categoryBreakdown]
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)

  const remainingCount = categoryBreakdown.filter((c) => c.total > 0).length - 6

  if (topCategories.length === 0) {
    return (
      <InlineEmptyState
        icon={PieChart}
        title="No spending data"
        description="Categories appear after importing transactions"
      />
    )
  }

  // Calculate values to display (total or monthly average)
  const displayValues = topCategories.map((cat) => ({
    ...cat,
    displayAmount: showMonthlyAverage ? Math.round(cat.total / totalMonths) : cat.total,
  }))

  const displayTotal = showMonthlyAverage ? Math.round(total / totalMonths) : total
  const maxAmount = Math.max(...displayValues.map((c) => c.displayAmount))

  return (
    <div>
      {/* Total header - matches subscriptions EST. MONTHLY COST */}
      <div className="flex items-center justify-between pb-3 mb-1 border-b border-border-subtle">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          {showMonthlyAverage ? 'Avg. Monthly' : 'Total Spent'}
        </span>
        <span className="text-base font-bold text-foreground tabular-nums">
          {formatCurrency(displayTotal, currency)}
        </span>
      </div>

      {/* Category list */}
      <div className="space-y-0.5">
        {displayValues.map((cat, index) => {
          const colorName = getCategoryColor(cat.category)
          const colors = getCategoryColorClasses(colorName)
          // Normalize percentage relative to max (top category = 100%)
          const percentage = maxAmount > 0 ? (cat.displayAmount / maxAmount) * 100 : 0

          return (
            <div
              key={cat.category}
              className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg hover:bg-surface-elevated transition-colors"
            >
              {/* Left: Category name and progress bar */}
              <div className="min-w-0 flex-1 pr-4">
                <p className="text-sm font-medium text-foreground truncate">
                  {getCategoryLabel(cat.category)}
                </p>
                <div className="flex items-center gap-1.5 mt-1 h-4">
                  <span
                    className={cn('text-[11px] font-medium shrink-0 tabular-nums', colors.text)}
                  >
                    #{index + 1}
                  </span>
                  <div className="flex-1 h-1 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', colors.bar)}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Right: Amount */}
              <p className="text-sm font-semibold tabular-nums text-foreground shrink-0 text-right min-w-20">
                {formatCurrency(cat.displayAmount, currency)}
                {showMonthlyAverage && (
                  <span className="text-[10px] text-muted-foreground font-normal">/mo</span>
                )}
              </p>
            </div>
          )
        })}
      </div>

      {remainingCount > 0 && (
        <p className="text-[11px] text-muted-foreground text-center pt-3">
          +{remainingCount} more categories
        </p>
      )}
    </div>
  )
}

// Account Balance Card Component
function AccountBalanceCard({ account }: { account: FinancialSummary['netWorth']['accounts'][0] }) {
  const hasBalance = account.latestBalance !== null

  return (
    <div className="flex items-center gap-3 p-3.5 rounded-lg bg-surface-elevated border border-border-subtle hover:border-border-hover transition-colors">
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-lg shrink-0 border',
          'bg-surface border-border-subtle'
        )}
      >
        {account.type === 'credit_card' ? (
          <CreditCard className="h-5 w-5 text-muted-foreground" />
        ) : (
          <Building2 className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-foreground">
          {account.accountName || account.institution || 'Account'}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {account.isLiability ? 'Credit Card' : account.type?.replace(/_/g, ' ')}
        </p>
      </div>
      <div className="text-right shrink-0">
        {hasBalance ? (
          <>
            <p
              className={cn(
                'text-sm font-semibold tabular-nums',
                account.isLiability ? 'text-negative' : 'text-positive'
              )}
            >
              {account.isLiability ? '-' : ''}
              {formatCurrency(account.latestBalance!, account.currency)}
            </p>
            {account.latestStatementDate && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {formatDate(account.latestStatementDate)}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No data</p>
        )}
      </div>
    </div>
  )
}

// Sort options for month transactions
type SortOption = 'latest' | 'oldest' | 'highest' | 'lowest'
type ViewMode = 'transactions' | 'categories'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'highest', label: 'Highest' },
  { value: 'lowest', label: 'Lowest' },
  { value: 'latest', label: 'Latest' },
  { value: 'oldest', label: 'Oldest' },
]

// Month Detail Modal Component
function MonthDetailModal({
  month,
  data,
  isLoading,
  getCategoryLabel,
  onClose,
}: {
  month: MonthlyTrendData | null
  data: MonthTransactionsResponse | undefined
  isLoading: boolean
  getCategoryLabel: (code: string) => string
  onClose: () => void
}) {
  const [sortBy, setSortBy] = useState<SortOption>('highest')
  const [viewMode, setViewMode] = useState<ViewMode>('transactions')

  // Use data from the API response (already has netting and exclusions applied)
  const totals = data?.totals || { income: 0, expenses: 0, net: 0 }
  const currency = data?.currency || 'INR'

  // Sort transactions based on selected option
  const credits = useMemo(() => {
    const raw = data?.credits || []
    return [...raw].sort((a, b) => {
      switch (sortBy) {
        case 'latest':
          return new Date(b.date).getTime() - new Date(a.date).getTime()
        case 'oldest':
          return new Date(a.date).getTime() - new Date(b.date).getTime()
        case 'highest':
          return b.amount - a.amount
        case 'lowest':
          return a.amount - b.amount
        default:
          return 0
      }
    })
  }, [data?.credits, sortBy])

  const debits = useMemo(() => {
    const raw = data?.debits || []
    return [...raw].sort((a, b) => {
      switch (sortBy) {
        case 'latest':
          return new Date(b.date).getTime() - new Date(a.date).getTime()
        case 'oldest':
          return new Date(a.date).getTime() - new Date(b.date).getTime()
        case 'highest':
          return b.amount - a.amount
        case 'lowest':
          return a.amount - b.amount
        default:
          return 0
      }
    })
  }, [data?.debits, sortBy])

  // Calculate category breakdown
  const categoryBreakdown = useMemo(() => {
    const incomeByCategory = new Map<string, number>()
    const expensesByCategory = new Map<string, number>()

    for (const txn of data?.credits || []) {
      incomeByCategory.set(txn.category, (incomeByCategory.get(txn.category) || 0) + txn.amount)
    }
    for (const txn of data?.debits || []) {
      expensesByCategory.set(txn.category, (expensesByCategory.get(txn.category) || 0) + txn.amount)
    }

    // Sort by amount descending
    const income = Array.from(incomeByCategory.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)

    const expenses = Array.from(expensesByCategory.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)

    return { income, expenses }
  }, [data?.credits, data?.debits])

  return (
    <Dialog open={!!month} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {month?.monthLabel}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Transactions for {month?.monthLabel}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Summary Stats */}
        <div className="px-6 pb-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-surface-elevated border border-border-subtle p-4">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Income
              </p>
              <p className="text-lg font-semibold text-foreground tabular-nums tracking-tight">
                {formatCurrency(totals.income, currency)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {credits.length} transactions
              </p>
            </div>
            <div className="rounded-xl bg-surface-elevated border border-border-subtle p-4">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Expenses
              </p>
              <p className="text-lg font-semibold text-foreground tabular-nums tracking-tight">
                {formatCurrency(totals.expenses, currency)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">{debits.length} transactions</p>
            </div>
            <div className="rounded-xl bg-surface-elevated border border-border-subtle p-4">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Net
              </p>
              <p
                className={cn(
                  'text-lg font-semibold tabular-nums tracking-tight',
                  totals.net >= 0 ? 'text-positive' : 'text-negative'
                )}
              >
                {totals.net >= 0 ? '+' : ''}
                {formatCurrency(totals.net, currency)}
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="px-6 pb-4 flex items-center justify-between border-t border-border-subtle pt-4">
          <div
            className={cn(
              'flex items-center p-1 rounded-xl',
              'bg-surface-elevated',
              'border border-border-subtle'
            )}
          >
            <button
              onClick={() => setViewMode('transactions')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                viewMode === 'transactions'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Transactions
            </button>
            <button
              onClick={() => setViewMode('categories')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                viewMode === 'categories'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Categories
            </button>
          </div>

          {viewMode === 'transactions' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-sm gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  Sort: {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
                  <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {SORT_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => setSortBy(option.value)}
                    className={cn(sortBy === option.value && 'bg-accent')}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          <div className="grid grid-cols-2 gap-6 h-85">
            {isLoading ? (
              <>
                <div className="space-y-2">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex items-center gap-2 py-2">
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-2 w-24" />
                      </div>
                      <Skeleton className="h-3 w-16" />
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex items-center gap-2 py-2">
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-2 w-24" />
                      </div>
                      <Skeleton className="h-3 w-16" />
                    </div>
                  ))}
                </div>
              </>
            ) : viewMode === 'transactions' ? (
              <>
                {/* Credits Column */}
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-2 pb-2.5 mb-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-positive" />
                    <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Income
                    </h3>
                    <span className="text-[10px] text-muted-foreground/60">{credits.length}</span>
                  </div>
                  <ScrollArea className="h-75">
                    <div className="space-y-0.5 pr-4">
                      {credits.length > 0 ? (
                        credits.map((txn) => (
                          <MonthTransactionRow
                            key={txn.id}
                            transaction={txn}
                            getCategoryLabel={getCategoryLabel}
                          />
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-8">
                          No income this month
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Debits Column */}
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-2 pb-2.5 mb-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-negative" />
                    <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Expenses
                    </h3>
                    <span className="text-[10px] text-muted-foreground/60">{debits.length}</span>
                  </div>
                  <ScrollArea className="h-75">
                    <div className="space-y-0.5 pr-4">
                      {debits.length > 0 ? (
                        debits.map((txn) => (
                          <MonthTransactionRow
                            key={txn.id}
                            transaction={txn}
                            getCategoryLabel={getCategoryLabel}
                          />
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-8">
                          No expenses this month
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </>
            ) : (
              <>
                {/* Income Categories */}
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-2 pb-2.5 mb-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-positive" />
                    <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Income by Category
                    </h3>
                  </div>
                  <ScrollArea className="h-75">
                    <div className="space-y-1 pr-4">
                      {categoryBreakdown.income.length > 0 ? (
                        categoryBreakdown.income.map((cat) => (
                          <CategoryRow
                            key={cat.category}
                            category={cat.category}
                            amount={cat.amount}
                            total={totals.income}
                            currency={currency}
                            getCategoryLabel={getCategoryLabel}
                            type="income"
                          />
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-8">
                          No income this month
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Expenses Categories */}
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-2 pb-2.5 mb-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-negative" />
                    <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Expenses by Category
                    </h3>
                  </div>
                  <ScrollArea className="h-75">
                    <div className="space-y-1 pr-4">
                      {categoryBreakdown.expenses.length > 0 ? (
                        categoryBreakdown.expenses.map((cat) => (
                          <CategoryRow
                            key={cat.category}
                            category={cat.category}
                            amount={cat.amount}
                            total={totals.expenses}
                            currency={currency}
                            getCategoryLabel={getCategoryLabel}
                            type="expense"
                          />
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-8">
                          No expenses this month
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Category breakdown row
function CategoryRow({
  category,
  amount,
  total,
  currency,
  getCategoryLabel,
  type,
}: {
  category: string
  amount: number
  total: number
  currency: string
  getCategoryLabel: (code: string) => string
  type: 'income' | 'expense'
}) {
  const percentage = total > 0 ? (amount / total) * 100 : 0
  const barColor = type === 'income' ? 'bg-positive' : 'bg-negative'
  const label = getCategoryLabel(category)
  const truncatedLabel = label.length > 20 ? label.slice(0, 20) + '…' : label

  return (
    <div className="py-2 px-2 rounded-lg hover:bg-surface-hover transition-colors">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-foreground" title={label}>
          {truncatedLabel}
        </span>
        <span className="text-xs font-semibold tabular-nums text-foreground ml-2 whitespace-nowrap">
          {formatCurrency(amount, currency)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-surface-elevated rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', barColor)}
            style={{ width: `${Math.max(percentage, 2)}%` }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
          {percentage.toFixed(0)}%
        </span>
      </div>
    </div>
  )
}

// Simplified transaction row for the modal
function MonthTransactionRow({
  transaction,
  getCategoryLabel,
}: {
  transaction: Transaction
  getCategoryLabel: (code: string) => string
}) {
  const isCredit = transaction.type === 'credit'
  const description = transaction.summary || transaction.originalDescription
  // Limit description to 26 characters to prevent overflow
  const truncatedDescription =
    description.length > 26 ? description.slice(0, 26) + '…' : description

  return (
    <div className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-surface-hover transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground" title={description}>
          {truncatedDescription}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {formatDate(transaction.date)} · {getCategoryLabel(transaction.category)}
        </p>
      </div>
      <p
        className={cn(
          'text-xs font-semibold tabular-nums whitespace-nowrap',
          isCredit ? 'text-positive' : 'text-foreground'
        )}
      >
        {formatCurrency(transaction.amount, transaction.currency)}
      </p>
    </div>
  )
}
