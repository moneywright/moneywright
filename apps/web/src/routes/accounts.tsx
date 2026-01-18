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
  Building2,
  CreditCard,
  Wallet,
  MoreVertical,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import {
  getAccounts,
  getAccountTypes,
  createAccount,
  updateAccount,
  deleteFinancialAccount,
  type Account,
  type AccountType,
} from '@/lib/api'
import { useProfiles } from '@/hooks/useAuthStatus'

export const Route = createFileRoute('/accounts')({
  component: AccountsPage,
})

function AccountsPage() {
  const queryClient = useQueryClient()
  const { profiles, defaultProfile } = useProfiles()
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)

  // Use default profile if none selected
  const activeProfileId = selectedProfileId || defaultProfile?.id

  // Fetch accounts
  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts', activeProfileId],
    queryFn: () => getAccounts(activeProfileId),
    enabled: !!activeProfileId,
  })

  // Fetch account types
  const { data: accountTypes } = useQuery({
    queryKey: ['account-types'],
    queryFn: getAccountTypes,
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteFinancialAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      toast.success('Account deleted')
    },
    onError: () => {
      toast.error('Failed to delete account')
    },
  })

  const getAccountIcon = (type: string) => {
    if (type.includes('credit')) return <CreditCard className="h-5 w-5" />
    if (type.includes('savings') || type.includes('checking')) return <Wallet className="h-5 w-5" />
    return <Building2 className="h-5 w-5" />
  }

  const getAccountTypeLabel = (code: string) => {
    return accountTypes?.find((t) => t.code === code)?.label || code.replace(/_/g, ' ')
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Accounts</h1>
            <p className="text-muted-foreground">Manage your financial accounts</p>
          </div>
          <div className="flex items-center gap-4">
            <ProfileSelector
              profiles={profiles || []}
              selectedProfileId={activeProfileId || ''}
              onProfileChange={setSelectedProfileId}
            />
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </div>
        </div>

        {/* Add/Edit Form */}
        {(showAddForm || editingAccount) && (
          <AccountForm
            account={editingAccount}
            profileId={activeProfileId!}
            accountTypes={accountTypes || []}
            onClose={() => {
              setShowAddForm(false)
              setEditingAccount(null)
            }}
            onSuccess={() => {
              setShowAddForm(false)
              setEditingAccount(null)
              queryClient.invalidateQueries({ queryKey: ['accounts'] })
            }}
          />
        )}

        {/* Accounts List */}
        {accountsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : accounts && accounts.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => (
              <Card key={account.id} className={!account.isActive ? 'opacity-60' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-muted p-2">{getAccountIcon(account.type)}</div>
                      <div>
                        <CardTitle className="text-base">
                          {account.accountName || getAccountTypeLabel(account.type)}
                        </CardTitle>
                        <CardDescription>{account.institution || 'No institution'}</CardDescription>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingAccount(account)}>
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
                              <AlertDialogTitle>Delete Account?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will delete all statements and transactions associated with
                                this account. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => deleteMutation.mutate(account.id)}
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
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span>{getAccountTypeLabel(account.type)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Currency</span>
                      <span>{account.currency}</span>
                    </div>
                    {account.accountNumber && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Account</span>
                        <span>****{account.accountNumber.slice(-4)}</span>
                      </div>
                    )}
                    {!account.isActive && (
                      <div className="mt-2 text-xs text-muted-foreground">Inactive</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">No accounts yet</h3>
                <p className="mt-2 text-muted-foreground">
                  Add an account manually or upload a statement to get started
                </p>
                <Button className="mt-4" onClick={() => setShowAddForm(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Account
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  )
}

// Account Form Component
function AccountForm({
  account,
  profileId,
  accountTypes,
  onClose,
  onSuccess,
}: {
  account: Account | null
  profileId: string
  accountTypes: AccountType[]
  onClose: () => void
  onSuccess: () => void
}) {
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
      // Update
      updateMutation.mutate({
        accountName: accountName || undefined,
        institution: institution || null,
        isActive,
      })
    } else {
      // Create
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
