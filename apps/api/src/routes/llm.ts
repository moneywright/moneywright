import { Hono } from 'hono'
import { z } from 'zod/v4'
import { auth, type AuthVariables } from '../middleware/auth'
import { getLLMSettings, setLLMSettings } from '../services/config'
import { createLLMClient } from '../llm'
import { generateText } from 'ai'
import { logger } from '../lib/logger'
import { AI_PROVIDERS } from '../lib/ai'
import { listCachedBanks, clearParserCache, getParserCodes } from '../lib/pdf'
import {
  getOllamaCustomModels,
  addOllamaCustomModel,
  removeOllamaCustomModel,
} from '../services/preferences'

const llmRoutes = new Hono<{ Variables: AuthVariables }>()

// Apply auth to all routes
llmRoutes.use('*', auth())

const LLM_PROVIDERS = ['openai', 'anthropic', 'google', 'vercel', 'ollama'] as const

/**
 * Update LLM settings request schema
 * Only API keys and Ollama base URL - no provider/model settings
 */
const updateSettingsSchema = z.object({
  ollamaBaseUrl: z.string().url().optional().nullable(),
  openaiApiKey: z.string().min(1).optional().nullable(),
  anthropicApiKey: z.string().min(1).optional().nullable(),
  googleAiApiKey: z.string().min(1).optional().nullable(),
  vercelApiKey: z.string().min(1).optional().nullable(),
})

/**
 * GET /llm/settings
 * Get current LLM settings (API keys are masked)
 */
llmRoutes.get('/settings', async (c) => {
  const settings = await getLLMSettings()

  // Return which providers are configured (don't expose actual keys)
  return c.json({
    ollamaBaseUrl: settings.ollamaBaseUrl,
    hasOpenaiApiKey: !!settings.openaiApiKey,
    hasAnthropicApiKey: !!settings.anthropicApiKey,
    hasGoogleAiApiKey: !!settings.googleAiApiKey,
    hasVercelApiKey: !!settings.vercelApiKey,
    isConfigured: settings.isConfigured,
  })
})

/**
 * PUT /llm/settings
 * Update LLM settings (API keys only)
 */
