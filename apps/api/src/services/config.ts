/**
 * Configuration service
 * Manages app configuration stored in database
 */

import { eq } from 'drizzle-orm'
import { db, tables, dbType } from '../db'
import { encrypt, decrypt } from '../lib/encryption'
import { getProviderModels } from '../lib/ai'

// Keys that should be encrypted
const ENCRYPTED_KEYS = [
  'google_client_secret',
  'openai_api_key',
  'anthropic_api_key',
  'google_ai_api_key',
  'vercel_api_key',
]

/**
 * Get a config value from database
 */
export async function getConfig(key: string): Promise<string | null> {
  const [row] = await db.select().from(tables.appConfig).where(eq(tables.appConfig.key, key))

  if (!row) return null

  // Decrypt if needed
  if (row.isEncrypted === '1') {
    try {
      return decrypt(row.value)
    } catch {
      return null
    }
  }

  return row.value
}

/**
 * Set a config value in database
 */
export async function setConfig(key: string, value: string): Promise<void> {
  const shouldEncrypt = ENCRYPTED_KEYS.includes(key)
  const storedValue = shouldEncrypt ? encrypt(value) : value
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  // Check if key exists
  const [existing] = await db.select().from(tables.appConfig).where(eq(tables.appConfig.key, key))

  if (existing) {
    await db
      .update(tables.appConfig)
      .set({
        value: storedValue,
        isEncrypted: shouldEncrypt ? '1' : '0',
        updatedAt: now as Date,
      })
      .where(eq(tables.appConfig.key, key))
  } else {
    await db.insert(tables.appConfig).values({
      key,
      value: storedValue,
      isEncrypted: shouldEncrypt ? '1' : '0',
    })
  }
}

/**
 * Delete a config value
 */
export async function deleteConfig(key: string): Promise<void> {
  await db.delete(tables.appConfig).where(eq(tables.appConfig.key, key))
}

/**
 * Get Google OAuth credentials
 * Priority: environment variables > database config
 */
export async function getGoogleCredentials(): Promise<{
  clientId: string | null
  clientSecret: string | null
  isConfigured: boolean
}> {
  // Check environment first
  let clientId = process.env.GOOGLE_CLIENT_ID || null
  let clientSecret = process.env.GOOGLE_CLIENT_SECRET || null

  // If not in env, check database
  if (!clientId) {
    clientId = await getConfig('google_client_id')
  }
  if (!clientSecret) {
    clientSecret = await getConfig('google_client_secret')
  }

  return {
    clientId,
    clientSecret,
    isConfigured: !!(clientId && clientSecret),
  }
}

/**
 * Get app URL for OAuth redirects
 */
export async function getAppUrl(): Promise<string> {
  // Check environment first
  if (process.env.APP_URL) {
    return process.env.APP_URL
  }

  // Check database
  const dbUrl = await getConfig('app_url')
  if (dbUrl) {
    return dbUrl
  }

  // Default
  const port = process.env.PORT || '17777'
  return `http://localhost:${port}`
}

/**
 * Check if initial setup is complete
 */
export async function isSetupComplete(): Promise<boolean> {
  const { isConfigured } = await getGoogleCredentials()
  if (isConfigured) return true

  const setupCompleted = await getConfig('setup_completed')
  return setupCompleted === 'true'
}

/**
 * LLM Configuration
 * Only stores API keys and base URL - no default provider or model
 * Users select provider/model in the app when needed
 */

export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'ollama' | 'vercel'

export interface LLMSettings {
  ollamaBaseUrl: string | null
  openaiApiKey: string | null
  anthropicApiKey: string | null
  googleAiApiKey: string | null
  vercelApiKey: string | null
  /** True if at least one provider is configured */
  isConfigured: boolean
}

/**
 * Get LLM settings
 * Priority: environment variables > database config
 */
export async function getLLMSettings(): Promise<LLMSettings> {
  // Ollama Base URL
  let ollamaBaseUrl = process.env.OLLAMA_BASE_URL || null
  if (!ollamaBaseUrl) {
    ollamaBaseUrl = await getConfig('ollama_base_url')
  }

  // API Keys - check env first, then database
  let openaiApiKey = process.env.OPENAI_API_KEY || null
  if (!openaiApiKey) {
    openaiApiKey = await getConfig('openai_api_key')
  }

  let anthropicApiKey = process.env.ANTHROPIC_API_KEY || null
  if (!anthropicApiKey) {
    anthropicApiKey = await getConfig('anthropic_api_key')
  }

  let googleAiApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || null
  if (!googleAiApiKey) {
    googleAiApiKey = await getConfig('google_ai_api_key')
  }

  let vercelApiKey = process.env.VERCEL_API_KEY || null
  if (!vercelApiKey) {
    vercelApiKey = await getConfig('vercel_api_key')
  }

  // At least one provider must be configured
  const isConfigured = !!(
    openaiApiKey ||
    anthropicApiKey ||
    googleAiApiKey ||
    ollamaBaseUrl ||
    vercelApiKey
  )

  return {
    ollamaBaseUrl,
    openaiApiKey,
    anthropicApiKey,
    googleAiApiKey,
    vercelApiKey,
    isConfigured,
  }
}

/**
 * Update LLM settings
 */
export async function setLLMSettings(settings: {
  ollamaBaseUrl?: string | null
  openaiApiKey?: string | null
  anthropicApiKey?: string | null
  googleAiApiKey?: string | null
  vercelApiKey?: string | null
}): Promise<void> {
  if (settings.ollamaBaseUrl !== undefined) {
    if (settings.ollamaBaseUrl) {
      await setConfig('ollama_base_url', settings.ollamaBaseUrl)
    } else {
      await deleteConfig('ollama_base_url')
    }
  }

  if (settings.openaiApiKey !== undefined) {
    if (settings.openaiApiKey) {
      await setConfig('openai_api_key', settings.openaiApiKey)
    } else {
      await deleteConfig('openai_api_key')
    }
  }

  if (settings.anthropicApiKey !== undefined) {
    if (settings.anthropicApiKey) {
      await setConfig('anthropic_api_key', settings.anthropicApiKey)
    } else {
      await deleteConfig('anthropic_api_key')
    }
  }

  if (settings.googleAiApiKey !== undefined) {
    if (settings.googleAiApiKey) {
      await setConfig('google_ai_api_key', settings.googleAiApiKey)
    } else {
      await deleteConfig('google_ai_api_key')
    }
  }

  if (settings.vercelApiKey !== undefined) {
    if (settings.vercelApiKey) {
      await setConfig('vercel_api_key', settings.vercelApiKey)
    } else {
      await deleteConfig('vercel_api_key')
    }
  }
}

/**
 * Get available models for a provider
 */
export function getAvailableModelsForProvider(provider: LLMProvider): string[] {
  return getProviderModels(provider).map((m) => m.id)
}
