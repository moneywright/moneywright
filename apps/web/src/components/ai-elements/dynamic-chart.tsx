/**
 * Dynamic Chart Renderer for AI-generated charts
 *
 * Renders Recharts visualizations from configuration objects returned by the executeCode tool.
 * Supports bar, line, pie, and area chart types.
 */

import { memo, useMemo } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts'
import { cn } from '@/lib/utils'

/**
 * Chart configuration from executeCode tool
 */
export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'area' | 'composed'
  data: Array<Record<string, unknown>>
  config: {
    xKey?: string
    yKey?: string | string[]
    title?: string
    colors?: string[]
    stacked?: boolean
  }
}

interface DynamicChartProps {
  chart: ChartConfig
  className?: string
}

// Default color palette matching the app's design
const DEFAULT_COLORS = [
  'rgb(16, 185, 129)', // emerald-500
  'rgb(244, 63, 94)', // rose-500
  'rgb(59, 130, 246)', // blue-500
  'rgb(168, 85, 247)', // purple-500
  'rgb(245, 158, 11)', // amber-500
  'rgb(14, 165, 233)', // sky-500
  'rgb(236, 72, 153)', // pink-500
  'rgb(34, 197, 94)', // green-500
]

// Custom Tooltip
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; color: string; name?: string }>
  label?: string
}) {
  if (!active || !payload || !payload.length) return null

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-elevated/95 backdrop-blur-xl p-3 shadow-2xl shadow-black/20">
      {label && (
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          {label}
        </p>
      )}
      <div className="space-y-1.5">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full shadow-sm"
                style={{
                  backgroundColor: entry.color,
                  boxShadow: `0 0 4px ${entry.color}50`,
                }}
              />
              <span className="text-sm text-muted-foreground">{entry.name || entry.dataKey}</span>
            </div>
            <span className="text-sm font-semibold tabular-nums" style={{ color: entry.color }}>
              {formatValue(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Format numbers for display
function formatValue(value: number | unknown): string {
  if (typeof value !== 'number') return String(value)

  if (Math.abs(value) >= 10000000) {
    return `${(value / 10000000).toFixed(1)}Cr`
  }
  if (Math.abs(value) >= 100000) {
    return `${(value / 100000).toFixed(1)}L`
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}K`
  }
  return value.toLocaleString()
}

// Pie chart custom label renderer
const renderPieLabel = (props: {
  cx: number
  cy: number
  midAngle: number
  innerRadius: number
  outerRadius: number
  percent: number
  name: string
}) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props
  if (percent < 0.05) return null // Don't show labels for small slices

  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-xs font-medium"
      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

// Bar Chart Component
function BarChartRenderer({ chart, colors }: { chart: ChartConfig; colors: string[] }) {
  const { data, config } = chart
  const xKey = config.xKey || Object.keys(data[0] || {})[0] || 'name'
  const yKeys = Array.isArray(config.yKey)
    ? config.yKey
    : config.yKey
      ? [config.yKey]
      : Object.keys(data[0] || {}).filter((k) => k !== xKey)

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border-subtle)"
          strokeOpacity={0.5}
          vertical={false}
        />
        <XAxis
          dataKey={xKey}
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontWeight: 500 }}
          dy={8}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontWeight: 500 }}
          tickFormatter={(v) => formatValue(v)}
          width={60}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: 'var(--surface-hover)', opacity: 0.5 }}
        />
        {yKeys.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            fill={colors[index % colors.length]}
            radius={[4, 4, 0, 0]}
            stackId={config.stacked ? 'stack' : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// Line Chart Component
function LineChartRenderer({ chart, colors }: { chart: ChartConfig; colors: string[] }) {
  const { data, config } = chart
  const xKey = config.xKey || Object.keys(data[0] || {})[0] || 'name'
  const yKeys = Array.isArray(config.yKey)
    ? config.yKey
    : config.yKey
      ? [config.yKey]
      : Object.keys(data[0] || {}).filter((k) => k !== xKey)

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border-subtle)"
          strokeOpacity={0.5}
          vertical={false}
        />
        <XAxis
          dataKey={xKey}
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontWeight: 500 }}
          dy={8}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontWeight: 500 }}
          tickFormatter={(v) => formatValue(v)}
          width={60}
        />
        <Tooltip content={<CustomTooltip />} />
        {yKeys.map((key, index) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={colors[index % colors.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// Area Chart Component
function AreaChartRenderer({ chart, colors }: { chart: ChartConfig; colors: string[] }) {
  const { data, config } = chart
  const xKey = config.xKey || Object.keys(data[0] || {})[0] || 'name'
  const yKeys = Array.isArray(config.yKey)
    ? config.yKey
    : config.yKey
      ? [config.yKey]
      : Object.keys(data[0] || {}).filter((k) => k !== xKey)

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          {yKeys.map((key, index) => (
            <linearGradient key={key} id={`gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors[index % colors.length]} stopOpacity={0.4} />
              <stop offset="50%" stopColor={colors[index % colors.length]} stopOpacity={0.15} />
              <stop offset="100%" stopColor={colors[index % colors.length]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border-subtle)"
          strokeOpacity={0.5}
          vertical={false}
        />
        <XAxis
          dataKey={xKey}
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontWeight: 500 }}
          dy={8}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontWeight: 500 }}
          tickFormatter={(v) => formatValue(v)}
          width={60}
        />
        <Tooltip content={<CustomTooltip />} />
        {yKeys.map((key, index) => (
          <Area
            key={key}
            type="monotone"
            dataKey={key}
            stroke={colors[index % colors.length]}
            strokeWidth={2}
            fill={`url(#gradient-${key})`}
            stackId={config.stacked ? 'stack' : undefined}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

// Pie Chart Component
function PieChartRenderer({ chart, colors }: { chart: ChartConfig; colors: string[] }) {
  const { data, config } = chart
  const nameKey = config.xKey || Object.keys(data[0] || {})[0] || 'name'
  const valueKey =
    (Array.isArray(config.yKey) ? config.yKey[0] : config.yKey) ||
    Object.keys(data[0] || {}).find((k) => k !== nameKey) ||
    'value'

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderPieLabel}
          outerRadius={100}
          innerRadius={40}
          dataKey={valueKey}
          nameKey={nameKey}
          paddingAngle={2}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
          formatter={(value) => <span className="text-muted-foreground">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

/**
 * Dynamic Chart Component
 *
 * Renders different chart types based on the configuration from executeCode tool.
 */
export const DynamicChart = memo(function DynamicChart({ chart, className }: DynamicChartProps) {
  const colors = useMemo(() => chart.config.colors || DEFAULT_COLORS, [chart.config.colors])

  if (!chart.data || chart.data.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-64 text-muted-foreground', className)}>
        No data to display
      </div>
    )
  }

  return (
    <div className={cn('w-full', className)}>
      {chart.config.title && (
        <h4 className="text-sm font-medium text-foreground mb-4">{chart.config.title}</h4>
      )}
      <div className="[&_svg]:outline-none [&_svg:focus]:outline-none [&_g:focus]:outline-none [&_path:focus]:outline-none [&_.recharts-surface]:outline-none [&_*:focus]:outline-none">
        {chart.type === 'bar' && <BarChartRenderer chart={chart} colors={colors} />}
        {chart.type === 'line' && <LineChartRenderer chart={chart} colors={colors} />}
        {chart.type === 'area' && <AreaChartRenderer chart={chart} colors={colors} />}
        {chart.type === 'pie' && <PieChartRenderer chart={chart} colors={colors} />}
        {chart.type === 'composed' && <BarChartRenderer chart={chart} colors={colors} />}
      </div>
    </div>
  )
})

DynamicChart.displayName = 'DynamicChart'
