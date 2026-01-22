import { useState } from 'react'
import { Repeat } from 'lucide-react'
import type { DetectedSubscription } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

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

interface SubscriptionsListProps {
  subscriptions: DetectedSubscription[]
  totalMonthly: number
  currency: string
  getCategoryLabel: (code: string) => string
  isLoading?: boolean
  className?: string
  /** Whether to show compact view (for dashboard) or expanded view */
  compact?: boolean
  /** Country code for institution logos */
  countryCode?: string
}

// Account Logo Component - Mini version for dashboard
function AccountLogo({
  logoPath,
  institutionId,
}: {
  logoPath: string | null
  institutionId: string
}) {
  const [logoError, setLogoError] = useState(false)

  return (
    <div className="h-4 w-4 rounded bg-surface-elevated flex items-center justify-center overflow-hidden shrink-0 border border-border-subtle">
      {logoPath && !logoError ? (
        <img
          src={logoPath}
          alt={institutionId}
          className="h-3 w-3 object-contain"
          onError={() => setLogoError(true)}
        />
      ) : (
        <span className="text-[7px] font-semibold text-muted-foreground">
          {institutionId.slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  )
}

// Format currency for display
function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Loading Skeleton
function SubscriptionsSkeleton() {
  return (
    <div className="space-y-1">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center justify-between py-2.5 px-1">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-4 w-14" />
        </div>
      ))}
    </div>
  )
}

// Empty State
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
        <div className="relative p-3 rounded-xl bg-surface-elevated border border-border-subtle">
          <Repeat className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">No subscriptions detected</p>
      <p className="mt-1 text-xs text-muted-foreground text-center max-w-44">
        Recurring payments will appear here once detected
      </p>
    </div>
  )
}

export function SubscriptionsList({
  subscriptions,
  totalMonthly,
  currency,
  getCategoryLabel: _getCategoryLabel,
  isLoading,
  className,
  compact = true,
  countryCode = 'in',
}: SubscriptionsListProps) {
  if (isLoading) {
    return (
      <div className={cn('', className)}>
        <SubscriptionsSkeleton />
      </div>
    )
  }

  if (!subscriptions.length) {
    return (
      <div className={cn('', className)}>
        <EmptyState />
      </div>
    )
  }

  // For compact view, only show active subscriptions
  const activeSubscriptions = compact ? subscriptions.filter((s) => s.isActive) : subscriptions
  const displayCount = compact ? 6 : activeSubscriptions.length

  return (
    <div className={cn('', className)}>
      {/* Total monthly cost header */}
      <div className="flex items-center justify-between pb-3 mb-1 border-b border-border-subtle">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          Est. Monthly Cost
        </span>
        <span className="text-base font-bold text-foreground tabular-nums">
          {formatCurrency(totalMonthly, currency)}
        </span>
      </div>

      {/* Subscription list */}
      <div className="space-y-0.5">
        {activeSubscriptions.slice(0, displayCount).map((sub) => {
          const institutionId = sub.institution || ''
          const logoPath = institutionId
            ? `/institutions/${countryCode}/${institutionId}.svg`
            : null

          return (
            <div
              key={`${sub.name}-${sub.lastChargeDate}`}
              className={cn(
                'flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg hover:bg-surface-elevated transition-colors',
                !sub.isActive && 'opacity-50'
              )}
            >
              {/* Left: Name and account */}
              <div className="min-w-0 flex-1 pr-4">
                <p className="text-sm font-medium text-foreground truncate">{sub.name}</p>
                {sub.accountLast4 && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <AccountLogo logoPath={logoPath} institutionId={institutionId || 'bank'} />
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      ••{sub.accountLast4}
                    </span>
                  </div>
                )}
              </div>

              {/* Right: Amount */}
              <p className="text-sm font-semibold tabular-nums text-foreground shrink-0">
                {formatCurrency(getMonthlyPrice(sub.amount, sub.frequency), currency)}
              </p>
            </div>
          )
        })}
      </div>

      {compact && activeSubscriptions.length > 6 && (
        <p className="text-[11px] text-muted-foreground text-center pt-3">
          +{activeSubscriptions.length - 6} more subscriptions
        </p>
      )}
    </div>
  )
}
