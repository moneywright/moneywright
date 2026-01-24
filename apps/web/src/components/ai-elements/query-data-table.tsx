/**
 * Query Data Table Component
 *
 * Fetches and displays full query data from the cache.
 * Used when LLM includes <data-table query-id="xxx" /> in responses.
 */

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getQueryData } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'

interface QueryDataTableProps {
  queryId: string
  className?: string
}

const PAGE_SIZE = 20

// Format cell value based on type
function formatCellValue(value: unknown, fieldType?: string): string {
  if (value === null || value === undefined) return '-'

  if (typeof value === 'number') {
    // Check if it looks like currency (large number)
    if (Math.abs(value) >= 100) {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value)
    }
    // Small numbers - could be percentage or units
    if (!Number.isInteger(value)) {
      return value.toFixed(2)
    }
    return value.toLocaleString('en-IN')
  }

  if (typeof value === 'boolean') return value ? 'Yes' : 'No'

  if (fieldType === 'date' || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))) {
    try {
      const date = new Date(value as string)
      return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return String(value)
    }
  }

  if (typeof value === 'object') return JSON.stringify(value)

  return String(value)
}

// Get display label for field name
function getFieldLabel(name: string): string {
  const labels: Record<string, string> = {
    id: 'ID',
    date: 'Date',
    amount: 'Amount',
    type: 'Type',
    category: 'Category',
    summary: 'Description',
    originalDescription: 'Original Description',
    accountId: 'Account',
    balance: 'Balance',
    currency: 'Currency',
    name: 'Name',
    symbol: 'Symbol',
    investmentType: 'Type',
    units: 'Units',
    averageCost: 'Avg Cost',
    currentPrice: 'Current Price',
    currentValue: 'Current Value',
    investedValue: 'Invested',
    gainLoss: 'Gain/Loss',
    gainLossPercent: 'Gain %',
  }
  return labels[name] || name.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())
}

// Determine which columns to show by default based on data type
function getDefaultColumns(dataType: string): string[] {
  switch (dataType) {
    case 'transactions':
      // Use special 'description' column that combines summary + originalDescription
      return ['date', 'description', 'category', 'amount', 'type']
    case 'holdings':
      return [
        'name',
        'symbol',
        'investmentType',
        'units',
        'currentValue',
        'gainLoss',
        'gainLossPercent',
      ]
    case 'accounts':
      return ['accountName', 'type', 'institution', 'latestBalance', 'currency']
    default:
      return []
  }
}

// Check if column is a virtual/combined column
function isVirtualColumn(col: string): boolean {
  return col === 'description'
}

type SortDirection = 'asc' | 'desc' | null

