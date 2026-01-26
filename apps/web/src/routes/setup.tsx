import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'motion/react'
import { getSetupStatus, updateSetup, testLLMConnection } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Loader2,
  ExternalLink,
  Check,
  Lock,
  Zap,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  MessageSquare,
  Layers,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { AuthLayout, type AuthStep } from '@/components/auth/auth-layout'
import { PROVIDER_LOGOS, INVERTED_LOGO_PROVIDERS } from '@/lib/provider-logos'

export const Route = createFileRoute('/setup')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: (search.redirect as string) || undefined,
  }),
  component: SetupPage,
})

// Step definitions for AuthLayout
const SETUP_STEPS: AuthStep[] = [{ id: 'llm', label: 'AI Provider' }]

function SetupPage() {
  const navigate = useNavigate()
  const { redirect: redirectTo } = Route.useSearch()
  const queryClient = useQueryClient()

  // Currently expanded provider (for entering API key)
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState<string>('')
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState<string>('http://localhost:11434/api')

  // UI state
  const [error, setError] = useState<string | null>(null)

  // Fetch setup status (includes providers with isConfigured status)
  const { data: setupStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['setup-status'],
    queryFn: getSetupStatus,
  })

  // Providers come from setupStatus now (with isConfigured field)
  const providers = setupStatus?.providers

  // Get expanded provider details
  const expandedProviderDetails = providers?.find((p) => p.id === expandedProvider)

  // Check if provider is configured
  const isProviderConfigured = (providerId: string) => {
    return (
      setupStatus?.llm?.configuredProviders?.[
        providerId as keyof typeof setupStatus.llm.configuredProviders
      ] ?? false
    )
  }

  // Check if any provider is configured
  const hasAnyConfiguredProvider = providers?.some((p) => isProviderConfigured(p.id)) ?? false

  // Handle provider click - toggle expand/collapse
  const handleProviderClick = (providerId: string) => {
    if (expandedProvider === providerId) {
      // Collapse if already expanded
      setExpandedProvider(null)
      setApiKey('')
      setError(null)
    } else {
      // Expand new provider
      setExpandedProvider(providerId)
      setApiKey('')
      setError(null)
    }
  }

  // Build LLM update payload
  const buildLLMPayload = () => {
    const llm: Record<string, string | null | undefined> = {}

    if (expandedProvider === 'ollama') {
      llm.ollamaBaseUrl = ollamaBaseUrl || null
    } else if (apiKey) {
      const keyMap: Record<string, string> = {
        openai: 'openaiApiKey',
        anthropic: 'anthropicApiKey',
        google: 'googleAiApiKey',
        vercel: 'vercelApiKey',
      }
      const keyField = keyMap[expandedProvider!]
      if (keyField) {
        llm[keyField] = apiKey
      }
    }

    return llm
  }

  // Save mutation - saves and collapses
  const saveMutation = useMutation({
    mutationFn: () => updateSetup({ llm: buildLLMPayload() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setup'] })
      queryClient.invalidateQueries({ queryKey: ['setup-status'] })
      toast.success('AI provider configured!')
      // Collapse the provider
      setExpandedProvider(null)
      setApiKey('')
      setError(null)
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to save configuration')
    },
  })

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      const payload: { provider: string; model: string; apiKey?: string; ollamaBaseUrl?: string } =
        {
          provider: expandedProvider!,
          model: expandedProviderDetails?.models?.[0]?.id || '',
        }

      if (expandedProvider === 'ollama') {
        payload.ollamaBaseUrl = ollamaBaseUrl || undefined
      } else if (apiKey) {
        payload.apiKey = apiKey
      }

      return testLLMConnection(payload)
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Connection successful!')
      } else {
        toast.error(`Connection failed: ${result.message}`)
      }
    },
    onError: (err) => {
      toast.error(`Test failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    },
  })

  // Handle save for expanded provider
  const handleSave = () => {
    setError(null)

    if (!expandedProvider) return

    // API key required for providers that need it (unless already configured)
    const providerAlreadyConfigured = isProviderConfigured(expandedProvider)
    if (expandedProviderDetails?.requiresApiKey && !apiKey && !providerAlreadyConfigured) {
      setError('API key is required for this provider')
      return
    }

    saveMutation.mutate()
  }

  // Handle continue - navigate to onboarding
  const handleContinue = () => {
    navigate({ to: '/onboarding/country', search: { redirect: redirectTo }, replace: true })
  }

  if (statusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030303]">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
      </div>
    )
  }

  return (
    <AuthLayout
      currentStep={1}
      steps={SETUP_STEPS}
      title="Connect your"
      subtitle="AI provider"
      description="Connect your preferred AI provider to unlock intelligent categorization, spending insights, and natural language queries about your finances."
      features={[
        {
          icon: <Sparkles className="w-4 h-4" />,
          title: 'Smart Categorization',
          description: 'AI automatically categorizes your transactions accurately',
        },
        {
          icon: <MessageSquare className="w-4 h-4" />,
          title: 'Natural Language',
          description: 'Ask questions about your spending in plain English',
        },
        {
          icon: <Layers className="w-4 h-4" />,
          title: 'Multiple Providers',
          description: 'Choose from OpenAI, Anthropic, Google, or use your own',
        },
      ]}
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
            Choose your AI provider
          </motion.h1>
          <motion.p
            className="text-zinc-500 text-[15px]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            Select and configure AI providers for expense categorization.
          </motion.p>
        </div>

        <div className="space-y-6">
          {/* Provider Selection - Grid */}
          <motion.div
            className="grid grid-cols-3 gap-2.5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {providers?.map((p, index) => {
              const isConfigured = isProviderConfigured(p.id)
              const isExpanded = expandedProvider === p.id
              return (
                <motion.button
                  key={p.id}
                  type="button"
                  onClick={() => handleProviderClick(p.id)}
                  className={cn(
                    'group relative flex flex-col items-center gap-2.5 p-4 rounded-xl border transition-all duration-200',
                    isExpanded
                      ? 'bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/20'
                      : isConfigured
                        ? 'bg-zinc-900/50 border-emerald-500/20 hover:bg-zinc-800/50 hover:border-emerald-500/30'
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
                      src={PROVIDER_LOGOS[p.id]}
                      alt={p.name}
                      className={cn(
                        'h-7 w-7 object-contain transition-all',
                        isExpanded
                          ? 'opacity-100'
                          : isConfigured
                            ? 'opacity-80'
                            : 'opacity-50 group-hover:opacity-70',
                        INVERTED_LOGO_PROVIDERS.includes(p.id) && 'brightness-0 invert'
                      )}
                    />
                  </div>
                  <span
                    className={cn(
                      'text-xs font-medium transition-colors',
                      isExpanded
                        ? 'text-white'
                        : isConfigured
                          ? 'text-zinc-300'
                          : 'text-zinc-500 group-hover:text-zinc-300'
                    )}
                  >
                    {p.name}
                  </span>
                  {/* Show checkmark if expanded or configured */}
                  {isExpanded ? (
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
                  ) : isConfigured ? (
                    <div className="absolute top-2 right-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500/60" />
                    </div>
                  ) : null}
                </motion.button>
              )
            })}
          </motion.div>

          {/* Expanded Provider Form */}
          <AnimatePresence mode="wait">
            {expandedProvider && (
              <motion.div
                key={expandedProvider}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{
                  duration: 0.3,
                  ease: [0.22, 1, 0.36, 1],
                  height: { duration: 0.3 },
                  opacity: { duration: 0.2 },
                }}
                className="overflow-hidden -mx-1"
              >
                <div className="space-y-4 pt-2 px-1">
                  {/* Error message */}
                  {error && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                      {error}
                    </div>
                  )}

                  {/* Show configured status */}
                  {isProviderConfigured(expandedProvider) && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>API key already configured. Enter a new key to replace it.</span>
                    </div>
                  )}

                  {/* API Key Input */}
                  {expandedProviderDetails?.requiresApiKey && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-zinc-400">
                          API Key{' '}
                          {isProviderConfigured(expandedProvider) && (
                            <span className="text-zinc-600">(optional)</span>
                          )}
                        </label>
                        <a
                          href={
                            expandedProvider === 'openai'
                              ? 'https://platform.openai.com/api-keys'
                              : expandedProvider === 'anthropic'
                                ? 'https://console.anthropic.com/settings/keys'
                                : expandedProvider === 'google'
                                  ? 'https://aistudio.google.com/app/apikey'
                                  : expandedProvider === 'vercel'
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
                          isProviderConfigured(expandedProvider)
                            ? '••••••••••••••••'
                            : expandedProvider === 'openai'
                              ? 'sk-...'
                              : expandedProvider === 'anthropic'
                                ? 'sk-ant-...'
                                : expandedProvider === 'google'
                                  ? 'AIza...'
                                  : 'Enter API key'
                        }
                        className="h-11 px-4 rounded-xl bg-zinc-900/50 border-zinc-800/80 text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                      />
                    </div>
                  )}

                  {/* Ollama Base URL */}
                  {expandedProvider === 'ollama' && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-400">Ollama Base URL</label>
                      <Input
                        type="text"
                        value={ollamaBaseUrl}
                        onChange={(e) => setOllamaBaseUrl(e.target.value)}
                        placeholder="http://localhost:11434/api"
                        className="h-11 px-4 rounded-xl bg-zinc-900/50 border-zinc-800/80 text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                      />
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 h-11 rounded-xl border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800/50 hover:border-zinc-700"
                      onClick={() => testMutation.mutate()}
                      disabled={
                        testMutation.isPending ||
                        (!apiKey &&
                          expandedProviderDetails?.requiresApiKey &&
                          !isProviderConfigured(expandedProvider)) ||
                        (expandedProvider === 'ollama' && !ollamaBaseUrl.trim())
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
                          Test
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSave}
                      disabled={
                        saveMutation.isPending ||
                        (!apiKey &&
                          expandedProviderDetails?.requiresApiKey &&
                          !isProviderConfigured(expandedProvider)) ||
                        (expandedProvider === 'ollama' && !ollamaBaseUrl.trim())
                      }
                      className="flex-1 h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 transition-none hover:brightness-110"
                    >
                      {saveMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Save
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Continue Button - Only show when at least one provider is configured */}
          <AnimatePresence>
            {hasAnyConfiguredProvider && !expandedProvider && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <Button
                  type="button"
                  onClick={handleContinue}
                  className="w-full h-12 rounded-xl text-[15px] font-medium bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 transition-none hover:brightness-110"
                >
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Security note */}
          <motion.p
            className="text-center text-zinc-600 text-xs flex items-center justify-center gap-1.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Lock className="h-3 w-3" />
            API keys are encrypted and stored locally
          </motion.p>
        </div>
      </motion.div>
    </AuthLayout>
  )
}
