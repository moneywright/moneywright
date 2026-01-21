import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useProfiles, useCategories } from '@/hooks'
import { AppLayout } from '@/components/domain/app-layout'
import { ProfileSelector } from '@/components/domain/profile-selector'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { InlineEmptyState, EmptyState as SharedEmptyState } from '@/components/ui/empty-state'
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
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getSummary, getTransactions, getAccounts } from '@/lib/api'
import type { Profile, Transaction, FinancialSummary } from '@/lib/api'
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

function DashboardPage() {
  const { defaultProfile } = useProfiles()
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [showFamilyView, setShowFamilyView] = useState(false)
  const [timeframe, setTimeframe] = useState<TimeframeKey>('this_month')

  const selectedProfile = selectedProfileId ? { id: selectedProfileId } : defaultProfile
  const profileId = selectedProfile?.id

  // Get date range for selected timeframe
  const dateRange = getDateRange(timeframe)
  const selectedTimeframeOption = TIMEFRAME_OPTIONS.find((t) => t.key === timeframe)!

  // Fetch categories for proper labels
  const { data: categoriesData } = useCategories()
  const categories = categoriesData?.categories || []

  // Helper to get category label
  const getCategoryLabel = (code: string) => {
    const cat = categories.find((c) => c.code === code)
    return cat?.label || code.replace(/_/g, ' ')
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

      {/* Secondary Row: Recent Transactions & Spending Breakdown */}
      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        {/* Recent Transactions */}
        <Card className="border-[var(--border-subtle)] hover:border-[var(--border-hover)] transition-colors">
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
        <Card className="border-[var(--border-subtle)] hover:border-[var(--border-hover)] transition-colors">
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
        <Card className="mb-6 border-[var(--border-subtle)] hover:border-[var(--border-hover)] transition-colors">
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
            linkOptions: { to: '/statements', search: { upload: true } },
            icon: Upload,
          }}
          size="lg"
        />
      )}
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
    <div className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors group">
      <div
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-lg shrink-0 border',
          'bg-[var(--surface-elevated)] border-[var(--border-subtle)]'
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
            <div className="h-2 bg-[var(--surface-elevated)] rounded-full overflow-hidden">
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
    <div className="flex items-center gap-3 p-3.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] transition-colors">
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-lg shrink-0 border',
          'bg-[var(--surface)] border-[var(--border-subtle)]'
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
