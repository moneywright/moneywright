import { useQuery } from '@tanstack/react-query'
import { getConstants } from '@/lib/api'

// Query Keys
export const constantsKeys = {
  all: ['constants'] as const,
}

/**
 * Build lookup object from array
 */
function buildLookup<T extends { code?: string; id?: string; label?: string; name?: string }>(
  items: T[] | undefined,
  keyField: 'code' | 'id',
  valueField: 'label' | 'name'
): Record<string, string> {
  if (!items) return {}
  const lookup: Record<string, string> = {}
  for (const item of items) {
    const key = keyField === 'code' ? (item as { code: string }).code : (item as { id: string }).id
    const value =
      valueField === 'label' ? (item as { label: string }).label : (item as { name: string }).name
    if (key && value) {
      lookup[key] = value
    }
  }
  return lookup
}

/**
 * Fetch all constants and return lookup objects for easy access
 * Usage:
 *   const { institutions, investmentSourceTypes } = useConstants()
 *   const bankName = institutions['hdfc'] // "HDFC Bank"
 *   const sourceName = investmentSourceTypes['zerodha'] // "Zerodha"
 */
export function useConstants(enabled: boolean = true) {
  const query = useQuery({
    queryKey: constantsKeys.all,
    queryFn: getConstants,
    staleTime: 60 * 60 * 1000, // 1 hour - constants rarely change
    enabled,
    select: (data) => ({
      raw: data,
      institutions: buildLookup(data.institutions, 'id', 'name'),
      investmentSourceTypes: buildLookup(data.investmentSourceTypes, 'code', 'label'),
      accountTypes: buildLookup(data.accountTypes, 'code', 'label'),
      categories: buildLookup(data.categories, 'code', 'label'),
      investmentHoldingTypes: buildLookup(data.investmentHoldingTypes, 'code', 'label'),
      countryCode: data.countryCode,
      countries: data.countries,
    }),
  })

  return {
    ...query,
    institutions: query.data?.institutions ?? {},
    investmentSourceTypes: query.data?.investmentSourceTypes ?? {},
    accountTypes: query.data?.accountTypes ?? {},
    categories: query.data?.categories ?? {},
    investmentHoldingTypes: query.data?.investmentHoldingTypes ?? {},
    countryCode: query.data?.countryCode,
    countries: query.data?.countries,
    // Raw arrays for when you need more than just labels (e.g., logos)
    rawInstitutions: query.data?.raw.institutions ?? [],
    rawInvestmentSourceTypes: query.data?.raw.investmentSourceTypes ?? [],
  }
}
