import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getInvestmentTypes,
  getInvestmentSummary,
  getInvestmentSources,
  getInvestmentSource,
  createInvestmentSource,
  updateInvestmentSource,
  deleteInvestmentSource,
  getAllHoldings,
  getHoldingsForSource,
  getHolding,
  createHolding,
  updateHolding,
  deleteHolding,
  getAllSnapshots,
  getSnapshotsForSource,
  createSnapshot,
  deleteSnapshot,
  type InvestmentHolding,
} from '@/lib/api'

// Query Keys
export const investmentKeys = {
  all: ['investments'] as const,
  types: () => [...investmentKeys.all, 'types'] as const,
  summary: (profileId?: string) => [...investmentKeys.all, 'summary', profileId] as const,
  sources: (profileId?: string) => [...investmentKeys.all, 'sources', profileId] as const,
  source: (sourceId: string) => [...investmentKeys.all, 'source', sourceId] as const,
  holdings: (profileId?: string) => [...investmentKeys.all, 'holdings', profileId] as const,
  holdingsForSource: (sourceId: string) =>
    [...investmentKeys.all, 'holdings', 'source', sourceId] as const,
  holding: (holdingId: string) => [...investmentKeys.all, 'holding', holdingId] as const,
  snapshots: (profileId?: string) => [...investmentKeys.all, 'snapshots', profileId] as const,
  snapshotsForSource: (sourceId: string) =>
    [...investmentKeys.all, 'snapshots', 'source', sourceId] as const,
}

// ============================================
// Query Hooks
// ============================================

/**
 * Fetch investment types (source types and holding types)
 */
export function useInvestmentTypes(enabled: boolean = true) {
  return useQuery({
    queryKey: investmentKeys.types(),
    queryFn: getInvestmentTypes,
    staleTime: 30 * 60 * 1000, // 30 minutes - types don't change often
    enabled,
  })
}

/**
 * Fetch investment summary for a profile
 */
export function useInvestmentSummary(profileId?: string) {
  return useQuery({
    queryKey: investmentKeys.summary(profileId),
    queryFn: () => getInvestmentSummary(profileId),
    enabled: !!profileId,
  })
}

/**
 * Fetch all investment sources for a profile
 */
export function useInvestmentSources(profileId?: string) {
  return useQuery({
    queryKey: investmentKeys.sources(profileId),
    queryFn: () => getInvestmentSources(profileId),
    enabled: !!profileId,
  })
}

/**
 * Fetch a single investment source
 */
export function useInvestmentSource(sourceId: string) {
  return useQuery({
    queryKey: investmentKeys.source(sourceId),
    queryFn: () => getInvestmentSource(sourceId),
    enabled: !!sourceId,
  })
}

/**
 * Fetch all holdings for a profile
 */
export function useInvestmentHoldings(profileId?: string) {
  return useQuery({
    queryKey: investmentKeys.holdings(profileId),
    queryFn: () => getAllHoldings(profileId),
    enabled: !!profileId,
  })
}

/**
 * Fetch holdings for a specific source
 */
export function useHoldingsForSource(sourceId: string) {
  return useQuery({
    queryKey: investmentKeys.holdingsForSource(sourceId),
    queryFn: () => getHoldingsForSource(sourceId),
    enabled: !!sourceId,
  })
}

/**
 * Fetch a single holding
 */
export function useHolding(holdingId: string) {
  return useQuery({
    queryKey: investmentKeys.holding(holdingId),
    queryFn: () => getHolding(holdingId),
    enabled: !!holdingId,
  })
}

/**
 * Fetch all snapshots for a profile
 */
export function useInvestmentSnapshots(
  profileId?: string,
  options?: { startDate?: string; endDate?: string; limit?: number }
) {
  return useQuery({
    queryKey: investmentKeys.snapshots(profileId),
    queryFn: () => getAllSnapshots(profileId, options),
    enabled: !!profileId,
  })
}

/**
 * Fetch snapshots for a specific source
 */
export function useSnapshotsForSource(
  sourceId: string,
  options?: { startDate?: string; endDate?: string; limit?: number }
) {
  return useQuery({
    queryKey: investmentKeys.snapshotsForSource(sourceId),
    queryFn: () => getSnapshotsForSource(sourceId, options),
    enabled: !!sourceId,
  })
}

// ============================================
// Mutation Hooks
// ============================================

/**
 * Create a new investment source
 */
