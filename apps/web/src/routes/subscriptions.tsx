import { useState, useMemo, useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AppLayout } from '@/components/domain/app-layout'
import { ProfileSelector } from '@/components/domain/profile-selector'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Search, Calendar, TrendingUp, Repeat, Receipt, Info, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth, useCategories } from '@/hooks'
import { getSubscriptions } from '@/lib/api'
import type { DetectedSubscription, Profile } from '@/lib/api'

export const Route = createFileRoute('/subscriptions')({
  component: SubscriptionsPage,
})

// Format currency for display
function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Format date
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// Format short date for cards
function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  })
}

// Get frequency label
function getFrequencyLabel(frequency: DetectedSubscription['frequency']): string {
  switch (frequency) {
    case 'monthly':
      return 'Monthly'
    case 'quarterly':
      return 'Quarterly'
    case 'yearly':
      return 'Yearly'
    default:
      return 'Recurring'
  }
}

// Get frequency abbreviation - always /mo since we show monthly equivalent
function getFrequencyAbbr(frequency: DetectedSubscription['frequency']): string {
  // For quarterly/yearly, we show the monthly equivalent price, so suffix is /mo
  if (frequency === 'quarterly' || frequency === 'yearly') {
    return '/mo'
  }
  return ''
}

// Get monthly equivalent price
function getMonthlyPrice(amount: number, frequency: DetectedSubscription['frequency']): number {
  switch (frequency) {
    case 'quarterly':
      return Math.round(amount / 3)
    case 'yearly':
      return Math.round(amount / 12)
    default:
      return amount
  }
}

// Get billing period label
function getBillingLabel(frequency: DetectedSubscription['frequency']): string {
  switch (frequency) {
    case 'quarterly':
      return 'Billed quarterly'
    case 'yearly':
      return 'Billed yearly'
    default:
      return ''
  }
}

type FrequencyFilter = 'all' | 'monthly' | 'quarterly' | 'yearly'
type StatusFilter = 'all' | 'active' | 'inactive'

