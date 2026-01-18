import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AppLayout } from '@/components/domain/app-layout'
import { ProfileSelector } from '@/components/domain/profile-selector'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getTransactions,
  getTransactionStats,
  getCategories,
  getAccounts,
  updateTransaction,
  type Transaction,
  type TransactionFilters,
  type Category,
} from '@/lib/api'
import { useProfiles } from '@/hooks/useAuthStatus'

export const Route = createFileRoute('/transactions')({
  component: TransactionsPage,
})

function TransactionsPage() {
  const queryClient = useQueryClient()
  const { profiles, defaultProfile } = useProfiles()
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
  const { data: stats } = useQuery({
    queryKey: ['transaction-stats', activeFilters],
    queryFn: () => getTransactionStats(activeFilters),
    enabled: !!activeProfileId,
  })

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

  const transactions = transactionsData?.transactions || []
  const total = transactionsData?.total || 0
  const totalPages = Math.ceil(total / limit)
  const categories = categoriesData?.categories || []

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
    if (filters.category) {
      parts.push(getCategoryLabel(filters.category))
    }
    if (filters.accountId) {
      const account = accounts?.find((a) => a.id === filters.accountId)
      parts.push(account?.accountName || 'Selected account')
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

        {/* Stats Cards */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-l-4 border-l-emerald-500/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-500/10 p-2">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Credits</p>
                    <p className="text-xl font-semibold text-emerald-600">
                      {formatAmount(stats.totalCredits, currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {stats.creditCount} transactions
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-rose-500/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-rose-500/10 p-2">
                    <TrendingDown className="h-5 w-5 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Debits</p>
                    <p className="text-xl font-semibold text-rose-600">
                      {formatAmount(stats.totalDebits, currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">{stats.debitCount} transactions</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-500/10 p-2">
                    <Wallet className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Net Amount</p>
                    <p
                      className={`text-xl font-semibold ${stats.netAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                    >
                      {formatAmount(stats.netAmount, currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {stats.netAmount >= 0 ? 'Surplus' : 'Deficit'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-violet-500/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-violet-500/10 p-2">
                    <Receipt className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Transactions</p>
                    <p className="text-xl font-semibold">{stats.creditCount + stats.debitCount}</p>
                    <p className="text-xs text-muted-foreground">{getStatsLabel()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-9"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex items-center gap-2">
            {/* Type Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={filters.type ? 'secondary' : 'outline'} size="sm" className="h-9">
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  {filters.type === 'credit'
                    ? 'Credits'
                    : filters.type === 'debit'
                      ? 'Debits'
                      : 'Type'}
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

            {/* Category Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={filters.category ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-9"
                >
                  <Tag className="mr-2 h-4 w-4" />
                  {filters.category ? getCategoryLabel(filters.category) : 'Category'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="start">
                <div className="max-h-[300px] overflow-y-auto space-y-1">
                  <Button
                    variant={!filters.category ? 'secondary' : 'ghost'}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => {
                      removeFilter('category')
                    }}
                  >
                    All categories
                  </Button>
                  {categories.map((cat) => (
                    <Button
                      key={cat.code}
                      variant={filters.category === cat.code ? 'secondary' : 'ghost'}
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => {
                        setFilters({ ...filters, category: cat.code })
                        setPage(1)
                      }}
                    >
                      {cat.label}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Account Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={filters.accountId ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-9"
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  {filters.accountId
                    ? accounts?.find((a) => a.id === filters.accountId)?.accountName || 'Account'
                    : 'Account'}
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
                        setFilters({ ...filters, accountId: account.id })
                        setPage(1)
                      }}
                    >
                      {account.accountName || account.type}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Date Range Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={filters.startDate || filters.endDate ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-9"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {filters.startDate || filters.endDate
                    ? filters.startDate && filters.endDate
                      ? `${filters.startDate} - ${filters.endDate}`
                      : filters.startDate
                        ? `From ${filters.startDate}`
                        : `Until ${filters.endDate}`
                    : 'Date Range'}
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
            {filters.category && (
              <Badge variant="secondary" className="gap-1 pr-1">
                {getCategoryLabel(filters.category)}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 hover:bg-transparent"
                  onClick={() => removeFilter('category')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
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

        {/* Transactions Table */}
        {transactionsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : transactions.length > 0 ? (
          <>
            <Card className="overflow-hidden">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[90px]">Date</TableHead>
                    <TableHead className="w-auto">Description</TableHead>
                    <TableHead className="w-[140px]">Category</TableHead>
                    <TableHead className="w-[130px] text-right">Amount</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell className="font-medium text-muted-foreground whitespace-nowrap">
                        {new Date(txn.date).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: '2-digit',
                        })}
                      </TableCell>
                      <TableCell className="overflow-hidden">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                              txn.type === 'credit'
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : 'bg-rose-500/10 text-rose-600'
                            }`}
                          >
                            {txn.type === 'credit' ? (
                              <ArrowDownLeft className="h-4 w-4" />
                            ) : (
                              <ArrowUpRight className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              {txn.summary || txn.originalDescription}
                            </p>
                            {txn.summary && txn.summary !== txn.originalDescription && (
                              <p className="truncate text-xs text-muted-foreground">
                                {txn.originalDescription}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal whitespace-nowrap">
                          {getCategoryLabel(txn.category)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            txn.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {txn.type === 'credit' ? '+' : '-'}
                          {formatAmount(txn.amount, txn.currency)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditingTransaction(txn)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}{' '}
                  transactions
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Receipt className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">No transactions found</h3>
                <p className="mt-2 text-muted-foreground">
                  {hasActiveFilters
                    ? 'Try adjusting your filters'
                    : 'Upload a statement to start tracking transactions'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
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
