/**
 * Category Breakdown component for spending analysis
 */

import { PieChart } from 'lucide-react'
import { InlineEmptyState } from '@/components/ui/empty-state'
import { getCategoryColorClasses } from '@/lib/category-colors'
import { cn } from '@/lib/utils'
import { formatCurrency } from './utils'

interface CategoryBreakdownProps {
  categoryBreakdown: { category: string; total: number; count: number }[]
  total: number
  currency: string
  getCategoryLabel: (code: string) => string
  getCategoryColor: (code: string) => string
  showMonthlyAverage?: boolean
  totalMonths?: number
}

export function CategoryBreakdown({
  categoryBreakdown,
  total,
  currency,
  getCategoryLabel,
  getCategoryColor,
  showMonthlyAverage = false,
  totalMonths = 1,
}: CategoryBreakdownProps) {
  // Sort by total and take top 6 to match subscriptions card
  const topCategories = [...categoryBreakdown]
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)

  const remainingCount = categoryBreakdown.filter((c) => c.total > 0).length - 6

  if (topCategories.length === 0) {
    return (
      <InlineEmptyState
        icon={PieChart}
        title="No spending data"
        description="Categories appear after importing transactions"
      />
    )
  }

  // Calculate values to display (total or monthly average)
  const displayValues = topCategories.map((cat) => ({
    ...cat,
    displayAmount: showMonthlyAverage ? Math.round(cat.total / totalMonths) : cat.total,
  }))

  const displayTotal = showMonthlyAverage ? Math.round(total / totalMonths) : total
  const maxAmount = Math.max(...displayValues.map((c) => c.displayAmount))

  return (
    <div>
      {/* Total header - matches subscriptions EST. MONTHLY COST */}
      <div className="flex items-center justify-between pb-3 mb-1 border-b border-border-subtle">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          {showMonthlyAverage ? 'Avg. Monthly' : 'Total Spent'}
        </span>
        <span className="text-base font-bold text-foreground tabular-nums">
          {formatCurrency(displayTotal, currency)}
        </span>
      </div>

      {/* Category list */}
      <div className="space-y-0.5">
        {displayValues.map((cat, index) => {
          const colorName = getCategoryColor(cat.category)
          const colors = getCategoryColorClasses(colorName)
          // Normalize percentage relative to max (top category = 100%)
          const percentage = maxAmount > 0 ? (cat.displayAmount / maxAmount) * 100 : 0

          return (
            <div
              key={cat.category}
              className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg hover:bg-surface-elevated transition-colors"
            >
              {/* Left: Category name and progress bar */}
              <div className="min-w-0 flex-1 pr-4">
                <p className="text-sm font-medium text-foreground truncate">
                  {getCategoryLabel(cat.category)}
                </p>
                <div className="flex items-center gap-1.5 mt-1 h-4">
                  <span
                    className={cn('text-[11px] font-medium shrink-0 tabular-nums', colors.text)}
                  >
                    #{index + 1}
                  </span>
                  <div className="flex-1 h-1 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', colors.bar)}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Right: Amount */}
              <p className="text-sm font-semibold tabular-nums text-foreground shrink-0 text-right min-w-20">
                {formatCurrency(cat.displayAmount, currency)}
                {showMonthlyAverage && (
                  <span className="text-[10px] text-muted-foreground font-normal">/mo</span>
                )}
              </p>
            </div>
          )
        })}
      </div>

      {remainingCount > 0 && (
        <p className="text-[11px] text-muted-foreground text-center pt-3">
          +{remainingCount} more categories
        </p>
      )}
    </div>
  )
}
