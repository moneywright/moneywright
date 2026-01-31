import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getInsurancePolicies,
  getInsurancePoliciesByProfile,
  getInsurancePolicy,
  uploadInsurancePolicy,
  updateInsurancePolicy,
  deleteInsurancePolicy,
  getInsurancePaymentHistory,
  type InsurancePolicyType,
  type InsurancePolicyStatus,
  type InsuranceParseStatus,
} from '@/lib/api'

// Query Keys
export const insuranceKeys = {
  all: ['insurance'] as const,
  list: (profileId?: string) => [...insuranceKeys.all, 'list', profileId ?? 'family'] as const,
  detail: (policyId: string) => [...insuranceKeys.all, 'detail', policyId] as const,
  paymentHistory: (policyId: string) =>
    [...insuranceKeys.all, 'payment-history', policyId] as const,
}

// ============================================
// Query Hooks
// ============================================

/**
 * Fetch all insurance policies for user (family view)
 * Pass profileId to get policies for a specific profile
 */
export function useInsurancePolicies(
  profileId?: string,
  options?: {
    policyType?: InsurancePolicyType
    status?: InsurancePolicyStatus
    parseStatus?: InsuranceParseStatus
    refetchInterval?: number | false | ((query: unknown) => number | false)
    enabled?: boolean
  }
) {
  const enabled = options?.enabled ?? true
  const filters = {
    policyType: options?.policyType,
    status: options?.status,
    parseStatus: options?.parseStatus,
  }

  return useQuery({
    queryKey: insuranceKeys.list(profileId),
    queryFn: () =>
      profileId ? getInsurancePoliciesByProfile(profileId, filters) : getInsurancePolicies(filters),
    enabled,
    refetchInterval: options?.refetchInterval,
  })
}

/**
 * Fetch a single insurance policy by ID
 */
export function useInsurancePolicy(policyId: string) {
  return useQuery({
    queryKey: insuranceKeys.detail(policyId),
    queryFn: () => getInsurancePolicy(policyId),
    enabled: !!policyId,
  })
}

// ============================================
// Mutation Hooks
// ============================================

/**
 * Upload an insurance policy PDF
 */
export function useUploadInsurance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      file,
      profileId,
      options,
    }: {
      file: File
      profileId: string
      options?: {
        policyType?: InsurancePolicyType
        parsingModel?: string
      }
    }) => uploadInsurancePolicy(file, profileId, options),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: insuranceKeys.list(variables.profileId) })
      queryClient.invalidateQueries({ queryKey: insuranceKeys.list() }) // Family view
      toast.success('Insurance policy uploaded successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload insurance policy')
    },
  })
}

/**
 * Update an insurance policy
 */
export function useUpdateInsurance(profileId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      policyId,
      data,
    }: {
      policyId: string
      data: Parameters<typeof updateInsurancePolicy>[1]
    }) => updateInsurancePolicy(policyId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: insuranceKeys.list(profileId) })
      queryClient.invalidateQueries({ queryKey: insuranceKeys.list() }) // Family view
      queryClient.invalidateQueries({ queryKey: insuranceKeys.detail(variables.policyId) })
      toast.success('Insurance policy updated')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update insurance policy')
    },
  })
}

/**
 * Delete an insurance policy
 */
export function useDeleteInsurance(profileId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteInsurancePolicy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: insuranceKeys.list(profileId) })
      queryClient.invalidateQueries({ queryKey: insuranceKeys.list() }) // Family view
      toast.success('Insurance policy deleted')
    },
    onError: () => {
      toast.error('Failed to delete insurance policy')
    },
  })
}

// ============================================
// Polling Hook for Policy Processing
// ============================================

/**
 * Poll insurance policy processing status until complete
 */
export function useInsuranceProcessing(
  policyId: string,
  options?: {
    onComplete?: () => void
    onError?: (error: string) => void
  }
) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: insuranceKeys.detail(policyId),
    queryFn: () => getInsurancePolicy(policyId),
    enabled: !!policyId,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return 2000 // Poll every 2 seconds initially

      if (data.parseStatus === 'completed') {
        options?.onComplete?.()
        queryClient.invalidateQueries({ queryKey: insuranceKeys.list() })
        return false // Stop polling
      }

      if (data.parseStatus === 'failed') {
        options?.onError?.(data.errorMessage || 'Processing failed')
        return false // Stop polling
      }

      return 2000 // Continue polling every 2 seconds
    },
  })
}

/**
 * Get insurance policy payment history
 */
export function useInsurancePaymentHistory(policyId: string) {
  return useQuery({
    queryKey: insuranceKeys.paymentHistory(policyId),
    queryFn: () => getInsurancePaymentHistory(policyId),
    enabled: !!policyId,
  })
}
