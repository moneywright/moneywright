/**
 * Foreign Exchange Rate Service
 * Fetches and caches FX rates from fawazahmed0/currency-api
 */

import { logger } from '../lib/logger'

/**
 * FX rates response structure
 */
export interface FxRates {
  date: string
  baseCurrency: string
  rates: Record<string, number>
  fetchedAt: string
}

/**
 * In-memory cache for FX rates
 * Rates don't change frequently, so we cache for 1 hour
 */
let cachedRates: FxRates | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION_MS = 60 * 60 * 1000 // 1 hour

/**
 * Primary and fallback API URLs
 */
const PRIMARY_API_URL =
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies'
const FALLBACK_API_URL = 'https://latest.currency-api.pages.dev/v1/currencies'

/**
 * Fetch FX rates for a base currency
 * Uses USD as base and provides rates to convert to other currencies
 */
export async function fetchFxRates(baseCurrency: string = 'usd'): Promise<FxRates> {
  const now = Date.now()

  // Return cached rates if still valid
  if (
    cachedRates &&
    cachedRates.baseCurrency === baseCurrency.toLowerCase() &&
    now - cacheTimestamp < CACHE_DURATION_MS
  ) {
    logger.debug(
      `[FxRates] Returning cached rates (age: ${Math.round((now - cacheTimestamp) / 1000)}s)`
    )
    return cachedRates
  }

  const base = baseCurrency.toLowerCase()

  // Try primary URL first, then fallback
  const urls = [`${PRIMARY_API_URL}/${base}.json`, `${FALLBACK_API_URL}/${base}.json`]

  let lastError: Error | null = null

  for (const url of urls) {
    try {
      logger.info(`[FxRates] Fetching rates from ${url}`)

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = (await response.json()) as { date: string; [key: string]: unknown }

      // The API returns { date: "2024-01-20", usd: { inr: 83.5, eur: 0.92, ... } }
      const rates = data[base] as Record<string, number>

      if (!rates || typeof rates !== 'object') {
        throw new Error(`Invalid response structure - missing ${base} rates`)
      }

      cachedRates = {
        date: data.date,
        baseCurrency: base,
        rates,
        fetchedAt: new Date().toISOString(),
      }
      cacheTimestamp = now

      logger.info(
        `[FxRates] Fetched ${Object.keys(rates).length} rates for ${base.toUpperCase()} (date: ${data.date})`
      )

      return cachedRates
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      logger.warn(`[FxRates] Failed to fetch from ${url}: ${lastError.message}`)
    }
  }

  // If we have stale cache, return it with a warning
  if (cachedRates && cachedRates.baseCurrency === base) {
    logger.warn(
      `[FxRates] Using stale cache (age: ${Math.round((now - cacheTimestamp) / 1000)}s) due to fetch failure`
    )
    return cachedRates
  }

  throw new Error(`Failed to fetch FX rates: ${lastError?.message || 'Unknown error'}`)
}

/**
 * Convert an amount from one currency to another
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) {
    return amount
  }

  const from = fromCurrency.toLowerCase()
  const to = toCurrency.toLowerCase()

  // Fetch rates with fromCurrency as base
  const rates = await fetchFxRates(from)

  const rate = rates.rates[to]
  if (rate === undefined) {
    throw new Error(`No rate found for ${from.toUpperCase()} to ${to.toUpperCase()}`)
  }

  return amount * rate
}

/**
 * Get conversion rate between two currencies
 */
export async function getConversionRate(fromCurrency: string, toCurrency: string): Promise<number> {
  if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) {
    return 1
  }

  const from = fromCurrency.toLowerCase()
  const to = toCurrency.toLowerCase()

  const rates = await fetchFxRates(from)

  const rate = rates.rates[to]
  if (rate === undefined) {
    throw new Error(`No rate found for ${from.toUpperCase()} to ${to.toUpperCase()}`)
  }

  return rate
}

/**
 * Clear the cache (useful for testing)
 */
export function clearFxRatesCache(): void {
  cachedRates = null
  cacheTimestamp = 0
}
