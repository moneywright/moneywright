/**
 * Profile create/edit modal component
 */

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createProfile, updateProfile } from '@/lib/api'
import { RELATIONSHIP_OPTIONS } from '@/hooks'
import type { Profile } from './types'

interface ProfileModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingProfile?: Profile | null
}

export function ProfileModal({ open, onOpenChange, editingProfile }: ProfileModalProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('self')
  const [summary, setSummary] = useState('')

  const isEditing = !!editingProfile

  // Reset form when modal opens/closes or editing profile changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open && editingProfile) {
      setName(editingProfile.name)
      setRelationship(editingProfile.relationship || 'self')
      setSummary(editingProfile.summary || '')
    } else if (open) {
      setName('')
      setRelationship('self')
      setSummary('')
    }
  }, [open, editingProfile])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Create mutation
  const createMutation = useMutation({
    mutationFn: ({
      name,
      relationship,
      summary,
    }: {
      name: string
      relationship: string
      summary?: string
    }) => createProfile({ name, relationship, summary: summary || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      toast.success('Profile created')
      onOpenChange(false)
    },
    onError: () => {
      toast.error('Failed to create profile')
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      name,
      relationship,
      summary,
    }: {
      id: string
      name: string
      relationship: string
      summary?: string
    }) => updateProfile(id, { name, relationship, summary: summary || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      toast.success('Profile updated')
      onOpenChange(false)
    },
    onError: () => {
      toast.error('Failed to update profile')
    },
  })

  const handleSubmit = () => {
    if (!name.trim()) return

    if (isEditing && editingProfile) {
      updateMutation.mutate({
        id: editingProfile.id,
        name: name.trim(),
        relationship,
        summary: summary.trim() || undefined,
      })
    } else {
      createMutation.mutate({
        name: name.trim(),
        relationship,
        summary: summary.trim() || undefined,
      })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Profile' : 'Create Profile'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update profile details'
              : 'Add a new profile to track finances separately'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Profile Name */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Profile Name
            </Label>
            <Input
              placeholder="e.g., Personal, John, Family..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit()
              }}
              autoFocus
            />
          </div>

          {/* Relationship Selector */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Who is this profile for?
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {RELATIONSHIP_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRelationship(option.value)}
                  className={cn(
                    'relative flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all',
                    relationship === option.value
                      ? 'border-primary/30 bg-primary/10'
                      : 'border-border-subtle bg-surface-elevated hover:border-border-hover'
                  )}
                >
                  <span className="text-lg">{option.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-sm font-medium',
                        relationship === option.value ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {option.label}
                    </p>
                  </div>
                  {relationship === option.value && (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Profile Summary */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              About this profile{' '}
              <span className="normal-case text-muted-foreground/50">(optional)</span>
            </Label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="e.g., Freelance designer with irregular income..."
              maxLength={1000}
              rows={3}
              className="resize-none rounded-xl bg-surface-elevated border-border-subtle focus:border-primary/50"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={!name.trim() || isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEditing ? (
              'Save Changes'
            ) : (
              'Create Profile'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
