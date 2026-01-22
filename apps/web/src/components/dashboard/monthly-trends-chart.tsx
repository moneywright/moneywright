import { useMemo, useCallback } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { MonthlyTrendData } from '@/lib/api'
import { cn } from '@/lib/utils'
import { TrendingDown, TrendingUp, Activity } from 'lucide-react'

interface MonthlyTrendsChartProps {
  data: MonthlyTrendData[]
  currency: string
  isLoading?: boolean
  className?: string
  onMonthClick?: (month: MonthlyTrendData) => void
}

// Format currency for display
function formatCurrency(amount: number, currency: string): string {
  if (Math.abs(amount) >= 10000000) {
    return `${currency === 'INR' ? '₹' : '$'}${(amount / 10000000).toFixed(1)}Cr`
  }
  if (Math.abs(amount) >= 100000) {
    return `${currency === 'INR' ? '₹' : '$'}${(amount / 100000).toFixed(1)}L`
  }
  if (Math.abs(amount) >= 1000) {
    return `${currency === 'INR' ? '₹' : '$'}${(amount / 1000).toFixed(1)}K`
  }
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Format full currency for tooltip
function formatFullCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Custom Tooltip Component
function CustomTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; color: string }>
  label?: string
  currency: string
}) {
  if (!active || !payload || !payload.length) return null

  const income = payload.find((p) => p.dataKey === 'income')?.value || 0
  const expenses = payload.find((p) => p.dataKey === 'expenses')?.value || 0
  const net = income - expenses

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-elevated/95 backdrop-blur-xl p-4 shadow-2xl shadow-black/20">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
        {label}
      </p>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
            <span className="text-sm text-muted-foreground">Income</span>
          </div>
          <span className="text-sm font-semibold text-emerald-400 tabular-nums">
            {formatFullCurrency(income, currency)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
            <span className="text-sm text-muted-foreground">Expenses</span>
          </div>
          <span className="text-sm font-semibold text-rose-400 tabular-nums">
            {formatFullCurrency(expenses, currency)}
          </span>
        </div>
        <div className="h-px bg-linear-to-r from-transparent via-border-subtle to-transparent my-1" />
        <div className="flex items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            {net >= 0 ? (
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
            )}
            <span className="text-sm font-medium text-foreground">Net</span>
          </div>
          <span
            className={cn(
              'text-sm font-bold tabular-nums',
              net >= 0 ? 'text-emerald-400' : 'text-rose-400'
            )}
          >
            {net >= 0 ? '+' : ''}
            {formatFullCurrency(net, currency)}
          </span>
        </div>
      </div>
    </div>
  )
}

// Custom Legend
function CustomLegend() {
  return (
    <div className="flex items-center justify-center gap-6 mb-4">
      <div className="flex items-center gap-2">
        <div className="h-2 w-6 rounded-full bg-linear-to-r from-emerald-500/80 to-emerald-400" />
        <span className="text-xs font-medium text-muted-foreground">Income</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-2 w-6 rounded-full bg-linear-to-r from-rose-500/80 to-rose-400" />
        <span className="text-xs font-medium text-muted-foreground">Expenses</span>
      </div>
    </div>
  )
}

// Loading Skeleton
function ChartSkeleton() {
  return (
    <div className="w-full h-70 flex flex-col">
      {/* Legend skeleton */}
      <div className="flex items-center justify-center gap-6 mb-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-6 rounded-full bg-surface-hover animate-pulse" />
          <div className="h-3 w-12 rounded bg-surface-hover animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-6 rounded-full bg-surface-hover animate-pulse" />
          <div className="h-3 w-14 rounded bg-surface-hover animate-pulse" />
        </div>
      </div>
      {/* Chart area skeleton */}
      <div className="flex-1 relative overflow-hidden rounded-lg">
        <div className="absolute inset-0 bg-linear-to-t from-surface-hover/30 to-transparent animate-pulse" />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-linear-to-t from-surface-hover/50 to-transparent animate-pulse" />
        {/* Fake bars */}
        <div className="absolute bottom-8 left-0 right-0 flex items-end justify-around gap-2 px-8">
          {[40, 65, 45, 80, 55, 70, 50, 85, 60, 75, 45, 90].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-surface-hover animate-pulse"
              style={{
                height: `${h}%`,
                animationDelay: `${i * 50}ms`,
              }}
            />
          ))}
        </div>
        {/* X-axis skeleton */}
        <div className="absolute bottom-0 left-0 right-0 h-6 flex items-center justify-around px-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-2.5 w-8 rounded bg-surface-hover animate-pulse"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Empty State
