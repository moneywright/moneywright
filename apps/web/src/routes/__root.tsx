import { createContext, useContext, useCallback } from 'react'
import { createRootRoute, Outlet, redirect } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  type User,
  getAuthStatus,
  getCurrentUser,
  getSetupStatus,
  getProfiles,
  logout as logoutApi,
  localLogin,
  getPinStatus,
} from '@/lib/api'
import { Toaster } from '@/components/ui/sonner'

/**
 * Check if the session hint cookie exists
 */
function hasSessionHint(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split(';').some((c) => c.trim().startsWith('_s='))
}

/**
 * Routes that don't require authentication
 */
const PUBLIC_ROUTES = ['/login', '/auth', '/pin']

/**
 * Routes that are part of setup/onboarding flow
 */
const SETUP_ROUTES = ['/setup', '/onboarding']

/**
 * PIN-related routes
 */
const PIN_ROUTES = ['/pin/setup', '/pin/unlock', '/pin/recover']

function isPinRoute(pathname: string): boolean {
  return PIN_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'))
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'))
}

function isSetupRoute(pathname: string): boolean {
  return SETUP_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'))
}

// Auth context type
interface AuthContextType {
  // User & auth state
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean

  // Setup state
  authEnabled: boolean
  setupRequired: boolean
  llmConfigured: boolean

  // Onboarding state
  needsCountry: boolean
  needsProfile: boolean
  onboardingComplete: boolean

  // Profiles
  profiles: Awaited<ReturnType<typeof getProfiles>>
  defaultProfile: Awaited<ReturnType<typeof getProfiles>>[number] | null

  // Actions
  logout: () => void
  isLoggingOut: boolean
  refetch: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

/**
 * Single auth hook for the entire app
 * Must be used within a route (child of __root)
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within a route')
  }
  return context
}

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    // Skip auth check for public routes (includes PIN routes)
    if (isPublicRoute(location.pathname)) {
      return
    }

    // Check auth status
    const authStatus = await getAuthStatus()
    const authEnabled = authStatus?.authEnabled ?? true

    // Check if user has session
    const hasSession = hasSessionHint()

    // If auth is disabled (local mode), handle PIN authentication
    if (!authEnabled) {
      // Check if PIN is configured
      let pinStatus: { configured: boolean } | null = null

      try {
        pinStatus = await getPinStatus()
      } catch {
        // PIN status check failed - table might not exist yet
        // Continue without PIN requirement
      }

      // Only enforce PIN if we successfully got the status
      if (pinStatus !== null) {
        if (!pinStatus.configured) {
          // PIN not set up - redirect to PIN setup
          throw redirect({
            to: '/pin/setup',
            replace: true,
          })
        }

        // PIN is configured but no session - redirect to unlock
        if (!hasSession) {
          throw redirect({
            to: '/pin/unlock',
            replace: true,
          })
        }
      }
    }

    // Auth required but no session - redirect to login with return URL
    if (authEnabled && !hasSession) {
      throw redirect({
        to: '/login',
        search: { redirect: location.pathname },
        replace: true,
      })
    }

    // Verify the session is valid and check setup/onboarding status
    try {
      const user = await getCurrentUser()

      if (!user && authEnabled) {
        throw redirect({
          to: '/login',
          search: { redirect: location.pathname },
          replace: true,
        })
      }

      // Skip setup/onboarding checks if already on those routes
      if (isSetupRoute(location.pathname)) {
        return
      }

      // Check if setup is complete (LLM configured)
      const setupStatus = await getSetupStatus()
      const llmConfigured = setupStatus?.llm?.isConfigured ?? false

      if (!llmConfigured) {
        throw redirect({
          to: '/setup',
          search: { redirect: location.pathname },
          replace: true,
        })
      }

      // Check onboarding status
      if (user && !user.country) {
        throw redirect({
          to: '/onboarding/country',
          search: { redirect: location.pathname },
          replace: true,
        })
      }

      if (user && user.country && !user.onboardingComplete) {
        throw redirect({
          to: '/onboarding/profile',
          search: { redirect: location.pathname },
          replace: true,
        })
      }
    } catch (error) {
      // If it's already a redirect, rethrow it
      if (error instanceof Response) {
        throw error
      }
      // Check if it's a redirect object from TanStack Router
      if (error && typeof error === 'object' && 'to' in error) {
        throw error
      }
      // Auth failed - redirect to login or PIN unlock
      if (authEnabled) {
        throw redirect({
          to: '/login',
          search: { redirect: location.pathname },
          replace: true,
        })
      } else {
        // In local mode, redirect to PIN unlock
        throw redirect({
          to: '/pin/unlock',
          replace: true,
        })
      }
    }
  },
  component: RootComponent,
})

function RootComponent() {
  const queryClient = useQueryClient()

  // Check if user has session hint cookie
  const hasSession = hasSessionHint()

  // 1. Get auth status (unauthenticated endpoint)
  const { data: authStatus, isLoading: authStatusLoading } = useQuery({
    queryKey: ['auth-status'],
    queryFn: getAuthStatus,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const authEnabled = authStatus?.authEnabled ?? true

  // 2. Get current user (only if session hint exists)
  const {
    data: user,
    isLoading: userLoading,
    refetch: refetchUser,
  } = useQuery({
    queryKey: ['user', 'me'],
    queryFn: getCurrentUser,
    enabled: hasSession,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const authenticated = hasSession && !!user

  // 3. Get setup status (only if authenticated)
  const { data: setupStatus, refetch: refetchSetup } = useQuery({
    queryKey: ['setup'],
    queryFn: getSetupStatus,
    enabled: authenticated,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  // 4. Get profiles (only if authenticated)
  const { data: profiles, refetch: refetchProfiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: getProfiles,
    enabled: authenticated,
    staleTime: 5 * 60 * 1000,
  })

  // Use the first profile (by creation order) as the initial profile
  const defaultProfile = profiles?.[0] ?? null

  // Derive setup state
  const llmConfigured = setupStatus?.llm?.isConfigured ?? false
  const setupRequired = authenticated && !llmConfigured

  // Onboarding state
  const needsCountry = authenticated && !setupRequired && !!user && !user.country
  const needsProfile =
    authenticated && !setupRequired && !!user && !!user.country && !user.onboardingComplete
  const onboardingComplete = authenticated && !setupRequired && user?.onboardingComplete === true

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: logoutApi,
    onSuccess: () => {
      queryClient.clear()
      if (authEnabled) {
        window.location.href = '/login'
      } else {
        window.location.href = '/'
      }
    },
  })

  // Refetch all auth data
  const refetch = useCallback(async () => {
    await refetchSetup()
    await refetchUser()
    await refetchProfiles()
  }, [refetchSetup, refetchUser, refetchProfiles])

  // Loading state - only for initial auth check
  const isLoading = authStatusLoading || (hasSession && userLoading)

  // Auth context value
  const authValue: AuthContextType = {
    user: user ?? null,
    isAuthenticated: authenticated,
    isLoading,
    authEnabled,
    setupRequired,
    llmConfigured,
    needsCountry,
    needsProfile,
    onboardingComplete,
    profiles: profiles ?? [],
    defaultProfile,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    refetch,
  }

  return (
    <AuthContext.Provider value={authValue}>
      <Outlet />
      <Toaster position="bottom-right" richColors closeButton />
    </AuthContext.Provider>
  )
}
