import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { AccountSelector } from '@/components/ui/account-selector'
import {
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Calendar,
  Building2,
  Tag,
  FileText,
  Check,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TransactionFilters, Category, Account, Statement } from '@/lib/api'

// Date preset options (matching dashboard)
type DatePresetKey =
  | 'this_month'
  | 'this_year'
  | 'last_7d'
  | 'last_30d'
  | 'last_3m'
  | 'last_6m'
  | 'last_1y'
  | 'last_3y'
  | 'all_time'

const DATE_PRESETS: { key: DatePresetKey; label: string }[] = [
  { key: 'this_month', label: 'This Month' },
  { key: 'this_year', label: 'This Year' },
  { key: 'last_7d', label: 'Last 7 Days' },
  { key: 'last_30d', label: 'Last 30 Days' },
  { key: 'last_3m', label: 'Last 3 Months' },
  { key: 'last_6m', label: 'Last 6 Months' },
  { key: 'last_1y', label: 'Last 1 Year' },
  { key: 'last_3y', label: 'Last 3 Years' },
  { key: 'all_time', label: 'All Time' },
]

function getPresetDateRange(preset: DatePresetKey): { startDate?: string; endDate?: string } {
  const now = new Date()
  const formatDateStr = (d: Date) => d.toISOString().split('T')[0]

  switch (preset) {
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

interface TransactionFiltersBarProps {
  filters: TransactionFilters
  search: string
  categories: Category[]
  accounts: Account[]
  statements: Statement[]
  onFiltersChange: (filters: TransactionFilters) => void
  onSearchChange: (search: string) => void
  onClearFilters: () => void
  getCategoryLabel: (code: string) => string
  getStatementLabel: (id: string) => string
}

export function TransactionFiltersBar({
  filters,
  search,
  categories,
  accounts,
  statements,
  onFiltersChange,
  onSearchChange,
  onClearFilters,
  getCategoryLabel,
  getStatementLabel,
}: TransactionFiltersBarProps) {
  const [searchFocused, setSearchFocused] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  // Check for advanced filters to auto-expand
  const hasAdvancedFilters = Boolean(
    filters.category?.length ||
    filters.accountId?.length ||
    filters.statementId?.length ||
    filters.startDate ||
    filters.endDate
  )

  const hasActiveFilters =
    Object.keys(filters).filter((k) => k !== 'profileId' && k !== 'isSubscription').length > 0 ||
    search ||
    filters.isSubscription

  // Track manual toggle, but auto-show if advanced filters exist
  const [manualShowAdvanced, setManualShowAdvanced] = useState(false)
  const showAdvanced = manualShowAdvanced || hasAdvancedFilters

  const removeFilter = (key: keyof TransactionFilters) => {
    const newFilters = { ...filters }
    delete newFilters[key]
    onFiltersChange(newFilters)
  }

  const activeFilterCount = [
    filters.category?.length ? 1 : 0,
    filters.accountId?.length ? 1 : 0,
    filters.statementId?.length ? 1 : 0,
    filters.startDate || filters.endDate ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-3">
      {/* Main Filter Bar */}
      <div
        className={cn(
          'relative flex flex-col gap-4 p-4 rounded-2xl transition-all duration-300',
          'bg-linear-to-b from-card to-card/80',
          'border border-border-subtle',
          'shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]',
          'dark:shadow-[0_1px_3px_rgba(0,0,0,0.2),0_4px_12px_rgba(0,0,0,0.15)]'
        )}
      >
        {/* Top Row: Search + Quick Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input - Command Bar Style */}
          <div
            className={cn(
              'relative flex-1 min-w-60 max-w-md transition-all duration-200',
              searchFocused && 'max-w-lg'
            )}
          >
            <div
              className={cn(
                'absolute inset-0 rounded-xl transition-all duration-200',
                searchFocused
                  ? 'bg-primary/5 ring-2 ring-primary/20 dark:ring-primary/30'
                  : 'bg-transparent'
              )}
            />
            <Search
              className={cn(
                'absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors',
                searchFocused ? 'text-primary' : 'text-muted-foreground'
              )}
            />
            <Input
              ref={searchRef}
              placeholder="Search transactions..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className={cn(
                'relative pl-10 pr-4 h-11 rounded-xl border-0',
                'bg-surface-elevated dark:bg-surface-elevated',
                'placeholder:text-muted-foreground/60',
                'focus-visible:ring-0 focus-visible:ring-offset-0',
                'transition-all duration-200'
              )}
            />
            {search && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-surface-hover transition-colors"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Quick Filter Chips */}
          <div className="flex items-center gap-2">
            {/* Transaction Type Selector */}
            <div
              className={cn(
                'flex items-center p-1 rounded-xl',
                'bg-surface-elevated',
                'border border-border-subtle'
              )}
            >
              <button
                onClick={() => removeFilter('type')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                  !filters.type
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                All
              </button>
              <button
                onClick={() => onFiltersChange({ ...filters, type: 'credit' })}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                  filters.type === 'credit'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <ArrowDownLeft className="h-3.5 w-3.5" />
                <span>Income</span>
              </button>
              <button
                onClick={() => onFiltersChange({ ...filters, type: 'debit' })}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                  filters.type === 'debit'
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>Expense</span>
              </button>
            </div>

            {/* Subscription Toggle */}
            <button
              onClick={() =>
                onFiltersChange({
                  ...filters,
                  isSubscription: filters.isSubscription ? undefined : true,
                })
              }
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                'border',
                filters.isSubscription
                  ? 'bg-violet-500/10 border-violet-500/30 text-violet-600 dark:text-violet-400'
                  : 'bg-surface-elevated border-border-subtle text-muted-foreground hover:text-foreground hover:border-border-hover'
              )}
            >
              <RefreshCw
                className={cn(
                  'h-3.5 w-3.5 transition-transform duration-700',
                  filters.isSubscription && 'animate-[spin_4s_linear_infinite]'
                )}
              />
              <span>Recurring</span>
              {filters.isSubscription && (
                <span className="flex h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
              )}
            </button>

            {/* More Filters Toggle */}
            <button
              onClick={() => setManualShowAdvanced(!showAdvanced)}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                'border',
                showAdvanced || hasAdvancedFilters
                  ? 'bg-primary/5 border-primary/20 text-primary'
                  : 'bg-surface-elevated border-border-subtle text-muted-foreground hover:text-foreground hover:border-border-hover'
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="flex items-center justify-center h-5 min-w-5 px-1.5 text-xs font-semibold rounded-full bg-primary text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 transition-transform duration-200',
                  showAdvanced && 'rotate-180'
                )}
              />
            </button>
          </div>

          {/* Clear All */}
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Advanced Filters Panel */}
        <div
          className={cn(
            'grid transition-all duration-300 ease-out overflow-hidden',
            showAdvanced ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              className={cn(
                'pt-3 border-t border-border-subtle',
                'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'
              )}
            >
              {/* Category Filter */}
              <CategoryFilterDropdown
                categories={categories}
                selectedCategories={filters.category}
                getCategoryLabel={getCategoryLabel}
                onClear={() => removeFilter('category')}
                onToggle={(code) => {
                  const current = filters.category || []
                  const isSelected = current.includes(code)
                  const updated = isSelected
                    ? current.filter((c) => c !== code)
                    : [...current, code]
                  onFiltersChange({
                    ...filters,
                    category: updated.length > 0 ? updated : undefined,
                  })
                }}
              />

              {/* Account Filter */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="h-3 w-3" />
                  Account
                </Label>
                <AccountSelector
                  accounts={accounts}
                  values={filters.accountId || []}
                  onValuesChange={(accountIds) => {
                    const newFilters = {
                      ...filters,
                      accountId: accountIds.length > 0 ? accountIds : undefined,
                    }
                    // Filter statements to only those belonging to selected accounts
                    if (filters.statementId?.length && accountIds.length > 0) {
                      const validStatements = filters.statementId.filter((id) =>
                        accountIds.includes(statements?.find((s) => s.id === id)?.accountId || '')
                      )
                      newFilters.statementId =
                        validStatements.length > 0 ? validStatements : undefined
                    }
                    onFiltersChange(newFilters)
                  }}
                  mode="multi"
                  showAllOption
                  allOptionLabel="All accounts"
                  triggerClassName={cn(
                    'w-full h-10 rounded-lg',
                    'bg-surface-elevated border-border-subtle',
                    'hover:bg-surface-hover hover:border-border-hover',
                    filters.accountId?.length && 'border-primary/30 bg-primary/5'
                  )}
                />
              </div>

              {/* Date Range */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  Date Range
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-between h-10 rounded-lg font-normal',
                        'bg-surface-elevated border-border-subtle',
                        'hover:bg-surface-hover hover:border-border-hover',
                        (filters.startDate || filters.endDate) && 'border-primary/30 bg-primary/5'
                      )}
                    >
                      <span className="truncate">
                        {filters.startDate && filters.endDate
                          ? `${formatDate(filters.startDate)} — ${formatDate(filters.endDate)}`
                          : filters.startDate
                            ? `From ${formatDate(filters.startDate)}`
                            : filters.endDate
                              ? `Until ${formatDate(filters.endDate)}`
                              : 'Any time'}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-3" align="start">
                    <div className="space-y-3">
                      {/* Quick Presets */}
                      <div className="grid grid-cols-2 gap-1.5">
                        {DATE_PRESETS.map((preset) => {
                          const { startDate, endDate } = getPresetDateRange(preset.key)
                          const isSelected =
                            filters.startDate === startDate && filters.endDate === endDate
                          return (
                            <button
                              key={preset.key}
                              onClick={() => {
                                const range = getPresetDateRange(preset.key)
                                onFiltersChange({
                                  ...filters,
                                  startDate: range.startDate,
                                  endDate: range.endDate,
                                })
                              }}
                              className={cn(
                                'px-3 py-2 text-sm font-medium rounded-lg transition-colors text-left',
                                isSelected
                                  ? 'bg-primary/10 text-primary border border-primary/20'
                                  : 'bg-surface-elevated hover:bg-surface-hover text-foreground'
                              )}
                            >
                              {preset.label}
                            </button>
                          )
                        })}
                      </div>

                      {/* Divider */}
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-border-subtle" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-popover px-2 text-muted-foreground">or custom</span>
                        </div>
                      </div>

                      {/* Custom Date Range */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">From</Label>
                          <Input
                            type="date"
                            value={filters.startDate || ''}
                            onChange={(e) =>
                              onFiltersChange({
                                ...filters,
                                startDate: e.target.value || undefined,
                              })
                            }
                            className="h-9 rounded-lg"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">To</Label>
                          <Input
                            type="date"
                            value={filters.endDate || ''}
                            onChange={(e) =>
                              onFiltersChange({ ...filters, endDate: e.target.value || undefined })
                            }
                            className="h-9 rounded-lg"
                          />
                        </div>
                      </div>
                      {(filters.startDate || filters.endDate) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-muted-foreground"
                          onClick={() => {
                            const newFilters = { ...filters }
                            delete newFilters.startDate
                            delete newFilters.endDate
                            onFiltersChange(newFilters)
                          }}
                        >
                          <X className="mr-1.5 h-3.5 w-3.5" />
                          Clear dates
                        </Button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Statement Filter */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="h-3 w-3" />
                  Statement
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-between h-10 rounded-lg font-normal',
                        'bg-surface-elevated border-border-subtle',
                        'hover:bg-surface-hover hover:border-border-hover',
                        filters.statementId?.length && 'border-primary/30 bg-primary/5'
                      )}
                    >
                      <span className="truncate">
                        {filters.statementId?.length
                          ? filters.statementId.length === 1
                            ? getStatementLabel(filters.statementId[0]!)
                            : `${filters.statementId.length} selected`
                          : 'All statements'}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-2" align="start">
                    <div className="max-h-70 overflow-y-auto space-y-1">
                      <Button
                        variant={!filters.statementId?.length ? 'secondary' : 'ghost'}
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => removeFilter('statementId')}
                      >
                        <Sparkles className="mr-2 h-4 w-4 text-muted-foreground" />
                        All statements
                      </Button>
                      {statements
                        ?.filter((s) => s.status === 'completed')
                        .filter(
                          (s) =>
                            !filters.accountId?.length ||
                            filters.accountId.includes(s.accountId || '')
                        )
                        .map((statement) => {
                          const isSelected = filters.statementId?.includes(statement.id)
                          const date = statement.periodEnd
                            ? new Date(statement.periodEnd).toLocaleDateString('en-GB', {
                                month: 'short',
                                year: '2-digit',
                              })
                            : new Date(statement.createdAt).toLocaleDateString('en-GB', {
                                month: 'short',
                                year: '2-digit',
                              })
                          return (
                            <Button
                              key={statement.id}
                              variant={isSelected ? 'secondary' : 'ghost'}
                              size="sm"
                              className="w-full justify-start truncate"
                              onClick={() => {
                                const current = filters.statementId || []
                                const updated = isSelected
                                  ? current.filter((id) => id !== statement.id)
                                  : [...current, statement.id]
                                onFiltersChange({
                                  ...filters,
                                  statementId: updated.length > 0 ? updated : undefined,
                                })
                              }}
                            >
                              {isSelected && (
                                <Check className="mr-2 h-4 w-4 text-primary shrink-0" />
                              )}
                              <span className={cn('truncate', !isSelected && 'ml-6')}>
                                {statement.originalFilename.replace(/\.[^/.]+$/, '')}
                              </span>
                              <span className="ml-auto text-xs text-muted-foreground shrink-0">
                                {date}
                              </span>
                            </Button>
                          )
                        })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Filters Pills */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Active:
          </span>
          {search && (
            <FilterPill
              label={`"${search}"`}
              icon={<Search className="h-3 w-3" />}
              onRemove={() => onSearchChange('')}
            />
          )}
          {filters.type && (
            <FilterPill
              label={filters.type === 'credit' ? 'Income' : 'Expenses'}
              icon={
                filters.type === 'credit' ? (
                  <ArrowDownLeft className="h-3 w-3" />
                ) : (
                  <ArrowUpRight className="h-3 w-3" />
                )
              }
              variant={filters.type === 'credit' ? 'success' : 'danger'}
              onRemove={() => removeFilter('type')}
            />
          )}
          {filters.isSubscription && (
            <FilterPill
              label="Recurring"
              icon={<RefreshCw className="h-3 w-3" />}
              variant="violet"
              onRemove={() => removeFilter('isSubscription')}
            />
          )}
          {filters.category?.map((cat) => (
            <FilterPill
              key={cat}
              label={getCategoryLabel(cat)}
              icon={<Tag className="h-3 w-3" />}
              onRemove={() => {
                const updated = filters.category?.filter((c) => c !== cat)
                onFiltersChange({
                  ...filters,
                  category: updated?.length ? updated : undefined,
                })
              }}
            />
          ))}
          {filters.accountId?.map((id) => (
            <FilterPill
              key={id}
              label={accounts?.find((a) => a.id === id)?.accountName || 'Account'}
              icon={<Building2 className="h-3 w-3" />}
              onRemove={() => {
                const updated = filters.accountId?.filter((a) => a !== id)
                onFiltersChange({
                  ...filters,
                  accountId: updated?.length ? updated : undefined,
                })
              }}
            />
          ))}
          {(filters.startDate || filters.endDate) && (
            <FilterPill
              label={
                filters.startDate && filters.endDate
                  ? `${formatDate(filters.startDate)} — ${formatDate(filters.endDate)}`
                  : filters.startDate
                    ? `From ${formatDate(filters.startDate)}`
                    : `Until ${formatDate(filters.endDate!)}`
              }
              icon={<Calendar className="h-3 w-3" />}
              onRemove={() => {
                const newFilters = { ...filters }
                delete newFilters.startDate
                delete newFilters.endDate
                onFiltersChange(newFilters)
              }}
            />
          )}
          {filters.statementId?.map((id) => (
            <FilterPill
              key={id}
              label={getStatementLabel(id)}
              icon={<FileText className="h-3 w-3" />}
              onRemove={() => {
                const updated = filters.statementId?.filter((s) => s !== id)
                onFiltersChange({
                  ...filters,
                  statementId: updated?.length ? updated : undefined,
                })
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Helper to format dates nicely
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// Category Filter Dropdown with Search
function CategoryFilterDropdown({
  categories,
  selectedCategories,
  getCategoryLabel,
  onClear,
  onToggle,
}: {
  categories: Category[]
  selectedCategories?: string[]
  getCategoryLabel: (code: string) => string
  onClear: () => void
  onToggle: (code: string) => void
}) {
  const [categorySearch, setCategorySearch] = useState('')

  const filteredCategories = categories.filter((cat) =>
    cat.label.toLowerCase().includes(categorySearch.toLowerCase())
  )

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Tag className="h-3 w-3" />
        Category
      </Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-between h-10 rounded-lg font-normal',
              'bg-surface-elevated border-border-subtle',
              'hover:bg-surface-hover hover:border-border-hover',
              selectedCategories?.length && 'border-primary/30 bg-primary/5'
            )}
          >
            <span className="truncate">
              {selectedCategories?.length
                ? selectedCategories.length === 1
                  ? getCategoryLabel(selectedCategories[0]!)
                  : `${selectedCategories.length} selected`
                : 'All categories'}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-2" align="start">
          {/* Search Input */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search categories..."
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              className="h-8 pl-8 text-sm bg-surface-elevated border-border-subtle"
            />
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {!categorySearch && (
              <Button
                variant={!selectedCategories?.length ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start"
                onClick={onClear}
              >
                <Sparkles className="mr-2 h-4 w-4 text-muted-foreground" />
                All categories
              </Button>
            )}
            {filteredCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No categories found</p>
            ) : (
              filteredCategories.map((cat) => {
                const isSelected = selectedCategories?.includes(cat.code)
                return (
                  <Button
                    key={cat.code}
                    variant={isSelected ? 'secondary' : 'ghost'}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => onToggle(cat.code)}
                  >
                    {isSelected && <Check className="mr-2 h-4 w-4 text-primary shrink-0" />}
                    <span className={cn('truncate', !isSelected && 'ml-6')}>{cat.label}</span>
                  </Button>
                )
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

// Filter Pill Component
function FilterPill({
  label,
  icon,
  variant = 'default',
  onRemove,
}: {
  label: string
  icon?: React.ReactNode
  variant?: 'default' | 'success' | 'danger' | 'violet'
  onRemove: () => void
}) {
  const variantStyles = {
    default: 'bg-surface-elevated text-foreground border-border-subtle',
    success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    danger: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
    violet: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg text-xs font-medium border transition-all',
        'hover:shadow-sm',
        variantStyles[variant]
      )}
    >
      {icon}
      <span className="max-w-37.5 truncate">{label}</span>
      <button
        onClick={onRemove}
        className={cn(
          'p-0.5 rounded-md transition-colors',
          'hover:bg-black/5 dark:hover:bg-white/10'
        )}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}
