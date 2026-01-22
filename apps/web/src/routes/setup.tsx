import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'motion/react'
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
import { Loader2, ExternalLink, Copy, Check, Lock, Zap, ArrowRight, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { AuthLayout, type AuthStep } from '@/components/auth/auth-layout'

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

// Providers that need white fill (dark logos)
const invertedLogos = ['openai', 'vercel', 'ollama']

// Step definitions for AuthLayout
const SETUP_STEPS: AuthStep[] = [
  { id: 'llm', label: 'AI Provider' },
  { id: 'google', label: 'Authentication' },
]

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
      queryClient.invalidateQueries({ queryKey: ['setupStatus'] })
      queryClient.invalidateQueries({ queryKey: ['setup-status'] })
      toast.success('Setup complete!')
      // If auth is enabled, go to login. Otherwise, go to onboarding.
      navigate({ to: setupStatus?.authEnabled ? '/login' : '/onboarding/country', replace: true })
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
      <div className="min-h-screen flex items-center justify-center bg-[#030303]">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
      </div>
    )
  }

  const redirectUri = `${appUrl}/auth/google/callback`
  const currentStepIndex = currentStep === 'llm' ? 1 : 2

  return (
    <AuthLayout
      currentStep={currentStepIndex}
      steps={setupStatus?.authEnabled ? SETUP_STEPS : [SETUP_STEPS[0]!]}
      title="Get started"
      subtitle="in minutes"
    >
      <AnimatePresence mode="wait">
        {/* LLM Setup */}
        {currentStep === 'llm' && (
          <motion.div
            key="llm"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
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
                Choose your AI provider
              </motion.h1>
              <motion.p
                className="text-zinc-500 text-[15px]"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                Select the AI provider for expense categorization and analysis.
              </motion.p>
            </div>

            <form onSubmit={handleLLMSubmit} className="space-y-6">
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

              {/* Provider Selection - Grid */}
              <motion.div
                className="grid grid-cols-3 gap-2.5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                {providers?.map((p, index) => (
                  <motion.button
                    key={p.code}
                    type="button"
                    onClick={() => handleProviderSelect(p.code)}
                    className={cn(
                      'group relative flex flex-col items-center gap-2.5 p-4 rounded-xl border transition-all duration-200',
                      provider === p.code
                        ? 'bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/20'
                        : 'bg-zinc-900/50 border-zinc-800/80 hover:bg-zinc-800/50 hover:border-zinc-700'
                    )}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 + index * 0.03 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="h-9 w-9 flex items-center justify-center">
                      <img
                        src={providerLogos[p.code]}
                        alt={p.label}
                        className={cn(
                          'h-7 w-7 object-contain transition-all',
                          provider === p.code ? 'opacity-100' : 'opacity-50 group-hover:opacity-70',
                          invertedLogos.includes(p.code) && 'brightness-0 invert'
                        )}
                      />
                    </div>
                    <span
                      className={cn(
                        'text-xs font-medium transition-colors',
                        provider === p.code
                          ? 'text-white'
                          : 'text-zinc-500 group-hover:text-zinc-300'
                      )}
                    >
                      {p.label}
                    </span>
                    {provider === p.code && (
                      <motion.div
                        className="absolute top-2 right-2"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      >
                        <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                        </div>
                      </motion.div>
                    )}
                  </motion.button>
                ))}
              </motion.div>

              {/* API Key - Show after provider selection */}
              <AnimatePresence mode="wait">
                {provider && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 overflow-hidden"
                  >
                    {/* API Key */}
                    {selectedProvider?.requiresApiKey && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-zinc-400">API Key</label>
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
                            className="text-xs text-zinc-500 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                          >
                            Get API key
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        <Input
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
                          className="h-11 px-4 rounded-xl bg-zinc-900/50 border-zinc-800/80 text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                        />
                      </div>
                    )}

                    {/* API Base URL (for Ollama) */}
                    {provider === 'ollama' && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">API Base URL</label>
                        <Input
                          type="text"
                          value={apiBaseUrl}
                          onChange={(e) => setApiBaseUrl(e.target.value)}
                          placeholder="http://localhost:11434/api"
                          className="h-11 px-4 rounded-xl bg-zinc-900/50 border-zinc-800/80 text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                        />
                      </div>
                    )}

                    {/* Test Connection */}
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-11 rounded-xl border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800/50 hover:border-zinc-700"
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
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Continue Button */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Button
                  type="submit"
                  disabled={!provider || llmMutation.isPending}
                  className={cn(
                    'w-full h-12 rounded-xl text-[15px] font-medium transition-all duration-300',
                    provider
                      ? 'bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/25'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  )}
                >
                  {llmMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>

                {/* Security note */}
                <p className="text-center text-zinc-600 text-xs flex items-center justify-center gap-1.5 mt-4">
                  <Lock className="h-3 w-3" />
                  API keys are encrypted and stored locally
                </p>
              </motion.div>
            </form>
          </motion.div>
        )}

        {/* Google OAuth Setup */}
        {currentStep === 'google' && (
          <motion.div
            key="google"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
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
                Configure Google OAuth
              </motion.h1>
              <motion.p
                className="text-zinc-500 text-[15px]"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                Set up Google authentication for secure user login.
              </motion.p>
            </div>

            <form onSubmit={handleGoogleSubmit} className="space-y-5">
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

              {/* Help link */}
              <motion.a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-800/50 transition-all group"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                whileHover={{ scale: 1.01 }}
              >
                <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center group-hover:bg-zinc-700 transition-colors">
                  <img src="/google.svg" alt="Google" className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">Google Cloud Console</p>
                  <p className="text-zinc-500 text-xs">Create OAuth 2.0 credentials</p>
                </div>
                <ExternalLink className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
              </motion.a>

              {/* Form fields */}
              <motion.div
                className="space-y-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                {/* Google Client ID */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Client ID</label>
                  <Input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="123456789-abc.apps.googleusercontent.com"
                    className="h-11 px-4 rounded-xl bg-zinc-900/50 border-zinc-800/80 text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                  />
                </div>

                {/* Google Client Secret */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Client Secret</label>
                  <Input
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="GOCSPX-..."
                    className="h-11 px-4 rounded-xl bg-zinc-900/50 border-zinc-800/80 text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                  />
                </div>

                {/* App URL */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Application URL</label>
                  <Input
                    type="text"
                    value={appUrl}
                    onChange={(e) => setAppUrl(e.target.value)}
                    placeholder="http://localhost:7777"
                    className="h-11 px-4 rounded-xl bg-zinc-900/50 border-zinc-800/80 text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                  />
                </div>

                {/* OAuth Redirect URI */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Redirect URI</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-emerald-400 font-mono text-sm truncate">
                      {redirectUri}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-11 w-11 rounded-xl border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800/50 hover:border-zinc-700 shrink-0"
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
              </motion.div>

              {/* Actions */}
              <motion.div
                className="space-y-3 pt-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Button
                  type="submit"
                  disabled={googleMutation.isPending}
                  className="w-full h-12 rounded-xl text-[15px] font-medium bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/25 transition-all duration-300"
                >
                  {googleMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
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
                  className="w-full h-11 rounded-xl text-zinc-500 hover:text-white hover:bg-zinc-800/50"
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
              </motion.div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthLayout>
  )
}