function SubscriptionsPage() {
  const { defaultProfile, user } = useAuth()
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [frequencyFilter, setFrequencyFilter] = useState<FrequencyFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [selectedSubscription, setSelectedSubscription] = useState<DetectedSubscription | null>(
    null
  )

  const activeProfileId = selectedProfileId || defaultProfile?.id
  const countryCode = user?.country?.toLowerCase() || 'in'

  // Fetch categories for labels
  const { data: categoriesData } = useCategories()
  const categories = useMemo(() => categoriesData?.categories || [], [categoriesData?.categories])

  const getCategoryLabel = useCallback(
    (code: string) => {
      const cat = categories.find((c) => c.code === code)
      return cat?.label || code.replace(/_/g, ' ')
    },
    [categories]
  )

  // Fetch subscriptions
  const { data: subscriptionsData, isLoading } = useQuery({
    queryKey: ['subscriptions', activeProfileId],
    queryFn: () => getSubscriptions(activeProfileId!),
    enabled: !!activeProfileId,
  })

  const subscriptions = useMemo(
    () => subscriptionsData?.subscriptions || [],
    [subscriptionsData?.subscriptions]
  )
  const currency = subscriptionsData?.currency || 'INR'

  // Calculate stats (for active subscriptions only)
  const stats = useMemo(() => {
    const active = subscriptions.filter((s) => s.isActive)
    const inactive = subscriptions.filter((s) => !s.isActive)

    const monthly = active.filter((s) => s.frequency === 'monthly')
    const quarterly = active.filter((s) => s.frequency === 'quarterly')
    const yearly = active.filter((s) => s.frequency === 'yearly')

    const monthlyTotal = monthly.reduce((sum, s) => sum + s.amount, 0)
    const quarterlyTotal = quarterly.reduce((sum, s) => sum + s.amount, 0)
    const yearlyTotal = yearly.reduce((sum, s) => sum + s.amount, 0)

    // Calculate yearly equivalent (only for active subscriptions)
    const yearlyEquivalent = monthlyTotal * 12 + quarterlyTotal * 4 + yearlyTotal

    return {
      totalMonthly: subscriptionsData?.totalMonthly || 0,
      yearlyEquivalent,
      monthlyCount: monthly.length,
      quarterlyCount: quarterly.length,
      yearlyCount: yearly.length,
      activeCount: active.length,
      inactiveCount: inactive.length,
      totalCount: subscriptions.length,
    }
  }, [subscriptions, subscriptionsData?.totalMonthly])

  // Filter subscriptions
  const filteredSubscriptions = useMemo(() => {
    let filtered = subscriptions

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((s) => (statusFilter === 'active' ? s.isActive : !s.isActive))
    }

    // Filter by frequency
    if (frequencyFilter !== 'all') {
      filtered = filtered.filter((s) => s.frequency === frequencyFilter)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          getCategoryLabel(s.category).toLowerCase().includes(query) ||
          s.institution?.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [subscriptions, statusFilter, frequencyFilter, searchQuery, getCategoryLabel])

  const handleProfileChange = (profile: Profile) => {
    setSelectedProfileId(profile.id)
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title="Subscriptions"
          description="Track and manage your recurring payments"
          actions={
            <ProfileSelector
              selectedProfileId={activeProfileId || null}
              onProfileChange={handleProfileChange}
            />
          }
        />

        {/* Stats Cards */}
        <StatCardGrid className="lg:grid-cols-3">
          <StatCard
            label="Monthly Cost"
            value={stats.totalMonthly}
            currency={currency}
            subtitle={`${stats.activeCount} active subscriptions`}
            icon={Calendar}
          />
          <StatCard
            label="Yearly Equivalent"
            value={stats.yearlyEquivalent}
            currency={currency}
            subtitle="If all active subscriptions continue"
            icon={TrendingUp}
          />
          <StatCard
            label="Active / Inactive"
            value={stats.activeCount}
            isCount
            subtitle={`${stats.inactiveCount} inactive · ${stats.monthlyCount}M / ${stats.quarterlyCount}Q / ${stats.yearlyCount}Y`}
            icon={Repeat}
          />
        </StatCardGrid>

        {/* Filters */}
        <div
          className={cn(
            'relative flex flex-col gap-4 p-4 rounded-2xl transition-all duration-300',
            'bg-linear-to-b from-card to-card/80',
            'border border-border-subtle',
            'shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]',
            'dark:shadow-[0_1px_3px_rgba(0,0,0,0.2),0_4px_12px_rgba(0,0,0,0.15)]'
          )}
        >
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-60 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search subscriptions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  'pl-10 pr-4 h-11 rounded-xl border-0',
                  'bg-surface-elevated',
                  'placeholder:text-muted-foreground/60',
                  'focus-visible:ring-2 focus-visible:ring-primary/20'
                )}
              />
            </div>

            {/* Status Filter */}
            <div
              className={cn(
                'flex items-center p-1 rounded-xl',
                'bg-surface-elevated',
                'border border-border-subtle'
              )}
            >
              <button
                onClick={() => setStatusFilter('active')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                  statusFilter === 'active'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Active
              </button>
              <button
                onClick={() => setStatusFilter('inactive')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                  statusFilter === 'inactive'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Inactive
              </button>
              <button
                onClick={() => setStatusFilter('all')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                  statusFilter === 'all'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                All
              </button>
            </div>

            {/* Frequency Filter */}
            <div
              className={cn(
                'flex items-center p-1 rounded-xl',
                'bg-surface-elevated',
                'border border-border-subtle'
              )}
            >
              <button
                onClick={() => setFrequencyFilter('all')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                  frequencyFilter === 'all'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                All
              </button>
              <button
                onClick={() => setFrequencyFilter('monthly')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                  frequencyFilter === 'monthly'
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Monthly
              </button>
              <button
                onClick={() => setFrequencyFilter('quarterly')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                  frequencyFilter === 'quarterly'
                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Quarterly
              </button>
              <button
                onClick={() => setFrequencyFilter('yearly')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                  frequencyFilter === 'yearly'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Yearly
              </button>
            </div>
          </div>
        </div>

        {/* Subscriptions Grid */}
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card border border-border-subtle rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5">
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        ) : filteredSubscriptions.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSubscriptions.map((sub, index) => (
              <SubscriptionCard
                key={`${sub.name}-${sub.lastChargeDate}`}
                subscription={sub}
                currency={currency}
                countryCode={countryCode}
                getCategoryLabel={getCategoryLabel}
                onClick={() => setSelectedSubscription(sub)}
                index={index}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={
              searchQuery || frequencyFilter !== 'all' || statusFilter !== 'active'
                ? Receipt
                : Repeat
            }
            title={
              searchQuery || frequencyFilter !== 'all' || statusFilter !== 'active'
                ? 'No matching subscriptions'
                : 'No subscriptions detected'
            }
            description={
              searchQuery || frequencyFilter !== 'all' || statusFilter !== 'active'
                ? 'Try adjusting your search or filters'
                : 'Recurring payments will appear here once detected from your transactions.'
            }
          />
        )}

        {/* Transaction History Modal */}
        <TransactionHistoryModal
          subscription={selectedSubscription}
          currency={currency}
          countryCode={countryCode}
          getCategoryLabel={getCategoryLabel}
          onClose={() => setSelectedSubscription(null)}
        />
      </div>
    </AppLayout>
  )
}

// Account Logo Component - Compact version
function AccountBadge({
  logoPath,
  institutionId,
  last4,
}: {
  logoPath: string | null
  institutionId: string
  last4: string
}) {
  const [logoError, setLogoError] = useState(false)

  return (
    <div className="flex items-center gap-1">
      <div className="h-4 w-4 rounded bg-surface-elevated flex items-center justify-center overflow-hidden shrink-0 border border-border-subtle">
        {logoPath && !logoError ? (
          <img
            src={logoPath}
            alt={institutionId}
            className="h-3 w-3 object-contain"
            onError={() => setLogoError(true)}
          />
        ) : (
          <span className="text-[8px] font-medium text-muted-foreground">
            {institutionId.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
      <span className="text-[11px] text-muted-foreground tabular-nums">••{last4}</span>
    </div>
  )
}

// Subscription Card Component - Compact, clickable design
function SubscriptionCard({
  subscription: sub,
  currency,
  countryCode,
  getCategoryLabel,
  onClick,
  index,
}: {
  subscription: DetectedSubscription
  currency: string
  countryCode: string
  getCategoryLabel: (code: string) => string
  onClick: () => void
  index: number
}) {
  const institutionId = sub.institution || ''
  const logoPath = institutionId ? `/institutions/${countryCode}/${institutionId}.svg` : null
  const monthlyPrice = getMonthlyPrice(sub.amount, sub.frequency)

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative w-full text-left bg-card border border-border-subtle rounded-xl p-4',
        'hover:border-border-hover hover:bg-surface-hover/50 transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40',
        !sub.isActive && 'opacity-60',
        'animate-stagger-fade-in'
      )}
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
    >
      {/* Top row: Name and Amount */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground truncate">{sub.name}</h3>
            {!sub.isActive && (
              <span className="shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded bg-zinc-500/10 text-zinc-500 uppercase tracking-wide">
                Inactive
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {getCategoryLabel(sub.category)}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <div className="flex items-baseline gap-0.5">
            <span className="text-base font-bold tabular-nums text-foreground">
              {formatCurrency(monthlyPrice, currency)}
            </span>
            {(sub.frequency === 'quarterly' || sub.frequency === 'yearly') && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[10px] text-muted-foreground cursor-help">
                    {getFrequencyAbbr(sub.frequency)}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left" className="text-xs">
                  {getBillingLabel(sub.frequency)}: {formatCurrency(sub.amount, currency)}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {getFrequencyLabel(sub.frequency)}
          </span>
        </div>
      </div>

      {/* Bottom row: Meta info */}
      <div className="flex items-center gap-3 pt-2 border-t border-border-subtle">
        {/* Account info */}
        {sub.accountLast4 && (
          <AccountBadge
            logoPath={logoPath}
            institutionId={institutionId || 'other'}
            last4={sub.accountLast4}
          />
        )}

        {/* Charge count */}
        <span className="text-[11px] text-muted-foreground">
          {sub.chargeCount} {sub.chargeCount === 1 ? 'charge' : 'charges'}
        </span>

        {/* Last charge */}
        <span className="text-[11px] text-muted-foreground ml-auto">
          {formatShortDate(sub.lastChargeDate)}
        </span>

        {/* Arrow indicator */}
        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity -mr-1" />
      </div>
    </button>
  )
}

// Transaction History Modal
function TransactionHistoryModal({
  subscription: sub,
  currency,
  countryCode,
  getCategoryLabel,
  onClose,
}: {
  subscription: DetectedSubscription | null
  currency: string
  countryCode: string
  getCategoryLabel: (code: string) => string
  onClose: () => void
}) {
  if (!sub) return null

  const institutionId = sub.institution || ''
  const logoPath = institutionId ? `/institutions/${countryCode}/${institutionId}.svg` : null
  const monthlyPrice = getMonthlyPrice(sub.amount, sub.frequency)

  return (
    <Dialog open={!!sub} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pb-4 border-b border-border-subtle pr-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-semibold truncate">{sub.name}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {getCategoryLabel(sub.category)}
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold tabular-nums">
                  {formatCurrency(monthlyPrice, currency)}
                </span>
                {(sub.frequency === 'quarterly' || sub.frequency === 'yearly') && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-xs">
                      {getBillingLabel(sub.frequency)}: {formatCurrency(sub.amount, currency)}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {getFrequencyLabel(sub.frequency)}
              </span>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
            {sub.accountLast4 && (
              <AccountBadge
                logoPath={logoPath}
                institutionId={institutionId || 'other'}
                last4={sub.accountLast4}
              />
            )}
            <span>{sub.chargeCount} total charges</span>
            {!sub.isActive && (
              <span className="px-1.5 py-0.5 rounded bg-zinc-500/10 text-zinc-500 text-[10px] font-medium uppercase">
                Inactive
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Transaction list */}
        <div className="py-2">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Transaction History
          </p>
          <div className="space-y-1 max-h-[320px] overflow-y-auto -mx-2 px-2">
            {sub.transactions.map((txn, i) => (
              <div
                key={txn.id}
                className={cn(
                  'flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors',
                  i === 0 ? 'bg-primary/5 border border-primary/10' : 'hover:bg-surface-hover'
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-1.5 h-1.5 rounded-full shrink-0',
                      i === 0 ? 'bg-primary' : 'bg-border-subtle'
                    )}
                  />
                  <span
                    className={cn(
                      'text-sm',
                      i === 0 ? 'text-foreground font-medium' : 'text-muted-foreground'
                    )}
                  >
                    {formatDate(txn.date)}
                  </span>
                  {i === 0 && (
                    <span className="text-[9px] font-medium text-primary uppercase tracking-wide">
                      Latest
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    'text-sm tabular-nums',
                    i === 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {formatCurrency(txn.amount, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
