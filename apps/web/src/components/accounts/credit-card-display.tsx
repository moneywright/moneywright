import { useState } from 'react'
import { CreditCard, MoreVertical, Pencil, Trash2 } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import type { Account } from '@/lib/api'

interface CreditCardDisplayProps {
  account: Account
  countryCode: string
  institutionName?: string
  onEdit: () => void
  onDelete: () => void
}

export function CreditCardDisplay({
  account,
  countryCode,
  institutionName,
  onEdit,
  onDelete,
}: CreditCardDisplayProps) {
  const [logoError, setLogoError] = useState(false)
  const logoPath = account.institution
    ? `/institutions/${countryCode}/${account.institution}.svg`
    : null

  const lastFour = account.accountNumber?.slice(-4) || '••••'

  const displayCardName =
    account.productName ||
    (account.accountName?.includes('-') ? account.accountName.split(' - ')[1] : null) ||
    'Credit Card'

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
        'relative rounded-xl p-5 border transition-colors',
        'bg-card border-border-subtle hover:border-border-hover',
        !account.isActive && 'opacity-50'
      )}
    >
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-surface-elevated border border-border-subtle shrink-0">
            {logoPath && !logoError ? (
              <img
                src={logoPath}
                alt={institutionName || account.institution || ''}
                className="h-6 w-6 object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{displayCardName}</p>
            <p className="text-xs text-muted-foreground">
              {institutionName || account.institution || 'Credit Card'}
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
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

      {/* Card Number */}
      <p className="text-sm font-mono text-muted-foreground mt-4 tracking-wider">
        •••• •••• •••• {lastFour}
      </p>

      {/* Balance */}
      <div className="mt-4 pt-4 border-t border-border-subtle">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Outstanding</p>
        <div className="flex items-baseline justify-between mt-1">
          <p className="text-xl font-semibold text-negative tabular-nums">
            {account.latestBalance !== null ? formatCurrency(account.latestBalance) : '—'}
          </p>
          {balanceDate && <p className="text-xs text-muted-foreground">as of {balanceDate}</p>}
        </div>
      </div>
    </div>
  )
}
