import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useProfiles } from '@/hooks/useAuthStatus'
import { AppLayout } from '@/components/domain/app-layout'
import { ProfileSelector } from '@/components/domain/profile-selector'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Upload,
  TrendingUp,
  Wallet,
  CreditCard,
  Banknote,
  PieChart,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Building2,
} from 'lucide-react'
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

// Category labels mapping
const categoryLabels: Record<string, string> = {
  food_dining: 'Food & Dining',
  shopping: 'Shopping',
  transportation: 'Transport',
  utilities: 'Utilities',
  entertainment: 'Entertainment',
  healthcare: 'Healthcare',
  education: 'Education',
  travel: 'Travel',
  personal_care: 'Personal Care',
  home: 'Home',
  insurance: 'Insurance',
  investments: 'Investments',
  salary: 'Salary',
  business_income: 'Business',
  interest_income: 'Interest',
  refund: 'Refund',
  transfer: 'Transfer',
  other: 'Other',
  emi_loan: 'EMI/Loan',
  rent: 'Rent',
  groceries: 'Groceries',
  subscriptions: 'Subscriptions',
}

// Category colors for the breakdown chart
const categoryColors: Record<string, string> = {
  food_dining: 'bg-orange-500',
  shopping: 'bg-pink-500',
  transportation: 'bg-blue-500',
  utilities: 'bg-yellow-500',
  entertainment: 'bg-purple-500',
  healthcare: 'bg-red-500',
  education: 'bg-indigo-500',
  travel: 'bg-cyan-500',
  personal_care: 'bg-rose-500',
  home: 'bg-amber-500',
  insurance: 'bg-emerald-500',
  investments: 'bg-teal-500',
  emi_loan: 'bg-red-600',
  rent: 'bg-violet-500',
  groceries: 'bg-lime-500',
  subscriptions: 'bg-fuchsia-500',
  other: 'bg-slate-500',
}

