/**
 * Individual Profile card component
 */

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
} from '@/components/ui/alert-dialog'
import { Loader2, Pencil, MoreVertical, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { deleteProfile } from '@/lib/api'
import { RELATIONSHIP_OPTIONS, useProfileSelection } from '@/hooks'
import type { Profile } from './types'

interface ProfileCardProps {
  profile: Profile
  onEdit: (profile: Profile) => void
  canDelete?: boolean
}

export function ProfileCard({ profile, onEdit, canDelete = false }: ProfileCardProps) {
  const queryClient = useQueryClient()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const { selectedProfileId, clearSelection } = useProfileSelection()

  const deleteMutation = useMutation({
    mutationFn: deleteProfile,
    onSuccess: () => {
      // Clear selection if the deleted profile was selected
      if (selectedProfileId === profile.id) {
        clearSelection()
      }
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      toast.success('Profile deleted')
      setShowDeleteDialog(false)
    },
    onError: () => {
      toast.error('Failed to delete profile')
    },
  })

  const relationshipOption = RELATIONSHIP_OPTIONS.find((o) => o.value === profile.relationship)

  return (
    <>
      <div
        className={cn(
          'group relative rounded-xl border bg-card transition-all duration-200',
          'hover:border-border-hover hover:shadow-sm',
          'border-border-subtle'
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-4">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg',
              'bg-surface-elevated border border-border-subtle'
            )}
          >
            {relationshipOption?.icon || '👤'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">{profile.name}</p>
            <p className="text-xs text-muted-foreground">
              {relationshipOption?.label || profile.relationship}
            </p>
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
              <DropdownMenuItem onClick={() => onEdit(profile)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Summary */}
        {profile.summary && (
          <div className="border-t border-border-subtle px-4 py-3">
            <p className="text-xs text-muted-foreground line-clamp-2">{profile.summary}</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete profile?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{profile.name}" and all associated data including
              accounts, transactions, and statements.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate(profile.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
