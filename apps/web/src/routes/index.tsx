import { useState, useMemo, useCallback } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  useProfiles,
  useCategories,
  useMonthlyTrends,
  usePreferences,
  useSetPreference,
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
import { MonthlyTrendsChart } from '@/components/dashboard'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Upload,
  TrendingUp,
  Wallet,
  CreditCard,
  Banknote,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Building2,
  Calendar,
  ChevronDown,
  SlidersHorizontal,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PREFERENCE_KEYS } from '@/lib/api'
import { getSummary, getTransactions, getAccounts, getMonthTransactions } from '@/lib/api'
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
type ChartTimeframeKey = '6m' | '1y' | '2y' | '3y' | '5y' | 'all'

const CHART_TIMEFRAME_OPTIONS: { key: ChartTimeframeKey; label: string; months: number }[] = [
  { key: '6m', label: 'Last 6 months', months: 6 },
  { key: '1y', label: 'Last 1 year', months: 12 },
  { key: '2y', label: 'Last 2 years', months: 24 },
  { key: '3y', label: 'Last 3 years', months: 36 },
  { key: '5y', label: 'Last 5 years', months: 60 },
  { key: 'all', label: 'All time', months: 120 }, // 10 years max
]

function DashboardPage() {
  const { defaultProfile } = useProfiles()
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [showFamilyView, setShowFamilyView] = useState(false)
  const [timeframe, setTimeframe] = useState<TimeframeKey>('this_month')
  const [chartTimeframe, setChartTimeframe] = useState<ChartTimeframeKey>('1y')
  const [selectedMonth, setSelectedMonth] = useState<MonthlyTrendData | null>(null)

  const selectedProfile = selectedProfileId ? { id: selectedProfileId } : defaultProfile
  const profileId = selectedProfile?.id

  // Get date range for selected timeframe
  const dateRange = getDateRange(timeframe)
  const selectedTimeframeOption = TIMEFRAME_OPTIONS.find((t) => t.key === timeframe)!

  // Fetch categories for proper labels
  const { data: categoriesData } = useCategories()
  const categories = categoriesData?.categories || []

  // Fetch preferences
  const { data: preferences } = usePreferences(profileId)
  const setPreferenceMutation = useSetPreference()

  // Derive excluded categories from preferences (no local state needed)
  const excludedCategories = useMemo(() => {
    const prefValue = preferences?.[PREFERENCE_KEYS.DASHBOARD_EXCLUDED_CATEGORIES]
    if (prefValue) {
      try {
        return JSON.parse(prefValue) as string[]
      } catch {
        return []
      }
    }
    return []
  }, [preferences])

  // Helper to get category label
  const getCategoryLabel = (code: string) => {
    const cat = categories.find((c) => c.code === code)
    return cat?.label || code.replace(/_/g, ' ')
  }

  // Toggle category exclusion
  const toggleCategoryExclusion = (categoryCode: string) => {
    const newExcluded = excludedCategories.includes(categoryCode)
      ? excludedCategories.filter((c) => c !== categoryCode)
      : [...excludedCategories, categoryCode]

    // Save to preferences (which will update the derived state via preferences query invalidation)
    setPreferenceMutation.mutate({
      key: PREFERENCE_KEYS.DASHBOARD_EXCLUDED_CATEGORIES,
      value: JSON.stringify(newExcluded),
      profileId,
    })
  }

  // Fetch summary data with timeframe
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['summary', profileId, timeframe],
    queryFn: () => getSummary(profileId!, dateRange),
    enabled: !!profileId,
  })

  // Fetch recent transactions
  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', profileId, 'recent'],
    queryFn: () =>
      getTransactions({ profileId: profileId! }, { limit: 5, sortBy: 'date', sortOrder: 'desc' }),
    enabled: !!profileId,
  })

  // Fetch accounts count
  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts', profileId],
    queryFn: () => getAccounts(profileId!),
    enabled: !!profileId,
  })

  // Fetch monthly trends for chart
  const chartMonths = CHART_TIMEFRAME_OPTIONS.find((t) => t.key === chartTimeframe)?.months || 12
  const { data: trendsData, isLoading: trendsLoading } = useMonthlyTrends(
    profileId,
    chartMonths,
    excludedCategories.length > 0 ? excludedCategories : undefined
  )

  // Fetch transactions for selected month (with netting and exclusions applied)
  const { data: monthTransactionsData, isLoading: monthTransactionsLoading } = useQuery({
    queryKey: ['month-transactions', profileId, selectedMonth?.month, excludedCategories],
    queryFn: () =>
      getMonthTransactions(
        profileId!,
        selectedMonth!.month,
        excludedCategories.length > 0 ? excludedCategories : undefined
      ),
    enabled: !!profileId && !!selectedMonth,
  })

  // Handle month click from chart
  const handleMonthClick = useCallback((month: MonthlyTrendData) => {
    setSelectedMonth(month)
  }, [])

  const handleProfileChange = (profile: Profile) => {
    setSelectedProfileId(profile.id)
    setShowFamilyView(false)
  }

  const recentTransactions = transactionsData?.transactions || []
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
              {excludedCategories.length > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground/70">
                  ({excludedCategories.length} excluded)
                </span>
              )}
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
                      excludedCategories.length > 0 && 'text-primary'
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
                            checked={excludedCategories.includes(cat.code)}
                            onCheckedChange={() => toggleCategoryExclusion(cat.code)}
                          />
                          <span
                            className={cn(
                              excludedCategories.includes(cat.code) &&
                                'line-through text-muted-foreground'
                            )}
                          >
                            {cat.label}
                          </span>
                        </label>
                      ))}
                    </div>
                    {excludedCategories.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-7 text-xs"
                        onClick={() => {
                          setPreferenceMutation.mutate({
                            key: PREFERENCE_KEYS.DASHBOARD_EXCLUDED_CATEGORIES,
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Calendar className="mr-1.5 h-3 w-3" />
                    {CHART_TIMEFRAME_OPTIONS.find((t) => t.key === chartTimeframe)?.label}
                    <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {CHART_TIMEFRAME_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.key}
                      onClick={() => setChartTimeframe(option.key)}
                      className={cn(chartTimeframe === option.key && 'bg-accent')}
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
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

      {/* Secondary Row: Recent Transactions & Spending Breakdown */}
      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        {/* Recent Transactions */}
        <Card className="border-border-subtle hover:border-border-hover transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  Recent Transactions
                </CardTitle>
              </div>
              {recentTransactions.length > 0 && (
                <Link to="/transactions">
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
            {transactionsLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <Skeleton className="h-9 w-9 rounded-lg" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-2.5 w-20" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : recentTransactions.length > 0 ? (
              <div className="space-y-0.5">
                {recentTransactions.map((txn) => (
                  <TransactionRow
                    key={txn.id}
                    transaction={txn}
                    getCategoryLabel={getCategoryLabel}
                  />
                ))}
              </div>
            ) : (
              <InlineEmptyState
                icon={Wallet}
                title="No transactions yet"
                description="Upload a statement to get started"
              />
            )}
          </CardContent>
        </Card>

        {/* Spending by Category */}
        <Card className="border-border-subtle hover:border-border-hover transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Spending by Category
              </CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Calendar className="mr-1.5 h-3 w-3" />
                    {selectedTimeframeOption.shortLabel}
                    <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {TIMEFRAME_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.key}
                      onClick={() => setTimeframe(option.key)}
                      className={cn(timeframe === option.key && 'bg-accent')}
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {summaryLoading ? (
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
            ) : summary?.transactions.categoryBreakdown &&
              summary.transactions.categoryBreakdown.length > 0 ? (
              <CategoryBreakdown
                categoryBreakdown={summary.transactions.categoryBreakdown}
                total={summary.transactions.totalExpenses}
                currency={summary.transactions.currency}
                getCategoryLabel={getCategoryLabel}
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

// Transaction Row Component
function TransactionRow({
  transaction,
  getCategoryLabel,
}: {
  transaction: Transaction
  getCategoryLabel: (code: string) => string
}) {
  const isCredit = transaction.type === 'credit'

  return (
    <div className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-surface-hover transition-colors group">
      <div
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-lg shrink-0 border',
          'bg-surface-elevated border-border-subtle'
        )}
      >
        {isCredit ? (
          <ArrowDownRight className="h-4 w-4 text-positive" />
        ) : (
          <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-foreground">
          {transaction.summary || transaction.originalDescription.slice(0, 30)}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatDate(transaction.date)} · {getCategoryLabel(transaction.category)}
        </p>
      </div>
      <p
        className={cn(
          'text-sm font-semibold tabular-nums shrink-0',
          isCredit ? 'text-positive' : 'text-foreground'
        )}
      >
        {isCredit ? '+' : '-'}
        {formatCurrency(transaction.amount, transaction.currency)}
      </p>
    </div>
  )
}

// Category Breakdown Component
function CategoryBreakdown({
  categoryBreakdown,
  currency,
  getCategoryLabel,
}: {
  categoryBreakdown: { category: string; total: number; count: number }[]
  total: number // kept for API compatibility
  currency: string
  getCategoryLabel: (code: string) => string
}) {
  // Sort by total and take top 6
  const topCategories = [...categoryBreakdown]
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)

  if (topCategories.length === 0) {
    return (
      <InlineEmptyState
        icon={PieChart}
        title="No spending data"
        description="Categories appear after importing transactions"
      />
    )
  }

  // Calculate max for relative sizing
  const maxTotal = Math.max(...topCategories.map((c) => c.total))

  return (
    <div className="space-y-4">
      {topCategories.map((cat, index) => {
        const percentage = maxTotal > 0 ? (cat.total / maxTotal) * 100 : 0
        // Use emerald with varying opacity based on rank
        const opacityPercent = 100 - index * 12

        return (
          <div key={cat.category} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground truncate">
                {getCategoryLabel(cat.category)}
              </span>
              <span className="text-sm font-semibold tabular-nums ml-2 text-foreground">
                {formatCurrency(cat.total, currency)}
              </span>
            </div>
            <div className="h-2 bg-surface-elevated rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 bg-primary"
                style={{
                  width: `${Math.max(percentage, 4)}%`,
                  opacity: opacityPercent / 100,
                }}
              />
            </div>
          </div>
        )
      })}
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