function EmptyState() {
  return (
    <div className="w-full h-70 flex flex-col items-center justify-center">
      <div className="relative">
        <div className="absolute inset-0 bg-linear-to-r from-emerald-500/20 to-rose-500/20 blur-2xl rounded-full" />
        <div className="relative p-4 rounded-2xl bg-surface-elevated border border-border-subtle">
          <Activity className="h-8 w-8 text-muted-foreground" />
        </div>
      </div>
      <p className="mt-4 text-sm font-medium text-foreground">No trend data yet</p>
      <p className="mt-1 text-xs text-muted-foreground text-center max-w-50">
        Upload statements to see your income and expense trends
      </p>
    </div>
  )
}

export function MonthlyTrendsChart({
  data,
  currency,
  isLoading,
  className,
  onMonthClick,
}: MonthlyTrendsChartProps) {
  // Calculate max value for Y-axis domain
  const maxValue = useMemo(() => {
    if (!data.length) return 100000
    const max = Math.max(...data.flatMap((d) => [d.income, d.expenses]))
    // Round up to a nice number
    const magnitude = Math.pow(10, Math.floor(Math.log10(max)))
    return Math.ceil(max / magnitude) * magnitude
  }, [data])

  // Handle chart click
  const handleChartClick = useCallback(
    (state: { activeTooltipIndex?: number }) => {
      if (state?.activeTooltipIndex !== undefined && onMonthClick) {
        const clickedMonth = data[state.activeTooltipIndex]
        if (clickedMonth) {
          onMonthClick(clickedMonth)
        }
      }
    },
    [data, onMonthClick]
  )

  if (isLoading) {
    return (
      <div className={cn('w-full', className)}>
        <ChartSkeleton />
      </div>
    )
  }

  // Check if all data points are zero
  const hasData = data.some((d) => d.income > 0 || d.expenses > 0)

  if (!data.length || !hasData) {
    return (
      <div className={cn('w-full', className)}>
        <EmptyState />
      </div>
    )
  }

  return (
    <div className={cn('w-full', className)}>
      <CustomLegend />
      <div className="[&_svg]:outline-none [&_svg:focus]:outline-none [&_g:focus]:outline-none [&_path:focus]:outline-none [&_.recharts-surface]:outline-none [&_*:focus]:outline-none">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
            onClick={handleChartClick as unknown as undefined}
            style={{ cursor: onMonthClick ? 'pointer' : 'default', outline: 'none' }}
          >
            <defs>
              {/* Income gradient */}
              <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity={0.4} />
                <stop offset="50%" stopColor="rgb(16, 185, 129)" stopOpacity={0.15} />
                <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity={0} />
              </linearGradient>
              {/* Expenses gradient */}
              <linearGradient id="expensesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(244, 63, 94)" stopOpacity={0.4} />
                <stop offset="50%" stopColor="rgb(244, 63, 94)" stopOpacity={0.15} />
                <stop offset="100%" stopColor="rgb(244, 63, 94)" stopOpacity={0} />
              </linearGradient>
              {/* Glow filters */}
              <filter id="incomeGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feFlood floodColor="rgb(16, 185, 129)" floodOpacity="0.5" result="color" />
                <feComposite in="color" in2="blur" operator="in" result="glow" />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="expensesGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feFlood floodColor="rgb(244, 63, 94)" floodOpacity="0.5" result="color" />
                <feComposite in="color" in2="blur" operator="in" result="glow" />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-subtle)"
              strokeOpacity={0.5}
              vertical={false}
            />

            <XAxis
              dataKey="monthLabel"
              axisLine={false}
              tickLine={false}
              tick={{
                fill: 'var(--muted-foreground)',
                fontSize: 11,
                fontWeight: 500,
              }}
              dy={8}
              interval="preserveStartEnd"
              tickCount={6}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{
                fill: 'var(--muted-foreground)',
                fontSize: 11,
                fontWeight: 500,
              }}
              tickFormatter={(value) => formatCurrency(value, currency)}
              domain={[0, maxValue]}
              width={60}
            />

            <Tooltip
              content={<CustomTooltip currency={currency} />}
              cursor={{
                stroke: 'var(--border-hover)',
                strokeWidth: 1,
                strokeDasharray: '4 4',
              }}
            />

            {/* Expenses area (behind) */}
            <Area
              type="monotone"
              dataKey="expenses"
              stroke="rgb(244, 63, 94)"
              strokeWidth={2}
              fill="url(#expensesGradient)"
              filter="url(#expensesGlow)"
              animationDuration={1200}
              animationEasing="ease-out"
              dot={false}
              activeDot={false}
            />

            {/* Income area (front) */}
            <Area
              type="monotone"
              dataKey="income"
              stroke="rgb(16, 185, 129)"
              strokeWidth={2}
              fill="url(#incomeGradient)"
              filter="url(#incomeGlow)"
              animationDuration={1000}
              animationEasing="ease-out"
              dot={false}
              activeDot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
