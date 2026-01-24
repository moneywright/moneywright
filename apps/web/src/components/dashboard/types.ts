/**
 * Dashboard types and constants
 */

// Timeframe options for stats
export type TimeframeKey =
  | 'this_month'
  | 'this_year'
  | 'last_7d'
  | 'last_30d'
  | 'last_3m'
  | 'last_6m'
  | 'last_1y'
  | 'last_3y'
  | 'all_time'

export const TIMEFRAME_OPTIONS: { key: TimeframeKey; label: string; shortLabel: string }[] = [
  { key: 'this_month', label: 'This Month', shortLabel: 'This Month' },
  { key: 'this_year', label: 'This Year', shortLabel: 'This Year' },
  { key: 'last_7d', label: 'Last 7 Days', shortLabel: 'Last 7d' },
  { key: 'last_30d', label: 'Last 30 Days', shortLabel: 'Last 30d' },
  { key: 'last_3m', label: 'Last 3 Months', shortLabel: 'Last 3m' },
  { key: 'last_6m', label: 'Last 6 Months', shortLabel: 'Last 6m' },
  { key: 'last_1y', label: 'Last 1 Year', shortLabel: 'Last 1y' },
  { key: 'last_3y', label: 'Last 3 Years', shortLabel: 'Last 3y' },
  { key: 'all_time', label: 'All Time', shortLabel: 'All Time' },
]

// Chart timeframe options
export type ChartTimeframeKey =
  | '6m'
  | '1y'
  | '2y'
  | '3y'
  | '5y'
  | 'all'
  | 'current_fy'
  | 'last_fy'
  | 'custom'

export interface ChartTimeframeOption {
  key: ChartTimeframeKey
  label: string
  months?: number
  isFiscal?: boolean
}

export const CHART_TIMEFRAME_OPTIONS: ChartTimeframeOption[] = [
  { key: '6m', label: 'Last 6 months', months: 6 },
  { key: '1y', label: 'Last 1 year', months: 12 },
  { key: '2y', label: 'Last 2 years', months: 24 },
  { key: '3y', label: 'Last 3 years', months: 36 },
  { key: '5y', label: 'Last 5 years', months: 60 },
  { key: 'all', label: 'All time', months: 120 },
  { key: 'current_fy', label: 'Current FY', isFiscal: true },
  { key: 'last_fy', label: 'Last FY', isFiscal: true },
  { key: 'custom', label: 'Custom range' },
]

// Sort options for month transactions
export type SortOption = 'latest' | 'oldest' | 'highest' | 'lowest'
export type ViewMode = 'transactions' | 'categories'

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'highest', label: 'Highest' },
  { value: 'lowest', label: 'Lowest' },
  { value: 'latest', label: 'Latest' },
  { value: 'oldest', label: 'Oldest' },
]
