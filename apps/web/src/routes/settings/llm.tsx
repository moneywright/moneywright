import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AppLayout } from '@/components/domain/app-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, CheckCircle2, XCircle, Eye, EyeOff, Zap } from 'lucide-react'
import { toast } from 'sonner'
import {
  getLLMSettings,
  updateLLMSettings,
  getLLMProviders,
  testLLMConnection,
  type AIModel,
} from '@/lib/api'

export const Route = createFileRoute('/settings/llm')({
  component: LLMSettingsPage,
})

function LLMSettingsPage() {
  // Fetch settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['llm-settings'],
    queryFn: getLLMSettings,
  })

  // Fetch providers
  const { data: providers } = useQuery({
    queryKey: ['llm-providers'],
    queryFn: getLLMProviders,
  })

  if (settingsLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  // Render form only when settings are loaded
  return <LLMSettingsForm settings={settings} providers={providers} />
}

interface LLMSettingsFormProps {
  settings: Awaited<ReturnType<typeof getLLMSettings>> | undefined
  providers: Awaited<ReturnType<typeof getLLMProviders>> | undefined
}

function LLMSettingsForm({ settings, providers }: LLMSettingsFormProps) {
  const queryClient = useQueryClient()

  // Form state - initialized from settings
  const [provider, setProvider] = useState<string>(settings?.provider || 'openai')
  const [model, setModel] = useState<string>(settings?.model || '')
  const [parsingModel, setParsingModel] = useState<string>(settings?.parsingModel || '')
  const [categorizationModel, setCategorizationModel] = useState<string>(
    settings?.categorizationModel || ''
  )
  const [apiBaseUrl, setApiBaseUrl] = useState<string>(settings?.apiBaseUrl || '')
  const [openaiApiKey, setOpenaiApiKey] = useState<string>('')
  const [anthropicApiKey, setAnthropicApiKey] = useState<string>('')
  const [googleAiApiKey, setGoogleAiApiKey] = useState<string>('')
  const [vercelApiKey, setVercelApiKey] = useState<string>('')
  const [showOpenaiKey, setShowOpenaiKey] = useState(false)
  const [showAnthropicKey, setShowAnthropicKey] = useState(false)
  const [showGoogleKey, setShowGoogleKey] = useState(false)
  const [showVercelKey, setShowVercelKey] = useState(false)

  // Derive hasChanges instead of storing in state
  const hasChanges = settings
    ? provider !== settings.provider ||
      model !== settings.model ||
      parsingModel !== settings.parsingModel ||
      categorizationModel !== settings.categorizationModel ||
      apiBaseUrl !== (settings.apiBaseUrl || '') ||
      openaiApiKey !== '' ||
      anthropicApiKey !== '' ||
      googleAiApiKey !== '' ||
      vercelApiKey !== ''
    : false

  // Get models for selected provider
  const selectedProvider = providers?.find((p) => p.code === provider)
  const availableModels: AIModel[] = selectedProvider?.models || []

  // Update settings mutation
  const updateMutation = useMutation({
    mutationFn: updateLLMSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llm-settings'] })
      toast.success('Settings saved')
      // Clear API key fields after save
      setOpenaiApiKey('')
      setAnthropicApiKey('')
      setGoogleAiApiKey('')
      setVercelApiKey('')
    },
    onError: () => {
      toast.error('Failed to save settings')
    },
  })

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: testLLMConnection,
    onSuccess: (result) => {
      if (result.success) {
        toast.success(
          `Connection successful! Response: "${result.response}" (${result.latencyMs}ms)`
        )
      } else {
        toast.error(`Connection failed: ${result.message}`)
      }
    },
    onError: (error) => {
      toast.error(`Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    },
  })

  const handleSave = () => {
    const data: Parameters<typeof updateLLMSettings>[0] = {}

    if (provider !== settings?.provider) data.provider = provider
    if (model !== settings?.model) data.model = model
    if (parsingModel !== settings?.parsingModel) data.parsingModel = parsingModel
    if (categorizationModel !== settings?.categorizationModel)
      data.categorizationModel = categorizationModel
    if (apiBaseUrl !== (settings?.apiBaseUrl || '')) {
      data.apiBaseUrl = apiBaseUrl || null
    }
    if (openaiApiKey) data.openaiApiKey = openaiApiKey
    if (anthropicApiKey) data.anthropicApiKey = anthropicApiKey
    if (googleAiApiKey) data.googleAiApiKey = googleAiApiKey
    if (vercelApiKey) data.vercelApiKey = vercelApiKey

    updateMutation.mutate(data)
  }

  // Handle provider change - update models to defaults
  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider)
    const newProviderData = providers?.find((p) => p.code === newProvider)
    if (newProviderData && newProviderData.models.length > 0) {
      // Find recommended model or use first model
      const recommendedModel = newProviderData.models.find((m) => m.recommended)
      const defaultModel = recommendedModel?.id || newProviderData.models[0]?.id || ''
      setModel(defaultModel)
      setParsingModel(defaultModel)
      setCategorizationModel(defaultModel)
    }
  }

  if (settingsLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-2xl space-y-6">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">LLM Settings</h1>
          <p className="text-muted-foreground">
            Configure the language model used for statement parsing and categorization
          </p>
        </div>

        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Connection Status
              {settings?.isConfigured ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
            </CardTitle>
            <CardDescription>
              {settings?.isConfigured
                ? `Connected to ${settings.provider} using ${settings.model}`
                : 'LLM is not configured. Add an API key below to get started.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => testMutation.mutate()}
              disabled={!settings?.isConfigured || testMutation.isPending}
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
          </CardContent>
        </Card>

        {/* Provider & Model Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Model Configuration</CardTitle>
            <CardDescription>
              Choose your preferred LLM provider and models for different tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Provider Selection */}
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Select value={provider} onValueChange={handleProviderChange}>
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers?.map((p) => (
                    <SelectItem key={p.code} value={p.code}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Parsing Model */}
            <div className="space-y-2">
              <Label htmlFor="parsingModel">Statement Parsing Model</Label>
              <Select value={parsingModel} onValueChange={setParsingModel}>
                <SelectTrigger id="parsingModel">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                      {m.recommended && (
                        <span className="text-xs text-muted-foreground ml-2">(Recommended)</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Used for generating code to parse bank statements. Requires strong reasoning - use a
                capable model.
              </p>
            </div>

            {/* Categorization Model */}
            <div className="space-y-2">
              <Label htmlFor="categorizationModel">Categorization Model</Label>
              <Select value={categorizationModel} onValueChange={setCategorizationModel}>
                <SelectTrigger id="categorizationModel">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                      {m.recommended && (
                        <span className="text-xs text-muted-foreground ml-2">(Recommended)</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Used for categorizing transactions. Can use a smaller, faster model to reduce costs.
              </p>
            </div>

            {/* API Base URL */}
            <div className="space-y-2">
              <Label htmlFor="apiBaseUrl">API Base URL (Optional)</Label>
              <Input
                id="apiBaseUrl"
                placeholder={
                  provider === 'ollama' ? 'http://localhost:11434/api' : 'Leave empty for default'
                }
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Custom endpoint for self-hosted models or proxies
              </p>
            </div>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card>
          <CardHeader>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>
              Enter your API keys. Keys are encrypted and stored securely.
              {provider === 'ollama' && ' Ollama does not require an API key.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* OpenAI */}
            <div className="space-y-2">
              <Label htmlFor="openaiKey" className="flex items-center gap-2">
                OpenAI API Key
                {settings?.hasOpenaiApiKey && (
                  <span className="text-xs text-green-600 font-normal">(configured)</span>
                )}
              </Label>
              <div className="relative">
                <Input
                  id="openaiKey"
                  type={showOpenaiKey ? 'text' : 'password'}
                  placeholder={settings?.hasOpenaiApiKey ? '••••••••••••••••' : 'sk-...'}
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                >
                  {showOpenaiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Anthropic */}
            <div className="space-y-2">
              <Label htmlFor="anthropicKey" className="flex items-center gap-2">
                Anthropic API Key
                {settings?.hasAnthropicApiKey && (
                  <span className="text-xs text-green-600 font-normal">(configured)</span>
                )}
              </Label>
              <div className="relative">
                <Input
                  id="anthropicKey"
                  type={showAnthropicKey ? 'text' : 'password'}
                  placeholder={settings?.hasAnthropicApiKey ? '••••••••••••••••' : 'sk-ant-...'}
                  value={anthropicApiKey}
                  onChange={(e) => setAnthropicApiKey(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                >
                  {showAnthropicKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Google */}
            <div className="space-y-2">
              <Label htmlFor="googleKey" className="flex items-center gap-2">
                Google AI API Key
                {settings?.hasGoogleAiApiKey && (
                  <span className="text-xs text-green-600 font-normal">(configured)</span>
                )}
              </Label>
              <div className="relative">
                <Input
                  id="googleKey"
                  type={showGoogleKey ? 'text' : 'password'}
                  placeholder={settings?.hasGoogleAiApiKey ? '••••••••••••••••' : 'AIza...'}
                  value={googleAiApiKey}
                  onChange={(e) => setGoogleAiApiKey(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowGoogleKey(!showGoogleKey)}
                >
                  {showGoogleKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Vercel */}
            <div className="space-y-2">
              <Label htmlFor="vercelKey" className="flex items-center gap-2">
                Vercel AI Gateway API Key
                {settings?.hasVercelApiKey && (
                  <span className="text-xs text-green-600 font-normal">(configured)</span>
                )}
              </Label>
              <div className="relative">
                <Input
                  id="vercelKey"
                  type={showVercelKey ? 'text' : 'password'}
                  placeholder={
                    settings?.hasVercelApiKey ? '••••••••••••••••' : 'Enter Vercel API key'
                  }
                  value={vercelApiKey}
                  onChange={(e) => setVercelApiKey(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowVercelKey(!showVercelKey)}
                >
                  {showVercelKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Access multiple AI providers through a single API. Learn more at vercel.com/ai
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!hasChanges || updateMutation.isPending}>
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
