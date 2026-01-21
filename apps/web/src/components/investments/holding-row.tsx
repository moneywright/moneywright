import { MoreVertical, Pencil, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { InvestmentHolding, InvestmentHoldingType } from '@/lib/api'

interface HoldingRowProps {
  holding: InvestmentHolding
  holdingTypes: InvestmentHoldingType[]
  formatCurrency: (amount: number | null | undefined, currency: string) => string
  formatPercentage: (value: number | null | undefined) => string
  showInINR?: boolean
  convertToINR?: (amount: number, currency: string) => number
  sourceName?: string
  onEdit: () => void
  onDelete: () => void
}

export function HoldingRow({
  holding,
  holdingTypes,
  formatCurrency,
  formatPercentage,
  showInINR,
  convertToINR,
  sourceName,
  onEdit,
  onDelete,
}: HoldingRowProps) {
  const typeLabel =
    holdingTypes.find((t) => t.code === holding.investmentType)?.label ||
    holding.investmentType.replace(/_/g, ' ')

  // Calculate values with conversion if needed
  const displayCurrency = showInINR ? 'INR' : holding.currency
  const currentValue =
    showInINR && convertToINR
      ? convertToINR(holding.currentValue, holding.currency)
      : holding.currentValue
  const investedValue =
    holding.investedValue !== null && showInINR && convertToINR
      ? convertToINR(holding.investedValue, holding.currency)
      : holding.investedValue

  // Only calculate gain/loss if investedValue exists and is positive
  const hasValidInvested = investedValue !== null && investedValue > 0
  const gainLoss = hasValidInvested ? currentValue - investedValue : null
  const gainLossPercent = hasValidInvested ? (gainLoss! / investedValue) * 100 : null

  const isPositive = gainLoss !== null && gainLoss >= 0

  return (
    <div className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[var(--surface-hover)]">
      {/* Holding Info */}
      <div className="min-w-0 flex-1">
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
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>{typeLabel}</span>
          {sourceName && (
            <>
              <span className="opacity-50">·</span>
              <span>{sourceName}</span>
            </>
          )}
          {holding.units !== null && (
            <>
              <span className="opacity-50">·</span>
              <span className="font-mono">{holding.units.toLocaleString()} units</span>
            </>
          )}
        </div>
      </div>

      {/* Values */}
      <div className="hidden text-right sm:block">
        <div className="font-mono font-semibold">
          {formatCurrency(currentValue, displayCurrency)}
        </div>
        {hasValidInvested ? (
          <div
            className={cn(
              'flex items-center justify-end gap-1 text-xs font-medium',
              isPositive ? 'text-positive' : 'text-negative'
            )}
          >
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            <span className="font-mono">
              {isPositive ? '+' : ''}
              {formatCurrency(gainLoss, displayCurrency)}
            </span>
            <span className="opacity-75">({formatPercentage(gainLossPercent)})</span>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">-</div>
        )}
      </div>

      {/* Mobile Values */}
      <div className="text-right sm:hidden">
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
          <DropdownMenuItem onClick={onEdit}>
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
  )
}