llmRoutes.put('/settings', async (c) => {
  const body = await c.req.json().catch(() => ({}))

  // Validate request body
  const result = updateSettingsSchema.safeParse(body)
  if (!result.success) {
    return c.json(
      {
        error: 'validation_error',
        message: result.error.issues[0]?.message || 'Invalid request',
      },
      400
    )
  }

  try {
    await setLLMSettings(result.data)

    // Return updated settings
    const settings = await getLLMSettings()

    return c.json({
      ollamaBaseUrl: settings.ollamaBaseUrl,
      hasOpenaiApiKey: !!settings.openaiApiKey,
      hasAnthropicApiKey: !!settings.anthropicApiKey,
      hasGoogleAiApiKey: !!settings.googleAiApiKey,
      hasVercelApiKey: !!settings.vercelApiKey,
      isConfigured: settings.isConfigured,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update settings'
    return c.json({ error: 'update_failed', message }, 400)
  }
})

/**
 * GET /llm/providers
 * Get available providers and their models
 */
llmRoutes.get('/providers', async (c) => {
  const userId = c.get('userId')
  const settings = await getLLMSettings()

  // Get custom Ollama models for this user
  const ollamaCustomModels = await getOllamaCustomModels(userId)

  const providers = AI_PROVIDERS.map((providerConfig) => {
    // For Ollama, use custom models from preferences
    const models =
      providerConfig.id === 'ollama'
        ? ollamaCustomModels.map((m) => ({
            id: m.id,
            name: m.name,
            supportsParsing: true,
            supportsThinking: m.supportsThinking,
          }))
        : providerConfig.models

    return {
      code: providerConfig.id,
      label: providerConfig.name,
      models,
      requiresApiKey: providerConfig.id !== 'ollama',
      isConfigured:
        (providerConfig.id === 'openai' && !!settings.openaiApiKey) ||
        (providerConfig.id === 'anthropic' && !!settings.anthropicApiKey) ||
        (providerConfig.id === 'google' && !!settings.googleAiApiKey) ||
        (providerConfig.id === 'ollama' && !!settings.ollamaBaseUrl) ||
        (providerConfig.id === 'vercel' && !!settings.vercelApiKey),
    }
  })

  return c.json({ providers })
})

/**
 * Test LLM connection request schema
 * Accepts apiKey/ollamaBaseUrl directly for testing without saving
 */
const testConnectionSchema = z.object({
  provider: z.enum(LLM_PROVIDERS),
  model: z.string().min(1),
  apiKey: z.string().min(1).optional(),
  ollamaBaseUrl: z.string().url().optional(),
})

/**
 * POST /llm/test
 * Test LLM connection with specified provider and model
 * Can use provided apiKey/ollamaBaseUrl or fall back to saved settings
 */
llmRoutes.post('/test', async (c) => {
  const body = await c.req.json().catch(() => ({}))

  // Validate request body
  const result = testConnectionSchema.safeParse(body)
  if (!result.success) {
    return c.json(
      {
        error: 'validation_error',
        message: 'Provider and model are required',
      },
      400
    )
  }

  const {
    provider,
    model,
    apiKey: providedApiKey,
    ollamaBaseUrl: providedOllamaBaseUrl,
  } = result.data

  try {
    // Get saved settings as fallback
    const settings = await getLLMSettings()

    // Use provided apiKey or fall back to saved settings
    let apiKey: string | undefined
    let ollamaBaseUrl: string | undefined

    switch (provider) {
      case 'openai':
        apiKey = providedApiKey || settings.openaiApiKey || undefined
        if (!apiKey) {
          return c.json({ error: 'not_configured', message: 'OpenAI API key is required' }, 400)
        }
        break
      case 'anthropic':
        apiKey = providedApiKey || settings.anthropicApiKey || undefined
        if (!apiKey) {
          return c.json({ error: 'not_configured', message: 'Anthropic API key is required' }, 400)
        }
        break
      case 'google':
        apiKey = providedApiKey || settings.googleAiApiKey || undefined
        if (!apiKey) {
          return c.json({ error: 'not_configured', message: 'Google AI API key is required' }, 400)
        }
        break
      case 'vercel':
        apiKey = providedApiKey || settings.vercelApiKey || undefined
        if (!apiKey) {
          return c.json({ error: 'not_configured', message: 'Vercel API key is required' }, 400)
        }
        break
      case 'ollama':
        ollamaBaseUrl = providedOllamaBaseUrl || settings.ollamaBaseUrl || undefined
        if (!ollamaBaseUrl) {
          return c.json({ error: 'not_configured', message: 'Ollama base URL is required' }, 400)
        }
        break
    }

    const { model: llmClient, providerOptions } = createLLMClient({
      provider,
      model,
      apiKey,
      apiBaseUrl: ollamaBaseUrl,
    })

    const startTime = Date.now()

    const { text } = await generateText({
      model: llmClient,
      prompt: 'Say "Hello from Moneywright!" in exactly 5 words or less.',
      providerOptions,
    })

    const latency = Date.now() - startTime

    logger.debug(`[LLM] Test successful: ${text} (${latency}ms)`)

    return c.json({
      success: true,
      provider,
      model,
      response: text.trim(),
      latencyMs: latency,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error(`[LLM] Test failed:`, error)

    return c.json(
      {
        success: false,
        error: 'test_failed',
        message,
      },
      400
    )
  }
})

/**
 * Ollama model schema
 */
const ollamaModelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  supportsThinking: z.boolean().optional(),
})

/**
 * GET /llm/ollama/models
 * Get custom Ollama models for the current user
 */
llmRoutes.get('/ollama/models', async (c) => {
  const userId = c.get('userId')
  const models = await getOllamaCustomModels(userId)
  return c.json({ models })
})

/**
 * POST /llm/ollama/models
 * Add or update a custom Ollama model
 */
llmRoutes.post('/ollama/models', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => ({}))

  const result = ollamaModelSchema.safeParse(body)
  if (!result.success) {
    return c.json(
      {
        error: 'validation_error',
        message: result.error.issues[0]?.message || 'Invalid model data',
      },
      400
    )
  }

  const models = await addOllamaCustomModel(userId, result.data)
  return c.json({ models })
})

/**
 * DELETE /llm/ollama/models/:modelId
 * Remove a custom Ollama model
 */
llmRoutes.delete('/ollama/models/:modelId', async (c) => {
  const userId = c.get('userId')
  const modelId = c.req.param('modelId')

  const models = await removeOllamaCustomModel(userId, modelId)
  return c.json({ models })
})

/**
 * GET /llm/parser-cache
 * List all cached parser codes (for debugging/admin)
 */
llmRoutes.get('/parser-cache', async (c) => {
  const banks = await listCachedBanks()
  return c.json({ banks })
})

/**
 * GET /llm/parser-cache/:bankKey
 * Get all versions of parser code for a specific bank
 */
llmRoutes.get('/parser-cache/:bankKey', async (c) => {
  const bankKey = c.req.param('bankKey')
  const versions = await getParserCodes(bankKey)

  return c.json({
    bankKey,
    versions: versions.map((v) => ({
      version: v.version,
      detectedFormat: v.detectedFormat,
      dateFormat: v.dateFormat,
      confidence: v.confidence,
      createdAt: v.createdAt,
      successCount: v.successCount,
      failCount: v.failCount,
      // Don't send full code in list, only first 200 chars
      codePreview: v.code.slice(0, 200) + (v.code.length > 200 ? '...' : ''),
    })),
  })
})

/**
 * DELETE /llm/parser-cache/:bankKey
 * Clear all cached parser code for a bank (forces regeneration on next parse)
 */
llmRoutes.delete('/parser-cache/:bankKey', async (c) => {
  const bankKey = c.req.param('bankKey')
  const deletedCount = await clearParserCache(bankKey)

  return c.json({
    success: true,
    bankKey,
    deletedVersions: deletedCount,
    message: `Cleared ${deletedCount} cached parser version(s) for ${bankKey}. Next statement will generate new parser code.`,
  })
})

export default llmRoutes
