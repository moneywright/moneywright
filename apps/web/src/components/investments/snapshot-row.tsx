import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Calendar,
  MoreVertical,
  Trash2,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import type { InvestmentSnapshot } from '@/lib/api'

interface SnapshotRowProps {
  snapshot: InvestmentSnapshot
  sourceName?: string
  formatCurrency: (amount: number | null | undefined, currency: string) => string
  formatPercentage: (value: number | null | undefined) => string
  onDelete: () => void
}

export function SnapshotRow({
  snapshot,
  sourceName,
  formatCurrency,
  formatPercentage,
  onDelete,
}: SnapshotRowProps) {
  const [expanded, setExpanded] = useState(false)

  const snapshotTypeLabels: Record<string, string> = {
    statement_import: 'Statement Import',
    manual: 'Manual',
    scheduled: 'Scheduled',
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const hasValidInvested = snapshot.totalInvested !== null && snapshot.totalInvested > 0
  const isPositive = snapshot.totalGainLoss !== null && snapshot.totalGainLoss >= 0

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div
        className={cn(
          'group overflow-hidden rounded-xl border transition-colors',
          'bg-card border-[var(--border-subtle)] hover:border-[var(--border-hover)]'
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-4 p-4">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-foreground"
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-subtle)]">
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{formatDate(snapshot.snapshotDate)}</span>
              <Badge variant="secondary" className="text-[10px]">
                {snapshotTypeLabels[snapshot.snapshotType] || snapshot.snapshotType}
              </Badge>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              {sourceName && <span>{sourceName}</span>}
              {sourceName && <span className="opacity-50">·</span>}
              <span>{snapshot.holdingsCount} holdings</span>
            </div>
          </div>

          {/* Values */}
          <div className="hidden text-right sm:block">
            <div className="font-mono text-lg font-semibold">
              {formatCurrency(snapshot.totalCurrent, snapshot.currency)}
            </div>
            {hasValidInvested && snapshot.totalGainLoss !== null ? (
              <div
                className={cn(
                  'flex items-center justify-end gap-1 text-sm font-medium',
                  isPositive ? 'text-positive' : 'text-negative'
                )}
              >
                {isPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span className="font-mono">
                  {isPositive ? '+' : ''}
                  {formatCurrency(snapshot.totalGainLoss, snapshot.currency)}
                </span>
                {snapshot.gainLossPercent !== null && (
                  <span className="text-xs opacity-75">
                    ({formatPercentage(snapshot.gainLossPercent)})
                  </span>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">-</div>
            )}
          </div>

          {/* Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 shrink-0 p-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Snapshot?</AlertDialogTitle>
                    <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={onDelete}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile values */}
        <div className="border-t border-[var(--border-subtle)] px-4 py-3 sm:hidden">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Value</span>
            <span className="font-mono font-semibold">
              {formatCurrency(snapshot.totalCurrent, snapshot.currency)}
            </span>
          </div>
          {hasValidInvested && snapshot.totalGainLoss !== null && (
            <div className="mt-1 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Gain/Loss</span>
              <span
                className={cn(
                  'font-mono text-sm font-medium',
                  isPositive ? 'text-positive' : 'text-negative'
                )}
              >
                {isPositive ? '+' : ''}
                {formatCurrency(snapshot.totalGainLoss, snapshot.currency)}
                {snapshot.gainLossPercent !== null &&
                  ` (${formatPercentage(snapshot.gainLossPercent)})`}
              </span>
            </div>
          )}
        </div>

        {/* Holdings Detail */}
        <CollapsibleContent>
          {snapshot.holdingsDetail && snapshot.holdingsDetail.length > 0 && (
            <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4">
              <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-card">
                {/* Table Header */}
                <div className="hidden border-b border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:grid sm:grid-cols-4 sm:gap-4">
                  <div>Name</div>
                  <div>Type</div>
                  <div className="text-right">Units</div>
                  <div className="text-right">Value</div>
                </div>
                <div className="divide-y divide-[var(--border-subtle)]">
                  {snapshot.holdingsDetail.map((holding, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-4 sm:items-center sm:gap-4 sm:py-2"
                    >
                      <div className="truncate font-medium">{holding.name}</div>
                      <div className="hidden text-sm text-muted-foreground sm:block">
                        {holding.investmentType.replace(/_/g, ' ')}
                      </div>
                      <div className="hidden text-right font-mono text-sm sm:block">
                        {holding.units ?? '-'}
                      </div>
                      <div className="text-right font-mono font-medium">
                        {formatCurrency(holding.currentValue, holding.currency)}
                      </div>
                      {/* Mobile type */}
                      <div className="col-span-2 text-xs text-muted-foreground sm:hidden">
                        {holding.investmentType.replace(/_/g, ' ')}
                        {holding.units !== null && ` · ${holding.units} units`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
