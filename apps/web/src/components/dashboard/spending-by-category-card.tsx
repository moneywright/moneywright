/**
 * Spending by Category card component
 */

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { InlineEmptyState } from '@/components/ui/empty-state'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar, ChevronDown, PieChart, SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CategoryBreakdown } from './category-breakdown'
import { getFinancialYearRange } from './utils'
import { CHART_TIMEFRAME_OPTIONS, type ChartTimeframeKey } from './types'

interface Category {
  code: string
  label: string
  color?: string
}

interface CategoryStats {
  categoryBreakdown: { category: string; total: number; count: number }[]
  totalDebits: number
  currency: string
}

interface SpendingByCategoryCardProps {
  categoryStats: CategoryStats | undefined
  isLoading: boolean
  categoryTimeframe: ChartTimeframeKey
  onCategoryTimeframeChange: (timeframe: ChartTimeframeKey) => void
  categoryDateRange: { startDate: string; endDate: string } | null
  onCategoryDateRangeChange: (range: { startDate: string; endDate: string } | null) => void
  showMonthlyAverage: boolean
  onShowMonthlyAverageChange: (show: boolean) => void
  totalMonths: number
  excludedCategories: string[]
  onToggleExclusion: (categoryCode: string) => void
  onClearExclusions: () => void
  categories: Category[]
  userCountry: string | null | undefined
  getCategoryLabel: (code: string) => string
  getCategoryColor: (code: string) => string
}

export function SpendingByCategoryCard({
  categoryStats,
  isLoading,
  categoryTimeframe,
  onCategoryTimeframeChange,
  categoryDateRange,
  onCategoryDateRangeChange,
  showMonthlyAverage,
  onShowMonthlyAverageChange,
  totalMonths,
  excludedCategories,
  onToggleExclusion,
  onClearExclusions,
  categories,
  userCountry,
  getCategoryLabel,
  getCategoryColor,
}: SpendingByCategoryCardProps) {
  // Get label for category timeframe
  const categoryTimeframeLabel = useMemo(() => {
    if (categoryTimeframe === 'custom' && categoryDateRange) {
      const start = new Date(categoryDateRange.startDate)
      const end = new Date(categoryDateRange.endDate)
      return `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })} - ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}`
    }

    if (categoryTimeframe === 'current_fy') {
      return getFinancialYearRange(userCountry, 0).label
    }

    if (categoryTimeframe === 'last_fy') {
      return getFinancialYearRange(userCountry, -1).label
    }

    return CHART_TIMEFRAME_OPTIONS.find((t) => t.key === categoryTimeframe)?.label || 'Last 1 year'
  }, [categoryTimeframe, categoryDateRange, userCountry])

  return (
    <Card className="border-border-subtle hover:border-border-hover transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Spending by Category
          </CardTitle>
          <div className="flex items-center gap-1">
            {/* Monthly Average Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onShowMonthlyAverageChange(!showMonthlyAverage)}
              className={cn(
                'h-7 text-xs',
                showMonthlyAverage
                  ? 'text-primary hover:text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {showMonthlyAverage ? '/mo' : 'Total'}
            </Button>
            {/* Category Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-7 text-xs text-muted-foreground hover:text-foreground',
                    excludedCategories.length > 0 && 'text-primary'
                  )}
                >
                  <SlidersHorizontal className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-3">
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium mb-1">Exclude Categories</h4>
                    <p className="text-xs text-muted-foreground">
                      Hide these categories from the chart
                    </p>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {categories.map((cat) => (
                      <label
                        key={cat.code}
                        className="flex items-center gap-2 text-sm cursor-pointer hover:text-foreground"
                      >
                        <Checkbox
                          checked={excludedCategories.includes(cat.code)}
                          onCheckedChange={() => onToggleExclusion(cat.code)}
                        />
                        <span
                          className={cn(
                            excludedCategories.includes(cat.code) &&
                              'line-through text-muted-foreground'
                          )}
                        >
                          {cat.label}
                        </span>
                      </label>
                    ))}
                  </div>
                  {excludedCategories.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-7 text-xs"
                      onClick={onClearExclusions}
                    >
                      Clear all
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            {/* Timeframe Selector */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Calendar className="mr-1.5 h-3 w-3" />
                  {categoryTimeframeLabel}
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-3">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-1.5">
                    {CHART_TIMEFRAME_OPTIONS.filter((o) => o.months).map((option) => (
                      <button
                        key={option.key}
                        onClick={() => {
                          onCategoryTimeframeChange(option.key)
                          onCategoryDateRangeChange(null)
                        }}
                        className={cn(
                          'px-3 py-2 text-sm font-medium rounded-lg transition-colors text-left',
                          categoryTimeframe === option.key
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-surface-elevated hover:bg-surface-hover text-foreground'
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="h-px bg-border-subtle" />
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Financial Year
                    </Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => {
                          onCategoryTimeframeChange('current_fy')
                          onCategoryDateRangeChange(null)
                        }}
                        className={cn(
                          'px-3 py-2 text-sm font-medium rounded-lg transition-colors text-left',
                          categoryTimeframe === 'current_fy'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-surface-elevated hover:bg-surface-hover text-foreground'
                        )}
                      >
                        {getFinancialYearRange(userCountry, 0).label}
                      </button>
                      <button
                        onClick={() => {
                          onCategoryTimeframeChange('last_fy')
                          onCategoryDateRangeChange(null)
                        }}
                        className={cn(
                          'px-3 py-2 text-sm font-medium rounded-lg transition-colors text-left',
                          categoryTimeframe === 'last_fy'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-surface-elevated hover:bg-surface-hover text-foreground'
                        )}
                      >
                        {getFinancialYearRange(userCountry, -1).label}
                      </button>
                    </div>
                  </div>
                  <div className="h-px bg-border-subtle" />
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Custom Range
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">From</Label>
                        <Input
                          type="date"
                          value={categoryDateRange?.startDate || ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              onCategoryDateRangeChange({
                                startDate: e.target.value,
                                endDate:
                                  categoryDateRange?.endDate ||
                                  new Date().toISOString().split('T')[0]!,
                              })
                              onCategoryTimeframeChange('custom')
                            }
                          }}
                          className="h-8 rounded-lg text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">To</Label>
                        <Input
                          type="date"
                          value={categoryDateRange?.endDate || ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              onCategoryDateRangeChange({
                                startDate: categoryDateRange?.startDate || '2020-01-01',
                                endDate: e.target.value,
                              })
                              onCategoryTimeframeChange('custom')
                            }
                          }}
                          className="h-8 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                    {categoryDateRange && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-muted-foreground h-7 text-xs"
                        onClick={() => {
                          onCategoryDateRangeChange(null)
                          onCategoryTimeframeChange('1y')
                        }}
                      >
                        <X className="mr-1.5 h-3 w-3" />
                        Clear custom range
                      </Button>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3.5 w-16" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        ) : categoryStats?.categoryBreakdown && categoryStats.categoryBreakdown.length > 0 ? (
          <CategoryBreakdown
            categoryBreakdown={categoryStats.categoryBreakdown}
            total={categoryStats.totalDebits}
            currency={categoryStats.currency}
            getCategoryLabel={getCategoryLabel}
            getCategoryColor={getCategoryColor}
            showMonthlyAverage={showMonthlyAverage}
            totalMonths={totalMonths}
          />
        ) : (
          <InlineEmptyState
            icon={PieChart}
            title="No spending data"
            description="Categories appear after importing transactions"
          />
        )}
      </CardContent>
    </Card>
  )
}
