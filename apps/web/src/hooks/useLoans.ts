import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getLoans,
  getLoansByProfile,
  getLoan,
  uploadLoan,
  updateLoan,
  deleteLoan,
  getLoanPaymentHistory,
  getLoanOutstanding,
  type LoanType,
  type LoanStatus,
  type LoanParseStatus,
} from '@/lib/api'

// Query Keys
export const loanKeys = {
  all: ['loans'] as const,
  list: (profileId?: string) => [...loanKeys.all, 'list', profileId ?? 'family'] as const,
  detail: (loanId: string) => [...loanKeys.all, 'detail', loanId] as const,
  paymentHistory: (loanId: string) => [...loanKeys.all, 'payment-history', loanId] as const,
  outstanding: (loanId: string) => [...loanKeys.all, 'outstanding', loanId] as const,
}

// ============================================
// Query Hooks
// ============================================

/**
 * Fetch all loans for user (family view)
 * Pass profileId to get loans for a specific profile
 */
export function useLoans(
  profileId?: string,
  options?: {
    loanType?: LoanType
    status?: LoanStatus
    parseStatus?: LoanParseStatus
    refetchInterval?: number | false | ((query: unknown) => number | false)
    enabled?: boolean
  }
) {
  const enabled = options?.enabled ?? true
  const filters = {
    loanType: options?.loanType,
    status: options?.status,
    parseStatus: options?.parseStatus,
  }

  return useQuery({
    queryKey: loanKeys.list(profileId),
    queryFn: () => (profileId ? getLoansByProfile(profileId, filters) : getLoans(filters)),
    enabled,
    refetchInterval: options?.refetchInterval,
  })
}

/**
 * Fetch a single loan by ID
 */
export function useLoan(loanId: string) {
  return useQuery({
    queryKey: loanKeys.detail(loanId),
    queryFn: () => getLoan(loanId),
    enabled: !!loanId,
  })
}

// ============================================
// Mutation Hooks
// ============================================

/**
 * Upload a loan document PDF
 */
export function useUploadLoan() {
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
        loanType?: LoanType
        parsingModel?: string
      }
    }) => uploadLoan(file, profileId, options),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: loanKeys.list(variables.profileId) })
      queryClient.invalidateQueries({ queryKey: loanKeys.list() }) // Family view
      toast.success('Loan document uploaded successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload loan document')
    },
  })
}

/**
 * Update a loan
 */
export function useUpdateLoan(profileId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ loanId, data }: { loanId: string; data: Parameters<typeof updateLoan>[1] }) =>
      updateLoan(loanId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: loanKeys.list(profileId) })
      queryClient.invalidateQueries({ queryKey: loanKeys.list() }) // Family view
      queryClient.invalidateQueries({ queryKey: loanKeys.detail(variables.loanId) })
      toast.success('Loan updated')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update loan')
    },
  })
}

/**
 * Delete a loan
 */
export function useDeleteLoan(profileId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteLoan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loanKeys.list(profileId) })
      queryClient.invalidateQueries({ queryKey: loanKeys.list() }) // Family view
      toast.success('Loan deleted')
    },
    onError: () => {
      toast.error('Failed to delete loan')
    },
  })
}

// ============================================
// Polling Hook for Loan Processing
// ============================================

/**
 * Poll loan processing status until complete
 */
export function useLoanProcessing(
  loanId: string,
  options?: {
    onComplete?: () => void
    onError?: (error: string) => void
  }
) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: loanKeys.detail(loanId),
    queryFn: () => getLoan(loanId),
    enabled: !!loanId,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return 2000 // Poll every 2 seconds initially

      if (data.parseStatus === 'completed') {
        options?.onComplete?.()
        queryClient.invalidateQueries({ queryKey: loanKeys.list() })
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
 * Get loan payment history
 */
export function useLoanPaymentHistory(loanId: string) {
  return useQuery({
    queryKey: loanKeys.paymentHistory(loanId),
    queryFn: () => getLoanPaymentHistory(loanId),
    enabled: !!loanId,
  })
}

/**
 * Get loan outstanding calculation
 */
export function useLoanOutstanding(loanId: string) {
  return useQuery({
    queryKey: loanKeys.outstanding(loanId),
    queryFn: () => getLoanOutstanding(loanId),
    enabled: !!loanId,
  })
}
