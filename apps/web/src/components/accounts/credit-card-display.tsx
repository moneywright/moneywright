import { useState } from 'react'
import {
  CreditCard,
  MoreVertical,
  Pencil,
  Trash2,
  RefreshCw,
  Receipt,
  Calendar,
  Wallet,
  ChevronRight,
  Loader2,
  CheckCircle2,
  TrendingUp,
  Banknote,
  Building2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { Account, Profile } from '@/lib/api'
import { ProfileBadge } from '@/components/ui/profile-badge'
import { useCreditCardPaymentHistory } from '@/hooks'

interface CreditCardDisplayProps {
  account: Account
  countryCode: string
  institutionName?: string
  onEdit: () => void
  onDelete: () => void
  onRecategorize?: () => void
  /** Profiles list for showing profile badge in family view */
  profiles?: Profile[]
  /** Whether to show profile badge (family view mode) */
  showProfileBadge?: boolean
  /** Callback when card is clicked to show detail modal */
  onSelect?: () => void
}

export function CreditCardDisplay({
  account,
  countryCode,
  institutionName,
  onEdit,
  onDelete,
  onRecategorize,
  profiles,
  showProfileBadge,
  onSelect,
}: CreditCardDisplayProps) {
  const [logoError, setLogoError] = useState(false)
  const logoPath = account.institution
    ? `/institutions/${countryCode}/${account.institution}.svg`
    : null

  const lastFour = account.accountNumber?.slice(-4) || '••••'

  const displayCardName =
    account.productName ||
    (account.accountName?.includes('-') ? account.accountName.split(' - ')[1] : null) ||
    'Credit Card'

  const balanceDate = account.latestStatementDate
    ? new Date(account.latestStatementDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: account.currency || 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div
      className={cn(
        'relative rounded-xl p-5 border transition-colors cursor-pointer',
        'bg-card border-border-subtle hover:border-border-hover',
        !account.isActive && 'opacity-50'
      )}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-surface-elevated border border-border-subtle shrink-0">
            {logoPath && !logoError ? (
              <img
                src={logoPath}
                alt={institutionName || account.institution || ''}
                className="h-6 w-6 object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{displayCardName}</p>
              {showProfileBadge && profiles && (
                <ProfileBadge profileId={account.profileId} profiles={profiles} />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {institutionName || account.institution || 'Credit Card'}
            </p>
          </div>
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              {onRecategorize && (
                <DropdownMenuItem onClick={onRecategorize}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Recategorize
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem
                    className="text-destructive"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Card?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will delete all statements and transactions associated with this card.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={onDelete}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Card Number */}
      <p className="text-sm font-mono text-muted-foreground mt-4 tracking-wider">
        •••• •••• •••• {lastFour}
      </p>

      {/* Balance */}
      <div className="mt-4 pt-4 border-t border-border-subtle">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Outstanding</p>
        <div className="flex items-baseline justify-between mt-1">
          <p className="text-xl font-semibold text-negative tabular-nums">
            {account.latestBalance !== null ? formatCurrency(account.latestBalance) : '—'}
          </p>
          {balanceDate && <p className="text-xs text-muted-foreground">as of {balanceDate}</p>}
        </div>
      </div>
    </div>
  )
}

// ============================================
// Credit Card Detail Modal Component
// ============================================

interface CreditCardDetailModalProps {
  account: Account | null
  onOpenChange: (open: boolean) => void
  countryCode: string
  institutionName?: string
  currencySymbol?: string
  accounts?: Account[]
  institutions?: Record<string, string>
}

export function CreditCardDetailModal({
  account,
  onOpenChange,
  countryCode,
  institutionName,
  currencySymbol = '₹',
  accounts,
  institutions,
}: CreditCardDetailModalProps) {
  const [logoError, setLogoError] = useState(false)
  const [paymentLogoErrors, setPaymentLogoErrors] = useState<Record<string, boolean>>({})

  // Fetch payment history
  const { data: paymentHistory, isLoading: isLoadingPayments } = useCreditCardPaymentHistory(
    account?.id || ''
  )

  if (!account) return null

  const logoPath = account.institution
    ? `/institutions/${countryCode}/${account.institution}.svg`
    : null

  const lastFour = account.accountNumber?.slice(-4) || '••••'

  const displayCardName =
    account.productName ||
    (account.accountName?.includes('-') ? account.accountName.split(' - ')[1] : null) ||
    'Credit Card'

  // Format currency
  const formatAmount = (amount: number | null) => {
    if (amount === null) return '—'
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0,
    }).format(Math.abs(Math.round(amount)))
  }

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  // Get source account info for payment
  const getSourceAccount = (sourceAccountId: string) => {
    return accounts?.find((a) => a.id === sourceAccountId)
  }

  // Get logo path for source account
  const getSourceAccountLogoPath = (sourceAccountId: string) => {
    const sourceAccount = getSourceAccount(sourceAccountId)
    if (sourceAccount?.institution) {
      return `/institutions/${countryCode}/${sourceAccount.institution}.svg`
    }
    return null
  }

  // Get institution name for source account
  const getSourceAccountInstitutionName = (sourceAccountId: string) => {
    const sourceAccount = getSourceAccount(sourceAccountId)
    if (sourceAccount?.institution && institutions) {
      return institutions[sourceAccount.institution]
    }
    return sourceAccount?.accountName || 'Account'
  }

  // Calculate totals from payment history
  const totalPaid = paymentHistory?.reduce((sum, p) => sum + p.amount, 0) ?? 0
  const paymentCount = paymentHistory?.length ?? 0

  // Outstanding balance
  const outstandingBalance = account.latestBalance ?? 0

  return (
    <Dialog open={!!account} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl p-0 gap-0 overflow-hidden max-h-[90vh]"
        showCloseButton={false}
      >
        {/* Header with gradient background */}
        <div
          className={cn(
            'relative px-6 pt-6 pb-8',
            'bg-gradient-to-br from-card via-card to-card',
            'border-b border-border-subtle'
          )}
        >
          {/* Subtle pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 1px)`,
              backgroundSize: '24px 24px',
            }}
          />

          <DialogHeader className="relative">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    'h-14 w-14 rounded-2xl flex items-center justify-center shrink-0',
                    'bg-gradient-to-br shadow-lg',
                    !logoPath || logoError
                      ? 'from-violet-500/20 to-violet-600/20'
                      : 'bg-surface-elevated border border-border-subtle'
                  )}
                >
                  {logoPath && !logoError ? (
                    <img
                      src={logoPath}
                      alt={institutionName || account.institution || ''}
                      className="h-8 w-8 object-contain"
                      onError={() => setLogoError(true)}
                    />
                  ) : (
                    <CreditCard className="h-7 w-7 text-violet-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-xl font-semibold truncate">
                    {displayCardName}
                  </DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">
                      {institutionName || account.institution || 'Credit Card'}
                    </span>
                    <span className="text-sm text-muted-foreground font-mono">•••• {lastFour}</span>
                  </div>
                </div>
              </div>

              {/* Status badge */}
              <div
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
                  account.isActive
                    ? 'bg-positive/10 text-positive'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {account.isActive ? (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-positive opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-positive"></span>
                  </span>
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                <span>{account.isActive ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Scrollable content */}
        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <div className="p-6 space-y-6">
            {/* Balance Section - Hero element */}
            <div className="relative rounded-2xl border border-border-subtle bg-gradient-to-br from-surface-elevated to-card p-5 overflow-hidden">
              {/* Background decoration */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-negative/5 rounded-full blur-3xl" />

              <div className="relative">
                {/* Balance header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-negative/10 flex items-center justify-center">
                      <Wallet className="h-4 w-4 text-negative" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Outstanding Balance</p>
                      <p className="text-xs text-muted-foreground">
                        as of {formatDate(account.latestStatementDate)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Balance display */}
                <div className="mb-4">
                  <p className="text-3xl font-bold tabular-nums text-negative">
                    {currencySymbol}
                    {formatAmount(outstandingBalance)}
                  </p>
                </div>

                {/* Stats breakdown */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 rounded-xl bg-positive/5 border border-positive/10">
                    <p className="text-xs text-muted-foreground mb-1">Total Paid</p>
                    <p className="text-base font-semibold tabular-nums text-positive">
                      {currencySymbol}
                      {formatAmount(totalPaid)}
                    </p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-muted/50 border border-border-subtle">
                    <p className="text-xs text-muted-foreground mb-1">Payments Made</p>
                    <p className="text-base font-semibold tabular-nums">{paymentCount}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <MetricCard
                icon={Banknote}
                label="Currency"
                value={account.currency || 'INR'}
                iconColor="text-blue-500"
                iconBg="bg-blue-500/10"
              />
              <MetricCard
                icon={Calendar}
                label="Last Statement"
                value={formatDate(account.latestStatementDate)}
                iconColor="text-emerald-500"
                iconBg="bg-emerald-500/10"
              />
              <MetricCard
                icon={TrendingUp}
                label="Avg. Payment"
                value={
                  paymentCount > 0
                    ? `${currencySymbol}${formatAmount(totalPaid / paymentCount)}`
                    : '—'
                }
                iconColor="text-orange-500"
                iconBg="bg-orange-500/10"
              />
            </div>

            {/* Payment History */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Payment History</h3>
                {paymentCount > 0 && (
                  <span className="px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                    {paymentCount}
                  </span>
                )}
              </div>

              {isLoadingPayments ? (
                <div className="flex items-center justify-center gap-2 text-muted-foreground py-12">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Loading payment history...</span>
                </div>
              ) : paymentHistory && paymentHistory.length > 0 ? (
                <div className="space-y-2">
                  {paymentHistory.map((payment, index) => {
                    const sourceLogoPath = getSourceAccountLogoPath(payment.sourceAccountId)
                    const sourceInstitutionName = getSourceAccountInstitutionName(
                      payment.sourceAccountId
                    )
                    const hasLogoError = paymentLogoErrors[payment.sourceAccountId]

                    return (
                      <div
                        key={payment.id}
                        className={cn(
                          'flex items-center justify-between p-4 rounded-xl border border-border-subtle',
                          'bg-card hover:bg-surface-elevated transition-colors',
                          'group cursor-default'
                        )}
                        style={{
                          animationDelay: `${index * 50}ms`,
                          animation: 'fadeInUp 0.3s ease-out forwards',
                        }}
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-surface-elevated border border-border-subtle shrink-0">
                            {sourceLogoPath && !hasLogoError ? (
                              <img
                                src={sourceLogoPath}
                                alt={sourceInstitutionName}
                                className="h-5 w-5 object-contain"
                                onError={() =>
                                  setPaymentLogoErrors((prev) => ({
                                    ...prev,
                                    [payment.sourceAccountId]: true,
                                  }))
                                }
                              />
                            ) : (
                              <Building2 className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {payment.summary || 'Bill Payment'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(payment.date).toLocaleDateString('en-GB', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-base font-semibold tabular-nums text-positive">
                            +{currencySymbol}
                            {formatAmount(payment.amount)}
                          </p>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                    <Receipt className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">No payments linked yet</p>
                  <p className="text-xs text-muted-foreground max-w-[280px]">
                    Payments will be auto-detected from your bank statements when you upload them
                  </p>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Close button at bottom */}
        <div className="px-6 py-4 border-t border-border-subtle bg-surface-elevated">
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>

      {/* Animation styles */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </Dialog>
  )
}

// Metric Card Component
function MetricCard({
  icon: Icon,
  label,
  value,
  subtitle,
  iconColor,
  iconBg,
}: {
  icon: typeof Banknote
  label: string
  value: string
  subtitle?: string
  iconColor: string
  iconBg: string
}) {
  return (
    <div className="p-3 rounded-xl border border-border-subtle bg-card hover:bg-surface-elevated transition-colors">
      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center mb-2', iconBg)}>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-base font-semibold tabular-nums leading-tight">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground capitalize">{subtitle}</p>}
    </div>
  )
}
