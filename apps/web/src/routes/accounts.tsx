import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AppLayout } from '@/components/domain/app-layout'
import { ProfileSelector } from '@/components/domain/profile-selector'
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
  MoreVertical,
  Pencil,
  Trash2,
  X,
  Wifi,
  Clock,
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
import { useProfiles, useAuthStatus } from '@/hooks/useAuthStatus'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/accounts')({
  component: AccountsPage,
})

function AccountsPage() {
  const queryClient = useQueryClient()
  const { profiles, defaultProfile } = useProfiles()
  const { user } = useAuthStatus()
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)

  // Use default profile if none selected
  const activeProfileId = selectedProfileId || defaultProfile?.id

  // User's country for institution logos
  const countryCode = user?.country?.toLowerCase() || 'in'

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

  // Separate credit cards from bank accounts
  const creditCards = accounts?.filter((a) => a.type === 'credit_card') || []
  const bankAccounts = accounts?.filter((a) => a.type !== 'credit_card') || []

  return (
    <AppLayout>
      <div className="space-y-8">
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

        {/* Accounts Display */}
        {accountsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : accounts && accounts.length > 0 ? (
          <div className="space-y-8">
            {/* Credit Cards Section */}
            {creditCards.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Credit Cards
                </h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {creditCards.map((account) => (
                    <CreditCardDisplay
                      key={account.id}
                      account={account}
                      countryCode={countryCode}
                      onEdit={() => setEditingAccount(account)}
                      onDelete={() => deleteMutation.mutate(account.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Bank Accounts Section */}
            {bankAccounts.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Bank Accounts
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {bankAccounts.map((account) => (
                    <BankAccountCard
                      key={account.id}
                      account={account}
                      accountTypes={accountTypes || []}
                      countryCode={countryCode}
                      onEdit={() => setEditingAccount(account)}
                      onDelete={() => deleteMutation.mutate(account.id)}
                    />
                  ))}
                </div>
              </section>
            )}
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

// Credit Card Component - Minimalist metallic neumorphic design
function CreditCardDisplay({
  account,
  countryCode,
  onEdit,
  onDelete,
}: {
  account: Account
  countryCode: string
  onEdit: () => void
  onDelete: () => void
}) {
  const [logoError, setLogoError] = useState(false)
  const logoPath = account.institution
    ? `/institutions/${countryCode}/${account.institution}.svg`
    : null

  const lastFour = account.accountNumber?.slice(-4) || '••••'

  // Use productName if available, otherwise fall back to extracting from accountName
  const displayCardName =
    account.productName ||
    (account.accountName?.includes('-') ? account.accountName.split(' - ')[1] : null) ||
    'Credit Card'

  // Format balance date
  const balanceDate = account.latestStatementDate
    ? new Date(account.latestStatementDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: account.currency || 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div
      className={cn(
        'relative aspect-[1.586/1] rounded-2xl p-5 overflow-hidden transition-all duration-300 hover:scale-[1.02]',
        // Light mode: light metallic gray
        'bg-gradient-to-br from-zinc-200 via-zinc-100 to-zinc-200',
        // Dark mode: dark charcoal
        'dark:bg-gradient-to-br dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-900',
        // Neumorphic shadow - light mode
        'shadow-[6px_6px_12px_rgba(0,0,0,0.15),-6px_-6px_12px_rgba(255,255,255,0.8)]',
        // Neumorphic shadow - dark mode
        'dark:shadow-[4px_4px_12px_rgba(0,0,0,0.6)]',
        !account.isActive && 'opacity-50'
      )}
    >
      {/* Subtle sheen - only in light mode */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-black/5 dark:from-transparent dark:to-transparent pointer-events-none" />

      {/* Top row: Logo + Card Name + Actions */}
      <div className="relative flex justify-between items-start">
        <div className="flex items-center gap-3">
          {/* Institution Logo */}
          {logoPath && !logoError ? (
            <img
              src={logoPath}
              alt={account.institution || ''}
              className="h-10 w-10 object-contain"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-zinc-300/50 dark:bg-zinc-600/50">
              <CreditCard className="h-5 w-5 text-zinc-600 dark:text-zinc-300" />
            </div>
          )}
          {/* Card Name */}
          <div>
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              {displayCardName}
            </p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              {account.institution || 'Credit Card'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-300/50 dark:hover:bg-zinc-600/50"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Card?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete all statements and transactions associated with this card. This
                    action cannot be undone.
                  </AlertDialogDescription>
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

      {/* Middle: Outstanding Balance */}
      <div className="relative mt-6">
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          {balanceDate ? `Outstanding as on ${balanceDate}` : 'Outstanding'}
        </p>
        <p className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">
          {account.latestBalance !== null ? formatCurrency(account.latestBalance) : '—'}
        </p>
      </div>

      {/* Bottom row: Currency + Last 4 digits */}
      <div className="absolute bottom-5 left-5 right-5 flex justify-between items-end">
        <div className="flex items-center gap-2">
          <Wifi className="h-4 w-4 text-zinc-400 dark:text-zinc-500 rotate-90" />
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {account.currency}
          </span>
        </div>
        <p className="text-lg font-mono font-medium text-zinc-700 dark:text-zinc-200 tracking-wider">
          •••• {lastFour}
        </p>
      </div>
    </div>
  )
}

// Bank Account Card - Minimalist neumorphic design
function BankAccountCard({
  account,
  accountTypes,
  countryCode,
  onEdit,
  onDelete,
}: {
  account: Account
  accountTypes: AccountType[]
  countryCode: string
  onEdit: () => void
  onDelete: () => void
}) {
  const [logoError, setLogoError] = useState(false)
  const logoPath = account.institution
    ? `/institutions/${countryCode}/${account.institution}.svg`
    : null

  // Check if this is a pending account (statement being processed)
  const isPending = account.accountName?.startsWith('Pending -')

  const getAccountTypeLabel = (code: string) => {
    return accountTypes?.find((t) => t.code === code)?.label || code.replace(/_/g, ' ')
  }

  const lastFour = account.accountNumber?.slice(-4) || null

  // Format balance date
  const balanceDate = account.latestStatementDate
    ? new Date(account.latestStatementDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: account.currency || 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Pending account - show processing state
  if (isPending) {
    const fileName = account.accountName?.replace('Pending - ', '') || 'Statement'
    return (
      <div
        className={cn(
          'relative rounded-2xl p-5 overflow-hidden',
          // Light mode: amber tint
          'bg-gradient-to-br from-amber-50 via-amber-50/50 to-zinc-100',
          // Dark mode: amber tint
          'dark:bg-gradient-to-br dark:from-amber-950/30 dark:via-zinc-900 dark:to-zinc-900',
          // Border to indicate pending state
          'border-2 border-dashed border-amber-300 dark:border-amber-700',
          'shadow-[4px_4px_10px_rgba(0,0,0,0.1),-4px_-4px_10px_rgba(255,255,255,0.9)]',
          'dark:shadow-[4px_4px_12px_rgba(0,0,0,0.5)]'
        )}
      >
        <div className="flex items-center gap-3">
          {/* Processing indicator */}
          <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-amber-100 dark:bg-amber-900/50 shrink-0">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 animate-pulse" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-amber-700 dark:text-amber-300 text-sm">
              Processing Statement
            </h3>
            <p className="text-xs text-amber-600/70 dark:text-amber-400/70 truncate">{fileName}</p>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
            This account will be updated once the statement is parsed. Please wait or check the
            Statements page for status.
          </p>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
          <span className="text-xs text-amber-600 dark:text-amber-400">Awaiting processing...</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative rounded-2xl p-5 overflow-hidden transition-all duration-300 hover:scale-[1.02]',
        // Light mode: clean white/gray
        'bg-gradient-to-br from-zinc-100 via-white to-zinc-100',
        // Dark mode: dark charcoal matching credit cards
        'dark:bg-gradient-to-br dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-900',
        // Neumorphic shadow - light mode
        'shadow-[4px_4px_10px_rgba(0,0,0,0.1),-4px_-4px_10px_rgba(255,255,255,0.9)]',
        // Neumorphic shadow - dark mode
        'dark:shadow-[4px_4px_12px_rgba(0,0,0,0.5)]',
        !account.isActive && 'opacity-50'
      )}
    >
      {/* Top row: Logo + Name + Last 4 digits + Actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Institution Logo */}
          {logoPath && !logoError ? (
            <img
              src={logoPath}
              alt={account.institution || ''}
              className="h-10 w-10 object-contain shrink-0"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-zinc-200/50 dark:bg-zinc-700/50 shrink-0">
              <Building2 className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
            </div>
          )}

          {/* Account Info */}
          <div className="min-w-0">
            <h3 className="font-semibold text-zinc-800 dark:text-zinc-100 truncate text-sm">
              {account.institution || 'Bank Account'}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              {getAccountTypeLabel(account.type)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Last 4 digits */}
          {lastFour && (
            <span className="text-sm font-mono font-medium text-zinc-600 dark:text-zinc-300">
              •••• {lastFour}
            </span>
          )}

          {/* Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
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
                      This will delete all statements and transactions associated with this account.
                      This action cannot be undone.
                    </AlertDialogDescription>
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
      </div>

      {/* Balance Section */}
      <div className="mt-4">
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          {balanceDate ? `Balance as on ${balanceDate}` : 'Balance'}
        </p>
        <p className="text-xl font-semibold text-zinc-800 dark:text-zinc-100 mt-0.5">
          {account.latestBalance !== null ? formatCurrency(account.latestBalance) : '—'}
        </p>
      </div>

      {/* Bottom row: Product name/Status + Currency */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {account.productName ? (
            // Show product/program name if available (e.g., "Savings Max", "Imperia")
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              {account.productName}
            </span>
          ) : (
            // Fallback to active/inactive status
            <>
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  account.isActive ? 'bg-emerald-500' : 'bg-zinc-400'
                )}
              />
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {account.isActive ? 'Active' : 'Inactive'}
              </span>
            </>
          )}
        </div>
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {account.currency}
        </span>
      </div>
    </div>
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
