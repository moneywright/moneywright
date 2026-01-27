import { useState } from 'react'
import {
  Building2,
  MoreVertical,
  Pencil,
  Trash2,
  Clock,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
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
import { cn } from '@/lib/utils'
import type { Account, AccountType, Statement, Profile } from '@/lib/api'
import { ProfileBadge } from '@/components/ui/profile-badge'

interface BankAccountCardProps {
  account: Account
  accountTypes: AccountType[]
  countryCode: string
  institutionName?: string
  statement?: Statement
  onEdit: () => void
  onDelete: () => void
  onRecategorize?: () => void
  /** Profiles list for showing profile badge in family view */
  profiles?: Profile[]
  /** Whether to show profile badge (family view mode) */
  showProfileBadge?: boolean
}

export function BankAccountCard({
  account,
  accountTypes,
  countryCode,
  institutionName,
  statement,
  onEdit,
  onDelete,
  onRecategorize,
  profiles,
  showProfileBadge,
}: BankAccountCardProps) {
  const [logoError, setLogoError] = useState(false)
  const logoPath = account.institution
    ? `/institutions/${countryCode}/${account.institution}.svg`
    : null

  const isPending = account.accountName?.startsWith('Pending -')

  const getAccountTypeLabel = (code: string) => {
    return accountTypes?.find((t) => t.code === code)?.label || code.replace(/_/g, ' ')
  }

  const lastFour = account.accountNumber?.slice(-4) || null

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

  // Pending account - show processing or failed state
  if (isPending) {
    const fileName = account.accountName?.replace('Pending - ', '') || 'Statement'
    const isFailed = statement?.status === 'failed'
    const isProcessing = statement?.status === 'parsing' || statement?.status === 'pending'

    return (
      <div
        className={cn(
          'relative rounded-xl p-5 border-2 border-dashed',
          isFailed ? 'bg-negative-muted border-negative/30' : 'bg-warning-muted border-warning/30'
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'h-10 w-10 rounded-lg flex items-center justify-center shrink-0 border',
              isFailed
                ? 'bg-negative-muted border-negative/20'
                : 'bg-warning-muted border-warning/20'
            )}
          >
            {isFailed ? (
              <XCircle className="h-5 w-5 text-negative" />
            ) : (
              <Clock className="h-5 w-5 text-warning animate-pulse" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3
              className={cn('font-semibold text-sm', isFailed ? 'text-negative' : 'text-warning')}
            >
              {isFailed ? 'Parsing Failed' : 'Processing Statement'}
            </h3>
            <p className="text-xs text-muted-foreground truncate">{fileName}</p>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs text-muted-foreground">
            {isFailed
              ? statement?.errorMessage ||
                'Failed to parse the statement. You can delete this account and try uploading again.'
              : 'This account will be updated once the statement is parsed. Please wait or check the Statements page for status.'}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isProcessing && !isFailed ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-warning" />
                <span className="text-xs text-warning">
                  {statement?.status === 'parsing' ? 'Parsing...' : 'Awaiting processing...'}
                </span>
              </>
            ) : isFailed ? (
              <>
                <AlertTriangle className="h-3 w-3 text-negative" />
                <span className="text-xs text-negative">Parsing failed</span>
              </>
            ) : null}
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-3 text-xs text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete this pending account and its associated statement. You can upload
                  the statement again after deletion.
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
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative rounded-xl p-5 border transition-colors',
        'bg-card border-border-subtle hover:border-border-hover',
        !account.isActive && 'opacity-50'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-surface-elevated border border-border-subtle shrink-0">
            {logoPath && !logoError ? (
              <img
                src={logoPath}
                alt={institutionName || account.institution || ''}
                className="h-6 w-6 object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <Building2 className="h-5 w-5 text-muted-foreground" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground truncate text-sm">
                {institutionName || account.institution || 'Bank Account'}
              </h3>
              {showProfileBadge && profiles && (
                <ProfileBadge profileId={account.profileId} profiles={profiles} />
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {getAccountTypeLabel(account.type)}
              {lastFour && ` · •••• ${lastFour}`}
            </p>
          </div>
        </div>

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
                <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete all statements and transactions associated with this account.
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

      {/* Balance */}
      <div className="mt-4 pt-4 border-t border-border-subtle">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Balance</p>
        <div className="flex items-baseline justify-between mt-1">
          <p className="text-xl font-semibold text-positive tabular-nums">
            {account.latestBalance !== null ? formatCurrency(account.latestBalance) : '—'}
          </p>
          {balanceDate && <p className="text-xs text-muted-foreground">as of {balanceDate}</p>}
        </div>
      </div>
    </div>
  )
}
