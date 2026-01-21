import { createContext, useContext, useEffect } from 'react'
import { createRootRoute, Outlet, useNavigate, useLocation } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useAuthStatus } from '@/hooks/useAuthStatus'
import { Loader2 } from 'lucide-react'
import { getSetupStatus, type User } from '@/lib/api'
import { Toaster } from '@/components/ui/sonner'

// Auth context for child components
interface AuthContextType {
  user: User | null
  authEnabled: boolean
  isAuthenticated: boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider')
  }
  return context
}

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  const navigate = useNavigate()
  const location = useLocation()

  // Check setup status first (only needed when auth is enabled)
  const { data: setupStatus, isLoading: setupLoading } = useQuery({
    queryKey: ['setupStatus'],
    queryFn: getSetupStatus,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false, // Don't retry if API is not available
  })

  // Auth state from new hook
  const {
    user,
    authEnabled,
    authenticated,
    isLoading: authLoading,
    needsCountry,
    needsProfile,
    logout,
  } = useAuthStatus()

  // Public routes that don't require authentication
  const isPublicRoute =
    location.pathname === '/login' ||
    location.pathname === '/setup' ||
    location.pathname.startsWith('/auth/')

  // Onboarding routes
  const isOnboardingRoute = location.pathname.startsWith('/onboarding')

  // Redirect to setup if required (LLM must always be configured)
  useEffect(() => {
    if (setupLoading || authLoading) return

    const isSetupRoute = location.pathname === '/setup'

    // If setup is required and we're not on setup page, redirect
    // Setup is required if LLM is not configured, or if auth is enabled and Google OAuth is not configured
    if (setupStatus?.setupRequired && !isSetupRoute) {
      navigate({ to: '/setup', replace: true })
    }
  }, [setupLoading, authLoading, setupStatus, location.pathname, navigate])

  // Redirect unauthenticated users to login (only when auth is enabled)
  useEffect(() => {
    if (setupLoading || authLoading) return

    // Don't redirect if setup is required
    if (setupStatus?.setupRequired) return

    // If auth is disabled, user is always "authenticated" via default user
    if (!authEnabled) return

    // Redirect to login if not authenticated and not on public route
    if (!authenticated && !isPublicRoute) {
      navigate({ to: '/login', replace: true })
    }
  }, [setupLoading, authLoading, authEnabled, setupStatus, authenticated, isPublicRoute, navigate])

  // Redirect to onboarding if needed
  useEffect(() => {
    if (setupLoading || authLoading) return

    // Don't redirect if on public routes or already on onboarding
    if (isPublicRoute || isOnboardingRoute) return

    // Don't redirect if setup is required
    if (setupStatus?.setupRequired) return

    // Redirect to country selection if needed
    if (needsCountry) {
      navigate({ to: '/onboarding/country', replace: true })
      return
    }

    // Redirect to profile creation if needed
    if (needsProfile) {
      navigate({ to: '/onboarding/profile', replace: true })
      return
    }
  }, [
    setupLoading,
    authLoading,
    authEnabled,
    setupStatus,
    needsCountry,
    needsProfile,
    isPublicRoute,
    isOnboardingRoute,
    navigate,
  ])

  // Redirect away from onboarding if already complete
  useEffect(() => {
    if (setupLoading || authLoading) return
    if (!isOnboardingRoute) return

    // If onboarding is complete, redirect to dashboard
    if (!needsCountry && !needsProfile && authenticated) {
      navigate({ to: '/', replace: true })
    }
  }, [
    setupLoading,
    authLoading,
    isOnboardingRoute,
    needsCountry,
    needsProfile,
    authenticated,
    navigate,
  ])

  // Show loading while checking setup status or auth
  if (setupLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // If setup is required (LLM not configured, or auth enabled without Google OAuth), render setup route only
  if (setupStatus?.setupRequired) {
    const isSetupRoute = location.pathname === '/setup'

    if (!isSetupRoute) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Redirecting to setup...</p>
          </div>
        </div>
      )
    }

    return (
      <AuthContext.Provider value={{ user: null, authEnabled, isAuthenticated: false, logout }}>
        <Outlet />
        <Toaster position="bottom-right" richColors closeButton />
      </AuthContext.Provider>
    )
  }

  // If not authenticated and auth is enabled, only render public routes
  if (authEnabled && !authenticated) {
    if (!isPublicRoute) {
      // Show loading while redirect happens (from useEffect above)
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Redirecting...</p>
          </div>
        </div>
      )
    }

    return (
      <AuthContext.Provider value={{ user: null, authEnabled, isAuthenticated: false, logout }}>
        <Outlet />
        <Toaster position="bottom-right" richColors closeButton />
      </AuthContext.Provider>
    )
  }

  // If onboarding is needed, show onboarding routes
  if ((needsCountry || needsProfile) && !isOnboardingRoute && !isPublicRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Redirecting to onboarding...</p>
        </div>
      </div>
    )
  }

  // Authenticated (or local mode) - render the full app
  return (
    <AuthContext.Provider value={{ user, authEnabled, isAuthenticated: authenticated, logout }}>
      <Outlet />
      <Toaster position="bottom-right" richColors closeButton />
    </AuthContext.Provider>
  )
}
