/**
 * Profile badge component - shows which profile an item belongs to
 * Only displayed in Family View mode
 */

import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/api'

interface ProfileBadgeProps {
  /** Direct name to display (simplest usage) */
  name?: string
  /** Profile ID to look up in profiles array */
  profileId?: string
  /** Array of profiles to look up profileId */
  profiles?: Profile[]
  className?: string
  size?: 'sm' | 'md'
}

export function ProfileBadge({
  name,
  profileId,
  profiles,
  className,
  size = 'sm',
}: ProfileBadgeProps) {
  // Determine the display name - either from direct name prop or by looking up profileId
  const displayName = name ?? profiles?.find((p) => p.id === profileId)?.name
  if (!displayName) return null

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md font-medium truncate max-w-[100px]',
        'bg-muted/50 text-muted-foreground border border-border-subtle',
        size === 'sm' && 'px-1.5 py-0.5 text-[10px] leading-tight',
        size === 'md' && 'px-2 py-0.5 text-xs',
        className
      )}
      title={displayName}
    >
      {displayName}
    </span>
  )
}

/**
 * Helper function to get profile name from profileId
 */
export function getProfileName(profileId: string, profiles?: Profile[]): string | null {
  const profile = profiles?.find((p) => p.id === profileId)
  return profile?.name || null
}
