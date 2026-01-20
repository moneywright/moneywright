import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AppLayout } from '@/components/domain/app-layout'
import { ProfileSelector } from '@/components/domain/profile-selector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Loader2,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronLeft,
  ChevronRight,
  X,
  Pencil,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  Calendar,
  Building2,
  Tag,
  ArrowLeftRight,
  BarChart3,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getTransactions,
  getTransactionStats,
  getCategories,
  getAccounts,
  getStatements,
  updateTransaction,
  type Transaction,
  type TransactionFilters,
  type Category,
} from '@/lib/api'
import { FileText, Check } from 'lucide-react'
import { useProfiles, useAuthStatus } from '@/hooks/useAuthStatus'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/transactions')({
  component: TransactionsPage,
})

function TransactionsPage() {
  const queryClient = useQueryClient()
  const { profiles, defaultProfile } = useProfiles()
  const { user } = useAuthStatus()
  const countryCode = user?.country?.toLowerCase() || 'in'
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)

  // Filter state
  const [filters, setFilters] = useState<TransactionFilters>({})
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const limit = 25

  // Use default profile if none selected
  const activeProfileId = selectedProfileId || defaultProfile?.id

  // Build active filters
  const activeFilters: TransactionFilters = {
    ...filters,
    profileId: activeProfileId,
    search: search || undefined,
  }

  // Fetch transactions
  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', activeFilters, page, limit],
    queryFn: () =>
      getTransactions(activeFilters, { page, limit, sortBy: 'date', sortOrder: 'desc' }),
    enabled: !!activeProfileId,
  })

  // Fetch stats WITH filters applied
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['transaction-stats', activeFilters],
    queryFn: () => getTransactionStats(activeFilters),
    enabled: !!activeProfileId,
  })

  // Default stats for loading/empty state
  const displayStats = stats || {
    totalCredits: 0,
    totalDebits: 0,
    creditCount: 0,
    debitCount: 0,
    netAmount: 0,
    currency: 'INR',
    categoryBreakdown: [],
  }

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  })

  // Fetch accounts for filter
  const { data: accounts } = useQuery({
    queryKey: ['accounts', activeProfileId],
    queryFn: () => getAccounts(activeProfileId),
    enabled: !!activeProfileId,
  })

  // Fetch statements for filter
  const { data: statements } = useQuery({
    queryKey: ['statements', activeProfileId],
    queryFn: () => getStatements(activeProfileId),
    enabled: !!activeProfileId,
  })

  const transactions = transactionsData?.transactions || []
  const total = transactionsData?.total || 0
  const totalPages = Math.ceil(total / limit)
  const categories = categoriesData?.categories || []

  // Create account lookup map
  const accountMap = new Map(accounts?.map((a) => [a.id, a]) || [])

  // Format amount with proper currency
  const formatAmount = (amount: number, currency: string) => {
    const locale = currency === 'INR' ? 'en-IN' : 'en-US'
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const getCategoryLabel = (code: string) => {
    return categories.find((c) => c.code === code)?.label || code.replace(/_/g, ' ')
  }

  const clearFilters = () => {
    setFilters({})
    setSearch('')
    setPage(1)
  }

  const removeFilter = (key: keyof TransactionFilters) => {
    const newFilters = { ...filters }
    delete newFilters[key]
    setFilters(newFilters)
    setPage(1)
  }

  const hasActiveFilters = Object.keys(filters).length > 0 || search

  // Get currency from stats or default to INR
  const currency = stats?.currency || 'INR'

  // Helper to get statement label
  const getStatementLabel = (id: string) => {
    const statement = statements?.find((s) => s.id === id)
    if (!statement) return 'Statement'
    const date = statement.periodEnd
      ? new Date(statement.periodEnd).toLocaleDateString('en-GB', {
          month: 'short',
          year: '2-digit',
        })
      : new Date(statement.createdAt).toLocaleDateString('en-GB', {
          month: 'short',
          year: '2-digit',
        })
    return `${statement.originalFilename.replace(/\.[^/.]+$/, '')} (${date})`
  }

  // Determine stats label based on filters
  const getStatsLabel = () => {
    const parts: string[] = []
    if (filters.startDate || filters.endDate) {
      if (filters.startDate && filters.endDate) {
        parts.push(`${filters.startDate} to ${filters.endDate}`)
      } else if (filters.startDate) {
        parts.push(`From ${filters.startDate}`)
      } else {
        parts.push(`Until ${filters.endDate}`)
      }
    }
    if (filters.category?.length) {
      if (filters.category.length === 1) {
        parts.push(getCategoryLabel(filters.category[0]!))
      } else {
        parts.push(`${filters.category.length} categories`)
      }
    }
    if (filters.accountId) {
      const account = accounts?.find((a) => a.id === filters.accountId)
      parts.push(account?.accountName || 'Selected account')
    }
    if (filters.statementId?.length) {
      parts.push(
        `${filters.statementId.length} statement${filters.statementId.length > 1 ? 's' : ''}`
      )
    }
    return parts.length > 0 ? parts.join(' · ') : 'All time'
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Transactions</h1>
            <p className="text-muted-foreground">View and manage your transactions</p>
          </div>
          <ProfileSelector
            profiles={profiles || []}
            selectedProfileId={activeProfileId || ''}
            onProfileChange={(id) => {
              setSelectedProfileId(id)
              setPage(1)
            }}
          />
        </div>

        {/* Stats Cards - Neumorphic Design (same pattern as account cards) */}
        <div className="grid gap-4 md:grid-cols-4">
          {/* Total Credits */}
          <div
            className={cn(
              'relative rounded-2xl p-5 overflow-hidden',
              // Light mode - neutral metallic
              'bg-gradient-to-br from-zinc-100 via-white to-zinc-100',
              // Dark mode - dark charcoal
              'dark:bg-gradient-to-br dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-900',
              // Neumorphic shadow
              'shadow-[4px_4px_10px_rgba(0,0,0,0.1),-4px_-4px_10px_rgba(255,255,255,0.9)]',
              'dark:shadow-[4px_4px_12px_rgba(0,0,0,0.5)]'
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Total Credits
                </p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {statsLoading ? '...' : formatAmount(displayStats.totalCredits, currency)}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                  {statsLoading
                    ? '...'
                    : `${displayStats.creditCount.toLocaleString()} transactions`}
                </p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </div>

          {/* Total Debits */}
          <div
            className={cn(
              'relative rounded-2xl p-5 overflow-hidden',
              // Light mode - neutral metallic
              'bg-gradient-to-br from-zinc-100 via-white to-zinc-100',
              // Dark mode - dark charcoal
              'dark:bg-gradient-to-br dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-900',
              // Neumorphic shadow
              'shadow-[4px_4px_10px_rgba(0,0,0,0.1),-4px_-4px_10px_rgba(255,255,255,0.9)]',
              'dark:shadow-[4px_4px_12px_rgba(0,0,0,0.5)]'
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Total Debits
                </p>
                <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                  {statsLoading ? '...' : formatAmount(displayStats.totalDebits, currency)}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                  {statsLoading
                    ? '...'
                    : `${displayStats.debitCount.toLocaleString()} transactions`}
                </p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                <TrendingDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              </div>
            </div>
          </div>

          {/* Net Amount */}
          <div
            className={cn(
              'relative rounded-2xl p-5 overflow-hidden',
              // Light mode - neutral metallic
              'bg-gradient-to-br from-zinc-100 via-white to-zinc-100',
              // Dark mode - dark charcoal
              'dark:bg-gradient-to-br dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-900',
              // Neumorphic shadow
              'shadow-[4px_4px_10px_rgba(0,0,0,0.1),-4px_-4px_10px_rgba(255,255,255,0.9)]',
              'dark:shadow-[4px_4px_12px_rgba(0,0,0,0.5)]'
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Net Amount
                </p>
                <p
                  className={cn(
                    'text-2xl font-bold mt-1',
                    displayStats.netAmount >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  )}
                >
                  {statsLoading ? '...' : formatAmount(displayStats.netAmount, currency)}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                  {displayStats.netAmount >= 0 ? 'Surplus' : 'Deficit'}
                </p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                <Wallet className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
              </div>
            </div>
          </div>

          {/* Total Transactions */}
          <div
            className={cn(
              'relative rounded-2xl p-5 overflow-hidden',
              // Light mode - neutral metallic
              'bg-gradient-to-br from-zinc-100 via-white to-zinc-100',
              // Dark mode - dark charcoal
              'dark:bg-gradient-to-br dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-900',
              // Neumorphic shadow
              'shadow-[4px_4px_10px_rgba(0,0,0,0.1),-4px_-4px_10px_rgba(255,255,255,0.9)]',
              'dark:shadow-[4px_4px_12px_rgba(0,0,0,0.5)]'
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Total Transactions
                </p>
                <p className="text-2xl font-bold text-zinc-800 dark:text-zinc-100 mt-1">
                  {statsLoading
                    ? '...'
                    : (displayStats.creditCount + displayStats.debitCount).toLocaleString()}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1 truncate max-w-[140px]">
                  {getStatsLabel()}
                </p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div
          className={cn(
            'flex flex-wrap items-center gap-3 p-4 rounded-xl',
            'bg-zinc-50 dark:bg-zinc-900/50',
            'border border-zinc-200 dark:border-zinc-800'
          )}
        >
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Search transactions..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-9 bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex items-center gap-2">
            {/* Type Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={filters.type ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-9 w-[90px] justify-start"
                >
                  <ArrowLeftRight className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {filters.type === 'credit'
                      ? 'Credits'
                      : filters.type === 'debit'
                        ? 'Debits'
                        : 'Type'}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-2" align="start">
                <div className="space-y-1">
                  <Button
                    variant={!filters.type ? 'secondary' : 'ghost'}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => {
                      removeFilter('type')
                    }}
                  >
                    All types
                  </Button>
                  <Button
                    variant={filters.type === 'credit' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => {
                      setFilters({ ...filters, type: 'credit' })
                      setPage(1)
                    }}
                  >
                    <ArrowDownLeft className="mr-2 h-4 w-4 text-emerald-600" />
                    Credits
                  </Button>
                  <Button
                    variant={filters.type === 'debit' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => {
                      setFilters({ ...filters, type: 'debit' })
                      setPage(1)
                    }}
                  >
                    <ArrowUpRight className="mr-2 h-4 w-4 text-rose-600" />
                    Debits
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Category Filter (Multi-select) */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={filters.category?.length ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-9 w-[120px] justify-start"
                >
                  <Tag className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {filters.category?.length
                      ? filters.category.length === 1
                        ? getCategoryLabel(filters.category[0]!)
                        : `${filters.category.length} categories`
                      : 'Category'}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="start">
                <div className="max-h-[300px] overflow-y-auto space-y-1">
                  <Button
                    variant={!filters.category?.length ? 'secondary' : 'ghost'}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => {
                      removeFilter('category')
                    }}
                  >
                    All categories
                  </Button>
                  {categories.map((cat) => {
                    const isSelected = filters.category?.includes(cat.code)
                    return (
                      <Button
                        key={cat.code}
                        variant={isSelected ? 'secondary' : 'ghost'}
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => {
                          const current = filters.category || []
                          const updated = isSelected
                            ? current.filter((c) => c !== cat.code)
                            : [...current, cat.code]
                          setFilters({
                            ...filters,
                            category: updated.length > 0 ? updated : undefined,
                          })
                          setPage(1)
                        }}
                      >
                        {isSelected && <Check className="mr-2 h-4 w-4" />}
                        {cat.label}
                      </Button>
                    )
                  })}
                </div>
              </PopoverContent>
            </Popover>

            {/* Account Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={filters.accountId ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-9 w-[160px] justify-start"
                >
                  <Building2 className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {filters.accountId
                      ? accounts?.find((a) => a.id === filters.accountId)?.accountName || 'Account'
                      : 'Account'}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <div className="max-h-[300px] overflow-y-auto space-y-1">
                  <Button
                    variant={!filters.accountId ? 'secondary' : 'ghost'}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => {
                      removeFilter('accountId')
                    }}
                  >
                    All accounts
                  </Button>
                  {accounts?.map((account) => (
                    <Button
                      key={account.id}
                      variant={filters.accountId === account.id ? 'secondary' : 'ghost'}
                      size="sm"
                      className="w-full justify-start truncate"
                      onClick={() => {
                        // Clear statement filter if changing account (statements are account-specific)
                        const newFilters = { ...filters, accountId: account.id }
                        if (filters.statementId?.length) {
                          // Only keep statements that belong to this account
                          const validStatements = filters.statementId.filter(
                            (id) => statements?.find((s) => s.id === id)?.accountId === account.id
                          )
                          newFilters.statementId =
                            validStatements.length > 0 ? validStatements : undefined
                        }
                        setFilters(newFilters)
                        setPage(1)
                      }}
                    >
                      {account.accountName || account.type}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Statement Filter (Multi-select) */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={filters.statementId?.length ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-9 w-[140px] justify-start"
                >
                  <FileText className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {filters.statementId?.length
                      ? filters.statementId.length === 1
                        ? getStatementLabel(filters.statementId[0]!)
                        : `${filters.statementId.length} statements`
                      : 'Statement'}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-2" align="start">
                <div className="max-h-[300px] overflow-y-auto space-y-1">
                  <Button
                    variant={!filters.statementId?.length ? 'secondary' : 'ghost'}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => {
                      removeFilter('statementId')
                    }}
                  >
                    All statements
                  </Button>
                  {statements
                    ?.filter((s) => s.status === 'completed')
                    // Filter by account if account filter is applied
                    .filter((s) => !filters.accountId || s.accountId === filters.accountId)
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
                            setFilters({
                              ...filters,
                              statementId: updated.length > 0 ? updated : undefined,
                            })
                            setPage(1)
                          }}
                        >
                          {isSelected && <Check className="mr-2 h-4 w-4 shrink-0" />}
                          <span className="truncate">
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

            {/* Date Range Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={filters.startDate || filters.endDate ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-9 w-[120px] justify-start"
                >
                  <Calendar className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {filters.startDate || filters.endDate ? 'Date Set' : 'Date Range'}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4" align="start">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">From</Label>
                    <Input
                      type="date"
                      value={filters.startDate || ''}
                      onChange={(e) => {
                        setFilters({ ...filters, startDate: e.target.value || undefined })
                        setPage(1)
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">To</Label>
                    <Input
                      type="date"
                      value={filters.endDate || ''}
                      onChange={(e) => {
                        setFilters({ ...filters, endDate: e.target.value || undefined })
                        setPage(1)
                      }}
                    />
                  </div>
                  {(filters.startDate || filters.endDate) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        const newFilters = { ...filters }
                        delete newFilters.startDate
                        delete newFilters.endDate
                        setFilters(newFilters)
                        setPage(1)
                      }}
                    >
                      Clear dates
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Clear All */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
                <X className="mr-1 h-4 w-4" />
                Clear all
              </Button>
            )}
          </div>
        </div>

        {/* Active Filters Pills */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Filtering by:</span>
            {search && (
              <Badge variant="secondary" className="gap-1 pr-1">
                Search: "{search}"
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 hover:bg-transparent"
                  onClick={() => setSearch('')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {filters.type && (
              <Badge variant="secondary" className="gap-1 pr-1">
                {filters.type === 'credit' ? 'Credits only' : 'Debits only'}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 hover:bg-transparent"
                  onClick={() => removeFilter('type')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {filters.category?.map((cat) => (
              <Badge key={cat} variant="secondary" className="gap-1 pr-1">
                {getCategoryLabel(cat)}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 hover:bg-transparent"
                  onClick={() => {
                    const updated = filters.category?.filter((c) => c !== cat)
                    setFilters({
                      ...filters,
                      category: updated?.length ? updated : undefined,
                    })
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
            {filters.accountId && (
              <Badge variant="secondary" className="gap-1 pr-1">
                {accounts?.find((a) => a.id === filters.accountId)?.accountName || 'Account'}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 hover:bg-transparent"
                  onClick={() => removeFilter('accountId')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {(filters.startDate || filters.endDate) && (
              <Badge variant="secondary" className="gap-1 pr-1">
                {filters.startDate && filters.endDate
                  ? `${filters.startDate} to ${filters.endDate}`
                  : filters.startDate
                    ? `From ${filters.startDate}`
                    : `Until ${filters.endDate}`}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 hover:bg-transparent"
                  onClick={() => {
                    const newFilters = { ...filters }
                    delete newFilters.startDate
                    delete newFilters.endDate
                    setFilters(newFilters)
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {filters.statementId?.map((id) => (
              <Badge key={id} variant="secondary" className="gap-1 pr-1">
                {getStatementLabel(id)}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 hover:bg-transparent"
                  onClick={() => {
                    const updated = filters.statementId?.filter((s) => s !== id)
                    setFilters({
                      ...filters,
                      statementId: updated?.length ? updated : undefined,
                    })
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}

        {/* Edit Transaction Dialog */}
        <Dialog
          open={!!editingTransaction}
          onOpenChange={(open) => !open && setEditingTransaction(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Transaction</DialogTitle>
              <DialogDescription>{editingTransaction?.originalDescription}</DialogDescription>
            </DialogHeader>
            {editingTransaction && (
              <TransactionEditForm
                transaction={editingTransaction}
                categories={categories}
                onClose={() => setEditingTransaction(null)}
                onSuccess={() => {
                  setEditingTransaction(null)
                  queryClient.invalidateQueries({ queryKey: ['transactions'] })
                  queryClient.invalidateQueries({ queryKey: ['transaction-stats'] })
                }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Pagination - Always visible */}
        {!transactionsLoading && transactions.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Showing{' '}
              <span className="font-medium text-zinc-700 dark:text-zinc-200">
                {(page - 1) * limit + 1}
              </span>{' '}
              to{' '}
              <span className="font-medium text-zinc-700 dark:text-zinc-200">
                {Math.min(page * limit, total)}
              </span>{' '}
              of{' '}
              <span className="font-medium text-zinc-700 dark:text-zinc-200">
                {total.toLocaleString()}
              </span>{' '}
              transactions
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="h-8"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <div className="px-3 py-1 text-sm text-zinc-600 dark:text-zinc-400">
                Page <span className="font-medium text-zinc-800 dark:text-zinc-200">{page}</span> of{' '}
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {Math.max(totalPages, 1)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="h-8"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Transactions Table */}
        {transactionsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : transactions.length > 0 ? (
          <>
            {/* Table Container */}
            <div
              className={cn(
                'rounded-xl overflow-hidden',
                'bg-white dark:bg-zinc-900',
                'border border-zinc-200 dark:border-zinc-800',
                'shadow-sm'
              )}
            >
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow className="bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <TableHead className="w-[100px] text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Date
                    </TableHead>
                    <TableHead className="w-[130px] text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Account
                    </TableHead>
                    <TableHead className="w-auto text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Description
                    </TableHead>
                    <TableHead className="w-[180px] text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Category
                    </TableHead>
                    <TableHead className="w-[140px] text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Amount
                    </TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((txn, index) => {
                    const account = accountMap.get(txn.accountId)
                    const accountNumber = account?.accountNumber || ''
                    const last4 = accountNumber.slice(-4) || '****'
                    const institutionId = account?.institution || ''
                    const logoPath = institutionId
                      ? `/institutions/${countryCode}/${institutionId}.svg`
                      : null

                    return (
                      <TableRow
                        key={txn.id}
                        className={cn(
                          'group transition-colors',
                          index % 2 === 0
                            ? 'bg-white dark:bg-zinc-900'
                            : 'bg-zinc-50/50 dark:bg-zinc-800/20'
                        )}
                      >
                        <TableCell className="text-sm text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                          {new Date(txn.date).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: '2-digit',
                          })}
                        </TableCell>
                        <TableCell>
                          <AccountLogo
                            logoPath={logoPath}
                            institutionId={institutionId || 'other'}
                            last4={last4}
                          />
                        </TableCell>
                        <TableCell className="overflow-hidden">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105',
                                txn.type === 'credit'
                                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
                              )}
                            >
                              {txn.type === 'credit' ? (
                                <ArrowDownLeft className="h-4 w-4" />
                              ) : (
                                <ArrowUpRight className="h-4 w-4" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-zinc-800 dark:text-zinc-100">
                                {txn.summary || txn.originalDescription}
                              </p>
                              {txn.summary && txn.summary !== txn.originalDescription && (
                                <p className="truncate text-xs text-zinc-500 dark:text-zinc-500">
                                  {txn.originalDescription}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium',
                              'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                            )}
                          >
                            {getCategoryLabel(txn.category)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <span
                            className={cn(
                              'font-semibold tabular-nums',
                              txn.type === 'credit'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            )}
                          >
                            {txn.type === 'credit' ? '+' : '-'}
                            {formatAmount(txn.amount, txn.currency)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setEditingTransaction(txn)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <div
            className={cn(
              'rounded-xl p-12 text-center',
              'bg-zinc-50 dark:bg-zinc-900/50',
              'border border-dashed border-zinc-200 dark:border-zinc-800'
            )}
          >
            <div className="mx-auto h-14 w-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
              <Receipt className="h-7 w-7 text-zinc-400" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              No transactions found
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
              {hasActiveFilters
                ? 'Try adjusting your filters to see more results'
                : 'Upload a statement to start tracking your transactions'}
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

// Account Logo component with fallback
function AccountLogo({
  logoPath,
  institutionId,
  last4,
}: {
  logoPath: string | null
  institutionId: string
  last4: string
}) {
  const [logoError, setLogoError] = useState(false)

  return (
    <div className="flex items-center gap-2">
      <div className="h-6 w-6 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
        {logoPath && !logoError ? (
          <img
            src={logoPath}
            alt={institutionId}
            className="h-4 w-4 object-contain"
            onError={() => setLogoError(true)}
          />
        ) : (
          <span className="text-[10px] font-medium text-zinc-500">
            {institutionId.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">••{last4}</span>
    </div>
  )
}

// Transaction Edit Form
function TransactionEditForm({
  transaction,
  categories,
  onClose,
  onSuccess,
}: {
  transaction: Transaction
  categories: Category[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [category, setCategory] = useState(transaction.category)
  const [summary, setSummary] = useState(transaction.summary || '')

  const updateMutation = useMutation({
    mutationFn: () =>
      updateTransaction(transaction.id, { category, summary: summary || undefined }),
    onSuccess: () => {
      toast.success('Transaction updated')
      onSuccess()
    },
    onError: () => {
      toast.error('Failed to update transaction')
    },
  })

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="summary">Summary</Label>
        <Input
          id="summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Brief description"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger id="category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.code} value={cat.code}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </div>
  )
}
