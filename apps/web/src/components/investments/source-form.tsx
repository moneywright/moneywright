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
  createInvestmentSource,
  updateInvestmentSource,
  type InvestmentSource,
  type InvestmentSourceType,
} from '@/lib/api'

interface SourceFormProps {
  source: InvestmentSource | null
  profileId: string
  sourceTypes: InvestmentSourceType[]
  onClose: () => void
  onSuccess: () => void
}

export function SourceForm({
  source,
  profileId,
  sourceTypes,
  onClose,
  onSuccess,
}: SourceFormProps) {
  const [sourceType, setSourceType] = useState(source?.sourceType || '')
  const [sourceName, setSourceName] = useState(source?.sourceName || '')
  const [institution, setInstitution] = useState(source?.institution || '')
  const [accountIdentifier, setAccountIdentifier] = useState(source?.accountIdentifier || '')
  const [currency, setCurrency] = useState(source?.currency || 'INR')

  const createMutation = useMutation({
    mutationFn: createInvestmentSource,
    onSuccess: () => {
      toast.success('Investment source added')
      onSuccess()
    },
    onError: () => {
      toast.error('Failed to add investment source')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateInvestmentSource>[1]) =>
      updateInvestmentSource(source!.id, data),
    onSuccess: () => {
      toast.success('Investment source updated')
      onSuccess()
    },
    onError: () => {
      toast.error('Failed to update investment source')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!sourceType || !sourceName) {
      toast.error('Please fill in required fields')
      return
    }

    if (source) {
      updateMutation.mutate({
        sourceName,
        institution: institution || null,
        accountIdentifier: accountIdentifier || null,
        currency,
      })
    } else {
      createMutation.mutate({
        profileId,
        sourceType,
        sourceName,
        institution: institution || null,
        accountIdentifier: accountIdentifier || null,
        currency,
      })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="sourceType">Source Type *</Label>
        <Select value={sourceType} onValueChange={setSourceType} disabled={!!source}>
          <SelectTrigger id="sourceType" className="h-11">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {sourceTypes.map((t) => (
              <SelectItem key={t.code} value={t.code}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sourceName">Name *</Label>
        <Input
          id="sourceName"
          placeholder="e.g., My Zerodha Account"
          value={sourceName}
          onChange={(e) => setSourceName(e.target.value)}
          className="h-11"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="institution">Institution / Platform</Label>
          <Input
            id="institution"
            placeholder="e.g., zerodha, groww"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">Used for logo display</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="accountIdentifier">Account ID</Label>
          <Input
            id="accountIdentifier"
            placeholder="e.g., DXXX1234"
            value={accountIdentifier}
            onChange={(e) => setAccountIdentifier(e.target.value)}
            className="h-11"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="currency">Currency</Label>
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger id="currency" className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="INR">INR - Indian Rupee</SelectItem>
            <SelectItem value="USD">USD - US Dollar</SelectItem>
            <SelectItem value="EUR">EUR - Euro</SelectItem>
            <SelectItem value="GBP">GBP - British Pound</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onClose} className="px-6">
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} className="px-6">
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {source ? 'Updating...' : 'Adding...'}
            </>
          ) : source ? (
            'Update Source'
          ) : (
            'Add Source'
          )}
        </Button>
      </div>
    </form>
  )
}
