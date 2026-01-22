import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  ArrowUpRight,
  ArrowDownLeft,
  Pencil,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Transaction, Account, Category } from '@/lib/api'

export type SortBy = 'date' | 'amount'
export type SortOrder = 'asc' | 'desc'

interface TransactionTableProps {
  transactions: Transaction[]
  accounts: Account[]
  categories: Category[]
  countryCode: string
  onEditTransaction: (transaction: Transaction) => void
  getCategoryLabel: (code: string) => string
  formatAmount: (amount: number, currency: string) => string
  sortBy?: SortBy
  sortOrder?: SortOrder
  onSortChange?: (sortBy: SortBy, sortOrder: SortOrder) => void
}

// Sort indicator component
function SortIndicator({
  column,
  sortBy,
  sortOrder,
}: {
  column: SortBy
  sortBy: SortBy
  sortOrder: SortOrder
}) {
  if (sortBy !== column) {
    return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
  }
  return sortOrder === 'asc' ? (
    <ArrowUp className="h-3.5 w-3.5 text-primary" />
  ) : (
    <ArrowDown className="h-3.5 w-3.5 text-primary" />
  )
}

// Map color names to Tailwind classes (light + dark mode aware)
const colorStyles: Record<string, string> = {
  emerald:
    'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
  orange:
    'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20',
  lime: 'bg-lime-100 text-lime-700 border-lime-200 dark:bg-lime-500/10 dark:text-lime-400 dark:border-lime-500/20',
  blue: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
  cyan: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20',
  purple:
    'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20',
  amber:
    'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
  pink: 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-500/10 dark:text-pink-400 dark:border-pink-500/20',
  sky: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20',
  red: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
  fuchsia:
    'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-500/10 dark:text-fuchsia-400 dark:border-fuchsia-500/20',
  indigo:
    'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20',
  slate:
    'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20',
  violet:
    'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20',
  teal: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20',
  rose: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
  zinc: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-500/10 dark:text-zinc-400 dark:border-zinc-500/20',
}

export function TransactionTable({
  transactions,
  accounts,
  categories,
  countryCode,
  onEditTransaction,
  getCategoryLabel,
  formatAmount,
  sortBy = 'date',
  sortOrder = 'desc',
  onSortChange,
}: TransactionTableProps) {
  const accountMap = new Map(accounts?.map((a) => [a.id, a]) || [])
  const categoryMap = new Map(categories?.map((c) => [c.code, c]) || [])

  const getCategoryColor = (code: string) => {
    const category = categoryMap.get(code)
    return colorStyles[category?.color || 'zinc'] || colorStyles.zinc
  }

  const handleSort = (column: SortBy) => {
    if (!onSortChange) return
    if (sortBy === column) {
      // Toggle order
      onSortChange(column, sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // New column, default to desc
      onSortChange(column, 'desc')
    }
  }

  return (
    <div className="rounded-xl overflow-hidden border border-border-subtle bg-card">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="bg-surface-elevated hover:bg-surface-elevated border-b border-border-subtle">
            <TableHead className="w-27.5">
              <button
                onClick={() => handleSort('date')}
                className={cn(
                  'flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider transition-colors',
                  'hover:text-foreground',
                  sortBy === 'date' ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                Date
                <SortIndicator column="date" sortBy={sortBy} sortOrder={sortOrder} />
              </button>
            </TableHead>
            <TableHead className="w-auto text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Description
            </TableHead>
            <TableHead className="w-35">
              <button
                onClick={() => handleSort('amount')}
                className={cn(
                  'flex items-center gap-1.5 ml-auto text-xs font-medium uppercase tracking-wider transition-colors',
                  'hover:text-foreground',
                  sortBy === 'amount' ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                Amount
                <SortIndicator column="amount" sortBy={sortBy} sortOrder={sortOrder} />
              </button>
            </TableHead>
            <TableHead className="w-11"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((txn, index) => {
            const account = accountMap.get(txn.accountId)
            const accountNumber = account?.accountNumber || ''
            const last4 = accountNumber.slice(-4) || '****'
            const institutionId = account?.institution || ''
            const logoPath = institutionId
              ? `/institutions/${countryCode}/${institutionId}.svg`
              : null

            return (
              <TableRow
                key={txn.id}
                className={cn(
                  'group transition-all duration-200 border-b border-border-subtle last:border-b-0',
                  'hover:bg-surface-hover',
                  'animate-fade-in'
                )}
                style={{ animationDelay: `${Math.min(index * 20, 200)}ms` }}
              >
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap py-3">
                  {new Date(txn.date).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: '2-digit',
                  })}
                </TableCell>
                <TableCell className="overflow-hidden py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
                        'bg-surface-elevated border-border-subtle',
                        'transition-all duration-200',
                        txn.type === 'credit' &&
                          'group-hover:bg-emerald-500/5 group-hover:border-emerald-500/20'
                      )}
                    >
                      {txn.type === 'credit' ? (
                        <ArrowDownLeft className="h-4 w-4 text-positive" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {/* Title row with category badge inline */}
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-foreground text-sm">
                          {txn.summary || txn.originalDescription}
                        </p>
                        {/* Category badge - inline */}
                        <span
                          className={cn(
                            'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0',
                            'transition-transform duration-200 group-hover:scale-105',
                            getCategoryColor(txn.category)
                          )}
                        >
                          {getCategoryLabel(txn.category)}
                        </span>
                        {/* Subscription indicator */}
                        {txn.isSubscription && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-violet-100 border border-violet-200 dark:bg-violet-500/10 dark:border-violet-500/20 shrink-0 transition-transform duration-200 group-hover:scale-110">
                                <RefreshCw className="h-2.5 w-2.5 text-violet-600 dark:text-violet-400" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              Recurring subscription
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      {/* Meta row */}
                      <div className="flex items-center gap-2 mt-0.5">
                        <AccountLogo
                          logoPath={logoPath}
                          institutionId={institutionId || 'other'}
                          last4={last4}
                        />
                        {txn.summary && txn.summary !== txn.originalDescription && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <p className="truncate text-xs text-muted-foreground">
                              {txn.originalDescription}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap py-3">
                  <span
                    className={cn(
                      'font-semibold tabular-nums text-sm transition-colors duration-200',
                      txn.type === 'credit' ? 'text-positive' : 'text-foreground'
                    )}
                  >
                    {txn.type === 'credit' ? '+' : '-'}
                    {formatAmount(txn.amount, txn.currency)}
                  </span>
                </TableCell>
                <TableCell className="py-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-all duration-200 text-muted-foreground hover:text-foreground"
                    onClick={() => onEditTransaction(txn)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function AccountLogo({
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
    <div className="flex items-center gap-1.5">
      <div className="h-5 w-5 rounded bg-surface flex items-center justify-center overflow-hidden shrink-0 border border-border-subtle">
        {logoPath && !logoError ? (
          <img
            src={logoPath}
            alt={institutionId}
            className="h-3.5 w-3.5 object-contain"
            onError={() => setLogoError(true)}
          />
        ) : (
          <span className="text-[9px] font-medium text-muted-foreground">
            {institutionId.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
      <span className="text-xs text-muted-foreground">••{last4}</span>
    </div>
  )
}
