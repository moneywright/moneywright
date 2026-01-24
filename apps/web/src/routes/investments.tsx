import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { AppLayout } from '@/components/domain/app-layout'
import { ProfileSelector } from '@/components/domain/profile-selector'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  Briefcase,
  Upload,
  RefreshCw,
  LayoutGrid,
  List,
  History,
  Loader2,
} from 'lucide-react'
import { StatCardGridSkeleton, CardSkeleton } from '@/components/ui/skeleton'
import type { InvestmentSource, InvestmentHolding } from '@/lib/api'
import {
  useAuth,
  useInvestmentTypes,
  useInvestmentSources,
  useInvestmentHoldings,
  useInvestmentSummary,
  useInvestmentSnapshots,
  useDeleteSource,
  useDeleteHolding,
  useDeleteSnapshot,
  useFxRates,
  useCurrencyConverter,
  useConstants,
} from '@/hooks'
import {
  PortfolioStats,
  SourceCard,
  HoldingsTable,
  SnapshotRow,
  SourceForm,
  HoldingForm,
} from '@/components/investments'
import { EmptyState } from '@/components/ui/empty-state'

export const Route = createFileRoute('/investments')({
  component: InvestmentsPage,
})

function InvestmentsPage() {
  const queryClient = useQueryClient()
  const { defaultProfile } = useAuth()
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [showAddSourceDialog, setShowAddSourceDialog] = useState(false)
  const [showAddHoldingDialog, setShowAddHoldingDialog] = useState(false)
  const [editingSource, setEditingSource] = useState<InvestmentSource | null>(null)
  const [editingHolding, setEditingHolding] = useState<InvestmentHolding | null>(null)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set())
  const [showInINR, setShowInINR] = useState(true)

  // Use default profile if none selected
  const activeProfileId = selectedProfileId || defaultProfile?.id

  // Query hooks
  const { data: typesData } = useInvestmentTypes()
  const { rawInvestmentSourceTypes } = useConstants()
  const { data: sources, isLoading: sourcesLoading } = useInvestmentSources(activeProfileId)
  const { data: holdings, isLoading: holdingsLoading } = useInvestmentHoldings(activeProfileId)
  const { data: summary, isLoading: summaryLoading } = useInvestmentSummary(activeProfileId)
  const { data: snapshots, isLoading: snapshotsLoading } = useInvestmentSnapshots(activeProfileId, {
    limit: 50,
  })

  // Check if we have any non-INR holdings
  const hasMultipleCurrencies = holdings?.some((h) => h.currency !== 'INR')

  // FX rates for currency conversion
  const { data: fxRatesData, isLoading: fxRatesLoading } = useFxRates('USD', {
    enabled: showInINR && hasMultipleCurrencies,
  })

  // Currency converter
  const { formatCurrency, formatPercentage } = useCurrencyConverter(showInINR)

  // Build FX rates map
  const fxRates: Record<string, number> = {}
  if (fxRatesData?.success && fxRatesData.data?.rates) {
    fxRates['USD'] = fxRatesData.data.rates.INR || 83
    fxRates['EUR'] = (fxRatesData.data.rates.INR || 83) / (fxRatesData.data.rates.EUR || 0.92)
    fxRates['GBP'] = (fxRatesData.data.rates.INR || 83) / (fxRatesData.data.rates.GBP || 0.79)
    fxRates['INR'] = 1
  }

  // Local convertToINR that uses local fxRates
  const localConvertToINR = (amount: number, currency: string): number => {
    if (!showInINR || currency === 'INR') return amount
    const rate = fxRates[currency]
    if (rate) return amount * rate
    return amount
  }

  // Use rawInvestmentSourceTypes from constants (includes logo paths)
  const sourceTypes = rawInvestmentSourceTypes
  const holdingTypes = typesData?.holdingTypes || []

  // Group holdings by source
  const holdingsBySource = holdings?.reduce(
    (acc, holding) => {
      if (!acc[holding.sourceId]) {
        acc[holding.sourceId] = []
      }
      acc[holding.sourceId]!.push(holding)
      return acc
    },
    {} as Record<string, InvestmentHolding[]>
  )

  // Mutation hooks
  const deleteSourceMutation = useDeleteSource(activeProfileId)
  const deleteHoldingMutation = useDeleteHolding(activeProfileId)
  const deleteSnapshotMutation = useDeleteSnapshot(activeProfileId)

  const getSourceTypeLabel = (code: string) => {
    return sourceTypes.find((t) => t.code === code)?.label || code.replace(/_/g, ' ')
  }

  const toggleSource = (sourceId: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev)
      if (next.has(sourceId)) {
        next.delete(sourceId)
      } else {
        next.add(sourceId)
      }
      return next
    })
  }

  const handleAddHolding = (sourceId: string) => {
    setSelectedSourceId(sourceId)
    setShowAddHoldingDialog(true)
  }

  // Calculate totals - only include holdings with valid invested value for gain calculations
  const calcTotals = holdings?.reduce(
    (acc, h) => {
      const currentConverted = localConvertToINR(h.currentValue, h.currency)
      const hasValidInvested = h.investedValue !== null && h.investedValue > 0
      const investedConverted = hasValidInvested
        ? localConvertToINR(h.investedValue!, h.currency)
        : 0
      const currentForGain = hasValidInvested ? currentConverted : 0

      return {
        totalCurrent: acc.totalCurrent + currentConverted,
        totalInvested: acc.totalInvested + investedConverted,
        totalCurrentWithInvested: acc.totalCurrentWithInvested + currentForGain,
      }
    },
    { totalCurrent: 0, totalInvested: 0, totalCurrentWithInvested: 0 }
  ) || { totalCurrent: 0, totalInvested: 0, totalCurrentWithInvested: 0 }

  const totalGainLoss = calcTotals.totalCurrentWithInvested - calcTotals.totalInvested
  const gainLossPercent =
    calcTotals.totalInvested > 0 ? (totalGainLoss / calcTotals.totalInvested) * 100 : null

  const isLoading = sourcesLoading || holdingsLoading

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title="Investments"
          description="Track your investment portfolio"
          actions={
            <>
              {hasMultipleCurrencies && (
                <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-card/50 px-3 py-2">
                  <Label
                    htmlFor="show-inr"
                    className="cursor-pointer text-sm text-muted-foreground"
                  >
                    Show in INR
                  </Label>
                  <Switch id="show-inr" checked={showInINR} onCheckedChange={setShowInINR} />
                  {showInINR && fxRatesLoading && (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  )}
                </div>
              )}
              <ProfileSelector
                selectedProfileId={activeProfileId || null}
                onProfileChange={(profile) => setSelectedProfileId(profile.id)}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setShowAddSourceDialog(true)}>
                    <Briefcase className="mr-2 h-4 w-4" />
                    New Source
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/statements">
                      <Upload className="mr-2 h-4 w-4" />
                      Import Statement
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
        />

        {/* Portfolio Stats */}
        {summary && !summaryLoading && (
          <PortfolioStats
            totalCurrent={calcTotals.totalCurrent}
            totalInvested={calcTotals.totalInvested}
            totalGainLoss={totalGainLoss}
            gainLossPercent={gainLossPercent}
            currency="INR"
            isLoading={summaryLoading}
          />
        )}

        {/* Add Source Dialog */}
        <Dialog
          open={showAddSourceDialog || !!editingSource}
          onOpenChange={(open) => {
            if (!open) {
              setShowAddSourceDialog(false)
              setEditingSource(null)
            }
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingSource ? 'Edit Source' : 'Add Investment Source'}</DialogTitle>
              <DialogDescription>
                {editingSource
                  ? 'Update the investment source details'
                  : 'Add a new investment source like a brokerage or mutual fund platform'}
              </DialogDescription>
            </DialogHeader>
            {activeProfileId && (
              <SourceForm
                source={editingSource}
                profileId={activeProfileId}
                sourceTypes={sourceTypes}
                onClose={() => {
                  setShowAddSourceDialog(false)
                  setEditingSource(null)
                }}
                onSuccess={() => {
                  setShowAddSourceDialog(false)
                  setEditingSource(null)
                  queryClient.invalidateQueries({ queryKey: ['investments'] })
                }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Add Holding Dialog */}
        <Dialog
          open={showAddHoldingDialog || !!editingHolding}
          onOpenChange={(open) => {
            if (!open) {
              setShowAddHoldingDialog(false)
              setEditingHolding(null)
              setSelectedSourceId(null)
            }
          }}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingHolding ? 'Edit Holding' : 'Add Holding'}</DialogTitle>
              <DialogDescription>
                {editingHolding
                  ? 'Update the holding details'
                  : 'Add a new investment holding to this source'}
              </DialogDescription>
            </DialogHeader>
            {(selectedSourceId || editingHolding?.sourceId) && (
              <HoldingForm
                holding={editingHolding}
                sourceId={selectedSourceId || editingHolding!.sourceId}
                holdingTypes={holdingTypes}
                sources={sources || []}
                onClose={() => {
                  setShowAddHoldingDialog(false)
                  setEditingHolding(null)
                  setSelectedSourceId(null)
                }}
                onSuccess={() => {
                  setShowAddHoldingDialog(false)
                  setEditingHolding(null)
                  setSelectedSourceId(null)
                  queryClient.invalidateQueries({ queryKey: ['investments'] })
                }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Main Content */}
        {isLoading ? (
          <div className="space-y-6">
            <StatCardGridSkeleton />
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          </div>
        ) : sources && sources.length > 0 ? (
          <Tabs defaultValue="by-source" className="space-y-6">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="by-source" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">By Source</span>
              </TabsTrigger>
              <TabsTrigger value="all-holdings" className="gap-2">
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">All Holdings</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">History</span>
              </TabsTrigger>
            </TabsList>

            {/* By Source View */}
            <TabsContent value="by-source">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sources.map((source) => {
                  const sourceHoldings = holdingsBySource?.[source.id] || []
                  return (
                    <SourceCard
                      key={source.id}
                      source={source}
                      holdings={sourceHoldings}
                      holdingTypes={holdingTypes}
                      sourceTypes={sourceTypes}
                      isExpanded={expandedSources.has(source.id)}
                      onToggle={() => toggleSource(source.id)}
                      onAddHolding={() => handleAddHolding(source.id)}
                      onEditSource={() => setEditingSource(source)}
                      onDeleteSource={() => deleteSourceMutation.mutate(source.id)}
                      onEditHolding={setEditingHolding}
                      onDeleteHolding={(id) => deleteHoldingMutation.mutate(id)}
                      formatCurrency={formatCurrency}
                      formatPercentage={formatPercentage}
                      showInINR={showInINR}
                      convertToINR={localConvertToINR}
                      getSourceTypeLabel={getSourceTypeLabel}
                    />
                  )
                })}
              </div>
            </TabsContent>

            {/* All Holdings View */}
            <TabsContent value="all-holdings">
              <HoldingsTable
                holdings={holdings || []}
                sources={sources}
                holdingTypes={holdingTypes}
                formatCurrency={formatCurrency}
                formatPercentage={formatPercentage}
                showInINR={showInINR}
                convertToINR={localConvertToINR}
                onEditHolding={setEditingHolding}
                onDeleteHolding={(id) => deleteHoldingMutation.mutate(id)}
              />
            </TabsContent>

            {/* History View */}
            <TabsContent value="history" className="space-y-4">
              {snapshotsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : snapshots && snapshots.length > 0 ? (
                snapshots.map((snapshot) => {
                  const source = sources?.find((s) => s.id === snapshot.sourceId)
                  return (
                    <SnapshotRow
                      key={snapshot.id}
                      snapshot={snapshot}
                      sourceName={source?.sourceName}
                      formatCurrency={formatCurrency}
                      formatPercentage={formatPercentage}
                      onDelete={() => deleteSnapshotMutation.mutate(snapshot.id)}
                    />
                  )
                })
              ) : (
                <div className="rounded-xl border border-dashed border-border-subtle bg-card">
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="h-14 w-14 rounded-full bg-surface-elevated border border-border-subtle flex items-center justify-center mb-4">
                      <History className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">
                      No snapshot history yet
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                      Snapshots are created when you import investment statements
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <EmptyState
            icon={Briefcase}
            title="No investment sources yet"
            description="Add an investment source like a brokerage account, or upload an investment statement to start tracking your portfolio."
            action={{
              label: 'Add Source',
              onClick: () => setShowAddSourceDialog(true),
              icon: Plus,
            }}
            secondaryAction={{
              label: 'Upload Statement',
              href: '/statements?upload=true',
              icon: Upload,
            }}
          />
        )}
      </div>
    </AppLayout>
  )
}