export function useCreateSource() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createInvestmentSource,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: investmentKeys.sources(variables.profileId) })
      queryClient.invalidateQueries({ queryKey: investmentKeys.summary(variables.profileId) })
      toast.success('Investment source added')
    },
    onError: () => {
      toast.error('Failed to add investment source')
    },
  })
}

/**
 * Update an investment source
 */
export function useUpdateSource() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      sourceId,
      data,
    }: {
      sourceId: string
      data: Parameters<typeof updateInvestmentSource>[1]
    }) => updateInvestmentSource(sourceId, data),
    onSuccess: (source) => {
      queryClient.invalidateQueries({ queryKey: investmentKeys.sources(source.profileId) })
      queryClient.invalidateQueries({ queryKey: investmentKeys.source(source.id) })
      toast.success('Investment source updated')
    },
    onError: () => {
      toast.error('Failed to update investment source')
    },
  })
}

/**
 * Delete an investment source
 */
export function useDeleteSource(profileId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteInvestmentSource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: investmentKeys.sources(profileId) })
      queryClient.invalidateQueries({ queryKey: investmentKeys.holdings(profileId) })
      queryClient.invalidateQueries({ queryKey: investmentKeys.summary(profileId) })
      toast.success('Investment source deleted')
    },
    onError: () => {
      toast.error('Failed to delete investment source')
    },
  })
}

/**
 * Create a new holding
 */
export function useCreateHolding(profileId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createHolding,
    onSuccess: (holding) => {
      queryClient.invalidateQueries({ queryKey: investmentKeys.holdings(profileId) })
      queryClient.invalidateQueries({
        queryKey: investmentKeys.holdingsForSource(holding.sourceId),
      })
      queryClient.invalidateQueries({ queryKey: investmentKeys.summary(profileId) })
      toast.success('Holding added')
    },
    onError: () => {
      toast.error('Failed to add holding')
    },
  })
}

/**
 * Update a holding
 */
export function useUpdateHolding(profileId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      holdingId,
      data,
    }: {
      holdingId: string
      data: Parameters<typeof updateHolding>[1]
    }) => updateHolding(holdingId, data),
    onSuccess: (holding) => {
      queryClient.invalidateQueries({ queryKey: investmentKeys.holdings(profileId) })
      queryClient.invalidateQueries({
        queryKey: investmentKeys.holdingsForSource(holding.sourceId),
      })
      queryClient.invalidateQueries({ queryKey: investmentKeys.holding(holding.id) })
      queryClient.invalidateQueries({ queryKey: investmentKeys.summary(profileId) })
      toast.success('Holding updated')
    },
    onError: () => {
      toast.error('Failed to update holding')
    },
  })
}

/**
 * Delete a holding
 */
export function useDeleteHolding(profileId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteHolding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: investmentKeys.holdings(profileId) })
      queryClient.invalidateQueries({ queryKey: investmentKeys.summary(profileId) })
      toast.success('Holding deleted')
    },
    onError: () => {
      toast.error('Failed to delete holding')
    },
  })
}

/**
 * Create a snapshot manually
 */
export function useCreateSnapshot() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createSnapshot,
    onSuccess: (snapshot) => {
      queryClient.invalidateQueries({ queryKey: investmentKeys.snapshots(snapshot.profileId) })
      if (snapshot.sourceId) {
        queryClient.invalidateQueries({
          queryKey: investmentKeys.snapshotsForSource(snapshot.sourceId),
        })
      }
      toast.success('Snapshot created')
    },
    onError: () => {
      toast.error('Failed to create snapshot')
    },
  })
}

/**
 * Delete a snapshot
 */
export function useDeleteSnapshot(profileId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteSnapshot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: investmentKeys.snapshots(profileId) })
      toast.success('Snapshot deleted')
    },
    onError: () => {
      toast.error('Failed to delete snapshot')
    },
  })
}

// ============================================
// Utility Hooks
// ============================================

/**
 * Group holdings by source ID
 */
export function useHoldingsBySource(holdings: InvestmentHolding[] | undefined) {
  if (!holdings) return {}

  return holdings.reduce(
    (acc, holding) => {
      if (!acc[holding.sourceId]) {
        acc[holding.sourceId] = []
      }
      acc[holding.sourceId]!.push(holding)
      return acc
    },
    {} as Record<string, InvestmentHolding[]>
  )
}
