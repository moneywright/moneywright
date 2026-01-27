import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getTransactions,
  getTransaction,
  getTransactionStats,
  getCategories,
  updateTransaction,
  linkTransactions,
  unlinkTransaction,
  getLinkCandidates,
  getCategorizationStatus,
  type TransactionFilters,
  type TransactionPagination,
} from '@/lib/api'

// Query Keys
export const transactionKeys = {
  all: ['transactions'] as const,
  list: (filters?: TransactionFilters, pagination?: TransactionPagination) =>
    [...transactionKeys.all, 'list', filters, pagination] as const,
  detail: (transactionId: string) => [...transactionKeys.all, 'detail', transactionId] as const,
  stats: (filters?: Omit<TransactionFilters, 'minAmount' | 'maxAmount'>) =>
    [...transactionKeys.all, 'stats', filters] as const,
  categories: () => [...transactionKeys.all, 'categories'] as const,
  linkCandidates: (transactionId: string) =>
    [...transactionKeys.all, 'linkCandidates', transactionId] as const,
}

// ============================================
// Query Hooks
// ============================================

/**
 * Fetch transactions with filters and pagination
 * Set filters.profileId to undefined for family view (all profiles)
 */
export function useTransactions(
  filters?: TransactionFilters & { enabled?: boolean },
  pagination?: TransactionPagination
) {
  const { enabled = true, ...filterOptions } = filters ?? {}
  return useQuery({
    queryKey: transactionKeys.list(filterOptions, pagination),
    queryFn: () => getTransactions(filterOptions, pagination),
    enabled,
  })
}

/**
 * Fetch a single transaction by ID
 */
export function useTransaction(transactionId: string) {
  return useQuery({
    queryKey: transactionKeys.detail(transactionId),
    queryFn: () => getTransaction(transactionId),
    enabled: !!transactionId,
  })
}

/**
 * Fetch transaction stats with filters
 * Set profileId to undefined for family view (all profiles)
 */
export function useTransactionStats(filters?: {
  profileId?: string
  accountId?: string[]
  statementId?: string[]
  startDate?: string
  endDate?: string
  category?: string[]
  type?: 'credit' | 'debit'
  search?: string
  isSubscription?: boolean
  enabled?: boolean
}) {
  const { enabled = true, ...filterOptions } = filters ?? {}
  return useQuery({
    queryKey: transactionKeys.stats(filterOptions),
    queryFn: () => getTransactionStats(filterOptions),
    enabled,
  })
}

/**
 * Fetch categories for user's country
 */
export function useCategories(enabled: boolean = true) {
  return useQuery({
    queryKey: transactionKeys.categories(),
    queryFn: getCategories,
    staleTime: 30 * 60 * 1000, // 30 minutes - categories don't change often
    enabled,
  })
}

/**
 * Fetch link candidates for a transaction
 */
export function useLinkCandidates(transactionId: string) {
  return useQuery({
    queryKey: transactionKeys.linkCandidates(transactionId),
    queryFn: () => getLinkCandidates(transactionId),
    enabled: !!transactionId,
  })
}

// ============================================
// Mutation Hooks
// ============================================

/**
 * Update a transaction (category, summary)
 */
export function useUpdateTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      transactionId,
      data,
    }: {
      transactionId: string
      data: { category?: string; summary?: string }
    }) => updateTransaction(transactionId, data),
    onSuccess: (transaction) => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.all })
      queryClient.invalidateQueries({ queryKey: transactionKeys.detail(transaction.id) })
      toast.success('Transaction updated')
    },
    onError: () => {
      toast.error('Failed to update transaction')
    },
  })
}

/**
 * Link two transactions
 */
export function useLinkTransactions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      transactionId1,
      transactionId2,
      linkType,
    }: {
      transactionId1: string
      transactionId2: string
      linkType: 'payment' | 'transfer' | 'refund'
    }) => linkTransactions(transactionId1, transactionId2, linkType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.all })
      toast.success('Transactions linked')
    },
    onError: () => {
      toast.error('Failed to link transactions')
    },
  })
}

/**
 * Unlink a transaction
 */
export function useUnlinkTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: unlinkTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.all })
      toast.success('Transaction unlinked')
    },
    onError: () => {
      toast.error('Failed to unlink transaction')
    },
  })
}

/**
 * Get current categorization status
 * Only polls when active (every 5 seconds)
 * Query should be invalidated when uploads/recategorization triggers
 */
export function useCategorizationStatus(enabled: boolean = true) {
  return useQuery({
    queryKey: ['categorization-status'],
    queryFn: getCategorizationStatus,
    enabled,
    // Only poll when processing is active
    refetchInterval: (query) => {
      const data = query.state.data
      return data?.active ? 5000 : false
    },
  })
}
