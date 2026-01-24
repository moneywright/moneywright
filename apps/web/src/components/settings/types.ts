/**
 * Settings types and constants
 */

import type { getLLMSettings, getLLMProviders, Profile } from '@/lib/api'

// Re-export shared provider logo utilities
export {
  PROVIDER_LOGOS,
  INVERTED_LOGO_PROVIDERS,
  needsLogoInversion,
  getProviderLogo,
  getLogoInvertStyle,
} from '@/lib/provider-logos'

// Provider types
export interface ProviderInfo {
  name: string
  placeholder: string
  description: string
}

export const PROVIDER_ORDER = ['openai', 'anthropic', 'google', 'vercel', 'ollama'] as const
export type ProviderCode = (typeof PROVIDER_ORDER)[number]

export const PROVIDER_INFO: Record<string, ProviderInfo> = {
  openai: {
    name: 'OpenAI',
    placeholder: 'sk-...',
    description: 'GPT-4, GPT-5, and other OpenAI models',
  },
  anthropic: {
    name: 'Anthropic',
    placeholder: 'sk-ant-...',
    description: 'Claude Opus, Sonnet, and Haiku models',
  },
  google: {
    name: 'Google AI',
    placeholder: 'AIza...',
    description: 'Gemini Pro, Flash, and other Google models',
  },
  vercel: {
    name: 'Vercel AI Gateway',
    placeholder: 'Enter API key',
    description: 'Access multiple providers through one API',
  },
  ollama: {
    name: 'Ollama',
    placeholder: 'http://localhost:11434/api',
    description: 'Run models locally. No API key required.',
  },
}

// Component prop types
export type LLMSettings = Awaited<ReturnType<typeof getLLMSettings>>
export type LLMProviders = Awaited<ReturnType<typeof getLLMProviders>>

export interface Session {
  id: string
  userAgent: string | null
  lastUsedAt: string
  current: boolean
}

export type { Profile }
