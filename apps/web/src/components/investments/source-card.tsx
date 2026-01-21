import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Building2,
  MoreVertical,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { HoldingRow } from './holding-row'
import { cn } from '@/lib/utils'
import type {
  InvestmentSource,
  InvestmentHolding,
  InvestmentHoldingType,
  InvestmentSourceType,
} from '@/lib/api'

interface SourceCardProps {
  source: InvestmentSource
  holdings: InvestmentHolding[]
  holdingTypes: InvestmentHoldingType[]
  sourceTypes: InvestmentSourceType[]
  isExpanded: boolean
  onToggle: () => void
  onAddHolding: () => void
  onEditSource: () => void
  onDeleteSource: () => void
  onEditHolding: (holding: InvestmentHolding) => void
  onDeleteHolding: (holdingId: string) => void
  formatCurrency: (amount: number | null | undefined, currency: string) => string
  formatPercentage: (value: number | null | undefined) => string
  showInINR: boolean
  convertToINR: (amount: number, currency: string) => number
  getSourceTypeLabel: (code: string) => string
}

function SourceLogo({
  logoPath,
  institution,
}: {
  logoPath: string | null
  institution: string | null
}) {
  const [logoError, setLogoError] = useState(false)

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)]">
      {logoPath && !logoError ? (
        <img
          src={logoPath}
          alt={institution || ''}
          className="h-7 w-7 object-contain"
          onError={() => setLogoError(true)}
        />
      ) : (
        <Building2 className="h-5 w-5 text-muted-foreground" />
      )}
    </div>
  )
}

export function SourceCard({
  source,
  holdings,
  holdingTypes,
  sourceTypes,
  isExpanded,
  onToggle,
  onAddHolding,
  onEditSource,
  onDeleteSource,
  onEditHolding,
  onDeleteHolding,
  formatCurrency,
  formatPercentage,
  showInINR,
  convertToINR,
  getSourceTypeLabel,
}: SourceCardProps) {
  // Calculate totals - only count holdings with valid invested value
  const sourceTotal = holdings.reduce((sum, h) => sum + convertToINR(h.currentValue, h.currency), 0)

  // For invested and gain calculation, only consider holdings with investedValue
  const holdingsWithInvested = holdings.filter(
    (h) => h.investedValue !== null && h.investedValue > 0
  )
  const sourceInvested = holdingsWithInvested.reduce(
    (sum, h) => sum + convertToINR(h.investedValue!, h.currency),
    0
  )
  const sourceGain =
    holdingsWithInvested.reduce((sum, h) => sum + convertToINR(h.currentValue, h.currency), 0) -
    sourceInvested
  const sourceGainPercent = sourceInvested > 0 ? (sourceGain / sourceInvested) * 100 : null

  const displayCurrency = showInINR ? 'INR' : source.currency
  const isPositive = sourceGain >= 0
  const hasGains = sourceGainPercent !== null

  // Get logo from sourceType
  const sourceTypeInfo = sourceTypes.find((st) => st.code === source.sourceType)
  const logoPath = sourceTypeInfo?.logo || null

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div
        className={cn(
          'group relative overflow-hidden rounded-xl border transition-colors',
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
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>

          <SourceLogo logoPath={logoPath} institution={source.institution} />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold">{source.sourceName}</h3>
              {holdings.length > 0 && (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {holdings.length}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {getSourceTypeLabel(source.sourceType)}
              {source.accountIdentifier && (
                <>
                  <span className="mx-1.5 opacity-50">·</span>
                  <span className="font-mono text-xs">{source.accountIdentifier}</span>
                </>
              )}
            </p>
          </div>

          {/* Value & Gains */}
          <div className="hidden text-right sm:block">
            <div className="font-mono text-lg font-semibold">
              {formatCurrency(sourceTotal, displayCurrency)}
            </div>
            {hasGains ? (
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
                  {formatCurrency(sourceGain, displayCurrency)}
                </span>
                <span className="text-xs opacity-75">({formatPercentage(sourceGainPercent)})</span>
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
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onAddHolding}>
                <Plus className="mr-2 h-4 w-4" />
                Add Holding
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEditSource}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Source
              </DropdownMenuItem>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Source
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Source?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will delete the source and all its holdings. This action cannot be
                      undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={onDeleteSource}
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
              {formatCurrency(sourceTotal, displayCurrency)}
            </span>
          </div>
          {hasGains && (
            <div className="mt-1 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Gain/Loss</span>
              <span
                className={cn(
                  'flex items-center gap-1 font-mono text-sm font-medium',
                  isPositive ? 'text-positive' : 'text-negative'
                )}
              >
                {isPositive ? '+' : ''}
                {formatCurrency(sourceGain, displayCurrency)} ({formatPercentage(sourceGainPercent)}
                )
              </span>
            </div>
          )}
        </div>

        {/* Holdings */}
        <CollapsibleContent>
          <div className="border-t border-[var(--border-subtle)]">
            {holdings.length > 0 ? (
              <div className="divide-y divide-[var(--border-subtle)]">
                {holdings.map((holding) => (
                  <HoldingRow
                    key={holding.id}
                    holding={holding}
                    holdingTypes={holdingTypes}
                    formatCurrency={formatCurrency}
                    formatPercentage={formatPercentage}
                    showInINR={showInINR}
                    convertToINR={convertToINR}
                    onEdit={() => onEditHolding(holding)}
                    onDelete={() => onDeleteHolding(holding.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-elevated)] border border-[var(--border-subtle)]">
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">No holdings in this source</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={onAddHolding}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Holding
                </Button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
