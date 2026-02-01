/**
 * LLM Client Factory
 * Creates model instances for different providers using Vercel AI SDK
 */

import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGateway } from '@ai-sdk/gateway'
import { createOllama } from 'ollama-ai-provider-v2'
import { wrapLanguageModel, type LanguageModel } from 'ai'
import { devToolsMiddleware } from '@ai-sdk/devtools'
import {
  LLM_PROVIDERS,
  type LLMProvider,
  getDefaultParsingModelId,
  getProviderModels,
  getGatewayProviderOptions,
  type GatewayProviderOptions,
} from '../lib/ai'

/**
 * Check if DevTools should be enabled (development only)
 */
const isDevToolsEnabled = process.env.APP_ENV === 'development'

export interface LLMConfig {
  provider: LLMProvider
  model: string
  apiKey?: string
  apiBaseUrl?: string
}

/**
 * Result from creating an LLM client
 * Includes both the model and any provider-specific options (e.g., gateway restrictions)
 */
export interface LLMClientResult {
  model: LanguageModel
  providerOptions: GatewayProviderOptions
}

/**
 * Get default model for a provider
 */
export function getDefaultModel(provider: LLMProvider): string {
  return getDefaultParsingModelId(provider)
}

/**
 * Get available models for a provider
 */
export function getAvailableModels(provider: LLMProvider): string[] {
  return getProviderModels(provider).map((m) => m.id)
}

/**
 * Optionally wrap model with DevTools middleware in development
 * SDK version mismatch requires type assertion - LanguageModel vs LanguageModelV3
 */
function maybeWrapWithDevTools(model: LanguageModel): LanguageModel {
  if (isDevToolsEnabled) {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    return wrapLanguageModel({
      model: model as any,
      middleware: devToolsMiddleware(),
    }) as any
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }
  return model
}

/**
 * Create an LLM client based on configuration
 * Returns both the model and any provider-specific options (e.g., gateway restrictions)
 */
export function createLLMClient(config?: Partial<LLMConfig>): LLMClientResult {
  const provider = config?.provider || (process.env.LLM_PROVIDER as LLMProvider) || 'openai'
  const model = config?.model || process.env.LLM_MODEL || getDefaultModel(provider)
  const apiBaseUrl = config?.apiBaseUrl || process.env.LLM_API_BASE_URL

  let llmModel: LanguageModel
  let providerOptions: GatewayProviderOptions = {}

  switch (provider) {
    case 'openai': {
      const openai = createOpenAI({
        apiKey: config?.apiKey || process.env.OPENAI_API_KEY,
        baseURL: apiBaseUrl,
      })
      llmModel = openai(model)
      break
    }

    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey: config?.apiKey || process.env.ANTHROPIC_API_KEY,
        baseURL: apiBaseUrl,
      })
      llmModel = anthropic(model)
      break
    }

    case 'google': {
      const google = createGoogleGenerativeAI({
        apiKey: config?.apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        baseURL: apiBaseUrl,
      })
      llmModel = google(model)
      break
    }

    case 'ollama': {
      const ollama = createOllama({
        baseURL: apiBaseUrl || 'http://localhost:11434/api',
      })
      llmModel = ollama(model)
      break
    }

    case 'vercel': {
      const gateway = createGateway({
        apiKey: config?.apiKey || process.env.VERCEL_API_KEY,
        baseURL: apiBaseUrl,
      })
      // modelId is in format "provider/model" e.g. "openai/gpt-4o"
      llmModel = gateway(model)
      // Get gateway provider options (e.g., restrict to specific providers)
      providerOptions = getGatewayProviderOptions(model)
      break
    }

    default:
      throw new Error(`Unsupported LLM provider: ${provider}`)
  }

  return {
    model: maybeWrapWithDevTools(llmModel),
    providerOptions,
  }
}

/**
 * Check if LLM is configured (sync version using env vars only)
 */
