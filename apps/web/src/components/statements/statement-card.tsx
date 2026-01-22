import { useState } from 'react'
import { Button } from '@/components/ui/button'
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
import {
  Loader2,
  FileText,
  Check,
  X,
  Clock,
  Trash2,
  Building2,
  CreditCard,
  TrendingUp,
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
}

export function StatementCard({
  statement,
  account,
  source,
  logoPath,
  formatFileSize,
  formatPeriod,
  onDelete,
}: StatementCardProps) {
  const [logoError, setLogoError] = useState(false)

  const getStatusConfig = (status: Statement['status']) => {
    switch (status) {
      case 'completed':
        return {
          icon: <Check className="h-4 w-4" />,
          label: 'Completed',
          bgClass: 'bg-positive/10',
          textClass: 'text-positive',
        }
      case 'failed':
        return {
          icon: <X className="h-4 w-4" />,
          label: 'Failed',
          bgClass: 'bg-negative/10',
          textClass: 'text-negative',
        }
      case 'parsing':
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          label: 'Processing',
          bgClass: 'bg-primary/10',
          textClass: 'text-primary',
        }
      default:
        return {
          icon: <Clock className="h-4 w-4" />,
          label: 'Pending',
          bgClass: 'bg-muted',
          textClass: 'text-muted-foreground',
        }
    }
  }

  const status = getStatusConfig(statement.status)
  const isInvestment = statement.documentType === 'investment_statement'
  const isCreditCard = account?.type === 'credit_card'
  const periodLabel = formatPeriod(statement.periodStart, statement.periodEnd)
  const accountNumber = isInvestment
    ? source?.accountIdentifier?.slice(-4)
    : account?.accountNumber?.slice(-4)

  return (
    <div
      className={cn(
        'group relative rounded-xl overflow-hidden transition-colors',
        'bg-card border border-border-subtle hover:border-border-hover'
      )}
    >
      <div className="p-4">
        {/* Header: Logo + Account Info + Status */}
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden bg-surface-elevated border border-border-subtle">
            {logoPath && !logoError ? (
              <img
                src={logoPath}
                alt={isInvestment ? source?.institution || '' : account?.institution || ''}
                className="h-6 w-6 object-contain"
                onError={() => setLogoError(true)}
              />
            ) : isInvestment ? (
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            ) : isCreditCard ? (
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Building2 className="h-5 w-5 text-muted-foreground" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground truncate text-sm">
              {isInvestment
                ? source?.sourceName || source?.institution || 'Investment Account'
                : account?.accountName || account?.institution || 'Unknown Account'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {accountNumber && `•••• ${accountNumber} · `}
              {isInvestment ? 'Investment' : isCreditCard ? 'Credit Card' : 'Bank Account'}
            </p>
          </div>

          {/* Status Badge */}
          <div
            className={cn(
              'flex items-center justify-center h-8 w-8 rounded-lg shrink-0',
              status.bgClass
            )}
          >
            <span className={status.textClass}>{status.icon}</span>
          </div>
        </div>

        {/* Period + Transaction/Holdings Count */}
        <div className="flex items-center justify-between mt-4 py-3 px-3 rounded-lg bg-surface-elevated border border-border-subtle">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block">
              {isInvestment ? 'As of' : periodLabel ? 'Period' : 'Uploaded'}
            </span>
            <span className="text-sm font-medium text-foreground mt-0.5 block">
              {periodLabel ||
                new Date(statement.createdAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
            </span>
          </div>

          {statement.status === 'completed' && (
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block">
                {isInvestment ? 'Holdings' : 'Transactions'}
              </span>
              <span className="text-lg font-semibold text-foreground tabular-nums">
                {isInvestment ? (statement.holdingsCount ?? 0) : statement.transactionCount}
              </span>
            </div>
          )}

          {statement.status === 'parsing' && (
            <div className="text-right">
              <span className="text-xs text-primary font-medium">Processing...</span>
            </div>
          )}

          {statement.status === 'pending' && (
            <div className="text-right">
              <span className="text-xs text-muted-foreground">Queued</span>
            </div>
          )}
        </div>

        {/* Error Message */}
        {statement.status === 'failed' && statement.errorMessage && (
          <div className="mt-3 py-2 px-3 rounded-lg bg-negative-muted border border-negative/20">
            <p className="text-xs text-negative line-clamp-2">{statement.errorMessage}</p>
          </div>
        )}

        {/* Footer: File Info + Delete */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border-subtle">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate max-w-40" title={statement.originalFilename}>
              {statement.originalFilename}
            </span>
            <span>·</span>
            <span className="shrink-0">{formatFileSize(statement.fileSizeBytes)}</span>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
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
        </div>
      </div>
    </div>
  )
}
