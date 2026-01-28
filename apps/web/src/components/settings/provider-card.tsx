/**
 * Individual AI Provider card component
 */

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Loader2, Eye, EyeOff, Zap, Pencil, MoreVertical, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { updateLLMSettings, testLLMConnection } from '@/lib/api'
import {
  PROVIDER_LOGOS,
  getLogoInvertStyle,
  PROVIDER_INFO,
  type LLMSettings,
  type LLMProviders,
} from './types'
import { OllamaModelsModal } from './ollama-models-modal'

interface ProviderCardProps {
  code: string
  settings: LLMSettings | undefined
  providers: LLMProviders | undefined
}

export function ProviderCard({ code, settings, providers }: ProviderCardProps) {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [ollamaUrl, setOllamaUrl] = useState(
    settings?.ollamaBaseUrl || 'http://localhost:11434/api'
  )
  const [isTesting, setIsTesting] = useState(false)
  const [showModelsModal, setShowModelsModal] = useState(false)

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: updateLLMSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llm-settings'] })
      queryClient.invalidateQueries({ queryKey: ['llm-providers'] })
      toast.success('Settings saved')
      setApiKeyInput('')
      setIsEditing(false)
    },
    onError: () => {
      toast.error('Failed to save settings')
    },
  })

  // Test mutation
  const testMutation = useMutation({
    mutationFn: testLLMConnection,
    onSuccess: (result) => {
      setIsTesting(false)
      if (result.success) {
        toast.success(`Connected! Response: "${result.response}" (${result.latencyMs}ms)`)
      } else {
        toast.error(`Failed: ${result.message}`)
      }
    },
    onError: (error) => {
      setIsTesting(false)
      toast.error(`Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    },
  })

  const info = PROVIDER_INFO[code]
  if (!info) return null

  const isConfigured = (() => {
    if (code === 'ollama') return !!settings?.ollamaBaseUrl
    if (code === 'openai') return !!settings?.hasOpenaiApiKey
    if (code === 'anthropic') return !!settings?.hasAnthropicApiKey
    if (code === 'google') return !!settings?.hasGoogleAiApiKey
    if (code === 'vercel') return !!settings?.hasVercelApiKey
    return false
  })()

  // Get Ollama models from providers
  const ollamaModels =
    code === 'ollama' ? providers?.find((p) => p.code === 'ollama')?.models || [] : []

  const handleSave = () => {
    const data: Parameters<typeof updateLLMSettings>[0] = {}

    if (code === 'ollama') {
      data.ollamaBaseUrl = ollamaUrl || null
    } else {
      if (!apiKeyInput) return
      if (code === 'openai') data.openaiApiKey = apiKeyInput
      else if (code === 'anthropic') data.anthropicApiKey = apiKeyInput
      else if (code === 'google') data.googleAiApiKey = apiKeyInput
      else if (code === 'vercel') data.vercelApiKey = apiKeyInput
    }

    updateMutation.mutate(data)
  }

  const handleRemove = () => {
    const data: Parameters<typeof updateLLMSettings>[0] = {}

    if (code === 'ollama') data.ollamaBaseUrl = null
    else if (code === 'openai') data.openaiApiKey = null
    else if (code === 'anthropic') data.anthropicApiKey = null
    else if (code === 'google') data.googleAiApiKey = null
    else if (code === 'vercel') data.vercelApiKey = null

    updateMutation.mutate(data)
  }

  const handleTest = () => {
    const provider = providers?.find((p) => p.code === code)
    if (!provider || provider.models.length === 0) return

    const model = provider.models[0]
    if (!model) return
    setIsTesting(true)
    testMutation.mutate({ provider: code, model: model.id })
  }

  const handleCancel = () => {
    setIsEditing(false)
    setApiKeyInput('')
  }

  const showForm = isEditing || !isConfigured

  return (
    <div
      className={cn(
        'group relative rounded-xl border bg-card transition-all duration-200',
        'hover:border-border-hover hover:shadow-sm',
        isConfigured ? 'border-primary/20' : 'border-border-subtle'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-0">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            'bg-surface-elevated border border-border-subtle'
          )}
        >
          <img
            src={PROVIDER_LOGOS[code]}
            alt={info.name}
            className="h-5 w-5 object-contain"
            style={getLogoInvertStyle(code)}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{info.name}</p>
          <p className="text-xs text-muted-foreground line-clamp-2">{info.description}</p>
        </div>
        {isConfigured && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleTest} disabled={testMutation.isPending}>
                <Zap className="mr-2 h-4 w-4" />
                Test Connection
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Update Key
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={handleRemove}>
                <Trash2 className="mr-2 h-4 w-4" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Content */}
      <div className="p-4 pt-3">
        {isConfigured && !showForm ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-muted-foreground">Connected</span>
              </div>
              {isTesting && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>

            {/* Ollama Models - compact view */}
            {code === 'ollama' && (
              <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
                <span className="text-xs text-muted-foreground">
                  {ollamaModels.length === 0
                    ? '0 models'
                    : ollamaModels.length === 1
                      ? '1 model'
                      : `${ollamaModels.length} models`}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setShowModelsModal(true)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {code === 'ollama' ? (
              <Input
                placeholder={info.placeholder}
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                className="h-9 text-sm"
              />
            ) : (
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  placeholder={info.placeholder}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="h-9 pr-10 text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              {isEditing && (
                <Button variant="ghost" size="sm" className="flex-1 h-8" onClick={handleCancel}>
                  Cancel
                </Button>
              )}
              <Button
                size="sm"
                className="flex-1 h-8"
                onClick={handleSave}
                disabled={updateMutation.isPending || (code !== 'ollama' && !apiKeyInput)}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isConfigured ? (
                  'Save'
                ) : (
                  'Enable'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Ollama Models Modal */}
      {code === 'ollama' && (
        <OllamaModelsModal
          open={showModelsModal}
          onOpenChange={setShowModelsModal}
          models={ollamaModels}
        />
      )}
    </div>
  )
}
