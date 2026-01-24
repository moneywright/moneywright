/**
 * Shared provider logo utilities
 *
 * Use these throughout the app for consistent logo handling
 */

export const PROVIDER_LOGOS: Record<string, string> = {
  openai: '/openai.svg',
  anthropic: '/anthropic.svg',
  google: '/google.svg',
  ollama: '/ollama.svg',
  vercel: '/vercel.svg',
}

// Logos that need to be inverted in dark mode (they are dark/black icons)
export const INVERTED_LOGO_PROVIDERS = ['openai', 'anthropic', 'vercel', 'ollama']

/**
 * Check if a provider's logo needs inversion for dark mode
 */
export function needsLogoInversion(providerCode: string): boolean {
  return INVERTED_LOGO_PROVIDERS.includes(providerCode)
}

/**
 * Get the logo URL for a provider
 */
export function getProviderLogo(providerCode: string): string | undefined {
  return PROVIDER_LOGOS[providerCode]
}

/**
 * Get inline style for logo inversion (uses CSS variable)
 * Use this with: style={getLogoInvertStyle(providerCode)}
 */
export function getLogoInvertStyle(providerCode: string): React.CSSProperties | undefined {
  return needsLogoInversion(providerCode) ? { filter: 'var(--logo-invert)' } : undefined
}
