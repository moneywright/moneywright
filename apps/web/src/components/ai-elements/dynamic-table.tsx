/**
 * Dynamic Table Renderer for AI-generated tables
 *
 * Renders tables from configuration objects returned by the executeCode tool.
 */

import { memo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

/**
 * Table output from executeCode tool
 */
export interface TableOutput {
  columns: Array<{ key: string; label: string }>
  rows: Array<Record<string, unknown>>
}

interface DynamicTableProps {
  table: TableOutput
  className?: string
  maxRows?: number
}

// Format cell value for display
function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'number') {
    // Format large numbers
    if (Math.abs(value) >= 10000000) {
      return `${(value / 10000000).toFixed(2)}Cr`
    }
    if (Math.abs(value) >= 100000) {
      return `${(value / 100000).toFixed(2)}L`
    }
    if (Math.abs(value) >= 1000) {
      return value.toLocaleString('en-IN')
    }
    // Format decimal numbers
    if (!Number.isInteger(value)) {
      return value.toFixed(2)
    }
    return value.toString()
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * Dynamic Table Component
 *
 * Renders tables based on configuration from executeCode tool.
 */
export const DynamicTable = memo(function DynamicTable({
  table,
  className,
  maxRows = 50,
}: DynamicTableProps) {
  if (!table.rows || table.rows.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-32 text-muted-foreground', className)}>
        No data to display
      </div>
    )
  }

  const displayRows = table.rows.slice(0, maxRows)
  const hasMore = table.rows.length > maxRows

  return (
    <div className={cn('w-full', className)}>
      <div className="rounded-xl border border-border-subtle overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border-subtle">
              {table.columns.map((col) => (
                <TableHead
                  key={col.key}
                  className="text-xs font-medium text-muted-foreground uppercase tracking-wider bg-surface-elevated/50 py-3"
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.map((row, rowIndex) => (
              <TableRow
                key={rowIndex}
                className="border-b border-border-subtle/50 last:border-0 hover:bg-surface-hover/50"
              >
                {table.columns.map((col) => (
                  <TableCell key={col.key} className="py-3 text-sm tabular-nums">
                    {formatCellValue(row[col.key])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {hasMore && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Showing {displayRows.length} of {table.rows.length} rows
        </p>
      )}
    </div>
  )
})

DynamicTable.displayName = 'DynamicTable'
