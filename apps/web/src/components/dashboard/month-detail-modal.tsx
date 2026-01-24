/**
 * Month Detail Modal component
 */

import { useState, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate } from './utils'
import { SORT_OPTIONS, type SortOption, type ViewMode } from './types'
import type { MonthlyTrendData, MonthTransactionsResponse, Transaction } from '@/lib/api'

interface MonthDetailModalProps {
  month: MonthlyTrendData | null
  data: MonthTransactionsResponse | undefined
  isLoading: boolean
  getCategoryLabel: (code: string) => string
  onClose: () => void
}

export function MonthDetailModal({
  month,
  data,
  isLoading,
  getCategoryLabel,
  onClose,
}: MonthDetailModalProps) {
  const [sortBy, setSortBy] = useState<SortOption>('highest')
  const [viewMode, setViewMode] = useState<ViewMode>('transactions')

  // Use data from the API response (already has netting and exclusions applied)
  const totals = data?.totals || { income: 0, expenses: 0, net: 0 }
  const currency = data?.currency || 'INR'

  // Sort transactions based on selected option
  const credits = useMemo(() => {
    const raw = data?.credits || []
    return [...raw].sort((a, b) => {
      switch (sortBy) {
        case 'latest':
          return new Date(b.date).getTime() - new Date(a.date).getTime()
        case 'oldest':
          return new Date(a.date).getTime() - new Date(b.date).getTime()
        case 'highest':
          return b.amount - a.amount
        case 'lowest':
          return a.amount - b.amount
        default:
          return 0
      }
    })
  }, [data?.credits, sortBy])

  const debits = useMemo(() => {
    const raw = data?.debits || []
    return [...raw].sort((a, b) => {
      switch (sortBy) {
        case 'latest':
          return new Date(b.date).getTime() - new Date(a.date).getTime()
        case 'oldest':
          return new Date(a.date).getTime() - new Date(b.date).getTime()
        case 'highest':
          return b.amount - a.amount
        case 'lowest':
          return a.amount - b.amount
        default:
          return 0
      }
    })
  }, [data?.debits, sortBy])

  // Calculate category breakdown
  const categoryBreakdown = useMemo(() => {
    const incomeByCategory = new Map<string, number>()
    const expensesByCategory = new Map<string, number>()

    for (const txn of data?.credits || []) {
      incomeByCategory.set(txn.category, (incomeByCategory.get(txn.category) || 0) + txn.amount)
    }
    for (const txn of data?.debits || []) {
      expensesByCategory.set(txn.category, (expensesByCategory.get(txn.category) || 0) + txn.amount)
    }

    // Sort by amount descending
    const income = Array.from(incomeByCategory.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)

    const expenses = Array.from(expensesByCategory.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)

    return { income, expenses }
  }, [data?.credits, data?.debits])

  return (
    <Dialog open={!!month} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {month?.monthLabel}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Transactions for {month?.monthLabel}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Summary Stats */}
        <div className="px-6 pb-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-surface-elevated border border-border-subtle p-4">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Income
              </p>
              <p className="text-lg font-semibold text-foreground tabular-nums tracking-tight">
                {formatCurrency(totals.income, currency)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {credits.length} transactions
              </p>
            </div>
            <div className="rounded-xl bg-surface-elevated border border-border-subtle p-4">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Expenses
              </p>
              <p className="text-lg font-semibold text-foreground tabular-nums tracking-tight">
                {formatCurrency(totals.expenses, currency)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">{debits.length} transactions</p>
            </div>
            <div className="rounded-xl bg-surface-elevated border border-border-subtle p-4">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Net
              </p>
              <p
                className={cn(
                  'text-lg font-semibold tabular-nums tracking-tight',
                  totals.net >= 0 ? 'text-positive' : 'text-negative'
                )}
              >
                {totals.net >= 0 ? '+' : ''}
                {formatCurrency(totals.net, currency)}
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="px-6 pb-4 flex items-center justify-between border-t border-border-subtle pt-4">
          <div
            className={cn(
              'flex items-center p-1 rounded-xl',
              'bg-surface-elevated',
              'border border-border-subtle'
            )}
          >
            <button
              onClick={() => setViewMode('transactions')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                viewMode === 'transactions'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Transactions
            </button>
            <button
              onClick={() => setViewMode('categories')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                viewMode === 'categories'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Categories
            </button>
          </div>

          {viewMode === 'transactions' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-sm gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  Sort: {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
                  <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {SORT_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => setSortBy(option.value)}
                    className={cn(sortBy === option.value && 'bg-accent')}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          <div className="grid grid-cols-2 gap-6 h-85">
            {isLoading ? (
              <>
                <div className="space-y-2">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex items-center gap-2 py-2">
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-2 w-24" />
                      </div>
                      <Skeleton className="h-3 w-16" />
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex items-center gap-2 py-2">
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-2 w-24" />
                      </div>
                      <Skeleton className="h-3 w-16" />
                    </div>
                  ))}
                </div>
              </>
            ) : viewMode === 'transactions' ? (
              <>
                {/* Credits Column */}
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-2 pb-2.5 mb-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-positive" />
                    <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Income
                    </h3>
                    <span className="text-[10px] text-muted-foreground/60">{credits.length}</span>
                  </div>
                  <ScrollArea className="h-75">
                    <div className="space-y-0.5 pr-4">
                      {credits.length > 0 ? (
                        credits.map((txn) => (
                          <MonthTransactionRow
                            key={txn.id}
                            transaction={txn}
                            getCategoryLabel={getCategoryLabel}
                          />
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-8">
                          No income this month
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Debits Column */}
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-2 pb-2.5 mb-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-negative" />
                    <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Expenses
                    </h3>
                    <span className="text-[10px] text-muted-foreground/60">{debits.length}</span>
                  </div>
                  <ScrollArea className="h-75">
                    <div className="space-y-0.5 pr-4">
                      {debits.length > 0 ? (
                        debits.map((txn) => (
                          <MonthTransactionRow
                            key={txn.id}
                            transaction={txn}
                            getCategoryLabel={getCategoryLabel}
                          />
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-8">
                          No expenses this month
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </>
            ) : (
              <>
                {/* Income Categories */}
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-2 pb-2.5 mb-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-positive" />
                    <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Income by Category
                    </h3>
                  </div>
                  <ScrollArea className="h-75">
                    <div className="space-y-1 pr-4">
                      {categoryBreakdown.income.length > 0 ? (
                        categoryBreakdown.income.map((cat) => (
                          <CategoryRow
                            key={cat.category}
                            category={cat.category}
                            amount={cat.amount}
                            total={totals.income}
                            currency={currency}
                            getCategoryLabel={getCategoryLabel}
                            type="income"
                          />
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-8">
                          No income this month
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Expenses Categories */}
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-2 pb-2.5 mb-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-negative" />
                    <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Expenses by Category
                    </h3>
                  </div>
                  <ScrollArea className="h-75">
                    <div className="space-y-1 pr-4">
                      {categoryBreakdown.expenses.length > 0 ? (
                        categoryBreakdown.expenses.map((cat) => (
                          <CategoryRow
                            key={cat.category}
                            category={cat.category}
                            amount={cat.amount}
                            total={totals.expenses}
                            currency={currency}
                            getCategoryLabel={getCategoryLabel}
                            type="expense"
                          />
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-8">
                          No expenses this month
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Category breakdown row
function CategoryRow({
  category,
  amount,
  total,
  currency,
  getCategoryLabel,
  type,
}: {
  category: string
  amount: number
  total: number
  currency: string
  getCategoryLabel: (code: string) => string
  type: 'income' | 'expense'
}) {
  const percentage = total > 0 ? (amount / total) * 100 : 0
  const barColor = type === 'income' ? 'bg-positive' : 'bg-negative'
  const label = getCategoryLabel(category)
  const truncatedLabel = label.length > 20 ? label.slice(0, 20) + '…' : label

  return (
    <div className="py-2 px-2 rounded-lg hover:bg-surface-hover transition-colors">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-foreground" title={label}>
          {truncatedLabel}
        </span>
        <span className="text-xs font-semibold tabular-nums text-foreground ml-2 whitespace-nowrap">
          {formatCurrency(amount, currency)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-surface-elevated rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', barColor)}
            style={{ width: `${Math.max(percentage, 2)}%` }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
          {percentage.toFixed(0)}%
        </span>
      </div>
    </div>
  )
}

// Simplified transaction row for the modal
function MonthTransactionRow({
  transaction,
  getCategoryLabel,
}: {
  transaction: Transaction
  getCategoryLabel: (code: string) => string
}) {
  const isCredit = transaction.type === 'credit'
  const description = transaction.summary || transaction.originalDescription
  // Limit description to 26 characters to prevent overflow
  const truncatedDescription =
    description.length > 26 ? description.slice(0, 26) + '…' : description

  return (
    <div className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-surface-hover transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground" title={description}>
          {truncatedDescription}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {formatDate(transaction.date)} · {getCategoryLabel(transaction.category)}
        </p>
      </div>
      <p
        className={cn(
          'text-xs font-semibold tabular-nums whitespace-nowrap',
          isCredit ? 'text-positive' : 'text-foreground'
        )}
      >
        {formatCurrency(transaction.amount, transaction.currency)}
      </p>
    </div>
  )
}