export function QueryDataTable({ queryId, className }: QueryDataTableProps) {
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['queryData', queryId],
    queryFn: () => getQueryData(queryId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  })

  // Determine columns to display
  const columns = useMemo(() => {
    if (!data) return []

    // Get default columns for this data type
    const defaultCols = getDefaultColumns(data.dataType)

    if (defaultCols.length > 0) {
      // Use default columns, but only those that exist in schema (or are virtual)
      const schemaFields = new Set(data.schema.fields.map((f) => f.name))
      return defaultCols.filter((col) => isVirtualColumn(col) || schemaFields.has(col))
    }

    // Fallback: show first 6 fields from schema (excluding 'id')
    return data.schema.fields
      .filter((f) => f.name !== 'id')
      .slice(0, 6)
      .map((f) => f.name)
  }, [data])

  // Get field type from schema
  const getFieldType = (fieldName: string): string | undefined => {
    return data?.schema.fields.find((f) => f.name === fieldName)?.type
  }

  // Get sortable field for virtual columns
  const getSortField = (col: string): string => {
    if (col === 'description') return 'summary'
    return col
  }

  // Sort and paginate data
  const displayData = useMemo(() => {
    if (!data?.data) return []

    const sorted = [...data.data] as Array<Record<string, unknown>>

    // Apply sorting
    if (sortField && sortDirection) {
      const actualSortField = getSortField(sortField)
      sorted.sort((a, b) => {
        const aVal = a[actualSortField]
        const bVal = b[actualSortField]

        // Handle null/undefined
        if (aVal == null && bVal == null) return 0
        if (aVal == null) return sortDirection === 'asc' ? 1 : -1
        if (bVal == null) return sortDirection === 'asc' ? -1 : 1

        // Compare
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
        }

        const aStr = String(aVal)
        const bStr = String(bVal)
        return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
      })
    }

    // Paginate
    const start = page * PAGE_SIZE
    return sorted.slice(start, start + PAGE_SIZE)
  }, [data, sortField, sortDirection, page])

  // Handle sort toggle
  const handleSort = (field: string) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> none
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortField(null)
        setSortDirection(null)
      }
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
    setPage(0) // Reset to first page when sorting
  }

  // Get sort icon
  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="ml-1 h-3 w-3" />
    }
    return <ArrowDown className="ml-1 h-3 w-3" />
  }

  // Pagination info
  const totalPages = data ? Math.ceil(data.count / PAGE_SIZE) : 0
  const startRow = page * PAGE_SIZE + 1
  const endRow = Math.min((page + 1) * PAGE_SIZE, data?.count || 0)

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        <Skeleton className="h-8 w-48" />
        <div className="rounded-xl border border-border-subtle overflow-hidden">
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !data) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20',
          className
        )}
      >
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm">
          {error instanceof Error
            ? error.message
            : 'Failed to load data. The query may have expired.'}
        </span>
      </div>
    )
  }

  // Empty state
  if (data.count === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center p-8 text-muted-foreground text-sm',
          className
        )}
      >
        No data found
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header with count */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Showing {startRow}-{endRow} of {data.count} items
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border-subtle">
                {columns.map((col) => (
                  <TableHead
                    key={col}
                    className="text-xs font-medium text-muted-foreground uppercase tracking-wider bg-surface-elevated/50 py-3 cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort(col)}
                  >
                    <div className="flex items-center">
                      {getFieldLabel(col)}
                      {getSortIcon(col)}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayData.map((row, rowIndex) => (
                <TableRow
                  key={rowIndex}
                  className="border-b border-border-subtle/50 last:border-0 hover:bg-surface-hover/50"
                >
                  {columns.map((col) => {
                    // Special handling for combined description column
                    if (col === 'description') {
                      const summary = row['summary'] as string | undefined
                      const originalDesc = row['originalDescription'] as string | undefined
                      return (
                        <TableCell key={col} className="py-3 text-sm max-w-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium truncate">
                              {summary || originalDesc || '-'}
                            </span>
                            {originalDesc && summary && originalDesc !== summary && (
                              <span className="text-xs text-muted-foreground truncate">
                                {originalDesc}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      )
                    }

                    return (
                      <TableCell key={col} className="py-3 text-sm">
                        <span
                          className={cn(
                            'tabular-nums',
                            col === 'type' && row[col] === 'credit' && 'text-emerald-500',
                            col === 'type' && row[col] === 'debit' && 'text-rose-500',
                            (col === 'gainLoss' || col === 'gainLossPercent') &&
                              typeof row[col] === 'number' &&
                              (row[col] as number) >= 0 &&
                              'text-emerald-500',
                            (col === 'gainLoss' || col === 'gainLossPercent') &&
                              typeof row[col] === 'number' &&
                              (row[col] as number) < 0 &&
                              'text-rose-500'
                          )}
                        >
                          {formatCellValue(row[col], getFieldType(col))}
                        </span>
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage(0)}
            disabled={page === 0}
            className="h-8 w-8 p-0"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-2">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage(totalPages - 1)}
            disabled={page >= totalPages - 1}
            className="h-8 w-8 p-0"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
