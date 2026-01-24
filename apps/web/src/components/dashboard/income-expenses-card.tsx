/**
 * Income vs Expenses chart card component
 */

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar, ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MonthlyTrendsChart } from './monthly-trends-chart'
import { getFinancialYearRange } from './utils'
import { CHART_TIMEFRAME_OPTIONS, type ChartTimeframeKey } from './types'
import type { MonthlyTrendData } from '@/lib/api'

interface Category {
  code: string
  label: string
}

interface IncomeExpensesCardProps {
  trendsData: { trends: MonthlyTrendData[]; currency: string } | undefined
  isLoading: boolean
  chartTimeframe: ChartTimeframeKey
  onChartTimeframeChange: (timeframe: ChartTimeframeKey) => void
  customDateRange: { startDate: string; endDate: string } | null
  onCustomDateRangeChange: (range: { startDate: string; endDate: string } | null) => void
  excludedCategories: string[]
  onToggleExclusion: (categoryCode: string) => void
  onClearExclusions: () => void
  categories: Category[]
  userCountry: string | null | undefined
  onMonthClick: (month: MonthlyTrendData) => void
}

export function IncomeExpensesCard({
  trendsData,
  isLoading,
  chartTimeframe,
  onChartTimeframeChange,
  customDateRange,
  onCustomDateRangeChange,
  excludedCategories,
  onToggleExclusion,
  onClearExclusions,
  categories,
  userCountry,
  onMonthClick,
}: IncomeExpensesCardProps) {
  // Get label for chart timeframe
  const chartTimeframeLabel = useMemo(() => {
    if (chartTimeframe === 'custom' && customDateRange) {
      const start = new Date(customDateRange.startDate)
      const end = new Date(customDateRange.endDate)
      return `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })} - ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}`
    }

    if (chartTimeframe === 'current_fy') {
      return getFinancialYearRange(userCountry, 0).label
    }

    if (chartTimeframe === 'last_fy') {
      return getFinancialYearRange(userCountry, -1).label
    }

    return CHART_TIMEFRAME_OPTIONS.find((t) => t.key === chartTimeframe)?.label || 'Last 1 year'
  }, [chartTimeframe, customDateRange, userCountry])

  return (
    <Card className="mb-6 border-border-subtle hover:border-border-hover transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Income vs Expenses
          </CardTitle>
          <div className="flex items-center gap-1">
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
                  {chartTimeframeLabel}
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-3">
                <div className="space-y-3">
                  {/* Standard time ranges */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {CHART_TIMEFRAME_OPTIONS.filter((o) => o.months).map((option) => (
                      <button
                        key={option.key}
                        onClick={() => {
                          onChartTimeframeChange(option.key)
                          onCustomDateRangeChange(null)
                        }}
                        className={cn(
                          'px-3 py-2 text-sm font-medium rounded-lg transition-colors text-left',
                          chartTimeframe === option.key
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-surface-elevated hover:bg-surface-hover text-foreground'
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <div className="h-px bg-border-subtle" />

                  {/* Financial year options */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Financial Year
                    </Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => {
                          onChartTimeframeChange('current_fy')
                          onCustomDateRangeChange(null)
                        }}
                        className={cn(
                          'px-3 py-2 text-sm font-medium rounded-lg transition-colors text-left',
                          chartTimeframe === 'current_fy'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-surface-elevated hover:bg-surface-hover text-foreground'
                        )}
                      >
                        {getFinancialYearRange(userCountry, 0).label}
                      </button>
                      <button
                        onClick={() => {
                          onChartTimeframeChange('last_fy')
                          onCustomDateRangeChange(null)
                        }}
                        className={cn(
                          'px-3 py-2 text-sm font-medium rounded-lg transition-colors text-left',
                          chartTimeframe === 'last_fy'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-surface-elevated hover:bg-surface-hover text-foreground'
                        )}
                      >
                        {getFinancialYearRange(userCountry, -1).label}
                      </button>
                    </div>
                  </div>

                  <div className="h-px bg-border-subtle" />

                  {/* Custom date range */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Custom Range
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">From</Label>
                        <Input
                          type="date"
                          value={customDateRange?.startDate || ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              onCustomDateRangeChange({
                                startDate: e.target.value,
                                endDate:
                                  customDateRange?.endDate ||
                                  new Date().toISOString().split('T')[0]!,
                              })
                              onChartTimeframeChange('custom')
                            }
                          }}
                          className="h-8 rounded-lg text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">To</Label>
                        <Input
                          type="date"
                          value={customDateRange?.endDate || ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              onCustomDateRangeChange({
                                startDate: customDateRange?.startDate || '2020-01-01',
                                endDate: e.target.value,
                              })
                              onChartTimeframeChange('custom')
                            }
                          }}
                          className="h-8 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                    {customDateRange && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-muted-foreground h-7 text-xs"
                        onClick={() => {
                          onCustomDateRangeChange(null)
                          onChartTimeframeChange('1y')
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
        <MonthlyTrendsChart
          data={trendsData?.trends || []}
          currency={trendsData?.currency || 'INR'}
          isLoading={isLoading}
          onMonthClick={onMonthClick}
        />
      </CardContent>
    </Card>
  )
}
