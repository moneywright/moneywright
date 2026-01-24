/**
 * Account Balance Card component
 */

import { CreditCard, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate } from './utils'
import type { FinancialSummary } from '@/lib/api'

interface AccountBalanceCardProps {
  account: FinancialSummary['netWorth']['accounts'][0]
}

export function AccountBalanceCard({ account }: AccountBalanceCardProps) {
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