export function isLLMConfigured(): boolean {
  const provider = (process.env.LLM_PROVIDER as LLMProvider) || 'openai'

  switch (provider) {
    case 'openai':
      return !!process.env.OPENAI_API_KEY
    case 'anthropic':
      return !!process.env.ANTHROPIC_API_KEY
    case 'google':
      return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY
    case 'ollama':
      return true // Ollama doesn't require an API key
    case 'vercel':
      return !!process.env.VERCEL_API_KEY
    default:
      return false
  }
}

/**
 * Parse model override string to extract provider and model
 * Format: "provider:model" (e.g., "openai:gpt-4o") or just "model" (uses first configured provider)
 */
function parseModelOverride(
  modelOverride: string | undefined,
  settings: {
    openaiApiKey: string | null
    anthropicApiKey: string | null
    googleAiApiKey: string | null
    vercelApiKey: string | null
    ollamaBaseUrl: string | null
  }
): { provider: LLMProvider; model: string } {
  if (!modelOverride) {
    // Find first configured provider and use its default model
    if (settings.openaiApiKey) return { provider: 'openai', model: getDefaultModel('openai') }
    if (settings.anthropicApiKey)
      return { provider: 'anthropic', model: getDefaultModel('anthropic') }
    if (settings.googleAiApiKey) return { provider: 'google', model: getDefaultModel('google') }
    if (settings.vercelApiKey) return { provider: 'vercel', model: getDefaultModel('vercel') }
    if (settings.ollamaBaseUrl) return { provider: 'ollama', model: getDefaultModel('ollama') }
    throw new Error('No LLM provider configured')
  }

  // Check if format is "provider:model"
  const colonIndex = modelOverride.indexOf(':')
  if (colonIndex > 0) {
    const provider = modelOverride.slice(0, colonIndex) as LLMProvider
    const model = modelOverride.slice(colonIndex + 1)
    if (LLM_PROVIDERS.includes(provider)) {
      return { provider, model }
    }
  }

  // Just model name - infer provider from model name
  if (
    modelOverride.startsWith('gpt-') ||
    modelOverride.startsWith('o1') ||
    modelOverride.startsWith('o3')
  ) {
    return { provider: 'openai', model: modelOverride }
  }
  if (modelOverride.startsWith('claude-')) {
    return { provider: 'anthropic', model: modelOverride }
  }
  if (modelOverride.startsWith('gemini-')) {
    return { provider: 'google', model: modelOverride }
  }
  if (modelOverride.includes('/')) {
    // Vercel gateway format: "provider/model"
    return { provider: 'vercel', model: modelOverride }
  }

  // Assume Ollama for unknown models (e.g., llama3, mistral)
  return { provider: 'ollama', model: modelOverride }
}

/**
 * Create LLM client using database settings for API keys
 * Accepts model override in format "provider:model" (e.g., "openai:gpt-4o")
 * or just model name which will be inferred
 * Returns both the model and any provider-specific options (e.g., gateway restrictions)
 */
export async function createLLMClientFromSettings(
  modelOverride?: string
): Promise<LLMClientResult> {
  // Import here to avoid circular dependency
  const { getLLMSettings } = await import('../services/config')
  const settings = await getLLMSettings()

  if (!settings.isConfigured) {
    throw new Error('LLM is not configured. Please configure at least one provider.')
  }

  const { provider, model } = parseModelOverride(modelOverride, settings)

  // Get the appropriate API key for the provider
  let apiKey: string | undefined
  switch (provider) {
    case 'openai':
      apiKey = settings.openaiApiKey || undefined
      break
    case 'anthropic':
      apiKey = settings.anthropicApiKey || undefined
      break
    case 'google':
      apiKey = settings.googleAiApiKey || undefined
      break
    case 'vercel':
      apiKey = settings.vercelApiKey || undefined
      break
    case 'ollama':
      // Ollama doesn't need API key
      break
  }

  return createLLMClient({
    provider,
    model,
    apiKey,
    apiBaseUrl: provider === 'ollama' ? settings.ollamaBaseUrl || undefined : undefined,
  })
}

export { LLM_PROVIDERS, type LLMProvider }
