import { Hono } from 'hono'
import { z } from 'zod'
import {
  getGoogleCredentials,
  setConfig,
  isSetupComplete,
  getLLMSettings,
  setLLMSettings,
} from '../services/config'
import { isAuthEnabled } from '../lib/startup'

const setupRoutes = new Hono()

/**
 * GET /setup/status
 * Check if initial setup is required
 */
setupRoutes.get('/status', async (c) => {
  const { isConfigured: googleConfigured } = await getGoogleCredentials()
  const llmSettings = await getLLMSettings()
  const setupComplete = await isSetupComplete()
  const authEnabled = isAuthEnabled()

  // Setup is required if:
  // 1. LLM is not configured (always required)
  // 2. Auth is enabled but Google OAuth is not configured
  const llmConfigured = llmSettings.isConfigured
  const googleRequired = authEnabled && !googleConfigured

  return c.json({
    setupRequired: !llmConfigured || googleRequired,
    llmConfigured,
    googleConfigured,
    authEnabled,
    setupComplete,
  })
})

/**
 * LLM Setup request schema
 */
const llmSetupSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google', 'ollama', 'vercel']),
  model: z.string().optional(), // Model is optional - will be selected per-statement
  apiKey: z.string().min(1).optional(),
  apiBaseUrl: z.string().url().optional().nullable(),
})

/**
 * POST /setup/llm
 * Save LLM configuration
 */
setupRoutes.post('/llm', async (c) => {
  try {
    const body = await c.req.json()
    const validated = llmSetupSchema.parse(body)

    // Build settings object based on provider
    const settings: Parameters<typeof setLLMSettings>[0] = {
      provider: validated.provider,
      model: validated.model || '', // Model will be selected per-statement
      apiBaseUrl: validated.apiBaseUrl,
    }

    // Set the API key for the correct provider
    if (validated.apiKey) {
      switch (validated.provider) {
        case 'openai':
          settings.openaiApiKey = validated.apiKey
          break
        case 'anthropic':
          settings.anthropicApiKey = validated.apiKey
          break
        case 'google':
          settings.googleAiApiKey = validated.apiKey
          break
        case 'vercel':
          settings.vercelApiKey = validated.apiKey
          break
      }
    }

    await setLLMSettings(settings)

    return c.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          error: 'validation_error',
          issues: error.issues,
        },
        400
      )
    }
    throw error
  }
})

/**
 * Google OAuth Setup request schema
 */
const googleSetupSchema = z.object({
  googleClientId: z.string().min(1, 'Google Client ID is required'),
  googleClientSecret: z.string().min(1, 'Google Client Secret is required'),
  appUrl: z.string().url().optional(),
})

/**
 * POST /setup/google
 * Save Google OAuth configuration
 */
setupRoutes.post('/google', async (c) => {
  try {
    const body = await c.req.json()
    const validated = googleSetupSchema.parse(body)

    // Save configuration to database
    await setConfig('google_client_id', validated.googleClientId)
    await setConfig('google_client_secret', validated.googleClientSecret)

    if (validated.appUrl) {
      await setConfig('app_url', validated.appUrl)
    }

    return c.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          error: 'validation_error',
          issues: error.issues,
        },
        400
      )
    }
    throw error
  }
})

/**
 * POST /setup/complete
 * Mark setup as complete
 */
setupRoutes.post('/complete', async (c) => {
  await setConfig('setup_completed', 'true')
  return c.json({ success: true })
})

/**
 * Legacy: POST /setup/config
 * Save initial configuration (kept for backwards compatibility)
 */
setupRoutes.post('/config', async (c) => {
  try {
    const body = await c.req.json()
    const validated = googleSetupSchema.parse(body)

    // Save configuration to database
    await setConfig('google_client_id', validated.googleClientId)
    await setConfig('google_client_secret', validated.googleClientSecret)

    if (validated.appUrl) {
      await setConfig('app_url', validated.appUrl)
    }

    // Mark setup as complete
    await setConfig('setup_completed', 'true')

    return c.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          error: 'validation_error',
          issues: error.issues,
        },
        400
      )
    }
    throw error
  }
})

/**
 * GET /setup/config
 * Get current configuration (masked secrets)
 */
setupRoutes.get('/config', async (c) => {
  const { clientId, isConfigured } = await getGoogleCredentials()

  return c.json({
    googleClientId: clientId ? `${clientId.slice(0, 20)}...` : null,
    googleClientSecretSet: isConfigured,
    isConfigured,
  })
})

export default setupRoutes
