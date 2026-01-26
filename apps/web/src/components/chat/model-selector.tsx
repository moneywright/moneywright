/**
 * Model and thinking level selector components
 */

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import { Brain, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PROVIDER_LOGOS, getLogoInvertStyle } from '@/lib/provider-logos'
import type { ThinkingLevel } from './types'

// Provider logo component using local assets
function ProviderLogo({ provider, className }: { provider: string; className?: string }) {
  const logoSrc = PROVIDER_LOGOS[provider]
  if (!logoSrc) return null

  return (
    <img
      src={logoSrc}
      alt={`${provider} logo`}
      className={cn('size-4', className)}
      style={getLogoInvertStyle(provider)}
    />
  )
}

interface ChatProvider {
  id: string
  name: string
  models: ChatModel[]
  isConfigured?: boolean
}

interface ChatModel {
  id: string
  name: string
  supportsThinking?: boolean
}

interface ModelSelectorProps {
  providers: ChatProvider[]
  currentProvider: ChatProvider | undefined
  currentModel: ChatModel | undefined
  selectedProvider: string
  selectedModel: string
  onSelect: (providerId: string, modelId: string) => void
}

export function ModelSelector({
  providers,
  currentProvider,
  currentModel,
  selectedProvider,
  selectedModel,
  onSelect,
}: ModelSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          {currentProvider && <ProviderLogo provider={currentProvider.id} className="size-4" />}
          <span className="text-muted-foreground">{currentModel?.name || selectedModel}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {providers.map((provider) => {
          const providerConfigured = provider.isConfigured !== false
          return (
            <DropdownMenuSub key={provider.id}>
              <DropdownMenuSubTrigger
                className={cn('gap-2', !providerConfigured && 'opacity-50 cursor-not-allowed')}
                disabled={!providerConfigured}
              >
                <ProviderLogo
                  provider={provider.id}
                  className={cn('size-4', !providerConfigured && 'opacity-50')}
                />
                <span className="flex-1">{provider.name}</span>
                {!providerConfigured && (
                  <span className="text-[10px] text-muted-foreground">Not configured</span>
                )}
              </DropdownMenuSubTrigger>
              {providerConfigured && (
                <DropdownMenuSubContent>
                  {provider.models.map((model) => (
                    <DropdownMenuItem
                      key={model.id}
                      onSelect={() => onSelect(provider.id, model.id)}
                      className="justify-between"
                    >
                      <span className="flex items-center gap-2">
                        {model.name}
                        {model.supportsThinking && (
                          <Brain className="h-3 w-3 text-muted-foreground" />
                        )}
                      </span>
                      {selectedProvider === provider.id && selectedModel === model.id && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              )}
            </DropdownMenuSub>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface ThinkingLevelSelectorProps {
  level: ThinkingLevel
  onChange: (level: ThinkingLevel) => void
  supportsThinking: boolean
}

export function ThinkingLevelSelector({
  level,
  onChange,
  supportsThinking,
}: ThinkingLevelSelectorProps) {
  if (!supportsThinking) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('gap-1.5', level !== 'off' ? 'text-primary' : 'text-muted-foreground')}
        >
          <Brain className="h-4 w-4" />
          <span className="capitalize">{level === 'off' ? 'Thinking' : level}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Thinking Level</DropdownMenuLabel>
        {(['off', 'low', 'medium', 'high'] as const).map((lvl) => (
          <DropdownMenuItem
            key={lvl}
            onSelect={() => onChange(lvl)}
            className="justify-between capitalize"
          >
            {lvl}
            {level === lvl && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
