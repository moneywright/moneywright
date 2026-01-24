/**
 * Dashboard utility functions
 */

import type { TimeframeKey } from './types'

/**
 * Currency formatter
 */
export function formatCurrency(amount: number, currency: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format large numbers compactly
 */
export function formatCompact(amount: number, currency: string = 'INR'): string {
  if (Math.abs(amount) >= 10000000) {
    return `${currency === 'INR' ? '₹' : '$'}${(amount / 10000000).toFixed(2)}Cr`
  }
  if (Math.abs(amount) >= 100000) {
    return `${currency === 'INR' ? '₹' : '$'}${(amount / 100000).toFixed(2)}L`
  }
  return formatCurrency(amount, currency)
}

/**
 * Date formatter for display
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  })
}

/**
 * Get date range for selected timeframe
 */
export function getDateRange(timeframe: TimeframeKey): { startDate?: string; endDate?: string } {
  const now = new Date()
  const formatDateStr = (d: Date) => d.toISOString().split('T')[0]

  switch (timeframe) {
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { startDate: formatDateStr(start), endDate: formatDateStr(end) }
    }
    case 'this_year': {
      const start = new Date(now.getFullYear(), 0, 1)
      return { startDate: formatDateStr(start), endDate: formatDateStr(now) }
    }
    case 'last_7d': {
      const start = new Date(now)
      start.setDate(start.getDate() - 7)
      return { startDate: formatDateStr(start), endDate: formatDateStr(now) }
    }
    case 'last_30d': {
      const start = new Date(now)
      start.setDate(start.getDate() - 30)
      return { startDate: formatDateStr(start), endDate: formatDateStr(now) }
    }
    case 'last_3m': {
      const start = new Date(now)
      start.setMonth(start.getMonth() - 3)
      return { startDate: formatDateStr(start), endDate: formatDateStr(now) }
    }
    case 'last_6m': {
      const start = new Date(now)
      start.setMonth(start.getMonth() - 6)
      return { startDate: formatDateStr(start), endDate: formatDateStr(now) }
    }
    case 'last_1y': {
      const start = new Date(now)
      start.setFullYear(start.getFullYear() - 1)
      return { startDate: formatDateStr(start), endDate: formatDateStr(now) }
    }
    case 'last_3y': {
      const start = new Date(now)
      start.setFullYear(start.getFullYear() - 3)
      return { startDate: formatDateStr(start), endDate: formatDateStr(now) }
    }
    case 'all_time':
      return {} // No date filter
  }
}

/**
 * Get financial year start month based on country
 * Returns 0-indexed month (0 = January, 3 = April, etc.)
 */
export function getFiscalYearStartMonth(country: string | null | undefined): number {
  switch (country) {
    case 'IN': // India: April 1 - March 31
    case 'AU': // Australia: July 1 - June 30 (but commonly April for some)
    case 'GB': // UK: April 6 - April 5 (we'll use April 1 for simplicity)
    case 'NZ': // New Zealand: April 1 - March 31
      return 3 // April
    case 'US': // USA: Calendar year (Jan 1 - Dec 31) for individuals
    default:
      return 0 // January
  }
}

/**
 * Calculate financial year date range
 */
export function getFinancialYearRange(
  country: string | null | undefined,
  offset: number = 0 // 0 = current FY, -1 = last FY
): { startDate: string; endDate: string; label: string } {
  const fyStartMonth = getFiscalYearStartMonth(country)
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  // Determine which FY we're currently in
  let fyStartYear = currentYear
  if (currentMonth < fyStartMonth) {
    // We're in the FY that started last calendar year
    fyStartYear = currentYear - 1
  }

  // Apply offset (negative for past FYs)
  fyStartYear += offset

  const fyEndYear = fyStartYear + 1

  // Format dates
  const startDate = `${fyStartYear}-${String(fyStartMonth + 1).padStart(2, '0')}-01`

  // End date is the day before the next FY starts
  let endMonth = fyStartMonth
  let endYear = fyEndYear
  if (fyStartMonth === 0) {
    // For calendar year FY, end on Dec 31
    endMonth = 11
    endYear = fyStartYear
  } else {
    // End on the last day of the month before FY start
    endMonth = fyStartMonth - 1
  }
  const lastDayOfMonth = new Date(endYear, endMonth + 1, 0).getDate()
  const endDate = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`

  // Create label
  const label =
    fyStartMonth === 0 ? `FY ${fyStartYear}` : `FY ${fyStartYear}-${String(fyEndYear).slice(-2)}`

  return { startDate, endDate, label }
}
