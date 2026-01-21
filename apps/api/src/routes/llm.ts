import { Hono } from 'hono'
import { z } from 'zod/v4'
import { auth, type AuthVariables } from '../middleware/auth'
import { getLLMSettings, setLLMSettings } from '../services/config'
import { createLLMClient } from '../llm'
import { generateText } from 'ai'
import { logger } from '../lib/logger'
import { AI_PROVIDERS, getDefaultParsingModelId } from '../lib/ai'
import { listCachedBanks, clearParserCache, getParserCodes } from '../lib/pdf'

const llmRoutes = new Hono<{ Variables: AuthVariables }>()

// Apply auth to all routes
llmRoutes.use('*', auth())

const LLM_PROVIDERS = ['openai', 'anthropic', 'google', 'ollama', 'vercel'] as const

/**
 * Update LLM settings request schema
 */
const updateSettingsSchema = z.object({
  provider: z.enum(LLM_PROVIDERS).optional(),
  model: z.string().min(1).optional(),
  apiBaseUrl: z.string().url().optional().nullable(),
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

  // Mask API keys for security
  return c.json({
    provider: settings.provider,
    model: settings.model,
    apiBaseUrl: settings.apiBaseUrl,
    hasOpenaiApiKey: !!settings.openaiApiKey,
    hasAnthropicApiKey: !!settings.anthropicApiKey,
    hasGoogleAiApiKey: !!settings.googleAiApiKey,
    hasVercelApiKey: !!settings.vercelApiKey,
    isConfigured: settings.isConfigured,
  })
})

/**
 * PUT /llm/settings
 * Update LLM settings
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
      provider: settings.provider,
      model: settings.model,
      apiBaseUrl: settings.apiBaseUrl,
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
  const providers = AI_PROVIDERS.map((providerConfig) => ({
    code: providerConfig.id,
    label: providerConfig.name,
    models: providerConfig.models,
    requiresApiKey: providerConfig.id !== 'ollama',
  }))

  return c.json({ providers })
})

/**
 * POST /llm/test
 * Test LLM connection with current settings
 */
llmRoutes.post('/test', async (c) => {
  try {
    const settings = await getLLMSettings()

    if (!settings.isConfigured) {
      return c.json(
        {
          error: 'not_configured',
          message: `LLM is not configured. Please provide an API key for ${settings.provider}.`,
        },
        400
      )
    }

    // Get API key for current provider
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

    // Use saved model or default model for the provider
    const modelId = settings.model || getDefaultParsingModelId(settings.provider)

    const model = createLLMClient({
      provider: settings.provider,
      model: modelId,
      apiKey,
      apiBaseUrl: settings.apiBaseUrl || undefined,
    })

    const startTime = Date.now()

    const { text } = await generateText({
      model,
      prompt: 'Say "Hello from Moneywright!" in exactly 5 words or less.',
    })

    const latency = Date.now() - startTime

    logger.debug(`[LLM] Test successful: ${text} (${latency}ms)`)

    return c.json({
      success: true,
      provider: settings.provider,
      model: modelId,
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
