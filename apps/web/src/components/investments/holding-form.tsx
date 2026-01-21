import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  createHolding,
  updateHolding,
  type InvestmentHolding,
  type InvestmentHoldingType,
  type InvestmentSource,
} from '@/lib/api'

interface HoldingFormProps {
  holding: InvestmentHolding | null
  sourceId: string
  holdingTypes: InvestmentHoldingType[]
  sources: InvestmentSource[]
  onClose: () => void
  onSuccess: () => void
}

export function HoldingForm({
  holding,
  sourceId,
  holdingTypes,
  sources,
  onClose,
  onSuccess,
}: HoldingFormProps) {
  const source = sources.find((s) => s.id === sourceId)
  const [investmentType, setInvestmentType] = useState(holding?.investmentType || '')
  const [name, setName] = useState(holding?.name || '')
  const [symbol, setSymbol] = useState(holding?.symbol || '')
  const [isin, setIsin] = useState(holding?.isin || '')
  const [units, setUnits] = useState(holding?.units?.toString() || '')
  const [averageCost, setAverageCost] = useState(holding?.averageCost?.toString() || '')
  const [currentPrice, setCurrentPrice] = useState(holding?.currentPrice?.toString() || '')
  const [currentValue, setCurrentValue] = useState(holding?.currentValue?.toString() || '')
  const [investedValue, setInvestedValue] = useState(holding?.investedValue?.toString() || '')
  const [currency, setCurrency] = useState(holding?.currency || source?.currency || 'INR')
  const [asOfDate, setAsOfDate] = useState(
    holding?.asOfDate || new Date().toISOString().split('T')[0]
  )
  const [folioNumber, setFolioNumber] = useState(holding?.folioNumber || '')
  const [maturityDate, setMaturityDate] = useState(holding?.maturityDate || '')
  const [interestRate, setInterestRate] = useState(holding?.interestRate?.toString() || '')

  // Auto-calculate current value from units and current price
  const handleUnitsChange = (value: string) => {
    setUnits(value)
    if (value && currentPrice) {
      const calc = parseFloat(value) * parseFloat(currentPrice)
      if (!isNaN(calc)) setCurrentValue(calc.toFixed(2))
    }
  }

  const handleCurrentPriceChange = (value: string) => {
    setCurrentPrice(value)
    if (units && value) {
      const calc = parseFloat(units) * parseFloat(value)
      if (!isNaN(calc)) setCurrentValue(calc.toFixed(2))
    }
  }

  // Auto-calculate invested value from units and average cost
  const handleAverageCostChange = (value: string) => {
    setAverageCost(value)
    if (units && value) {
      const calc = parseFloat(units) * parseFloat(value)
      if (!isNaN(calc)) setInvestedValue(calc.toFixed(2))
    }
  }

  const createMutation = useMutation({
    mutationFn: createHolding,
    onSuccess: () => {
      toast.success('Holding added')
      onSuccess()
    },
    onError: () => {
      toast.error('Failed to add holding')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateHolding>[1]) => updateHolding(holding!.id, data),
    onSuccess: () => {
      toast.success('Holding updated')
      onSuccess()
    },
    onError: () => {
      toast.error('Failed to update holding')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!investmentType || !name || !currentValue || !asOfDate) {
      toast.error('Please fill in required fields')
      return
    }

    const data = {
      sourceId,
      investmentType,
      name,
      units: units ? parseFloat(units) : null,
      currentValue: parseFloat(currentValue),
      currency,
      asOfDate,
      symbol: symbol || null,
      isin: isin || null,
      averageCost: averageCost ? parseFloat(averageCost) : null,
      currentPrice: currentPrice ? parseFloat(currentPrice) : null,
      investedValue: investedValue ? parseFloat(investedValue) : null,
      folioNumber: folioNumber || null,
      maturityDate: maturityDate || null,
      interestRate: interestRate ? parseFloat(interestRate) : null,
    }

    if (holding) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="investmentType">Investment Type *</Label>
          <Select value={investmentType} onValueChange={setInvestmentType}>
            <SelectTrigger id="investmentType" className="h-11">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {holdingTypes.map((t) => (
                <SelectItem key={t.code} value={t.code}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger id="currency" className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INR">INR</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
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
          className="h-11"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="symbol">Symbol / Ticker</Label>
          <Input
            id="symbol"
            placeholder="e.g., RELIANCE, INFY"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="isin">ISIN</Label>
          <Input
            id="isin"
            placeholder="e.g., INE002A01018"
            value={isin}
            onChange={(e) => setIsin(e.target.value)}
            className="h-11"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="units">Units / Quantity</Label>
          <Input
            id="units"
            type="number"
            step="0.0001"
            placeholder="Optional for PPF, EPF, FD"
            value={units}
            onChange={(e) => handleUnitsChange(e.target.value)}
            className="h-11 font-mono"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="averageCost">Avg Cost / Unit</Label>
          <Input
            id="averageCost"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={averageCost}
            onChange={(e) => handleAverageCostChange(e.target.value)}
            className="h-11 font-mono"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="currentPrice">Current Price</Label>
          <Input
            id="currentPrice"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={currentPrice}
            onChange={(e) => handleCurrentPriceChange(e.target.value)}
            className="h-11 font-mono"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="investedValue">Invested Value</Label>
          <Input
            id="investedValue"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={investedValue}
            onChange={(e) => setInvestedValue(e.target.value)}
            className="h-11 font-mono"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="currentValue">Current Value *</Label>
          <Input
            id="currentValue"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            className="h-11 font-mono"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="asOfDate">As of Date *</Label>
          <Input
            id="asOfDate"
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="folioNumber">Folio Number</Label>
          <Input
            id="folioNumber"
            placeholder="Optional"
            value={folioNumber}
            onChange={(e) => setFolioNumber(e.target.value)}
            className="h-11"
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
            className="h-11 font-mono"
          />
        </div>
      </div>

      {maturityDate !== undefined && (
        <div className="space-y-2">
          <Label htmlFor="maturityDate">Maturity Date</Label>
          <Input
            id="maturityDate"
            type="date"
            value={maturityDate}
            onChange={(e) => setMaturityDate(e.target.value)}
            className="h-11"
          />
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onClose} className="px-6">
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} className="px-6">
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {holding ? 'Updating...' : 'Adding...'}
            </>
          ) : holding ? (
            'Update Holding'
          ) : (
            'Add Holding'
          )}
        </Button>
      </div>
    </form>
  )
}
