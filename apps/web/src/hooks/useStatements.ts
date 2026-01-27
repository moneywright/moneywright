import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getStatements,
  getStatement,
  getStatementStatus,
  uploadStatements,
  deleteStatement,
} from '@/lib/api'
import { accountKeys } from './useAccounts'
import { investmentKeys } from './useInvestments'
import { transactionKeys } from './useTransactions'

// Query Keys
export const statementKeys = {
  all: ['statements'] as const,
  list: (profileId?: string, accountId?: string) =>
    [...statementKeys.all, 'list', profileId ?? 'family', accountId] as const,
  detail: (statementId: string) => [...statementKeys.all, 'detail', statementId] as const,
  status: (statementId: string) => [...statementKeys.all, 'status', statementId] as const,
}

// ============================================
// Query Hooks
// ============================================

/**
 * Fetch all statements for a profile/account or all profiles (family view)
 * Pass undefined for profileId to get family view (all profiles)
 */
export function useStatements(
  profileId?: string,
  options?: {
    accountId?: string
    refetchInterval?: number | false | ((query: unknown) => number | false)
    enabled?: boolean
  }
) {
  const enabled = options?.enabled ?? true
  return useQuery({
    queryKey: statementKeys.list(profileId, options?.accountId),
    queryFn: () => getStatements(profileId, options?.accountId),
    enabled,
    refetchInterval: options?.refetchInterval,
  })
}

/**
 * Fetch a single statement by ID
 */
export function useStatement(statementId: string) {
  return useQuery({
    queryKey: statementKeys.detail(statementId),
    queryFn: () => getStatement(statementId),
    enabled: !!statementId,
  })
}

/**
 * Fetch statement processing status (for polling)
 */
export function useStatementStatus(
  statementId: string,
  options?: { enabled?: boolean; refetchInterval?: number }
) {
  return useQuery({
    queryKey: statementKeys.status(statementId),
    queryFn: () => getStatementStatus(statementId),
    enabled: options?.enabled !== false && !!statementId,
    refetchInterval: options?.refetchInterval,
  })
}

// ============================================
// Mutation Hooks
// ============================================

/**
 * Upload statements
 */
export function useUploadStatements() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      files,
      profileId,
      options,
    }: {
      files: File[]
      profileId: string
      options?: Parameters<typeof uploadStatements>[2]
    }) => uploadStatements(files, profileId, options),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: statementKeys.list(variables.profileId) })
      // Invalidate categorization status so the processing indicator appears
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['categorization-status'] })
      }, 2000)
      const count = result.processedCount
      toast.success(`${count} statement${count !== 1 ? 's' : ''} uploaded successfully`)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload statements')
    },
  })
}

/**
 * Delete a statement
 */
export function useDeleteStatement(profileId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteStatement,
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: statementKeys.list(profileId) })
      queryClient.invalidateQueries({ queryKey: accountKeys.list(profileId) })
      queryClient.invalidateQueries({ queryKey: transactionKeys.all })
      queryClient.invalidateQueries({ queryKey: investmentKeys.holdings(profileId) })
      queryClient.invalidateQueries({ queryKey: investmentKeys.snapshots(profileId) })
      toast.success('Statement deleted')
    },
    onError: () => {
      toast.error('Failed to delete statement')
    },
  })
}

// ============================================
// Polling Hook for Statement Processing
// ============================================

/**
 * Poll statement status until processing is complete
 */
export function useStatementProcessing(
  statementId: string,
  options?: {
    onComplete?: () => void
    onError?: (error: string) => void
  }
) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: statementKeys.status(statementId),
    queryFn: () => getStatementStatus(statementId),
    enabled: !!statementId,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return 2000 // Poll every 2 seconds initially

      if (data.status === 'completed') {
        options?.onComplete?.()
        // Invalidate related queries when complete
        queryClient.invalidateQueries({ queryKey: transactionKeys.all })
        queryClient.invalidateQueries({ queryKey: investmentKeys.all })
        queryClient.invalidateQueries({ queryKey: accountKeys.all })
        return false // Stop polling
      }

      if (data.status === 'failed') {
        options?.onError?.(data.errorMessage || 'Processing failed')
        return false // Stop polling
      }

      return 2000 // Continue polling every 2 seconds
    },
  })
}
