import { useState, useMemo } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2, EyeOff, Link2, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateTransaction, type Transaction, type Category } from '@/lib/api'
import { useLoans, useInsurancePolicies, useAccounts } from '@/hooks'

// Categories that support entity linking
const LINKABLE_CATEGORIES = {
  emi: 'loan',
  insurance: 'insurance',
  credit_card_payment: 'credit_card',
} as const

type LinkableCategory = keyof typeof LINKABLE_CATEGORIES

interface TransactionEditFormProps {
  transaction: Transaction
  categories: Category[]
  onClose: () => void
  onSuccess: () => void
}

export function TransactionEditForm({
  transaction,
  categories,
  onClose,
  onSuccess,
}: TransactionEditFormProps) {
  const [category, setCategory] = useState(transaction.category)
  const [summary, setSummary] = useState(transaction.summary || '')
  const [isHidden, setIsHidden] = useState(transaction.isHidden)
  const [linkedEntityId, setLinkedEntityId] = useState<string | null>(transaction.linkedEntityId)

  // Check if current category supports entity linking
  const isLinkableCategory = category in LINKABLE_CATEGORIES
  const entityType = isLinkableCategory ? LINKABLE_CATEGORIES[category as LinkableCategory] : null

  // Fetch entities based on category - use family view (no profileId filter)
  // to allow linking to any entity the user owns
  const { data: loans, isLoading: loansLoading } = useLoans(undefined, {
    status: 'active',
    enabled: entityType === 'loan',
  })

  const { data: insurancePolicies, isLoading: insuranceLoading } = useInsurancePolicies(undefined, {
    status: 'active',
    enabled: entityType === 'insurance',
  })

  const { data: accounts, isLoading: accountsLoading } = useAccounts(undefined, {
    enabled: entityType === 'credit_card',
  })

  // Filter to only credit card accounts
  const creditCards = useMemo(
    () => accounts?.filter((a) => a.type === 'credit_card') || [],
    [accounts]
  )

  // Get the appropriate entity list based on category
  const entityOptions = useMemo(() => {
    if (entityType === 'loan' && loans) {
      return loans.map((loan) => ({
        id: loan.id,
        label: `${loan.lender} - ${loan.loanType.replace(/_/g, ' ')}`,
        sublabel: loan.loanAccountNumber ? `••${loan.loanAccountNumber.slice(-4)}` : undefined,
      }))
    }
    if (entityType === 'insurance' && insurancePolicies) {
      return insurancePolicies.map((policy) => ({
        id: policy.id,
        label: `${policy.provider} - ${policy.policyType.replace(/_/g, ' ')}`,
        sublabel: policy.policyNumber ? `#${policy.policyNumber.slice(-6)}` : undefined,
      }))
    }
    if (entityType === 'credit_card' && creditCards) {
      return creditCards.map((card) => ({
        id: card.id,
        label: card.accountName,
        sublabel: card.accountNumber ? `••${card.accountNumber.slice(-4)}` : undefined,
      }))
    }
    return []
  }, [entityType, loans, insurancePolicies, creditCards])

  const isLoadingEntities = loansLoading || insuranceLoading || accountsLoading

  // Get entity type label for UI
  const entityTypeLabel = useMemo(() => {
    if (entityType === 'loan') return 'Loan'
    if (entityType === 'insurance') return 'Insurance Policy'
    if (entityType === 'credit_card') return 'Credit Card'
    return 'Entity'
  }, [entityType])

  // Handle category change - reset linked entity if category changes
  const handleCategoryChange = (newCategory: string) => {
    setCategory(newCategory)
    // Clear linked entity if category changes away from linkable type
    // or to a different linkable type
    if (
      !(newCategory in LINKABLE_CATEGORIES) ||
      (category in LINKABLE_CATEGORIES &&
        LINKABLE_CATEGORIES[category as LinkableCategory] !==
          LINKABLE_CATEGORIES[newCategory as LinkableCategory])
    ) {
      setLinkedEntityId(null)
    }
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      updateTransaction(transaction.id, {
        category,
        summary: summary || undefined,
        isHidden,
        linkedEntityId,
        linkedEntityType: linkedEntityId && entityType ? entityType : null,
      }),
    onSuccess: () => {
      toast.success('Transaction updated')
      onSuccess()
    },
    onError: () => {
      toast.error('Failed to update transaction')
    },
  })

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="summary">Summary</Label>
        <Input
          id="summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Brief description"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Select value={category} onValueChange={handleCategoryChange}>
          <SelectTrigger id="category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.code} value={cat.code}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Entity Linking Section - Only show for linkable categories */}
      {isLinkableCategory && (
        <div className="space-y-2">
          <Label htmlFor="linked-entity" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Link to {entityTypeLabel}
          </Label>
          <Select
            value={linkedEntityId || '__none__'}
            onValueChange={(value) => setLinkedEntityId(value === '__none__' ? null : value)}
            disabled={isLoadingEntities}
          >
            <SelectTrigger id="linked-entity">
              <SelectValue
                placeholder={isLoadingEntities ? 'Loading...' : `Select ${entityTypeLabel}`}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Unlink className="h-4 w-4" />
                  Not linked
                </span>
              </SelectItem>
              {entityOptions.map((entity) => (
                <SelectItem key={entity.id} value={entity.id}>
                  <span className="flex items-center gap-2">
                    {entity.label}
                    {entity.sublabel && (
                      <span className="text-muted-foreground text-xs">{entity.sublabel}</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Linking helps track payments and calculate outstanding balances.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg border p-4 mt-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <EyeOff className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="hide-transaction" className="font-medium">
              Hide Transaction
            </Label>
          </div>
          <p className="text-sm text-muted-foreground">
            Hidden transactions are excluded from all reports, charts, and calculations.
          </p>
        </div>
        <Switch id="hide-transaction" checked={isHidden} onCheckedChange={setIsHidden} />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </div>
  )
}
