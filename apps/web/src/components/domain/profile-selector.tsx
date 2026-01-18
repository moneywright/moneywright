import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProfiles, createProfile, type Profile } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ChevronDown, Plus, User, Users, Check, Loader2 } from 'lucide-react'

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
  const [isCreating, setIsCreating] = useState(false)
  const [newProfileName, setNewProfileName] = useState('')

  // Fetch profiles
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: getProfiles,
  })

  // Create profile mutation
  const createMutation = useMutation({
    mutationFn: (name: string) => createProfile({ name, relationship: 'other' }),
    onSuccess: (newProfile) => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      setIsCreating(false)
      setNewProfileName('')
      onProfileChange(newProfile)
    },
  })

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId)
  const displayName = showFamilyView ? 'Family View' : selectedProfile?.name || 'Select Profile'

  const handleCreateProfile = () => {
    if (!newProfileName.trim()) return
    createMutation.mutate(newProfileName.trim())
  }

  if (isLoading) {
    return (
      <Button variant="outline" disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="min-w-[160px] justify-between">
          <span className="flex items-center gap-2">
            {showFamilyView ? <Users className="h-4 w-4" /> : <User className="h-4 w-4" />}
            <span className="truncate max-w-[120px]">{displayName}</span>
          </span>
          <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[220px]">
        <DropdownMenuLabel>Profiles</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Family View Option */}
        {onFamilyViewChange && profiles.length > 1 && (
          <>
            <DropdownMenuItem
              onClick={() => onFamilyViewChange(true)}
              className="flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Family View
              </span>
              {showFamilyView && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Individual Profiles */}
        {profiles.map((profile) => (
          <DropdownMenuItem
            key={profile.id}
            onClick={() => {
              onFamilyViewChange?.(false)
              onProfileChange(profile)
            }}
            className="flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="truncate">{profile.name}</span>
              {profile.isDefault && (
                <span className="text-xs text-muted-foreground">(default)</span>
              )}
            </span>
            {!showFamilyView && selectedProfileId === profile.id && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        {/* Create New Profile */}
        {isCreating ? (
          <div className="p-2 space-y-2">
            <Input
              placeholder="Profile name"
              value={newProfileName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewProfileName(e.target.value)
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateProfile()
                if (e.key === 'Escape') {
                  setIsCreating(false)
                  setNewProfileName('')
                }
              }}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={handleCreateProfile}
                disabled={!newProfileName.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsCreating(false)
                  setNewProfileName('')
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <DropdownMenuItem onClick={() => setIsCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Profile
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
