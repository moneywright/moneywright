import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getSummary,
  getFxRates,
  getFxRate,
  getMonthlyTrends,
  getPreferences,
  setPreference,
  PREFERENCE_KEYS,
} from '@/lib/api'

// Query Keys
export const summaryKeys = {
  all: ['summary'] as const,
  financial: (profileId: string, options?: { startDate?: string; endDate?: string }) =>
    [...summaryKeys.all, 'financial', profileId, options] as const,
  monthlyTrends: (profileId: string, months: number, excludeCategories?: string[]) =>
    [...summaryKeys.all, 'monthlyTrends', profileId, months, excludeCategories] as const,
  fxRates: (baseCurrency: string) => [...summaryKeys.all, 'fxRates', baseCurrency] as const,
  fxRate: (from: string, to: string) => [...summaryKeys.all, 'fxRate', from, to] as const,
}

export const preferencesKeys = {
  all: ['preferences'] as const,
  byProfile: (profileId?: string) => [...preferencesKeys.all, profileId] as const,
}

// ============================================
// Query Hooks
// ============================================

/**
 * Fetch comprehensive financial summary for a profile
 */
export function useSummary(profileId?: string, options?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: summaryKeys.financial(profileId!, options),
    queryFn: () => getSummary(profileId!, options),
    enabled: !!profileId,
  })
}

/**
 * Fetch monthly income/expense trends
 */
export function useMonthlyTrends(
  profileId?: string,
  months: number = 12,
  excludeCategories?: string[]
) {
  return useQuery({
    queryKey: summaryKeys.monthlyTrends(profileId!, months, excludeCategories),
    queryFn: () => getMonthlyTrends(profileId!, months, excludeCategories),
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Fetch user preferences
 */
export function usePreferences(profileId?: string) {
  return useQuery({
    queryKey: preferencesKeys.byProfile(profileId),
    queryFn: () => getPreferences(profileId),
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

/**
 * Mutation to set a preference
 */
export function useSetPreference() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      key,
      value,
      profileId,
    }: {
      key: string
      value: string
      profileId?: string | null
    }) => setPreference(key, value, profileId),
    onSuccess: (_, variables) => {
      // Invalidate preferences queries
      queryClient.invalidateQueries({ queryKey: preferencesKeys.all })
      // If it's an excluded categories preference, invalidate trends too
      if (variables.key === PREFERENCE_KEYS.DASHBOARD_EXCLUDED_CATEGORIES) {
        queryClient.invalidateQueries({ queryKey: ['summary', 'monthlyTrends'] })
      }
    },
  })
}

/**
 * Fetch FX rates for a base currency
 */
export function useFxRates(baseCurrency: string = 'USD', options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: summaryKeys.fxRates(baseCurrency),
    queryFn: () => getFxRates(baseCurrency),
    enabled: options?.enabled !== false,
    staleTime: 60 * 60 * 1000, // 1 hour - FX rates cached for 1 hour
  })
}

/**
 * Fetch conversion rate between two currencies
 */
export function useFxRate(from: string, to: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: summaryKeys.fxRate(from, to),
    queryFn: () => getFxRate(from, to),
    enabled: options?.enabled !== false && !!from && !!to,
    staleTime: 60 * 60 * 1000, // 1 hour
  })
}

// ============================================
// Utility Hooks
// ============================================

/**
 * Build FX rates map for currency conversion
 */
export function useFxRatesMap(baseCurrency: string = 'USD', enabled: boolean = true) {
  const { data: fxRatesData, isLoading } = useFxRates(baseCurrency, { enabled })

  const fxRates: Record<string, number> = {}

  if (fxRatesData?.success && fxRatesData.data?.rates) {
    // Build conversion rates to INR
    fxRates['USD'] = fxRatesData.data.rates.INR || 83
    fxRates['EUR'] = (fxRatesData.data.rates.INR || 83) / (fxRatesData.data.rates.EUR || 0.92)
    fxRates['GBP'] = (fxRatesData.data.rates.INR || 83) / (fxRatesData.data.rates.GBP || 0.79)
    fxRates['INR'] = 1
  }

  return { fxRates, isLoading }
}

/**
 * Currency conversion helper hook
 */
export function useCurrencyConverter(showInINR: boolean = true) {
  const { fxRates, isLoading: fxRatesLoading } = useFxRatesMap('USD', showInINR)

  const convertToINR = (amount: number, currency: string): number => {
    if (!showInINR || currency === 'INR') return amount
    const rate = fxRates[currency]
    if (rate) return amount * rate
    return amount
  }

  const formatCurrency = (amount: number | null | undefined, currency: string): string => {
    if (amount === null || amount === undefined) return '-'

    const displayAmount = convertToINR(amount, currency)
    const displayCurrency = showInINR ? 'INR' : currency

    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: displayCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(displayAmount)
  }

  const formatPercentage = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '-'
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}%`
  }

  return {
    fxRates,
    fxRatesLoading,
    convertToINR,
    formatCurrency,
    formatPercentage,
  }
}
