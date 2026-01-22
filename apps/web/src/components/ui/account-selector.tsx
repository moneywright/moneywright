import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CreditCard, Building2, Check, ChevronDown, Search, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useConstants } from '@/hooks/useConstants'
import type { Account } from '@/lib/api'

export interface AccountSelectorProps {
  accounts: Account[]
  /** Single-select: selected account ID */
  value?: string | null
  /** Single-select: callback when selection changes */
  onValueChange?: (accountId: string | null) => void
  /** Multi-select: selected account IDs */
  values?: string[]
  /** Multi-select: callback when selection changes */
  onValuesChange?: (accountIds: string[]) => void
  /** Selection mode */
  mode?: 'single' | 'multi'
  /** Show "All accounts" option */
  showAllOption?: boolean
  /** Label for "All accounts" option */
  allOptionLabel?: string
  /** Placeholder when nothing selected */
  placeholder?: string
  /** Enable search when many accounts */
  searchable?: boolean
  /** Group accounts by type */
  groupByType?: boolean
  /** Show institution logos */
  showInstitutionLogo?: boolean
  /** Additional class name for wrapper */
  className?: string
  /** Additional class name for trigger button */
  triggerClassName?: string
  /** Popover alignment */
  align?: 'start' | 'center' | 'end'
  /** Compact trigger (no text, just icon) */
  compact?: boolean
}

