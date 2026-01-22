import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Loader2,
  Check,
  X,
  Clock,
  Trash2,
  Building2,
  CreditCard,
  TrendingUp,
  MoreVertical,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Statement, Account, InvestmentSource } from '@/lib/api'

interface StatementCardProps {
  statement: Statement
  account: Account | undefined
  source: InvestmentSource | undefined
  logoPath: string | null
  formatFileSize: (bytes: number | null) => string
  formatPeriod: (start: string | null, end: string | null) => string | null
  onDelete: () => void
  onRecategorize?: () => void
}

export function StatementCard({
  statement,
  account,
  source,
  logoPath,
  formatFileSize,
  formatPeriod,
  onDelete,
  onRecategorize,
}: StatementCardProps) {
  const [logoError, setLogoError] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const isInvestment = statement.documentType === 'investment_statement'
  const isCreditCard = account?.type === 'credit_card'
  const periodLabel = formatPeriod(statement.periodStart, statement.periodEnd)
  const accountNumber = isInvestment
    ? source?.accountIdentifier?.slice(-4)
    : account?.accountNumber?.slice(-4)

  const count = isInvestment ? (statement.holdingsCount ?? 0) : statement.transactionCount

  const displayName = isInvestment
    ? source?.sourceName || source?.institution || 'Investment Account'
    : account?.accountName || account?.institution || 'Unknown Account'

  const accountType = isInvestment ? 'Investment' : isCreditCard ? 'Credit Card' : 'Bank'

  const isPending = statement.status === 'pending'
  const isParsing = statement.status === 'parsing'
  const isFailed = statement.status === 'failed'
  const isCompleted = statement.status === 'completed'

  const getStatusIcon = () => {
    if (isCompleted) {
      return {
        icon: <Check className="h-3 w-3" />,
        label: 'Completed',
        className: 'text-positive',
      }
    }
    if (isParsing) {
      return {
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
        label: 'Processing...',
        className: 'text-primary',
      }
    }
    if (isPending) {
      return {
        icon: <Clock className="h-3 w-3" />,
        label: 'Queued',
        className: 'text-muted-foreground',
      }
    }
    if (isFailed) {
      return {
        icon: <X className="h-3 w-3" />,
        label: 'Failed',
        className: 'text-negative',
      }
    }
    return null
  }

  const statusConfig = getStatusIcon()

  return (
    <>
      <div
        className={cn(
          'group relative rounded-xl overflow-hidden transition-all',
          'bg-card border border-border-subtle',
          'hover:border-border-hover',
          isFailed && 'border-negative/30'
        )}
      >
        <div className="p-4">
          {/* Header: Logo + Info + Menu */}
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 overflow-hidden bg-surface-elevated border border-border-subtle">
              {logoPath && !logoError ? (
                <img
                  src={logoPath}
                  alt=""
                  className="h-6 w-6 object-contain"
                  onError={() => setLogoError(true)}
                />
              ) : isInvestment ? (
                <TrendingUp className="h-5 w-5 text-muted-foreground/70" />
              ) : isCreditCard ? (
                <CreditCard className="h-5 w-5 text-muted-foreground/70" />
              ) : (
                <Building2 className="h-5 w-5 text-muted-foreground/70" />
              )}
            </div>

            {/* Name + Account Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate text-sm">{displayName}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {accountNumber && <span className="tabular-nums">••{accountNumber}</span>}
                {accountNumber && <span className="mx-1.5 opacity-50">·</span>}
                <span>{accountType}</span>
              </p>
            </div>

            {/* Three-dot Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-muted-foreground hover:bg-surface-elevated transition-colors">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {/* Only show recategorize for bank/credit card statements that are completed */}
                {!isInvestment && isCompleted && onRecategorize && (
                  <>
                    <DropdownMenuItem onClick={onRecategorize} className="cursor-pointer">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Recategorize
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Stats Row */}
          <div className="flex items-end justify-between mt-4">
            {/* Period */}
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium">
                {isInvestment ? 'As of' : periodLabel ? 'Period' : 'Uploaded'}
              </span>
              <p className="text-sm font-medium text-foreground mt-0.5 truncate">
                {periodLabel ||
                  new Date(statement.createdAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
              </p>
            </div>

            {/* Count */}
            {isCompleted && (
              <div className="text-right shrink-0 pl-4">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium">
                  {isInvestment ? 'Holdings' : 'Transactions'}
                </span>
                <p className="text-lg font-semibold text-foreground tabular-nums mt-0.5">{count}</p>
              </div>
            )}

            {/* Non-completed status */}
            {!isCompleted && statusConfig && (
              <div className={cn('flex items-center gap-1.5', statusConfig.className)}>
                {statusConfig.icon}
                <span className="text-xs font-medium">{statusConfig.label}</span>
              </div>
            )}
          </div>

          {/* Error Message */}
          {isFailed && statement.errorMessage && (
            <p className="text-xs text-negative/80 mt-2 line-clamp-2">{statement.errorMessage}</p>
          )}

          {/* Footer: File Info + Status */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-subtle/50">
            <p className="text-[11px] text-muted-foreground/50 truncate flex-1 min-w-0">
              {statement.originalFilename}
              <span className="mx-1.5 opacity-50">·</span>
              <span className="tabular-nums">{formatFileSize(statement.fileSizeBytes)}</span>
            </p>

            {/* Status indicator for completed */}
            {isCompleted && statusConfig && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn('shrink-0 ml-2', statusConfig.className)}>
                    {statusConfig.icon}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>
                  {statusConfig.label}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Statement?</AlertDialogTitle>
            <AlertDialogDescription>
              {isInvestment
                ? 'This will delete the statement. Holdings from this statement will be removed. This action cannot be undone.'
                : 'This will delete the statement and all its transactions. This action cannot be undone.'}
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
    </>
  )
}
