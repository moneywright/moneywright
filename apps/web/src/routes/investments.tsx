import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AppLayout } from '@/components/domain/app-layout'
import { ProfileSelector } from '@/components/domain/profile-selector'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import {
  Loader2,
  Plus,
  TrendingUp,
  TrendingDown,
  MoreVertical,
  Pencil,
  Trash2,
  X,
  PiggyBank,
  Landmark,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import {
  getInvestments,
  getInvestmentTypes,
  getInvestmentSummary,
  createInvestment,
  updateInvestment,
  deleteInvestment as deleteInvestmentApi,
  type Investment,
  type InvestmentType,
} from '@/lib/api'
import { useProfiles } from '@/hooks/useAuthStatus'

export const Route = createFileRoute('/investments')({
  component: InvestmentsPage,
})

function InvestmentsPage() {
  const queryClient = useQueryClient()
  const { profiles, defaultProfile } = useProfiles()
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null)

  // Use default profile if none selected
  const activeProfileId = selectedProfileId || defaultProfile?.id

  // Fetch investments
  const { data: investments, isLoading: investmentsLoading } = useQuery({
    queryKey: ['investments', activeProfileId],
    queryFn: () => getInvestments(activeProfileId),
    enabled: !!activeProfileId,
  })

  // Fetch investment types
  const { data: typesData } = useQuery({
    queryKey: ['investment-types'],
    queryFn: getInvestmentTypes,
  })

  // Fetch summary
  const { data: summary } = useQuery({
    queryKey: ['investment-summary', activeProfileId],
    queryFn: () => getInvestmentSummary(activeProfileId),
    enabled: !!activeProfileId,
  })

  const investmentTypes = typesData?.investmentTypes || []

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteInvestmentApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investments'] })
      queryClient.invalidateQueries({ queryKey: ['investment-summary'] })
      toast.success('Investment deleted')
    },
    onError: () => {
      toast.error('Failed to delete investment')
    },
  })

  const getInvestmentTypeLabel = (code: string) => {
    return investmentTypes.find((t) => t.code === code)?.label || code.replace(/_/g, ' ')
  }

  const formatCurrency = (amount: number | null, currency: string) => {
    if (amount === null) return '-'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}%`
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Investments</h1>
            <p className="text-muted-foreground">Track your investment portfolio</p>
          </div>
          <div className="flex items-center gap-4">
            <ProfileSelector
              profiles={profiles || []}
              selectedProfileId={activeProfileId || ''}
              onProfileChange={setSelectedProfileId}
            />
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Investment
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {formatCurrency(summary.totalCurrentValue, 'USD')}
                </div>
                <p className="text-xs text-muted-foreground">Current Value</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {formatCurrency(summary.totalPurchaseValue, 'USD')}
                </div>
                <p className="text-xs text-muted-foreground">Purchase Value</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div
                  className={`text-2xl font-bold flex items-center gap-2 ${
                    summary.totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {summary.totalGainLoss >= 0 ? (
                    <TrendingUp className="h-5 w-5" />
                  ) : (
                    <TrendingDown className="h-5 w-5" />
                  )}
                  {formatCurrency(Math.abs(summary.totalGainLoss), 'USD')}
                </div>
                <p className="text-xs text-muted-foreground">
                  {summary.totalGainLoss >= 0 ? 'Total Gain' : 'Total Loss'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div
                  className={`text-2xl font-bold ${
                    summary.gainLossPercentage >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {formatPercentage(summary.gainLossPercentage)}
                </div>
                <p className="text-xs text-muted-foreground">Returns</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Add/Edit Form */}
        {(showAddForm || editingInvestment) && (
          <InvestmentForm
            investment={editingInvestment}
            profileId={activeProfileId!}
            investmentTypes={investmentTypes}
            onClose={() => {
              setShowAddForm(false)
              setEditingInvestment(null)
            }}
            onSuccess={() => {
              setShowAddForm(false)
              setEditingInvestment(null)
              queryClient.invalidateQueries({ queryKey: ['investments'] })
              queryClient.invalidateQueries({ queryKey: ['investment-summary'] })
            }}
          />
        )}

        {/* Investments List */}
        {investmentsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : investments && investments.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {investments.map((investment) => {
              const gainLoss =
                investment.currentValue && investment.purchaseValue
                  ? investment.currentValue - investment.purchaseValue
                  : null
              const gainLossPercent =
                gainLoss !== null && investment.purchaseValue
                  ? (gainLoss / investment.purchaseValue) * 100
                  : null

              return (
                <Card key={investment.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-muted p-2">
                          {investment.type.includes('stock') ||
                          investment.type.includes('mutual') ? (
                            <TrendingUp className="h-5 w-5" />
                          ) : investment.type.includes('deposit') ||
                            investment.type.includes('ppf') ? (
                            <PiggyBank className="h-5 w-5" />
                          ) : (
                            <Landmark className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-base">{investment.name}</CardTitle>
                          <CardDescription>
                            {getInvestmentTypeLabel(investment.type)}
                            {investment.institution && ` • ${investment.institution}`}
                          </CardDescription>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingInvestment(investment)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                className="text-destructive"
                                onSelect={(e) => e.preventDefault()}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Investment?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => deleteMutation.mutate(investment.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {investment.currentValue !== null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Current Value</span>
                          <span className="font-semibold">
                            {formatCurrency(investment.currentValue, investment.currency)}
                          </span>
                        </div>
                      )}
                      {investment.purchaseValue !== null && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Purchase Value</span>
                          <span>
                            {formatCurrency(investment.purchaseValue, investment.currency)}
                          </span>
                        </div>
                      )}
                      {gainLoss !== null && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Gain/Loss</span>
                          <span className={gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {gainLoss >= 0 ? '+' : ''}
                            {formatCurrency(gainLoss, investment.currency)}
                            {gainLossPercent !== null && ` (${formatPercentage(gainLossPercent)})`}
                          </span>
                        </div>
                      )}
                      {investment.units !== null && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Units</span>
                          <span>{investment.units}</span>
                        </div>
                      )}
                      {investment.interestRate !== null && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Interest Rate</span>
                          <span>{investment.interestRate}%</span>
                        </div>
                      )}
                      {investment.maturityDate && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Maturity</span>
                          <span>{new Date(investment.maturityDate).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <PiggyBank className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">No investments yet</h3>
                <p className="mt-2 text-muted-foreground">
                  Start tracking your investments by adding them manually
                </p>
                <Button className="mt-4" onClick={() => setShowAddForm(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Investment
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  )
}

// Investment Form Component
function InvestmentForm({
  investment,
  profileId,
  investmentTypes,
  onClose,
  onSuccess,
}: {
  investment: Investment | null
  profileId: string
  investmentTypes: InvestmentType[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [type, setType] = useState(investment?.type || '')
  const [name, setName] = useState(investment?.name || '')
  const [institution, setInstitution] = useState(investment?.institution || '')
  const [units, setUnits] = useState(investment?.units?.toString() || '')
  const [purchaseValue, setPurchaseValue] = useState(investment?.purchaseValue?.toString() || '')
  const [currentValue, setCurrentValue] = useState(investment?.currentValue?.toString() || '')
  const [currency, setCurrency] = useState(investment?.currency || 'USD')
  const [folioNumber, setFolioNumber] = useState(investment?.folioNumber || '')
  const [maturityDate, setMaturityDate] = useState(investment?.maturityDate || '')
  const [interestRate, setInterestRate] = useState(investment?.interestRate?.toString() || '')
  const [notes, setNotes] = useState(investment?.notes || '')

  const createMutation = useMutation({
    mutationFn: createInvestment,
    onSuccess: () => {
      toast.success('Investment added')
      onSuccess()
    },
    onError: () => {
      toast.error('Failed to add investment')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateInvestment>[1]) =>
      updateInvestment(investment!.id, data),
    onSuccess: () => {
      toast.success('Investment updated')
      onSuccess()
    },
    onError: () => {
      toast.error('Failed to update investment')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!type || !name) {
      toast.error('Please fill in required fields')
      return
    }

    const data = {
      profileId,
      type,
      name,
      currency,
      institution: institution || null,
      units: units ? parseFloat(units) : null,
      purchaseValue: purchaseValue ? parseFloat(purchaseValue) : null,
      currentValue: currentValue ? parseFloat(currentValue) : null,
      folioNumber: folioNumber || null,
      maturityDate: maturityDate || null,
      interestRate: interestRate ? parseFloat(interestRate) : null,
      notes: notes || null,
    }

    if (investment) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{investment ? 'Edit Investment' : 'Add Investment'}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="type">Investment Type *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {investmentTypes.map((t) => (
                    <SelectItem key={t.code} value={t.code}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency *</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="INR">INR</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name / Scheme *</Label>
            <Input
              id="name"
              placeholder="e.g., HDFC Top 100 Fund, Reliance Industries"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="institution">Institution / Broker</Label>
            <Input
              id="institution"
              placeholder="e.g., Zerodha, HDFC AMC"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="units">Units / Quantity</Label>
              <Input
                id="units"
                type="number"
                step="0.0001"
                placeholder="0"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchaseValue">Purchase Value</Label>
              <Input
                id="purchaseValue"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={purchaseValue}
                onChange={(e) => setPurchaseValue(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currentValue">Current Value</Label>
              <Input
                id="currentValue"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="folioNumber">Folio Number</Label>
              <Input
                id="folioNumber"
                placeholder="Optional"
                value={folioNumber}
                onChange={(e) => setFolioNumber(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maturityDate">Maturity Date</Label>
              <Input
                id="maturityDate"
                type="date"
                value={maturityDate}
                onChange={(e) => setMaturityDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="interestRate">Interest Rate (%)</Label>
              <Input
                id="interestRate"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              placeholder="Additional notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {investment ? 'Updating...' : 'Adding...'}
                </>
              ) : investment ? (
                'Update Investment'
              ) : (
                'Add Investment'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
