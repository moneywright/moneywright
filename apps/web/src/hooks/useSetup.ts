/**
 * Setup Hook
 *
 * React Query hook for accessing setup/configuration data.
 * Reuses the same query key as __root.tsx to share cached data.
 */

import { useQuery } from '@tanstack/react-query'
import { getSetupStatus, type SetupStatus } from '@/lib/api'

/**
 * Query keys for setup data
 */
export const setupKeys = {
  all: ['setup'] as const,
}

/**
 * Hook to access setup status (providers, LLM configuration, etc.)
 * This uses the same query key as __root.tsx, so it shares cached data.
 */
export function useSetup() {
  return useQuery({
    queryKey: setupKeys.all,
    queryFn: getSetupStatus,
    staleTime: 5 * 60 * 1000, // 5 minutes - same as __root.tsx
  })
}

/**
 * Get the default chat provider and model from setup status
 * Returns the first configured provider with a model that has recommendedForChat,
 * or falls back to the first model of the first configured provider.
 */
export function getDefaultChatConfig(setupStatus: SetupStatus | undefined): {
  provider: string | null
  model: string | null
} {
  if (!setupStatus?.providers) {
    return { provider: null, model: null }
  }

  // Find first configured provider
  const configuredProvider = setupStatus.providers.find((p) => p.isConfigured)
  if (!configuredProvider) {
    return { provider: null, model: null }
  }

  // Find recommended chat model, or fall back to first model
  const recommendedModel = configuredProvider.models.find((m) => m.recommendedForChat)
  const defaultModel = recommendedModel || configuredProvider.models[0]

  return {
    provider: configuredProvider.id,
    model: defaultModel?.id || null,
  }
}
