// Auth hook - re-export from root route
export { useAuth } from '@/routes/__root'

// Investment hooks
export {
  investmentKeys,
  useInvestmentTypes,
  useInvestmentSummary,
  useInvestmentSources,
  useInvestmentSource,
  useInvestmentHoldings,
  useHoldingsForSource,
  useHolding,
  useInvestmentSnapshots,
  useSnapshotsForSource,
  useCreateSource,
  useUpdateSource,
  useDeleteSource,
  useCreateHolding,
  useUpdateHolding,
  useDeleteHolding,
  useCreateSnapshot,
  useDeleteSnapshot,
  useHoldingsBySource,
} from './useInvestments'

// Account hooks
export {
  accountKeys,
  useAccounts,
  useAccount,
  useAccountTypes,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
} from './useAccounts'

// Transaction hooks
export {
  transactionKeys,
  useTransactions,
  useTransaction,
  useTransactionStats,
  useCategories,
  useLinkCandidates,
  useUpdateTransaction,
  useLinkTransactions,
  useUnlinkTransaction,
  useCategorizationStatus,
} from './useTransactions'

// Statement hooks
export {
  statementKeys,
  useStatements,
  useStatement,
  useStatementStatus,
  useUploadStatements,
  useDeleteStatement,
  useStatementProcessing,
} from './useStatements'

// Summary hooks
export {
  summaryKeys,
  preferencesKeys,
  useSummary,
  useMonthlyTrends,
  usePreferences,
  useSetPreference,
  useFxRates,
  useFxRate,
  useFxRatesMap,
  useCurrencyConverter,
} from './useSummary'

// Onboarding hooks
export {
  useCountrySelection,
  useProfileCreation,
  getCountryFlag,
  ONBOARDING_STEPS,
  RELATIONSHIP_OPTIONS,
} from './useOnboarding'

// Constants hooks
export { constantsKeys, useConstants } from './useConstants'

// Chat hooks
export {
  useConversations,
  useCreateConversation,
  useConversationById,
  useConversation,
  useDeleteConversation,
  useClearConversation,
  useChatStream,
  type ChatStreamState,
} from './useChat'

// Setup hooks
export { setupKeys, useSetup, getDefaultChatConfig } from './useSetup'

// Other hooks
export { useTheme } from './useTheme'
export { useIsMobile } from './use-mobile'
export { useDebounce } from './useDebounce'
export { useProfileSelection } from './useProfileSelection'