export function AccountSelector({
  accounts,
  value,
  onValueChange,
  values = [],
  onValuesChange,
  mode = 'single',
  showAllOption = true,
  allOptionLabel = 'All accounts',
  placeholder = 'Select account',
  searchable = true,
  groupByType = true,
  showInstitutionLogo = true,
  className,
  triggerClassName,
  align = 'start',
  compact = false,
}: AccountSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const { rawInstitutions, institutions } = useConstants()

  // Build institution logo map
  const institutionLogos = useMemo(() => {
    const map: Record<string, string> = {}
    for (const inst of rawInstitutions) {
      if (inst.logo) {
        map[inst.id] = inst.logo
      }
    }
    return map
  }, [rawInstitutions])

  // Get institution display name from ID
  const getInstitutionName = (institutionId: string | null | undefined): string | undefined => {
    if (!institutionId) return undefined
    return institutions[institutionId] || institutionId
  }

  // Filter accounts by search
  const filteredAccounts = useMemo(() => {
    if (!search.trim()) return accounts
    const searchLower = search.toLowerCase()
    return accounts.filter(
      (account) =>
        account.accountName?.toLowerCase().includes(searchLower) ||
        account.institution?.toLowerCase().includes(searchLower) ||
        account.productName?.toLowerCase().includes(searchLower) ||
        account.type.toLowerCase().includes(searchLower)
    )
  }, [accounts, search])

  // Group accounts by type
  const groupedAccounts = useMemo(() => {
    if (!groupByType) {
      return { all: filteredAccounts }
    }

    const creditCards = filteredAccounts.filter((a) => a.type === 'credit_card')
    const bankAccounts = filteredAccounts.filter((a) => a.type !== 'credit_card')

    return {
      creditCards,
      bankAccounts,
    }
  }, [filteredAccounts, groupByType])

  // Get selected account(s) for display
  const selectedAccounts = useMemo(() => {
    if (mode === 'single') {
      return value ? accounts.filter((a) => a.id === value) : []
    }
    return accounts.filter((a) => values.includes(a.id))
  }, [accounts, mode, value, values])

  // Check if account is selected
  const isSelected = (accountId: string) => {
    if (mode === 'single') {
      return value === accountId
    }
    return values.includes(accountId)
  }

  // Handle selection
  const handleSelect = (accountId: string | null) => {
    if (mode === 'single') {
      onValueChange?.(accountId)
      setOpen(false)
    } else {
      if (accountId === null) {
        // Clear all
        onValuesChange?.([])
      } else {
        const newValues = values.includes(accountId)
          ? values.filter((id) => id !== accountId)
          : [...values, accountId]
        onValuesChange?.(newValues)
      }
    }
  }

  // Format account display - returns { label, subtitle } based on account type
  const getAccountDisplay = (account: Account): { label: string; subtitle?: string } => {
    const lastFour = account.accountNumber?.slice(-4)
    const institutionName = getInstitutionName(account.institution)

    if (account.type === 'credit_card') {
      // Credit cards: Product name (last 4) / Institution name
      const name = account.productName || account.accountName || 'Credit Card'
      const label = lastFour ? `${name} (${lastFour})` : name
      return {
        label,
        subtitle: institutionName,
      }
    } else {
      // Bank accounts: Institution name / Account type · •••• last4
      const label = institutionName || account.accountName || 'Bank Account'
      const accountType = account.productName || 'Savings Account'
      const subtitle = lastFour ? `${accountType} · •••• ${lastFour}` : accountType
      return {
        label,
        subtitle,
      }
    }
  }

  // Simple display name for trigger button
  const getAccountDisplayName = (account: Account) => {
    const { label } = getAccountDisplay(account)
    return label
  }

  // Get trigger label
  const getTriggerLabel = () => {
    if (mode === 'single') {
      if (!value) return allOptionLabel
      const selected = selectedAccounts[0]
      if (!selected) return placeholder
      return getAccountDisplayName(selected)
    } else {
      if (values.length === 0) return allOptionLabel
      if (values.length === 1) {
        const selected = selectedAccounts[0]
        return selected ? getAccountDisplayName(selected) : '1 account'
      }
      return `${values.length} accounts`
    }
  }

  // Check if has active selection
  const hasSelection = mode === 'single' ? !!value : values.length > 0

  // Show search if searchable and more than 5 accounts
  const showSearch = searchable && accounts.length > 5

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>
          <Button
            variant={hasSelection ? 'secondary' : 'outline'}
            size="sm"
            className={cn(
              'justify-between gap-2 font-normal',
              compact ? 'h-9 w-9 p-0' : 'h-9 min-w-40',
              triggerClassName
            )}
          >
            {compact ? (
              <Building2 className="h-4 w-4" />
            ) : (
              <>
                <span className="flex items-center gap-2 truncate">
                  {hasSelection && mode === 'multi' && values.length > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                      {values.length}
                    </span>
                  )}
                  <span className="truncate">{getTriggerLabel()}</span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
              </>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align={align}>
          {/* Search */}
          {showSearch && (
            <div className="border-b border-border-subtle p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search accounts..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 pl-8 text-sm"
                />
              </div>
            </div>
          )}

          {/* Account List */}
          <div className="max-h-80 overflow-y-auto p-1.5">
            {/* All Accounts Option */}
            {showAllOption && !search && (
              <AccountItem
                label={allOptionLabel}
                icon={<Sparkles className="h-4 w-4 text-muted-foreground" />}
                isSelected={!hasSelection}
                onClick={() => handleSelect(null)}
              />
            )}

            {groupByType ? (
              <>
                {/* Credit Cards */}
                {groupedAccounts.creditCards && groupedAccounts.creditCards.length > 0 && (
                  <div className="mt-1">
                    <div className="px-2 py-1.5">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Credit Cards
                      </span>
                    </div>
                    {groupedAccounts.creditCards.map((account) => {
                      const display = getAccountDisplay(account)
                      return (
                        <AccountItem
                          key={account.id}
                          label={display.label}
                          subtitle={display.subtitle}
                          icon={
                            showInstitutionLogo &&
                            account.institution &&
                            institutionLogos[account.institution] ? (
                              <img
                                src={institutionLogos[account.institution]}
                                alt=""
                                className="h-5 w-5 rounded object-contain"
                              />
                            ) : (
                              <CreditCard className="h-4 w-4 text-muted-foreground" />
                            )
                          }
                          isSelected={isSelected(account.id)}
                          onClick={() => handleSelect(account.id)}
                        />
                      )
                    })}
                  </div>
                )}

                {/* Bank Accounts */}
                {groupedAccounts.bankAccounts && groupedAccounts.bankAccounts.length > 0 && (
                  <div className="mt-1">
                    <div className="px-2 py-1.5">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Bank Accounts
                      </span>
                    </div>
                    {groupedAccounts.bankAccounts.map((account) => {
                      const display = getAccountDisplay(account)
                      return (
                        <AccountItem
                          key={account.id}
                          label={display.label}
                          subtitle={display.subtitle}
                          icon={
                            showInstitutionLogo &&
                            account.institution &&
                            institutionLogos[account.institution] ? (
                              <img
                                src={institutionLogos[account.institution]}
                                alt=""
                                className="h-5 w-5 rounded object-contain"
                              />
                            ) : (
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                            )
                          }
                          isSelected={isSelected(account.id)}
                          onClick={() => handleSelect(account.id)}
                        />
                      )
                    })}
                  </div>
                )}
              </>
            ) : (
              /* Flat list */
              filteredAccounts.map((account) => {
                const display = getAccountDisplay(account)
                return (
                  <AccountItem
                    key={account.id}
                    label={display.label}
                    subtitle={display.subtitle}
                    icon={
                      showInstitutionLogo &&
                      account.institution &&
                      institutionLogos[account.institution] ? (
                        <img
                          src={institutionLogos[account.institution]}
                          alt=""
                          className="h-5 w-5 rounded object-contain"
                        />
                      ) : account.type === 'credit_card' ? (
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      )
                    }
                    isSelected={isSelected(account.id)}
                    onClick={() => handleSelect(account.id)}
                  />
                )
              })
            )}

            {/* Empty state */}
            {filteredAccounts.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No accounts found
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

// Individual account item component
function AccountItem({
  label,
  subtitle,
  icon,
  isSelected,
  onClick,
}: {
  label: string
  subtitle?: string
  icon: React.ReactNode
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors',
        'hover:bg-surface-hover',
        isSelected && 'bg-primary/5'
      )}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-elevated">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{label}</div>
        {subtitle && <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>}
      </div>
      {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
    </button>
  )
}
