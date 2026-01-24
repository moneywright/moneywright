import { useState } from 'react'
import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'motion/react'
import { getGoogleAuthUrl, getCurrentUser, getSetupStatus } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Loader2, Star } from 'lucide-react'
import { AuthLayout } from '@/components/auth/auth-layout'

/**
 * Check if the session hint cookie exists
 */
function hasSessionHint(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split(';').some((c) => c.trim().startsWith('_s='))
}

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: (search.redirect as string) || undefined,
  }),
  beforeLoad: async ({ search }) => {
    // If user has a session, check if they should be redirected away from login
    if (!hasSessionHint()) {
      return
    }

    try {
      const user = await getCurrentUser()
      if (!user) {
        return // Not authenticated, show login page
      }

      // User is authenticated - check where to redirect
      const redirectTo = (search as { redirect?: string }).redirect

      // Check setup status
      const setupStatus = await getSetupStatus()
      const llmConfigured = setupStatus?.llm?.isConfigured ?? false

      if (!llmConfigured) {
        throw redirect({
          to: '/setup',
          search: { redirect: redirectTo },
          replace: true,
        })
      }

      // Check onboarding
      if (!user.country) {
        throw redirect({
          to: '/onboarding/country',
          search: { redirect: redirectTo },
          replace: true,
        })
      }

      if (!user.onboardingComplete) {
        throw redirect({
          to: '/onboarding/profile',
          search: { redirect: redirectTo },
          replace: true,
        })
      }

      // Fully set up - go to redirect URL or dashboard
      throw redirect({
        to: redirectTo || '/',
        replace: true,
      })
    } catch (error) {
      // If it's a redirect, rethrow
      if (error && typeof error === 'object' && 'to' in error) {
        throw error
      }
      // Otherwise, show login page (auth check failed)
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const { redirect: redirectTo } = Route.useSearch()
  const [error, setError] = useState<string | null>(null)

  // Use the redirect param or default to '/'
  const returnUrl = redirectTo || '/'

  const loginMutation = useMutation({
    mutationFn: () => getGoogleAuthUrl(returnUrl),
    onSuccess: (data) => {
      // Store state for verification after OAuth
      sessionStorage.setItem('oauth_state', JSON.stringify(data.state))
      // Redirect to Google OAuth
      window.location.href = data.url
    },
    onError: (err) => {
      if (err instanceof Error && err.message.includes('setup_required')) {
        navigate({ to: '/setup' })
      } else {
        setError('Failed to initiate login. Please try again.')
      }
    },
  })

  return (
    <AuthLayout
      title="Take control of"
      subtitle="your finances"
      description="Moneywright helps you understand your spending, grow your savings, and make smarter financial decisions."
    >
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Header */}
        <div className="mb-8">
          <motion.h1
            className="text-2xl font-semibold text-white tracking-tight font-display mb-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            Welcome back
          </motion.h1>
          <motion.p
            className="text-zinc-500 text-[15px]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            Sign in to continue to your financial dashboard
          </motion.p>
        </div>

        <div className="space-y-6">
          {/* Error message */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Google Sign In Button */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Button
              className="w-full h-12 rounded-xl text-[15px] font-medium bg-white hover:bg-zinc-100 text-zinc-900 transition-all duration-300 shadow-lg shadow-black/10"
              onClick={() => loginMutation.mutate()}
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <img src="/google.svg" alt="Google" className="mr-3 h-5 w-5" />
                  Continue with Google
                </>
              )}
            </Button>
          </motion.div>

          {/* Star on GitHub */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <a
              href="https://github.com/moneywright/moneywright"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <Star className="h-4 w-4" />
              <span className="text-sm">Star us on GitHub</span>
            </a>
          </motion.div>
        </div>
      </motion.div>
    </AuthLayout>
  )
}
