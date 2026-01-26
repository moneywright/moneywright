/**
 * Chat input component
 */

import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputSubmit,
} from '@/components/ai-elements/prompt-input'
import { ModelSelector, ThinkingLevelSelector } from './model-selector'
import type { ThinkingLevel } from './types'

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

interface ChatInputProps {
  input: string
  onInputChange: (value: string) => void
  onSubmit: () => void
  isLoading: boolean
  onCancel: () => void
  providers: ChatProvider[]
  currentProvider: ChatProvider | undefined
  currentModel: ChatModel | undefined
  selectedProvider: string
  selectedModel: string
  onModelSelect: (providerId: string, modelId: string) => void
  thinkingLevel: ThinkingLevel
  onThinkingLevelChange: (level: ThinkingLevel) => void
}

export function ChatInput({
  input,
  onInputChange,
  onSubmit,
  isLoading,
  onCancel,
  providers,
  currentProvider,
  currentModel,
  selectedProvider,
  selectedModel,
  onModelSelect,
  thinkingLevel,
  onThinkingLevelChange,
}: ChatInputProps) {
  return (
    <div className="fixed bottom-0 left-64 right-0 z-10">
      {/* Fade gradient */}
      <div className="h-24 bg-linear-to-t from-background to-transparent pointer-events-none" />
      {/* Input container */}
      <div className="pb-6 px-4 lg:px-12 bg-background">
        <div className="w-full lg:w-3xl lg:mx-auto">
          <PromptInput onSubmit={onSubmit} className="rounded-xl border-border-subtle bg-card">
            <PromptInputTextarea
              placeholder="Ask about your finances..."
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              disabled={isLoading}
              className="min-h-14"
            />
            <PromptInputFooter className="px-3 pb-3">
              <PromptInputTools className="gap-1">
                <ModelSelector
                  providers={providers}
                  currentProvider={currentProvider}
                  currentModel={currentModel}
                  selectedProvider={selectedProvider}
                  selectedModel={selectedModel}
                  onSelect={onModelSelect}
                />

                <ThinkingLevelSelector
                  level={thinkingLevel}
                  onChange={onThinkingLevelChange}
                  supportsThinking={currentModel?.supportsThinking || false}
                />
              </PromptInputTools>

              <PromptInputSubmit
                disabled={!input.trim() || isLoading}
                status={isLoading ? 'streaming' : undefined}
                onStop={onCancel}
              />
            </PromptInputFooter>
          </PromptInput>
          <p className="text-center text-xs text-muted-foreground mt-2">
            AI responses are for informational purposes only and should not be considered financial
            advice.
          </p>
        </div>
      </div>
    </div>
  )
}
