import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getSetupStatus,
  getLLMProviders,
  saveLLMSetup,
  saveGoogleSetup,
  completeSetup,
  testLLMConnection,
} from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Loader2,
  ExternalLink,
  Copy,
  Check,
  Lock,
  Github,
  Zap,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/setup')({
  component: SetupPage,
})

type SetupStep = 'llm' | 'google'

// Provider logo mapping
const providerLogos: Record<string, string> = {
  openai: '/openai.svg',
  anthropic: '/anthropic.svg',
  google: '/google.svg',
  ollama: '/ollama.svg',
  vercel: '/vercel.svg',
}

// Provider colors for selection ring
const providerColors: Record<string, string> = {
  openai: 'ring-emerald-500/50',
  anthropic: 'ring-orange-500/50',
  google: 'ring-blue-500/50',
  ollama: 'ring-purple-500/50',
  vercel: 'ring-white/50',
}

// Providers that need white fill (dark logos)
const invertedLogos = ['openai', 'vercel', 'ollama']

function SetupPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Current step
  const [currentStep, setCurrentStep] = useState<SetupStep>('llm')

  // LLM form state
  const [provider, setProvider] = useState<string>('')
  const [apiKey, setApiKey] = useState<string>('')
  const [apiBaseUrl, setApiBaseUrl] = useState<string>('')

  // Google OAuth form state
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [appUrl, setAppUrl] = useState('http://localhost:7777')

  // UI state
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch setup status
  const { data: setupStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['setup-status'],
    queryFn: getSetupStatus,
  })

  // Fetch LLM providers
  const { data: providers } = useQuery({
    queryKey: ['llm-providers'],
    queryFn: getLLMProviders,
  })

  // Get selected provider
  const selectedProvider = providers?.find((p) => p.code === provider)

  // Handle provider selection
  const handleProviderSelect = (newProvider: string) => {
    setProvider(newProvider)
    setApiKey('')
  }

  // LLM setup mutation
  const llmMutation = useMutation({
    mutationFn: saveLLMSetup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setup-status'] })
      toast.success('AI provider configured!')
      // If auth is enabled, go to Google step, otherwise complete
      if (setupStatus?.authEnabled) {
        setCurrentStep('google')
      } else {
        completeMutation.mutate()
      }
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to save configuration')
    },
  })

  // Google OAuth setup mutation
  const googleMutation = useMutation({
    mutationFn: saveGoogleSetup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setup-status'] })
      toast.success('Google OAuth configured!')
      completeMutation.mutate()
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to save Google configuration')
    },
  })

  // Complete setup mutation
  const completeMutation = useMutation({
    mutationFn: completeSetup,
    onSuccess: () => {
      toast.success('Setup complete!')
      navigate({ to: setupStatus?.authEnabled ? '/login' : '/', replace: true })
    },
  })

  // Test LLM connection
  const testMutation = useMutation({
    mutationFn: async () => {
      await saveLLMSetup({
        provider,
        model: '',
        apiKey: apiKey || undefined,
        apiBaseUrl: apiBaseUrl || null,
      })
      return testLLMConnection()
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Connection successful!`)
      } else {
        toast.error(`Connection failed: ${result.message}`)
      }
    },
    onError: (err) => {
      toast.error(`Test failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    },
  })

  // Handle LLM form submit
  const handleLLMSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!provider) {
      setError('Please select a provider')
      return
    }

    if (selectedProvider?.requiresApiKey && !apiKey) {
      setError('API key is required for this provider')
      return
    }

    llmMutation.mutate({
      provider,
      model: '', // Model will be selected per-statement
      apiKey: apiKey || undefined,
      apiBaseUrl: apiBaseUrl || null,
    })
  }

  // Handle Google OAuth form submit
  const handleGoogleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!clientId.trim() || !clientSecret.trim()) {
      setError('Both Client ID and Client Secret are required')
      return
    }

    googleMutation.mutate({
      googleClientId: clientId,
      googleClientSecret: clientSecret,
      appUrl: appUrl || undefined,
    })
  }

  // Copy redirect URI to clipboard
  const copyRedirectUri = () => {
    const uri = `${appUrl}/auth/google/callback`
    navigator.clipboard.writeText(uri)
    setCopied(true)
    toast.success('Copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  if (statusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    )
  }

  const redirectUri = `${appUrl}/auth/google/callback`

  return (
    <div className="min-h-screen flex bg-[#09090b]">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-10 relative overflow-hidden border-r border-zinc-800/50">
        {/* Gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <img src="/logo.png" alt="Moneywright" className="h-9 w-9" />
          <span className="text-lg font-semibold text-white">Moneywright</span>
        </div>

        {/* Center content */}
        <div className="relative z-10 flex flex-col items-center justify-center flex-1">
          {/* Logo with glow */}
          <div className="relative mb-10">
            <div className="absolute inset-0 blur-[80px] bg-gradient-to-r from-emerald-500/40 via-cyan-500/40 to-teal-500/40 rounded-full scale-150" />
            <img src="/logo.png" alt="Moneywright" className="relative h-40 w-40" />
          </div>

          {/* Tagline */}
          <h1 className="text-4xl font-bold text-white text-center mb-3 tracking-tight">
            Take control of
          </h1>
          <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-teal-400 text-center mb-5">
            your finances
          </h2>
          <p className="text-zinc-500 text-center max-w-sm text-[15px] leading-relaxed">
            AI-powered expense tracking, investment analysis, and personalized financial insights.
          </p>
        </div>

        {/* GitHub link */}
        <div className="relative z-10">
          <a
            href="https://github.com/moneywright/moneywright"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
          >
            <Github className="h-4 w-4" />
            <span>Star on GitHub</span>
          </a>
        </div>
      </div>

      {/* Right Panel - Setup Form */}
      <div className="flex-1 flex flex-col justify-center px-8 lg:px-16 py-12 relative">
        <div className="w-full max-w-lg mx-auto">
          {/* LLM Setup */}
          {currentStep === 'llm' && (
            <>
              <div className="mb-10">
                <h1 className="text-2xl font-semibold text-white mb-2">Choose your AI provider</h1>
                <p className="text-zinc-500 text-[15px]">
                  Select the AI provider you'd like to use for expense categorization and analysis.
                </p>
              </div>

              <form onSubmit={handleLLMSubmit} className="space-y-8">
                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                  </div>
                )}

                {/* Provider Selection - Card Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {providers?.map((p) => (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => handleProviderSelect(p.code)}
                      className={cn(
                        'group relative flex flex-col items-center gap-3 p-5 rounded-xl border transition-all duration-200',
                        provider === p.code
                          ? `bg-zinc-800/80 border-zinc-600 ring-2 ${providerColors[p.code] || 'ring-emerald-500/50'}`
                          : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800/50 hover:border-zinc-700'
                      )}
                    >
                      <div className="h-10 w-10 flex items-center justify-center">
                        <img
                          src={providerLogos[p.code]}
                          alt={p.label}
                          className={cn(
                            'h-8 w-8 object-contain transition-all',
                            provider === p.code
                              ? 'opacity-100'
                              : 'opacity-60 group-hover:opacity-80',
                            invertedLogos.includes(p.code) && 'invert brightness-0 invert'
                          )}
                        />
                      </div>
                      <span
                        className={cn(
                          'text-sm font-medium transition-colors',
                          provider === p.code
                            ? 'text-white'
                            : 'text-zinc-400 group-hover:text-zinc-300'
                        )}
                      >
                        {p.label}
                      </span>
                      {provider === p.code && (
                        <div className="absolute top-2 right-2">
                          <Check className="h-4 w-4 text-emerald-400" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* API Key - Show after provider selection */}
                {provider && (
                  <div className="space-y-5 pt-2">
                    {/* API Key */}
                    {selectedProvider?.requiresApiKey && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="apiKey" className="text-zinc-400 text-sm">
                            API Key
                          </Label>
                          <a
                            href={
                              provider === 'openai'
                                ? 'https://platform.openai.com/api-keys'
                                : provider === 'anthropic'
                                  ? 'https://console.anthropic.com/settings/keys'
                                  : provider === 'google'
                                    ? 'https://aistudio.google.com/app/apikey'
                                    : provider === 'vercel'
                                      ? 'https://vercel.com/docs/ai-gateway'
                                      : '#'
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
                          >
                            Get API key
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        <Input
                          id="apiKey"
                          type="password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder={
                            provider === 'openai'
                              ? 'sk-...'
                              : provider === 'anthropic'
                                ? 'sk-ant-...'
                                : provider === 'google'
                                  ? 'AIza...'
                                  : 'Enter API key'
                          }
                          className="bg-zinc-900 border-zinc-800 text-white h-11 placeholder:text-zinc-600 focus:ring-emerald-500/20 focus:border-zinc-600"
                        />
                      </div>
                    )}

                    {/* API Base URL (for Ollama) */}
                    {provider === 'ollama' && (
                      <div className="space-y-2">
                        <Label htmlFor="apiBaseUrl" className="text-zinc-400 text-sm">
                          API Base URL
                        </Label>
                        <Input
                          id="apiBaseUrl"
                          type="text"
                          value={apiBaseUrl}
                          onChange={(e) => setApiBaseUrl(e.target.value)}
                          placeholder="http://localhost:11434/api"
                          className="bg-zinc-900 border-zinc-800 text-white h-11 placeholder:text-zinc-600 focus:ring-emerald-500/20 focus:border-zinc-600"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                {provider && (
                  <div className="space-y-3 pt-2">
                    {/* Test Connection */}
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-11 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800/50 hover:border-zinc-700"
                      onClick={() => testMutation.mutate()}
                      disabled={
                        testMutation.isPending || (!apiKey && selectedProvider?.requiresApiKey)
                      }
                    >
                      {testMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <Zap className="mr-2 h-4 w-4" />
                          Test Connection
                        </>
                      )}
                    </Button>

                    {/* Continue Button */}
                    <Button
                      type="submit"
                      className="w-full h-11 bg-white text-black hover:bg-zinc-200 font-medium"
                      disabled={llmMutation.isPending}
                    >
                      {llmMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          Continue
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>

                    {/* Security note */}
                    <p className="text-center text-zinc-600 text-xs flex items-center justify-center gap-1.5 pt-2">
                      <Lock className="h-3 w-3" />
                      API keys are encrypted and stored locally
                    </p>
                  </div>
                )}
              </form>
            </>
          )}

          {/* Google OAuth Setup */}
          {currentStep === 'google' && (
            <>
              <div className="mb-10">
                <h1 className="text-2xl font-semibold text-white mb-2">Configure Google OAuth</h1>
                <p className="text-zinc-500 text-[15px]">
                  Set up Google authentication for secure user login.
                </p>
              </div>

              <form onSubmit={handleGoogleSubmit} className="space-y-6">
                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                  </div>
                )}

                {/* Help link */}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 transition-all"
                >
                  <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                    <img src="/google.svg" alt="Google" className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">Google Cloud Console</p>
                    <p className="text-zinc-500 text-xs">Create OAuth 2.0 credentials</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-zinc-600" />
                </a>

                {/* Google Client ID */}
                <div className="space-y-2">
                  <Label htmlFor="clientId" className="text-zinc-400 text-sm">
                    Client ID
                  </Label>
                  <Input
                    id="clientId"
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="123456789-abc.apps.googleusercontent.com"
                    className="bg-zinc-900 border-zinc-800 text-white h-11 placeholder:text-zinc-600 focus:ring-emerald-500/20 focus:border-zinc-600"
                  />
                </div>

                {/* Google Client Secret */}
                <div className="space-y-2">
                  <Label htmlFor="clientSecret" className="text-zinc-400 text-sm">
                    Client Secret
                  </Label>
                  <Input
                    id="clientSecret"
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="GOCSPX-..."
                    className="bg-zinc-900 border-zinc-800 text-white h-11 placeholder:text-zinc-600 focus:ring-emerald-500/20 focus:border-zinc-600"
                  />
                </div>

                {/* App URL */}
                <div className="space-y-2">
                  <Label htmlFor="appUrl" className="text-zinc-400 text-sm">
                    Application URL
                  </Label>
                  <Input
                    id="appUrl"
                    type="text"
                    value={appUrl}
                    onChange={(e) => setAppUrl(e.target.value)}
                    placeholder="http://localhost:7777"
                    className="bg-zinc-900 border-zinc-800 text-white h-11 placeholder:text-zinc-600 focus:ring-emerald-500/20 focus:border-zinc-600"
                  />
                </div>

                {/* OAuth Redirect URI */}
                <div className="space-y-2">
                  <Label className="text-zinc-400 text-sm">Redirect URI</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-emerald-400 font-mono text-sm truncate">
                      {redirectUri}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-11 w-11 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800/50 hover:border-zinc-700 shrink-0"
                      onClick={copyRedirectUri}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-600">
                    Add this URL to your Google OAuth authorized redirect URIs
                  </p>
                </div>

                {/* Actions */}
                <div className="space-y-3 pt-4">
                  <Button
                    type="submit"
                    className="w-full h-11 bg-white text-black hover:bg-zinc-200 font-medium"
                    disabled={googleMutation.isPending}
                  >
                    {googleMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        Complete Setup
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>

                  {/* Back button */}
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full h-11 text-zinc-500 hover:text-white hover:bg-zinc-800/50"
                    onClick={() => setCurrentStep('llm')}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to AI Setup
                  </Button>

                  {/* Security note */}
                  <p className="text-center text-zinc-600 text-xs flex items-center justify-center gap-1.5 pt-2">
                    <Lock className="h-3 w-3" />
                    Credentials are encrypted and stored locally
                  </p>
                </div>
              </form>
            </>
          )}
        </div>

        {/* Mobile logo */}
        <div className="lg:hidden absolute top-6 left-6 flex items-center gap-2">
          <img src="/logo.png" alt="Moneywright" className="h-8 w-8" />
          <span className="text-white font-semibold">Moneywright</span>
        </div>
      </div>
    </div>
  )
}
