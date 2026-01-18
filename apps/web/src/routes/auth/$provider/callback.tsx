import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { exchangeOAuthCode } from '@/lib/api'
import { Loader2 } from 'lucide-react'

export const Route = createFileRoute('/auth/$provider/callback')({
  component: OAuthCallback,
})

function OAuthCallback() {
  const navigate = useNavigate()
  const { provider: _provider } = Route.useParams()

  // Check URL params once on mount
  const urlParams =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const code = urlParams?.get('code')
  const state = urlParams?.get('state')
  const errorParam = urlParams?.get('error')

  // Determine initial error from URL params
  const urlError = errorParam
    ? `OAuth error: ${errorParam}`
    : !code || !state
      ? 'Missing code or state parameter'
      : null

  const exchangeMutation = useMutation({
    mutationFn: ({ code, state }: { code: string; state: string }) =>
      exchangeOAuthCode(code, state),
    onSuccess: (data) => {
      // Clear stored state
      sessionStorage.removeItem('oauth_state')

      // Navigate to redirect URL or dashboard
      const redirectUrl = data.redirectUrl || '/'
      navigate({ to: redirectUrl, replace: true })
    },
  })

  useEffect(() => {
    // Only exchange if we have valid params and haven't started yet
    if (
      code &&
      state &&
      !urlError &&
      !exchangeMutation.isPending &&
      !exchangeMutation.isSuccess &&
      !exchangeMutation.isError
    ) {
      exchangeMutation.mutate({ code, state })
    }
  }, [code, state, urlError, exchangeMutation])

  const error =
    urlError ||
    (exchangeMutation.error instanceof Error
      ? exchangeMutation.error.message
      : exchangeMutation.error
        ? 'Authentication failed'
        : null)

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-xl font-semibold text-destructive">Authentication Failed</h1>
          <p className="text-muted-foreground">{error}</p>
          <button
            onClick={() => navigate({ to: '/login', replace: true })}
            className="text-primary hover:underline"
          >
            Return to login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  )
}
