import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAuthStatus, logout as logoutApi, getProfiles } from '@/lib/api'

/**
 * Auth status hook - manages authentication state for the entire app
 * This is the primary hook for determining auth state and onboarding status
 */
export function useAuthStatus() {
  const queryClient = useQueryClient()

  // Get auth status (always fetch - this is the source of truth)
  const {
    data: authStatus,
    isLoading: isAuthLoading,
    error: authError,
    refetch: refetchAuth,
  } = useQuery({
    queryKey: ['auth', 'status'],
    queryFn: getAuthStatus,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  })

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: logoutApi,
    onSuccess: () => {
      queryClient.clear()
      // Only redirect to login if auth is enabled
      if (authStatus?.authEnabled) {
        window.location.href = '/login'
      } else {
        window.location.href = '/'
      }
    },
  })

  const user = authStatus?.user ?? null
  const authEnabled = authStatus?.authEnabled ?? true
  const authenticated = authStatus?.authenticated ?? false

  // Determine onboarding state
  const needsCountry = authenticated && user && !user.country
  const needsProfile = authenticated && user && user.country && !user.onboardingComplete
  const onboardingComplete = authenticated && user?.onboardingComplete === true

  return {
    // Auth state
    user,
    authEnabled,
    authenticated,
    isLoading: isAuthLoading,
    error: authError?.message ?? null,

    // Onboarding state
    needsCountry,
    needsProfile,
    onboardingComplete,

    // Actions
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    refetch: refetchAuth,
  }
}

/**
 * Profiles hook - manages user profiles
 */
export function useProfiles() {
  const {
    data: profiles,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['profiles'],
    queryFn: getProfiles,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const defaultProfile = profiles?.find((p) => p.isDefault) ?? profiles?.[0] ?? null

  return {
    profiles: profiles ?? [],
    defaultProfile,
    isLoading,
    error: error?.message ?? null,
    refetch,
  }
}
