import { TrendingUp, TrendingDown, MoreVertical, Pencil, Trash2 } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import type { InvestmentHolding, InvestmentHoldingType, InvestmentSource } from '@/lib/api'

interface HoldingsTableProps {
  holdings: InvestmentHolding[]
  sources: InvestmentSource[]
  holdingTypes: InvestmentHoldingType[]
  formatCurrency: (amount: number | null | undefined, currency: string) => string
  formatPercentage: (value: number | null | undefined) => string
  showInINR: boolean
  convertToINR: (amount: number, currency: string) => number
  onEditHolding: (holding: InvestmentHolding) => void
  onDeleteHolding: (holdingId: string) => void
}

export function HoldingsTable({
  holdings,
  sources,
  holdingTypes,
  formatCurrency,
  formatPercentage,
  showInINR,
  convertToINR,
  onEditHolding,
  onDeleteHolding,
}: HoldingsTableProps) {
  const getSourceName = (sourceId: string) => {
    return sources.find((s) => s.id === sourceId)?.sourceName || '-'
  }

  const getTypeLabel = (code: string) => {
    return holdingTypes.find((t) => t.code === code)?.label || code.replace(/_/g, ' ')
  }

  if (holdings.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-card">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground">No holdings yet</p>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-card">
      {/* Table Header - Hidden on mobile */}
      <div className="hidden border-b border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:grid sm:grid-cols-12 sm:gap-4">
        <div className="col-span-4">Holding</div>
        <div className="col-span-2">Type</div>
        <div className="col-span-2 text-right">Units</div>
        <div className="col-span-2 text-right">Value</div>
        <div className="col-span-2 text-right">Gain/Loss</div>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-[var(--border-subtle)]">
        {holdings.map((holding) => {
          const displayCurrency = showInINR ? 'INR' : holding.currency
          const currentValue = showInINR
            ? convertToINR(holding.currentValue, holding.currency)
            : holding.currentValue
          const investedValue =
            holding.investedValue !== null && showInINR
              ? convertToINR(holding.investedValue, holding.currency)
              : holding.investedValue

          const hasValidInvested = investedValue !== null && investedValue > 0
          const gainLoss = hasValidInvested ? currentValue - investedValue : null
          const gainLossPercent = hasValidInvested ? (gainLoss! / investedValue) * 100 : null
          const isPositive = gainLoss !== null && gainLoss >= 0

          return (
            <div
              key={holding.id}
              className="group grid grid-cols-1 gap-2 px-4 py-4 transition-colors hover:bg-[var(--surface-hover)] sm:grid-cols-12 sm:items-center sm:gap-4 sm:py-3"
            >
              {/* Holding Name & Source */}
              <div className="col-span-4 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{holding.name}</span>
                  {holding.symbol && (
                    <Badge variant="secondary" className="shrink-0 font-mono text-[10px] uppercase">
                      {holding.symbol}
                    </Badge>
                  )}
                  {showInINR && holding.currency !== 'INR' && (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {holding.currency}
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {getSourceName(holding.sourceId)}
                </p>
              </div>

              {/* Type - Hidden on mobile, shown inline */}
              <div className="col-span-2 hidden text-sm text-muted-foreground sm:block">
                {getTypeLabel(holding.investmentType)}
              </div>

              {/* Units */}
              <div className="col-span-2 hidden text-right font-mono text-sm sm:block">
                {holding.units !== null ? holding.units.toLocaleString() : '-'}
              </div>

              {/* Value */}
              <div className="col-span-2 hidden text-right sm:block">
                <span className="font-mono font-semibold">
                  {formatCurrency(currentValue, displayCurrency)}
                </span>
              </div>

              {/* Gain/Loss */}
              <div className="col-span-2 hidden items-center justify-end gap-2 sm:flex">
                {hasValidInvested && gainLoss !== null ? (
                  <div
                    className={cn(
                      'flex items-center gap-1 font-mono text-sm font-medium',
                      isPositive ? 'text-positive' : 'text-negative'
                    )}
                  >
                    {isPositive ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    <span>{formatPercentage(gainLossPercent)}</span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => onEditHolding(holding)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
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
                          <AlertDialogTitle>Delete Holding?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => onDeleteHolding(holding.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Mobile Layout */}
              <div className="flex items-center justify-between sm:hidden">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{getTypeLabel(holding.investmentType)}</span>
                  {holding.units !== null && (
                    <>
                      <span className="opacity-50">·</span>
                      <span className="font-mono">{holding.units.toLocaleString()} units</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="font-mono text-sm font-semibold">
                      {formatCurrency(currentValue, displayCurrency)}
                    </div>
                    {hasValidInvested && gainLoss !== null && (
                      <div
                        className={cn(
                          'font-mono text-xs font-medium',
                          isPositive ? 'text-positive' : 'text-negative'
                        )}
                      >
                        {formatPercentage(gainLossPercent)}
                      </div>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => onEditHolding(holding)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
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
                            <AlertDialogTitle>Delete Holding?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => onDeleteHolding(holding.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
