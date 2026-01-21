import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Filter, Check, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import type { Account } from '@/lib/api'

export type SortOption = 'period_desc' | 'period_asc' | 'upload_desc' | 'upload_asc'

const sortOptions: { value: SortOption; label: string; icon: React.ReactNode }[] = [
  { value: 'period_desc', label: 'Period (Newest)', icon: <ArrowDown className="h-3.5 w-3.5" /> },
  { value: 'period_asc', label: 'Period (Oldest)', icon: <ArrowUp className="h-3.5 w-3.5" /> },
  {
    value: 'upload_desc',
    label: 'Upload Date (Newest)',
    icon: <ArrowDown className="h-3.5 w-3.5" />,
  },
  { value: 'upload_asc', label: 'Upload Date (Oldest)', icon: <ArrowUp className="h-3.5 w-3.5" /> },
]

interface FilterBarProps {
  accounts: Account[]
  accountFilter: string | null
  sortOrder: SortOption
  statementsCount: number
  onAccountFilterChange: (accountId: string | null) => void
  onSortChange: (sort: SortOption) => void
}

export function FilterBar({
  accounts,
  accountFilter,
  sortOrder,
  statementsCount,
  onAccountFilterChange,
  onSortChange,
}: FilterBarProps) {
  const selectedFilterAccount = accountFilter ? accounts.find((a) => a.id === accountFilter) : null

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Account Filter */}
      {accounts && accounts.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant={accountFilter ? 'secondary' : 'outline'} size="sm" className="h-9">
              <Filter className="mr-2 h-4 w-4" />
              {selectedFilterAccount
                ? selectedFilterAccount.accountName || selectedFilterAccount.institution
                : 'All Accounts'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              <Button
                variant={!accountFilter ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start"
                onClick={() => onAccountFilterChange(null)}
              >
                {!accountFilter && <Check className="mr-2 h-4 w-4" />}
                All Accounts
              </Button>
              {accounts.map((account) => (
                <Button
                  key={account.id}
                  variant={accountFilter === account.id ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start truncate"
                  onClick={() => onAccountFilterChange(account.id)}
                >
                  {accountFilter === account.id && <Check className="mr-2 h-4 w-4 shrink-0" />}
                  <span className="truncate">
                    {account.accountName || account.institution || account.type}
                  </span>
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {accountFilter && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onAccountFilterChange(null)}
          className="h-9 text-muted-foreground"
        >
          <X className="mr-1 h-4 w-4" />
          Clear filter
        </Button>
      )}

      {/* Sort Dropdown */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <ArrowUpDown className="mr-2 h-4 w-4" />
            {sortOptions.find((o) => o.value === sortOrder)?.label || 'Sort'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="space-y-1">
            {sortOptions.map((option) => (
              <Button
                key={option.value}
                variant={sortOrder === option.value ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start"
                onClick={() => onSortChange(option.value)}
              >
                {sortOrder === option.value && <Check className="mr-2 h-4 w-4" />}
                <span className="flex items-center gap-2">
                  {option.icon}
                  {option.label}
                </span>
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <span className="text-sm text-muted-foreground">
        {statementsCount} statement{statementsCount !== 1 ? 's' : ''}
      </span>
    </div>
  )
}
