import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getStatements,
  getStatement,
  getStatementStatus,
  uploadStatement,
  deleteStatement,
} from '@/lib/api'
import { accountKeys } from './useAccounts'
import { investmentKeys } from './useInvestments'
import { transactionKeys } from './useTransactions'

// Query Keys
export const statementKeys = {
  all: ['statements'] as const,
  list: (profileId?: string, accountId?: string) =>
    [...statementKeys.all, 'list', profileId, accountId] as const,
  detail: (statementId: string) => [...statementKeys.all, 'detail', statementId] as const,
  status: (statementId: string) => [...statementKeys.all, 'status', statementId] as const,
}

// ============================================
// Query Hooks
// ============================================

/**
 * Fetch all statements for a profile/account
 */
export function useStatements(
  profileId?: string,
  options?: {
    accountId?: string
    refetchInterval?: number | false | ((query: unknown) => number | false)
  }
) {
  return useQuery({
    queryKey: statementKeys.list(profileId, options?.accountId),
    queryFn: () => getStatements(profileId, options?.accountId),
    enabled: !!profileId,
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
 * Upload a statement
 */
export function useUploadStatement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      file,
      profileId,
      options,
    }: {
      file: File
      profileId: string
      options?: Parameters<typeof uploadStatement>[2]
    }) => uploadStatement(file, profileId, options),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: statementKeys.list(variables.profileId) })
      toast.success('Statement uploaded successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload statement')
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
