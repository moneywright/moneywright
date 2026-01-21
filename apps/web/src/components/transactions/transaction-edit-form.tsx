import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { updateTransaction, type Transaction, type Category } from '@/lib/api'

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

  const updateMutation = useMutation({
    mutationFn: () =>
      updateTransaction(transaction.id, { category, summary: summary || undefined }),
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
        <Select value={category} onValueChange={setCategory}>
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
