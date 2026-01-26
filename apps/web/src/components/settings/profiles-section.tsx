/**
 * Profiles section component
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { ProfileCard } from './profile-card'
import { ProfileModal } from './profile-modal'
import type { Profile } from './types'

interface ProfilesSectionProps {
  profiles: Profile[]
}

export function ProfilesSection({ profiles }: ProfilesSectionProps) {
  const [showModal, setShowModal] = useState(false)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)

  const handleCreate = () => {
    setEditingProfile(null)
    setShowModal(true)
  }

  const handleEdit = (profile: Profile) => {
    setEditingProfile(profile)
    setShowModal(true)
  }

  const handleCloseModal = (open: boolean) => {
    if (!open) {
      setShowModal(false)
      setEditingProfile(null)
    }
  }

  return (
    <>
      <Card className="border-border-subtle hover:border-border-hover transition-colors animate-fade-in">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Profiles
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleCreate}>
              <Plus className="mr-1 h-3 w-3" />
              Add Profile
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                onEdit={handleEdit}
                canDelete={profiles.length > 1}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <ProfileModal
        open={showModal}
        onOpenChange={handleCloseModal}
        editingProfile={editingProfile}
      />
    </>
  )
}
