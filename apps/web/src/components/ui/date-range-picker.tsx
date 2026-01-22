import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// Date preset type
export type DatePresetKey =
  | 'last_6m'
  | 'last_1y'
  | 'last_2y'
  | 'last_3y'
  | 'last_5y'
  | 'all_time'
  | 'current_fy'
  | 'last_fy'
  | 'custom'

interface DatePreset {
  key: Exclude<DatePresetKey, 'custom'>
  label: string
}

// Standard time presets (matching dashboard)
const TIME_PRESETS: DatePreset[] = [
  { key: 'last_6m', label: 'Last 6 months' },
  { key: 'last_1y', label: 'Last 1 year' },
  { key: 'last_2y', label: 'Last 2 years' },
  { key: 'last_3y', label: 'Last 3 years' },
  { key: 'last_5y', label: 'Last 5 years' },
  { key: 'all_time', label: 'All time' },
]

/**
 * Get financial year start month based on country
 * Returns 0-indexed month (0 = January, 3 = April, etc.)
 */
function getFiscalYearStartMonth(country: string | null | undefined): number {
  switch (country) {
    case 'IN': // India: April 1 - March 31
    case 'AU': // Australia
    case 'GB': // UK
    case 'NZ': // New Zealand
      return 3 // April
    case 'US': // USA: Calendar year
    default:
      return 0 // January
  }
}

/**
 * Calculate financial year date range
 */
function getFinancialYearRange(
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
    fyStartYear = currentYear - 1
  }

  // Apply offset
  fyStartYear += offset

  const fyEndYear = fyStartYear + 1

  // Format dates
  const startMonth = String(fyStartMonth + 1).padStart(2, '0')
  const startDate = `${fyStartYear}-${startMonth}-01`

  // End date is last day of month before FY start month
  const endMonth = fyStartMonth === 0 ? 12 : fyStartMonth
  const endYear = fyStartMonth === 0 ? fyEndYear - 1 : fyEndYear
  const lastDay = new Date(endYear, endMonth, 0).getDate()
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  // Label like "FY 2024-25" or "FY 2024"
  const label =
    fyStartMonth === 0 ? `FY ${fyStartYear}` : `FY ${fyStartYear}-${String(fyEndYear).slice(-2)}`

  return { startDate, endDate, label }
}

/**
 * Get date range from preset
 */
export function getPresetDateRange(
  preset: DatePresetKey,
  country?: string | null
): { startDate?: string; endDate?: string } {
  const now = new Date()
  const formatDateStr = (d: Date) => d.toISOString().split('T')[0]

  switch (preset) {
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
    case 'last_2y': {
      const start = new Date(now)
      start.setFullYear(start.getFullYear() - 2)
      return { startDate: formatDateStr(start), endDate: formatDateStr(now) }
    }
    case 'last_3y': {
      const start = new Date(now)
      start.setFullYear(start.getFullYear() - 3)
      return { startDate: formatDateStr(start), endDate: formatDateStr(now) }
    }
    case 'last_5y': {
      const start = new Date(now)
      start.setFullYear(start.getFullYear() - 5)
      return { startDate: formatDateStr(start), endDate: formatDateStr(now) }
    }
    case 'current_fy': {
      const fy = getFinancialYearRange(country, 0)
      return { startDate: fy.startDate, endDate: fy.endDate }
    }
    case 'last_fy': {
      const fy = getFinancialYearRange(country, -1)
      return { startDate: fy.startDate, endDate: fy.endDate }
    }
    case 'all_time':
    case 'custom':
      return {} // No date filter for all_time or custom (custom uses explicit dates)
  }
}

/**
 * Get display label for a date range
 */
export function getDateRangeLabel(
  startDate?: string,
  endDate?: string,
  country?: string | null
): string {
  if (!startDate && !endDate) return 'All time'

  // Check time presets
  for (const preset of TIME_PRESETS) {
    const range = getPresetDateRange(preset.key, country)
    if (range.startDate === startDate && range.endDate === endDate) {
      return preset.label
    }
  }

  // Check FY presets
  const currentFy = getFinancialYearRange(country, 0)
  if (currentFy.startDate === startDate && currentFy.endDate === endDate) {
    return currentFy.label
  }

  const lastFy = getFinancialYearRange(country, -1)
  if (lastFy.startDate === startDate && lastFy.endDate === endDate) {
    return lastFy.label
  }

  // Custom range - format nicely
  if (startDate && endDate) {
    return `${formatDate(startDate)} - ${formatDate(endDate)}`
  } else if (startDate) {
    return `From ${formatDate(startDate)}`
  } else if (endDate) {
    return `Until ${formatDate(endDate)}`
  }

  return 'All time'
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}

