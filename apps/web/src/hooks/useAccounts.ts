import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getAccounts,
  getAccount,
  getAccountTypes,
  createAccount,
  updateAccount,
  deleteFinancialAccount,
} from '@/lib/api'

// Query Keys
export const accountKeys = {
  all: ['accounts'] as const,
  list: (profileId?: string) => [...accountKeys.all, 'list', profileId] as const,
  detail: (accountId: string) => [...accountKeys.all, 'detail', accountId] as const,
  types: () => [...accountKeys.all, 'types'] as const,
}

// ============================================
// Query Hooks
// ============================================

/**
 * Fetch all accounts for a profile
 */
export function useAccounts(profileId?: string) {
  return useQuery({
    queryKey: accountKeys.list(profileId),
    queryFn: () => getAccounts(profileId),
    enabled: !!profileId,
  })
}

/**
 * Fetch a single account by ID
 */
export function useAccount(accountId: string) {
  return useQuery({
    queryKey: accountKeys.detail(accountId),
    queryFn: () => getAccount(accountId),
    enabled: !!accountId,
  })
}

/**
 * Fetch account types for user's country
 */
export function useAccountTypes() {
  return useQuery({
    queryKey: accountKeys.types(),
    queryFn: getAccountTypes,
    staleTime: 30 * 60 * 1000, // 30 minutes - types don't change often
  })
}

// ============================================
// Mutation Hooks
// ============================================

/**
 * Create a new account
 */
export function useCreateAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createAccount,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: accountKeys.list(variables.profileId) })
      toast.success('Account added')
    },
    onError: () => {
      toast.error('Failed to add account')
    },
  })
}

/**
 * Update an account
 */
export function useUpdateAccount(profileId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      accountId,
      data,
    }: {
      accountId: string
      data: Parameters<typeof updateAccount>[1]
    }) => updateAccount(accountId, data),
    onSuccess: (account) => {
      queryClient.invalidateQueries({ queryKey: accountKeys.list(profileId) })
      queryClient.invalidateQueries({ queryKey: accountKeys.detail(account.id) })
      toast.success('Account updated')
    },
    onError: () => {
      toast.error('Failed to update account')
    },
  })
}

/**
 * Delete an account
 */
export function useDeleteAccount(profileId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteFinancialAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.list(profileId) })
      toast.success('Account deleted')
    },
    onError: () => {
      toast.error('Failed to delete account')
    },
  })
}
