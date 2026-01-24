import { Hono } from 'hono'
import { z } from 'zod'
import { getLLMSettings, setLLMSettings } from '../services/config'
import { isAuthEnabled } from '../lib/startup'
import { SUPPORTED_COUNTRIES } from '../lib/constants'
import { AI_PROVIDERS } from '../lib/ai'

const setupRoutes = new Hono()

/**
 * GET /setup/auth
 * Returns only auth status - unauthenticated endpoint for initial app load
 */
setupRoutes.get('/auth', (c) => {
  return c.json({
    authEnabled: isAuthEnabled(),
  })
})

/**
 * GET /setup/countries
 * Returns list of supported countries for onboarding
 */
setupRoutes.get('/countries', (c) => {
  return c.json({
    countries: SUPPORTED_COUNTRIES.map((country) => ({
      code: country.code,
      name: country.name,
      currency: country.currency,
      currencySymbol: country.currencySymbol,
    })),
  })
})

/**
 * GET /setup
 * Returns setup configuration
 */
setupRoutes.get('/', async (c) => {
  const llmSettings = await getLLMSettings()
  const authEnabled = isAuthEnabled()

  const configuredProviders: Record<string, boolean> = {
    openai: !!llmSettings.openaiApiKey,
    anthropic: !!llmSettings.anthropicApiKey,
    google: !!llmSettings.googleAiApiKey,
    ollama: !!llmSettings.ollamaBaseUrl,
    vercel: !!llmSettings.vercelApiKey,
  }

  const providers = AI_PROVIDERS.map((providerConfig) => ({
    id: providerConfig.id,
    name: providerConfig.name,
    models: providerConfig.models,
    requiresApiKey: providerConfig.id !== 'ollama',
    isConfigured: configuredProviders[providerConfig.id] ?? false,
  }))

  return c.json({
    authEnabled,
    llm: {
      isConfigured: llmSettings.isConfigured,
      ollamaBaseUrl: llmSettings.ollamaBaseUrl,
      configuredProviders,
    },
    providers,
  })
})

/**
 * PATCH /setup
 * Update setup configuration (LLM settings only)
 *
 * Body structure:
 * {
 *   llm?: {
 *     ollamaBaseUrl?: string | null,
 *     openaiApiKey?: string | null,
 *     anthropicApiKey?: string | null,
 *     googleAiApiKey?: string | null,
 *     vercelApiKey?: string | null,
 *   }
 * }
 *
 * Note: Google OAuth must be configured via environment variables
 */
const patchSetupSchema = z.object({
  llm: z
    .object({
      ollamaBaseUrl: z.string().url().optional().nullable(),
      openaiApiKey: z.string().min(1).optional().nullable(),
      anthropicApiKey: z.string().min(1).optional().nullable(),
      googleAiApiKey: z.string().min(1).optional().nullable(),
      vercelApiKey: z.string().min(1).optional().nullable(),
    })
    .optional(),
})

setupRoutes.patch('/', async (c) => {
  try {
    const body = await c.req.json()
    const validated = patchSetupSchema.parse(body)

    // Update LLM settings if provided
    if (validated.llm) {
      await setLLMSettings({
        ollamaBaseUrl: validated.llm.ollamaBaseUrl,
        openaiApiKey: validated.llm.openaiApiKey,
        anthropicApiKey: validated.llm.anthropicApiKey,
        googleAiApiKey: validated.llm.googleAiApiKey,
        vercelApiKey: validated.llm.vercelApiKey,
      })
    }

    // Return updated status
    const llmSettings = await getLLMSettings()
    const authEnabled = isAuthEnabled()

    const configuredProviders: Record<string, boolean> = {
      openai: !!llmSettings.openaiApiKey,
      anthropic: !!llmSettings.anthropicApiKey,
      google: !!llmSettings.googleAiApiKey,
      ollama: !!llmSettings.ollamaBaseUrl,
      vercel: !!llmSettings.vercelApiKey,
    }

    const providers = AI_PROVIDERS.map((providerConfig) => ({
      id: providerConfig.id,
      name: providerConfig.name,
      models: providerConfig.models,
      requiresApiKey: providerConfig.id !== 'ollama',
      isConfigured: configuredProviders[providerConfig.id] ?? false,
    }))

    return c.json({
      authEnabled,
      llm: {
        isConfigured: llmSettings.isConfigured,
        ollamaBaseUrl: llmSettings.ollamaBaseUrl,
        configuredProviders,
      },
      providers,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'validation_error', issues: error.issues }, 400)
    }
    throw error
  }
})

export default setupRoutes
