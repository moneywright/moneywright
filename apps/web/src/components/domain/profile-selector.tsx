import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProfiles, createProfile, updateProfile, type Profile } from '@/lib/api'
import { RELATIONSHIP_OPTIONS } from '@/hooks/useOnboarding'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChevronDown, Plus, User, Users, Check, Loader2, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProfileSelectorProps {
  selectedProfileId: string | null
  onProfileChange: (profile: Profile) => void
  showFamilyView?: boolean
  onFamilyViewChange?: (enabled: boolean) => void
}

export function ProfileSelector({
  selectedProfileId,
  onProfileChange,
  showFamilyView = false,
  onFamilyViewChange,
}: ProfileSelectorProps) {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [newProfileName, setNewProfileName] = useState('')
  const [newProfileRelationship, setNewProfileRelationship] = useState('self')
  const [newProfileSummary, setNewProfileSummary] = useState('')

  // Fetch profiles
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: getProfiles,
  })

  // Create profile mutation
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
    onSuccess: (newProfile) => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      setShowCreateModal(false)
      setNewProfileName('')
      setNewProfileRelationship('self')
      setNewProfileSummary('')
      onProfileChange(newProfile)
    },
  })

  // Update profile mutation
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
    onSuccess: (updatedProfile) => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      setShowEditModal(false)
      setEditingProfile(null)
      setNewProfileName('')
      setNewProfileRelationship('self')
      setNewProfileSummary('')
      // Update selected profile if it was the one being edited
      if (selectedProfileId === updatedProfile.id) {
        onProfileChange(updatedProfile)
      }
    },
  })

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId)
  const displayName = showFamilyView ? 'Family' : selectedProfile?.name || 'Select Profile'

  const handleCreateProfile = () => {
    if (!newProfileName.trim()) return
    createMutation.mutate({
      name: newProfileName.trim(),
      relationship: newProfileRelationship,
      summary: newProfileSummary.trim() || undefined,
    })
  }

  const handleUpdateProfile = () => {
    if (!editingProfile || !newProfileName.trim()) return
    updateMutation.mutate({
      id: editingProfile.id,
      name: newProfileName.trim(),
      relationship: newProfileRelationship,
      summary: newProfileSummary.trim() || undefined,
    })
  }

  const handleOpenEditModal = (profile: Profile) => {
    setEditingProfile(profile)
    setNewProfileName(profile.name)
    setNewProfileRelationship(profile.relationship || 'self')
    setNewProfileSummary(profile.summary || '')
    setShowEditModal(true)
  }

  const handleCloseCreateModal = () => {
    setShowCreateModal(false)
    setNewProfileName('')
    setNewProfileRelationship('self')
    setNewProfileSummary('')
  }

  const handleCloseEditModal = () => {
    setShowEditModal(false)
    setEditingProfile(null)
    setNewProfileName('')
    setNewProfileRelationship('self')
    setNewProfileSummary('')
  }

  if (isLoading) {
    return (
      <Button variant="outline" disabled className="min-w-35">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </Button>
    )
  }

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="min-w-35 justify-between gap-2">
            <span className="flex items-center gap-2">
              {showFamilyView ? (
                <Users className="h-4 w-4 text-muted-foreground" />
              ) : (
                <User className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="truncate max-w-25">{displayName}</span>
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform duration-200',
                isOpen && 'rotate-180'
              )}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Profiles</DropdownMenuLabel>

          {/* Family View Option */}
          {onFamilyViewChange && profiles.length > 1 && (
            <>
              <DropdownMenuItem
                onClick={() => {
                  onFamilyViewChange(true)
                  setIsOpen(false)
                }}
                className={cn(showFamilyView && 'bg-primary/10 text-primary')}
              >
                <Users className="h-4 w-4" />
                <span>Family View</span>
                {showFamilyView && <Check className="h-4 w-4 ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {/* Individual Profiles */}
          {profiles.map((profile) => {
            const isSelected = !showFamilyView && selectedProfileId === profile.id
            return (
              <DropdownMenuItem
                key={profile.id}
                onClick={() => {
                  onFamilyViewChange?.(false)
                  onProfileChange(profile)
                  setIsOpen(false)
                }}
                className={cn(isSelected && 'bg-primary/10 text-primary')}
              >
                <User className="h-4 w-4" />
                <span className="truncate">{profile.name}</span>
                {isSelected && <Check className="h-4 w-4 ml-auto shrink-0" />}
              </DropdownMenuItem>
            )
          })}

          <DropdownMenuSeparator />

          {/* Edit Current Profile Button */}
          {selectedProfile && !showFamilyView && (
            <DropdownMenuItem
              onClick={() => {
                setIsOpen(false)
                handleOpenEditModal(selectedProfile)
              }}
            >
              <Pencil className="h-4 w-4" />
              <span>Edit Profile</span>
            </DropdownMenuItem>
          )}

          {/* Add Profile Button */}
          <DropdownMenuItem
            onClick={() => {
              setIsOpen(false)
              setShowCreateModal(true)
            }}
          >
            <Plus className="h-4 w-4" />
            <span>Add Profile</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Profile Modal */}
      <Dialog open={showCreateModal} onOpenChange={(open) => !open && handleCloseCreateModal()}>
        <DialogContent className="sm:max-w-100 p-0 gap-0 overflow-hidden">
          <div className="px-6 pt-6 pb-4">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">Create Profile</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Add a new profile to track finances separately
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 pb-6 space-y-5">
            {/* Profile Name */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Profile Name
              </Label>
              <Input
                placeholder="e.g., Personal, John, Family..."
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateProfile()
                }}
                autoFocus
              />
            </div>

            {/* Relationship Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Who is this profile for?
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {RELATIONSHIP_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setNewProfileRelationship(option.value)}
                    className={cn(
                      'relative flex items-center gap-2.5 p-2.5 rounded-xl border transition-all duration-200 text-left',
                      newProfileRelationship === option.value
                        ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/20'
                        : 'bg-surface-elevated border-border-subtle hover:bg-surface-hover hover:border-border-hover'
                    )}
                  >
                    {/* Icon */}
                    <div
                      className={cn(
                        'flex items-center justify-center w-8 h-8 rounded-lg text-sm transition-colors',
                        newProfileRelationship === option.value
                          ? 'bg-primary/20'
                          : 'bg-surface-hover'
                      )}
                    >
                      {option.icon}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div
                        className={cn(
                          'text-sm font-medium transition-colors',
                          newProfileRelationship === option.value
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                        )}
                      >
                        {option.label}
                      </div>
                      <div className="text-[10px] text-muted-foreground/70 truncate">
                        {option.description}
                      </div>
                    </div>

                    {/* Selection indicator */}
                    {newProfileRelationship === option.value && (
                      <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-2 h-2 text-primary-foreground" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Profile Summary */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                About this profile <span className="text-muted-foreground/50">(optional)</span>
              </Label>
              <textarea
                value={newProfileSummary}
                onChange={(e) => setNewProfileSummary(e.target.value)}
                placeholder="e.g., Freelance designer with irregular income. Runs online store as side business."
                maxLength={1000}
                rows={2}
                className="w-full px-3 py-2 rounded-lg text-sm bg-surface-elevated border border-border-subtle text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 focus:outline-none transition-all duration-200 resize-none"
              />
              <p className="text-[10px] text-muted-foreground/70">
                Mention occupation, income sources, and regular expenses
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={handleCloseCreateModal}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreateProfile}
                disabled={!newProfileName.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Create Profile'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Modal */}
      <Dialog open={showEditModal} onOpenChange={(open) => !open && handleCloseEditModal()}>
        <DialogContent className="sm:max-w-100 p-0 gap-0 overflow-hidden">
          <div className="px-6 pt-6 pb-4">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">Edit Profile</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Update profile details and categorization context
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 pb-6 space-y-5">
            {/* Profile Name */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Profile Name
              </Label>
              <Input
                placeholder="e.g., Personal, John, Family..."
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleUpdateProfile()
                }}
                autoFocus
              />
            </div>

            {/* Relationship Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Who is this profile for?
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {RELATIONSHIP_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setNewProfileRelationship(option.value)}
                    className={cn(
                      'relative flex items-center gap-2.5 p-2.5 rounded-xl border transition-all duration-200 text-left',
                      newProfileRelationship === option.value
                        ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/20'
                        : 'bg-surface-elevated border-border-subtle hover:bg-surface-hover hover:border-border-hover'
                    )}
                  >
                    {/* Icon */}
                    <div
                      className={cn(
                        'flex items-center justify-center w-8 h-8 rounded-lg text-sm transition-colors',
                        newProfileRelationship === option.value
                          ? 'bg-primary/20'
                          : 'bg-surface-hover'
                      )}
                    >
                      {option.icon}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div
                        className={cn(
                          'text-sm font-medium transition-colors',
                          newProfileRelationship === option.value
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                        )}
                      >
                        {option.label}
                      </div>
                      <div className="text-[10px] text-muted-foreground/70 truncate">
                        {option.description}
                      </div>
                    </div>

                    {/* Selection indicator */}
                    {newProfileRelationship === option.value && (
                      <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-2 h-2 text-primary-foreground" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Profile Summary */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                About this profile <span className="text-muted-foreground/50">(optional)</span>
              </Label>
              <textarea
                value={newProfileSummary}
                onChange={(e) => setNewProfileSummary(e.target.value)}
                placeholder="e.g., Freelance designer with irregular income. Runs online store as side business."
                maxLength={1000}
                rows={3}
                className="w-full px-3 py-2 rounded-lg text-sm bg-surface-elevated border border-border-subtle text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 focus:outline-none transition-all duration-200 resize-none"
              />
              <p className="text-[10px] text-muted-foreground/70">
                Mention occupation, income sources, and regular expenses to improve transaction
                categorization
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={handleCloseEditModal}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleUpdateProfile}
                disabled={!newProfileName.trim() || updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
