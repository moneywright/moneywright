/**
 * AI/LLM Provider constants and configuration
 */

/**
 * LLM Providers
 */
export const LLM_PROVIDERS = ['openai', 'anthropic', 'google', 'vercel', 'ollama'] as const
export type LLMProvider = (typeof LLM_PROVIDERS)[number]

/**
 * AI Model definition
 */
export interface AIModel {
  id: string
  name: string
  /** Model is capable of parsing statements (requires tool use, code generation) */
  supportsParsing?: boolean
  /** Recommended model for parsing statements */
  recommendedForParsing?: boolean
  /** Recommended model for categorization */
  recommendedForCategorization?: boolean
  /** Recommended model for chat */
  recommendedForChat?: boolean
  supportsThinking?: boolean
  reasoningBuiltIn?: boolean
}

/**
 * AI Provider configuration
 */
export interface AIProviderConfig {
  id: LLMProvider
  name: string
  models: AIModel[]
}

/**
 * Available AI providers and their models
 * Updated January 2026
 *
 * Sources:
 * - OpenAI: https://platform.openai.com/docs/models
 * - Anthropic: https://docs.anthropic.com/en/docs/about-claude/models/overview
 * - Google: https://ai.google.dev/gemini-api/docs/models
 */
export const AI_PROVIDERS: AIProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      {
        id: 'gpt-5.2',
        name: 'GPT-5.2',
        supportsParsing: true,
        supportsThinking: true,
      },
      {
        id: 'gpt-5-mini',
        name: 'GPT-5 Mini',
        supportsParsing: true,
        recommendedForCategorization: true,
        recommendedForParsing: true,
        recommendedForChat: true,
        supportsThinking: true,
      },
      { id: 'gpt-5-nano', name: 'GPT-5 Nano', supportsThinking: true },
      { id: 'gpt-4.1', name: 'GPT-4.1', supportsParsing: true, supportsThinking: true },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      {
        id: 'claude-opus-4-5',
        name: 'Claude Opus 4.5',
        supportsParsing: true,
        supportsThinking: true,
      },
      {
        id: 'claude-sonnet-4-5',
        name: 'Claude Sonnet 4.5',
        supportsParsing: true,
        supportsThinking: true,
        recommendedForChat: true,
      },
      {
        id: 'claude-haiku-4-5',
        name: 'Claude Haiku 4.5',
        recommendedForParsing: true,
        recommendedForCategorization: true,
        supportsParsing: true,
        supportsThinking: true,
      },
    ],
  },
  {
    id: 'google',
    name: 'Google',
    models: [
      {
        id: 'gemini-3-pro-preview',
        name: 'Gemini 3 Pro',
        supportsParsing: true,
        supportsThinking: true,
      },
      {
        id: 'gemini-3-flash-preview',
        name: 'Gemini 3 Flash',
        supportsParsing: true,
        recommendedForParsing: true,
        recommendedForCategorization: true,
        recommendedForChat: true,
        supportsThinking: true,
      },
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        supportsParsing: true,
        supportsThinking: true,
      },
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        supportsThinking: true,
      },
    ],
  },
  {
    id: 'vercel',
    name: 'Vercel AI Gateway',
    models: [
      // Anthropic models via Gateway
      {
        id: 'anthropic/claude-opus-4-5',
        name: 'Claude Opus 4.5',
        supportsParsing: true,
        supportsThinking: true,
      },
      {
        id: 'anthropic/claude-sonnet-4-5',
        name: 'Claude Sonnet 4.5',
        supportsParsing: true,
        supportsThinking: true,
        recommendedForChat: true,
      },
      {
        id: 'anthropic/claude-haiku-4-5',
        name: 'Claude Haiku 4.5',
        supportsParsing: true,
        supportsThinking: true,
      },
      // OpenAI models via Gateway
      { id: 'openai/gpt-5.2', name: 'GPT-5.2', supportsParsing: true, supportsThinking: true },
      {
        id: 'openai/gpt-5-mini',
        name: 'GPT-5 Mini',
        supportsParsing: true,
        supportsThinking: true,
      },
      { id: 'openai/gpt-5-nano', name: 'GPT-5 Nano', supportsThinking: true },
      { id: 'openai/gpt-4.1', name: 'GPT-4.1', supportsParsing: true, supportsThinking: true },
      // Google models via Gateway
      {
        id: 'google/gemini-3-pro-preview',
        name: 'Gemini 3 Pro',
        supportsParsing: true,
        supportsThinking: true,
      },
      {
        id: 'google/gemini-3-flash-preview',
        name: 'Gemini 3 Flash',
        supportsParsing: true,
        supportsThinking: true,
        recommendedForCategorization: true,
        recommendedForParsing: true,
      },
      {
        id: 'google/gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        supportsParsing: true,
        supportsThinking: true,
      },
      { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', supportsThinking: true },
      // xAI Grok models via Gateway
      { id: 'xai/grok-4', name: 'Grok 4', supportsParsing: true },
      {
        id: 'xai/grok-4.1-fast-reasoning',
        name: 'Grok 4.1 Fast Reasoning',
        supportsThinking: true,
        reasoningBuiltIn: true,
      },
      {
        id: 'xai/grok-4.1-fast-non-reasoning',
        name: 'Grok 4.1 Fast',
      },
      // Other models via Gateway
      {
        id: 'zai/glm-4.7',
        name: 'GLM 4.7',
        supportsParsing: true,
        supportsThinking: true,
      },
      {
        id: 'moonshotai/kimi-k2.5',
        name: 'Kimi K2.5',
        supportsParsing: true,
        supportsThinking: true,
      },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    // Models are user-defined and stored in preferences
    models: [],
  },
]

/**
 * Get provider configuration by ID
 */
export function getProviderConfig(providerId: LLMProvider): AIProviderConfig | undefined {
  return AI_PROVIDERS.find((p) => p.id === providerId)
}

/**
 * Get provider name by ID
 */
export function getProviderName(providerId: LLMProvider): string {
  return getProviderConfig(providerId)?.name ?? providerId
}

/**
 * Check if a model ID is valid for a given provider
 */
export function isValidModel(providerId: LLMProvider, modelId: string): boolean {
  const provider = getProviderConfig(providerId)
  if (!provider) return false
  return provider.models.some((m) => m.id === modelId)
}

/**
 * Get the recommended model for parsing statements
 */
export function getRecommendedParsingModel(providerId: LLMProvider): AIModel | undefined {
  const provider = getProviderConfig(providerId)
  if (!provider) return undefined
  // First try to find recommended parsing model, then any parsing-capable model
  return (
    provider.models.find((m) => m.recommendedForParsing && m.supportsParsing) ??
    provider.models.find((m) => m.supportsParsing) ??
    provider.models[0]
  )
}

/**
 * Get the recommended model for categorization
 */
export function getRecommendedCategorizationModel(providerId: LLMProvider): AIModel | undefined {
  const provider = getProviderConfig(providerId)
  if (!provider) return undefined
  return provider.models.find((m) => m.recommendedForCategorization) ?? provider.models[0]
}

/**
 * Get the recommended model for chat
 */
export function getRecommendedChatModel(providerId: LLMProvider): AIModel | undefined {
  const provider = getProviderConfig(providerId)
  if (!provider) return undefined
  return provider.models.find((m) => m.recommendedForChat) ?? provider.models[0]
}

/**
 * Get all models that support parsing for a provider
 */
export function getParsingModels(providerId: LLMProvider): AIModel[] {
  const provider = getProviderConfig(providerId)
  if (!provider) return []
  return provider.models.filter((m) => m.supportsParsing)
}

/**
 * Get all models for a provider
 */
export function getProviderModels(providerId: LLMProvider): AIModel[] {
  return getProviderConfig(providerId)?.models ?? []
}

/**
 * Get the default parsing model ID for a provider
 */
export function getDefaultParsingModelId(provider: LLMProvider): string {
  const recommended = getRecommendedParsingModel(provider)
  return recommended?.id ?? 'gpt-5-mini'
}

/**
 * Get the default categorization model ID for a provider
 */
export function getDefaultCategorizationModelId(provider: LLMProvider): string {
  const recommended = getRecommendedCategorizationModel(provider)
  return recommended?.id ?? 'gpt-5-mini'
}