interface DateRangePickerProps {
  startDate?: string
  endDate?: string
  onDateChange: (startDate?: string, endDate?: string) => void
  country?: string | null
  className?: string
  /** Show FY options (requires country) */
  showFiscalYear?: boolean
  /** Align popover */
  align?: 'start' | 'center' | 'end'
  /** Button variant - 'ghost' for dashboard style, 'outline' for filter bar style */
  variant?: 'ghost' | 'outline'
}

export function DateRangePicker({
  startDate,
  endDate,
  onDateChange,
  country,
  className,
  showFiscalYear = true,
  align = 'start',
  variant = 'ghost',
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [customRange, setCustomRange] = useState<{ startDate?: string; endDate?: string } | null>(
    null
  )

  const displayLabel = getDateRangeLabel(startDate, endDate, country)
  const hasDateFilter = startDate || endDate

  // Check if current selection is a custom range (not matching any preset)
  const isCustomSelection = (() => {
    if (!startDate && !endDate) return false
    for (const preset of TIME_PRESETS) {
      const range = getPresetDateRange(preset.key, country)
      if (range.startDate === startDate && range.endDate === endDate) return false
    }
    const currentFy = getFinancialYearRange(country, 0)
    if (currentFy.startDate === startDate && currentFy.endDate === endDate) return false
    const lastFy = getFinancialYearRange(country, -1)
    if (lastFy.startDate === startDate && lastFy.endDate === endDate) return false
    return true
  })()

  // Initialize custom range from current selection if it's custom
  const effectiveCustomRange =
    isCustomSelection && startDate && endDate ? { startDate, endDate } : customRange

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={variant}
          size={variant === 'outline' ? 'default' : 'sm'}
          className={cn(
            variant === 'ghost'
              ? cn(
                  'h-7 text-xs text-muted-foreground hover:text-foreground',
                  hasDateFilter && 'text-foreground'
                )
              : cn(
                  'justify-between h-10 rounded-lg font-normal',
                  'bg-surface-elevated border-border-subtle',
                  'hover:bg-surface-hover hover:border-border-hover',
                  hasDateFilter && 'border-primary/30 bg-primary/5'
                ),
            className
          )}
        >
          {variant === 'ghost' && <Calendar className="mr-1.5 h-3 w-3" />}
          <span className={variant === 'outline' ? 'truncate' : undefined}>{displayLabel}</span>
          <ChevronDown
            className={variant === 'ghost' ? 'ml-1 h-3 w-3' : 'h-4 w-4 shrink-0 opacity-50 ml-2'}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align={align}>
        <div className="space-y-3">
          {/* Standard time presets */}
          <div className="grid grid-cols-2 gap-1.5">
            {TIME_PRESETS.map((preset) => {
              const range = getPresetDateRange(preset.key, country)
              const isSelected =
                startDate === range.startDate && endDate === range.endDate && !isCustomSelection

              return (
                <button
                  key={preset.key}
                  onClick={() => {
                    onDateChange(range.startDate, range.endDate)
                    setCustomRange(null)
                    setOpen(false)
                  }}
                  className={cn(
                    'px-3 py-2 text-sm font-medium rounded-lg transition-colors text-left',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface-elevated hover:bg-surface-hover text-foreground'
                  )}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>

          {/* Financial Year section */}
          {showFiscalYear && (
            <>
              <div className="h-px bg-border-subtle" />
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Financial Year
                </Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['current_fy', 'last_fy'] as const).map((key) => {
                    const fy = getFinancialYearRange(country, key === 'current_fy' ? 0 : -1)
                    const isSelected =
                      startDate === fy.startDate && endDate === fy.endDate && !isCustomSelection

                    return (
                      <button
                        key={key}
                        onClick={() => {
                          onDateChange(fy.startDate, fy.endDate)
                          setCustomRange(null)
                          setOpen(false)
                        }}
                        className={cn(
                          'px-3 py-2 text-sm font-medium rounded-lg transition-colors text-left',
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-surface-elevated hover:bg-surface-hover text-foreground'
                        )}
                      >
                        {fy.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* Custom Range section */}
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
                  value={effectiveCustomRange?.startDate || ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      const newRange = {
                        startDate: e.target.value,
                        endDate:
                          effectiveCustomRange?.endDate || new Date().toISOString().split('T')[0]!,
                      }
                      setCustomRange(newRange)
                      onDateChange(newRange.startDate, newRange.endDate)
                    }
                  }}
                  className="h-8 rounded-lg text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input
                  type="date"
                  value={effectiveCustomRange?.endDate || ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      const newRange = {
                        startDate: effectiveCustomRange?.startDate || '2020-01-01',
                        endDate: e.target.value,
                      }
                      setCustomRange(newRange)
                      onDateChange(newRange.startDate, newRange.endDate)
                    }
                  }}
                  className="h-8 rounded-lg text-sm"
                />
              </div>
            </div>
            {effectiveCustomRange && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground h-7 text-xs"
                onClick={() => {
                  setCustomRange(null)
                  onDateChange(undefined, undefined)
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
  )
}
