import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { AppLayout } from '@/components/domain/app-layout'
import { ProfileSelector } from '@/components/domain/profile-selector'
import { PageHeader } from '@/components/ui/page-header'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TableSkeleton } from '@/components/ui/skeleton'
import type { Transaction, TransactionFilters } from '@/lib/api'
import {
  useAuth,
  useTransactions,
  useTransactionStats,
  useCategories,
  useAccounts,
  useStatements,
  useDebounce,
  useProfileSelection,
} from '@/hooks'
import {
  TransactionStats,
  TransactionFiltersBar,
  TransactionTable,
  TransactionEditForm,
  Pagination,
} from '@/components/transactions'
import type { SortBy, SortOrder } from '@/components/transactions'
import { EmptyState } from '@/components/ui/empty-state'
import { Receipt, Upload } from 'lucide-react'

export const Route = createFileRoute('/transactions')({
  component: TransactionsPage,
})

function TransactionsPage() {
  const queryClient = useQueryClient()
  const { user, profiles } = useAuth()
  const {
    activeProfileId,
    showFamilyView,
    selectorProfileId,
    handleProfileChange,
    handleFamilyViewChange,
  } = useProfileSelection()
  const countryCode = user?.country?.toLowerCase() || 'in'
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)

  // Filter state
  const [filters, setFilters] = useState<TransactionFilters>({})
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<SortBy>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const limit = 25

  // Debounce search to avoid excessive API calls
  const debouncedSearch = useDebounce(search, 300)

  // Query enabled when we have a profileId OR we're in family view
  const queryEnabled = !!activeProfileId || showFamilyView

  // Build active filters
  const activeFilters: TransactionFilters & { enabled?: boolean } = {
    ...filters,
    profileId: activeProfileId,
    search: debouncedSearch || undefined,
    enabled: queryEnabled,
  }

  // Query hooks
  const { data: transactionsData, isLoading: transactionsLoading } = useTransactions(
    activeFilters,
    { page, limit, sortBy, sortOrder }
  )
  const { data: stats, isLoading: statsLoading } = useTransactionStats(activeFilters)
  const { data: categoriesData } = useCategories()
  const { data: accounts } = useAccounts(activeProfileId, { enabled: queryEnabled })
  const { data: statements } = useStatements(activeProfileId, { enabled: queryEnabled })

  const transactions = transactionsData?.transactions || []
  const total = transactionsData?.total || 0
  const totalPages = Math.ceil(total / limit)
  const categories = categoriesData?.categories || []

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

  const currency = stats?.currency || 'INR'

  // Format amount with proper currency
  const formatAmount = (amount: number, curr: string) => {
    const locale = curr === 'INR' ? 'en-IN' : 'en-US'
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const getCategoryLabel = (code: string) => {
    return categories.find((c) => c.code === code)?.label || code.replace(/_/g, ' ')
  }

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
    return `${statement.originalFilename.replace(/\.[^/.]+$/, ``)} (${date})`
  }

  const clearFilters = () => {
    setFilters({})
    setSearch('')
    setPage(1)
  }

  const handleFiltersChange = (newFilters: TransactionFilters) => {
    setFilters(newFilters)
    setPage(1)
  }

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch)
    setPage(1)
  }

  const handleSortChange = (newSortBy: SortBy, newSortOrder: SortOrder) => {
    setSortBy(newSortBy)
    setSortOrder(newSortOrder)
    setPage(1)
  }

  const hasActiveFilters = Object.keys(filters).length > 0 || search

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
    if (filters.accountId?.length) {
      if (filters.accountId.length === 1) {
        const account = accounts?.find((a) => a.id === filters.accountId![0])
        parts.push(account?.accountName || 'Selected account')
      } else {
        parts.push(`${filters.accountId.length} accounts`)
      }
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
        <PageHeader
          title="Transactions"
          description="View and manage your transactions"
          actions={
            <ProfileSelector
              selectedProfileId={selectorProfileId}
              onProfileChange={(profile) => {
                handleProfileChange(profile)
                setPage(1)
              }}
              showFamilyView={showFamilyView}
              onFamilyViewChange={(enabled) => {
                handleFamilyViewChange(enabled)
                setPage(1)
              }}
            />
          }
        />

        {/* Stats Cards */}
        <TransactionStats
          totalCredits={displayStats.totalCredits}
          totalDebits={displayStats.totalDebits}
          creditCount={displayStats.creditCount}
          debitCount={displayStats.debitCount}
          netAmount={displayStats.netAmount}
          currency={currency}
          statsLabel={getStatsLabel()}
          isLoading={statsLoading}
          formatAmount={formatAmount}
        />

        {/* Filters */}
        <TransactionFiltersBar
          filters={filters}
          search={search}
          categories={categories}
          accounts={accounts || []}
          statements={statements || []}
          country={user?.country}
          onFiltersChange={handleFiltersChange}
          onSearchChange={handleSearchChange}
          onClearFilters={clearFilters}
          getCategoryLabel={getCategoryLabel}
          getStatementLabel={getStatementLabel}
        />

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
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={limit}
            onPageChange={setPage}
          />
        )}

        {/* Transactions Table */}
        {transactionsLoading ? (
          <TableSkeleton rows={10} columns={4} />
        ) : transactions.length > 0 ? (
          <TransactionTable
            transactions={transactions}
            accounts={accounts || []}
            categories={categories}
            countryCode={countryCode}
            onEditTransaction={setEditingTransaction}
            getCategoryLabel={getCategoryLabel}
            formatAmount={formatAmount}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
            profiles={profiles}
            showProfileBadge={showFamilyView}
          />
        ) : (
          <EmptyState
            icon={hasActiveFilters ? Receipt : Upload}
            title={hasActiveFilters ? 'No transactions found' : 'No transactions yet'}
            description={
              hasActiveFilters
                ? 'Try adjusting your filters to see more results'
                : 'Upload a bank or credit card statement to start tracking your transactions.'
            }
            action={
              hasActiveFilters
                ? undefined
                : {
                    label: 'Upload Statement',
                    href: '/statements?upload=true',
                    icon: Upload,
                  }
            }
          />
        )}
      </div>
    </AppLayout>
  )
}
