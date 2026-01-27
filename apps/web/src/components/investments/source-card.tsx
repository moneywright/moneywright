import { useState } from 'react'
import {
  Building2,
  MoreVertical,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  ChevronRight,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { HoldingRow } from './holding-row'
import { cn } from '@/lib/utils'
import { ProfileBadge } from '@/components/ui/profile-badge'
import type {
  InvestmentSource,
  InvestmentHolding,
  InvestmentHoldingType,
  InvestmentSourceType,
  Profile,
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
  /** Profiles list for showing profile badge in family view */
  profiles?: Profile[]
  /** Whether to show profile badge (family view mode) */
  showProfileBadge?: boolean
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
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-elevated border border-border-subtle">
      {logoPath && !logoError ? (
        <img
          src={logoPath}
          alt={institution || ''}
          className="h-5 w-5 object-contain"
          onError={() => setLogoError(true)}
        />
      ) : (
        <Building2 className="h-4 w-4 text-muted-foreground" />
      )}
    </div>
  )
}

export function SourceCard({
  source,
  holdings,
  holdingTypes,
  sourceTypes,
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
  profiles,
  showProfileBadge,
}: SourceCardProps) {
  const [showHoldings, setShowHoldings] = useState(false)

  // Calculate totals
  const sourceTotal = holdings.reduce((sum, h) => sum + convertToINR(h.currentValue, h.currency), 0)

  // For gain calculation, only consider holdings with investedValue
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
  const sourceTypeLabel = getSourceTypeLabel(source.sourceType)

  return (
    <>
      <div
        className={cn(
          'group relative rounded-xl border bg-card p-4 transition-colors hover:border-border-hover',
          'border-border-subtle'
        )}
      >
        {/* Header: Logo + Name + Actions */}
        <div className="flex items-start gap-3 mb-4">
          <SourceLogo logoPath={logoPath} institution={source.institution} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm truncate">{source.sourceName}</h3>
              {showProfileBadge && profiles && (
                <ProfileBadge profileId={source.profileId} profiles={profiles} />
              )}
            </div>
            <p className="text-xs text-muted-foreground">{sourceTypeLabel}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
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
                    Delete
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

        {/* Value */}
        <div className="mb-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Current Value
          </p>
          <p className="text-xl font-semibold">{formatCurrency(sourceTotal, displayCurrency)}</p>
        </div>

        {/* Gains */}
        <div className="flex items-center justify-between">
          {hasGains ? (
            <div
              className={cn(
                'flex items-center gap-1.5 text-sm',
                isPositive ? 'text-positive' : 'text-negative'
              )}
            >
              {isPositive ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              <span className="font-medium">
                {isPositive ? '+' : ''}
                {formatCurrency(sourceGain, displayCurrency)}
              </span>
              <span className="text-xs opacity-80">({formatPercentage(sourceGainPercent)})</span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>

        {/* Holdings count + View button */}
        <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {holdings.length} {holdings.length === 1 ? 'holding' : 'holdings'}
          </span>
          {holdings.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => setShowHoldings(true)}
            >
              View
              <ChevronRight className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Holdings Dialog */}
      <Dialog open={showHoldings} onOpenChange={setShowHoldings}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <SourceLogo logoPath={logoPath} institution={source.institution} />
              <div>
                <span>{source.sourceName}</span>
                <p className="text-sm font-normal text-muted-foreground">{sourceTypeLabel}</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            {holdings.length > 0 ? (
              <div className="divide-y divide-border-subtle">
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
              <div className="py-12 text-center text-muted-foreground">
                No holdings in this source
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