function DashboardPage() {
  const { defaultProfile } = useProfiles()
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [showFamilyView, setShowFamilyView] = useState(false)

  const selectedProfile = selectedProfileId ? { id: selectedProfileId } : defaultProfile
  const profileId = selectedProfile?.id

  // Fetch summary data
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['summary', profileId],
    queryFn: () => getSummary(profileId!),
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Your financial overview</p>
        </div>
        <ProfileSelector
          selectedProfileId={selectedProfile?.id || null}
          onProfileChange={handleProfileChange}
          showFamilyView={showFamilyView}
          onFamilyViewChange={setShowFamilyView}
        />
      </div>

      {/* Main Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard
          title="Net Worth"
          value={summary?.netWorth.netWorth}
          currency={summary?.netWorth.currency}
          subtitle={
            summary?.netWorth.totalLiabilities
              ? `${formatCompact(summary.netWorth.totalAssets, summary.netWorth.currency)} assets`
              : 'Across all accounts'
          }
          icon={Banknote}
          iconClassName="bg-emerald-500/10 text-emerald-500"
          loading={summaryLoading}
          trend={
            summary?.netWorth.netWorth ? (summary.netWorth.netWorth > 0 ? 'up' : 'down') : undefined
          }
        />
        <StatCard
          title="Monthly Expenses"
          value={summary?.transactions.totalExpenses}
          currency={summary?.transactions.currency}
          subtitle={
            summary?.transactions.expenseCount
              ? `${summary.transactions.expenseCount} transactions`
              : 'This month'
          }
          icon={CreditCard}
          iconClassName="bg-orange-500/10 text-orange-500"
          loading={summaryLoading}
          isExpense
        />
        <StatCard
          title="Investments"
          value={summary?.investments.totalCurrentValue}
          currency={summary?.totals.currency}
          subtitle={
            summary?.investments.gainLossPercentage !== undefined &&
            summary.investments.gainLossPercentage !== 0
              ? `${summary.investments.gainLossPercentage > 0 ? '+' : ''}${summary.investments.gainLossPercentage.toFixed(1)}% returns`
              : 'Total portfolio'
          }
          icon={TrendingUp}
          iconClassName="bg-blue-500/10 text-blue-500"
          loading={summaryLoading}
          trend={
            summary?.investments.totalGainLoss
              ? summary.investments.totalGainLoss > 0
                ? 'up'
                : 'down'
              : undefined
          }
        />
        <StatCard
          title="Accounts"
          value={accountsCount}
          subtitle="Connected accounts"
          icon={Wallet}
          iconClassName="bg-violet-500/10 text-violet-500"
          loading={accountsLoading}
          isCount
        />
      </div>

      {/* Secondary Row: Recent Transactions, Spending Breakdown, AI Insights */}
      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        {/* Recent Transactions */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-medium">Recent Transactions</CardTitle>
                <CardDescription className="text-xs mt-0.5">Latest activity</CardDescription>
              </div>
              {recentTransactions.length > 0 && (
                <Link to="/transactions">
                  <Button variant="ghost" size="sm" className="h-8 text-xs">
                    View all
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {transactionsLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-lg" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-2.5 w-16" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : recentTransactions.length > 0 ? (
              <div className="space-y-1">
                {recentTransactions.map((txn) => (
                  <TransactionRow key={txn.id} transaction={txn} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Wallet}
                title="No transactions yet"
                description="Upload a statement to get started"
              />
            )}
          </CardContent>
        </Card>

        {/* Spending by Category */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Spending Breakdown</CardTitle>
            <CardDescription className="text-xs mt-0.5">This month by category</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {summaryLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                ))}
              </div>
            ) : summary?.transactions.categoryBreakdown &&
              summary.transactions.categoryBreakdown.length > 0 ? (
              <CategoryBreakdown
                categories={summary.transactions.categoryBreakdown}
                total={summary.transactions.totalExpenses}
                currency={summary.transactions.currency}
              />
            ) : (
              <EmptyState
                icon={PieChart}
                title="No spending data"
                description="Categories appear after importing transactions"
              />
            )}
          </CardContent>
        </Card>

        {/* AI Insights */}
        <Card className="lg:col-span-1 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
          <CardHeader className="pb-3 relative">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Insights
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Personalized recommendations
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 relative">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-3">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium mb-1">Coming Soon</p>
              <p className="text-xs text-muted-foreground max-w-[200px]">
                AI-powered insights to help you make smarter financial decisions
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Account Balances Row */}
      {summary?.netWorth.accounts && summary.netWorth.accounts.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-medium">Account Balances</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Latest balance from each account
                </CardDescription>
              </div>
              <Link to="/accounts">
                <Button variant="ghost" size="sm" className="h-8 text-xs">
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
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="flex flex-col items-center text-center max-w-md mx-auto">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Get started with Moneywright</h3>
              <p className="text-muted-foreground text-sm mb-6">
                Upload your bank statements or credit card statements to unlock powerful financial
                insights and track your spending automatically.
              </p>
              <Link to="/statements">
                <Button size="lg" className="gap-2">
                  <Upload className="h-4 w-4" />
                  Upload Your First Statement
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </AppLayout>
  )
}

// Stat Card Component
interface StatCardProps {
  title: string
  value?: number | null
  currency?: string
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
  iconClassName: string
  loading?: boolean
  trend?: 'up' | 'down'
  isExpense?: boolean
  isCount?: boolean
}

function StatCard({
  title,
  value,
  currency = 'INR',
  subtitle,
  icon: Icon,
  iconClassName,
  loading,
  trend,
  isExpense,
  isCount,
}: StatCardProps) {
  const displayValue = isCount
    ? value?.toString() || '0'
    : value !== undefined && value !== null
      ? formatCompact(value, currency)
      : '—'

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              {title}
            </p>
            {loading ? (
              <Skeleton className="h-8 w-28 mb-1" />
            ) : (
              <div className="flex items-baseline gap-2">
                <p
                  className={cn(
                    'text-2xl font-semibold tracking-tight truncate',
                    isExpense && value ? 'text-orange-500' : '',
                    trend === 'up' && !isExpense ? 'text-emerald-500' : '',
                    trend === 'down' && !isExpense ? 'text-red-500' : ''
                  )}
                >
                  {displayValue}
                </p>
                {trend && !isCount && value !== 0 && (
                  <span
                    className={cn(
                      'flex items-center text-xs font-medium',
                      trend === 'up' ? 'text-emerald-500' : 'text-red-500'
                    )}
                  >
                    {trend === 'up' ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                  </span>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>
          </div>
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg shrink-0',
              iconClassName
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Transaction Row Component
function TransactionRow({ transaction }: { transaction: Transaction }) {
  const isCredit = transaction.type === 'credit'

  return (
    <div className="flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-muted/50 transition-colors">
      <div
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-lg shrink-0',
          isCredit ? 'bg-emerald-500/10' : 'bg-orange-500/10'
        )}
      >
        {isCredit ? (
          <ArrowDownRight className="h-4 w-4 text-emerald-500" />
        ) : (
          <ArrowUpRight className="h-4 w-4 text-orange-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {transaction.summary || transaction.originalDescription.slice(0, 30)}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDate(transaction.date)} ·{' '}
          {categoryLabels[transaction.category] || transaction.category}
        </p>
      </div>
      <p
        className={cn(
          'text-sm font-medium tabular-nums shrink-0',
          isCredit ? 'text-emerald-500' : 'text-foreground'
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
  categories,
  total,
  currency,
}: {
  categories: { category: string; total: number; count: number }[]
  total: number
  currency: string
}) {
  // Sort by total and take top 5
  const topCategories = [...categories]
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  if (topCategories.length === 0) {
    return (
      <EmptyState
        icon={PieChart}
        title="No spending data"
        description="Categories appear after importing transactions"
      />
    )
  }

  return (
    <div className="space-y-3">
      {topCategories.map((cat) => {
        const percentage = total > 0 ? (cat.total / total) * 100 : 0
        const colorClass = categoryColors[cat.category] || 'bg-slate-500'

        return (
          <div key={cat.category} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground truncate">
                {categoryLabels[cat.category] || cat.category}
              </span>
              <span className="font-medium tabular-nums ml-2">
                {formatCurrency(cat.total, currency)}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', colorClass)}
                style={{ width: `${Math.max(percentage, 2)}%` }}
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
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-lg shrink-0',
          account.isLiability ? 'bg-red-500/10' : 'bg-emerald-500/10'
        )}
      >
        {account.type === 'credit_card' ? (
          <CreditCard
            className={cn('h-5 w-5', account.isLiability ? 'text-red-500' : 'text-emerald-500')}
          />
        ) : (
          <Building2 className="h-5 w-5 text-emerald-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {account.accountName || account.institution || 'Account'}
        </p>
        <p className="text-xs text-muted-foreground">
          {account.isLiability ? 'Credit Card' : account.type?.replace(/_/g, ' ')}
        </p>
      </div>
      <div className="text-right shrink-0">
        {hasBalance ? (
          <>
            <p
              className={cn(
                'text-sm font-semibold tabular-nums',
                account.isLiability ? 'text-red-500' : 'text-emerald-500'
              )}
            >
              {account.isLiability ? '-' : ''}
              {formatCurrency(account.latestBalance!, account.currency)}
            </p>
            {account.latestStatementDate && (
              <p className="text-xs text-muted-foreground">
                as of {formatDate(account.latestStatementDate)}
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

// Empty State Component
function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-3">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">{description}</p>
    </div>
  )
}
