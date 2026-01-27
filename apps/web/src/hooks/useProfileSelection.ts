import { useCallback } from 'react'
import { useAuth, usePreferences, useSetPreference } from '@/hooks'
import { PREFERENCE_KEYS, type Profile } from '@/lib/api'

// Special value to indicate family view
const FAMILY_VIEW_VALUE = 'family'

/**
 * Hook for managing profile selection state across pages
 * Persists selection to user preferences API
 *
 * Preference value:
 * - "family" = Family view (all profiles)
 * - <profileId> = Specific profile selected
 * - null/undefined = Use default profile
 */
export function useProfileSelection() {
  const { defaultProfile, profiles } = useAuth()
  const { data: preferences } = usePreferences()
  const setPreferenceMutation = useSetPreference()

  // Get the stored selection from preferences
  const storedValue = preferences?.[PREFERENCE_KEYS.SELECTED_PROFILE]

  // Check if family view is active
  const showFamilyView = storedValue === FAMILY_VIEW_VALUE

  // Validate stored profile ID still exists (handle deleted profiles)
  const storedProfileExists =
    storedValue && storedValue !== FAMILY_VIEW_VALUE
      ? profiles?.some((p) => p.id === storedValue)
      : false

  // Determine selected profile ID
  const selectedProfileId = storedProfileExists ? storedValue : null

  // Derive the active profile ID
  // Family view = undefined (all profiles)
  // Otherwise use selected profile or fall back to default
  const activeProfileId = showFamilyView ? undefined : selectedProfileId || defaultProfile?.id

  // Handler for changing profile
  const handleProfileChange = useCallback(
    (profile: Profile) => {
      setPreferenceMutation.mutate({
        key: PREFERENCE_KEYS.SELECTED_PROFILE,
        value: profile.id,
      })
    },
    [setPreferenceMutation]
  )

  // Handler for toggling family view
  const handleFamilyViewChange = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        setPreferenceMutation.mutate({
          key: PREFERENCE_KEYS.SELECTED_PROFILE,
          value: FAMILY_VIEW_VALUE,
        })
      } else {
        // When disabling family view, reset to default (null/empty)
        setPreferenceMutation.mutate({
          key: PREFERENCE_KEYS.SELECTED_PROFILE,
          value: '',
        })
      }
    },
    [setPreferenceMutation]
  )

  // Handler to clear selection (used when profile is deleted)
  const clearSelection = useCallback(() => {
    setPreferenceMutation.mutate({
      key: PREFERENCE_KEYS.SELECTED_PROFILE,
      value: '',
    })
  }, [setPreferenceMutation])

  return {
    // The active profile ID to use for queries (undefined = family view)
    activeProfileId,
    // Whether family view is active
    showFamilyView,
    // The selected profile ID (may be null if using default)
    selectedProfileId,
    // Handlers
    handleProfileChange,
    handleFamilyViewChange,
    clearSelection,
    // For ProfileSelector component
    selectorProfileId: showFamilyView ? null : activeProfileId || null,
  }
}
