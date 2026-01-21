import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createAccount, updateAccount, type Account, type AccountType } from '@/lib/api'

interface AccountFormProps {
  account: Account | null
  profileId: string
  accountTypes: AccountType[]
  onClose: () => void
  onSuccess: () => void
}

export function AccountForm({
  account,
  profileId,
  accountTypes,
  onClose,
  onSuccess,
}: AccountFormProps) {
  const [type, setType] = useState(account?.type || '')
  const [institution, setInstitution] = useState(account?.institution || '')
  const [accountName, setAccountName] = useState(account?.accountName || '')
  const [accountNumber, setAccountNumber] = useState('')
  const [currency, setCurrency] = useState(account?.currency || 'USD')
  const [isActive, setIsActive] = useState(account?.isActive ?? true)

  const createMutation = useMutation({
    mutationFn: createAccount,
    onSuccess: () => {
      toast.success('Account created')
      onSuccess()
    },
    onError: () => {
      toast.error('Failed to create account')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateAccount>[1]) => updateAccount(account!.id, data),
    onSuccess: () => {
      toast.success('Account updated')
      onSuccess()
    },
    onError: () => {
      toast.error('Failed to update account')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!type) {
      toast.error('Please select an account type')
      return
    }

    if (account) {
      updateMutation.mutate({
        accountName: accountName || undefined,
        institution: institution || null,
        isActive,
      })
    } else {
      createMutation.mutate({
        profileId,
        type,
        currency,
        institution: institution || null,
        accountNumber: accountNumber || null,
        accountName: accountName || null,
      })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{account ? 'Edit Account' : 'Add Account'}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="type">Account Type *</Label>
              <Select value={type} onValueChange={setType} disabled={!!account}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {accountTypes.map((t) => (
                    <SelectItem key={t.code} value={t.code}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency *</Label>
              <Select value={currency} onValueChange={setCurrency} disabled={!!account}>
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
            <Label htmlFor="institution">Institution / Bank Name</Label>
            <Input
              id="institution"
              placeholder="e.g., Chase, HDFC Bank"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountName">Account Name</Label>
            <Input
              id="accountName"
              placeholder="e.g., Primary Savings, Travel Card"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
            />
          </div>

          {!account && (
            <div className="space-y-2">
              <Label htmlFor="accountNumber">Account Number (Optional)</Label>
              <Input
                id="accountNumber"
                placeholder="Will be encrypted"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Your account number is encrypted and stored securely
              </p>
            </div>
          )}

          {account && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-input"
              />
              <Label htmlFor="isActive" className="font-normal">
                Account is active
              </Label>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {account ? 'Updating...' : 'Creating...'}
                </>
              ) : account ? (
                'Update Account'
              ) : (
                'Create Account'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
