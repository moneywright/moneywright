import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCurrentUser, logout as logoutApi } from '@/lib/api'

/**
 * Check if session hint cookie exists
 */
function hasSessionHint(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.includes('_s=1')
}

/**
 * Auth hook - manages authentication state
 */
export function useAuth() {
  const queryClient = useQueryClient()

  // Get current user (skip API call if no session hint)
  const {
    data: user,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getCurrentUser,
    enabled: hasSessionHint(), // Only fetch if session hint exists
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  })

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: logoutApi,
    onSuccess: () => {
      queryClient.clear()
      window.location.href = '/login'
    },
  })

  return {
    user: user ?? null,
    isLoading: hasSessionHint() ? isLoading : false,
    isAuthenticated: !!user,
    error: error?.message ?? null,
    logout: logoutMutation.mutate,
    refetch,
  }
}
