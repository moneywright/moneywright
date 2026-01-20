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
} from '../lib/constants'

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
 */
function maybeWrapWithDevTools(model: LanguageModel): LanguageModel {
  if (isDevToolsEnabled) {
    return wrapLanguageModel({
      model,
      middleware: devToolsMiddleware(),
    })
  }
  return model
}

/**
 * Create an LLM client based on configuration
 */
export function createLLMClient(config?: Partial<LLMConfig>): LanguageModel {
  const provider = config?.provider || (process.env.LLM_PROVIDER as LLMProvider) || 'openai'
  const model = config?.model || process.env.LLM_MODEL || getDefaultModel(provider)
  const apiBaseUrl = config?.apiBaseUrl || process.env.LLM_API_BASE_URL

  let llmModel: LanguageModel

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
      break
    }

    default:
      throw new Error(`Unsupported LLM provider: ${provider}`)
  }

  return maybeWrapWithDevTools(llmModel)
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
 * Create LLM client using database settings
 * Use this for background jobs like statement parsing
 * @param modelOverride - Optional model ID to use instead of the saved setting
 */
export async function createLLMClientFromSettings(modelOverride?: string): Promise<LanguageModel> {
  // Import here to avoid circular dependency
  const { getLLMSettings } = await import('../services/config')
  const settings = await getLLMSettings()

  if (!settings.isConfigured) {
    throw new Error(`LLM is not configured. Please configure ${settings.provider} API key.`)
  }

  // Get the appropriate API key for the provider
  let apiKey: string | undefined
  switch (settings.provider) {
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
  }

  // Use modelOverride if provided, otherwise fall back to saved setting or default
  const modelId = modelOverride || settings.model || getDefaultModel(settings.provider)

  return createLLMClient({
    provider: settings.provider,
    model: modelId,
    apiKey,
    apiBaseUrl: settings.apiBaseUrl || undefined,
  })
}

export { LLM_PROVIDERS, type LLMProvider }
