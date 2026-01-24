import { api } from './axios'

/**
 * User type
 */
export interface User {
  id: string
  email: string | null
  name: string | null
  picture: string | null
  country: string | null
  createdAt?: string
  onboardingComplete?: boolean
}

/**
 * Profile type
 */
export interface Profile {
  id: string
  name: string
  relationship: string | null
  summary: string | null
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Country type
 */
export interface Country {
  code: string
  name: string
  currency: string
  currencySymbol: string
}

/**
 * Session type
 */
export interface Session {
  id: string
  current: boolean
  userAgent: string | null
  ipAddress: string | null
  createdAt: string
  lastUsedAt: string
}

/**
 * LLM configured providers map
 */
export interface ConfiguredProviders {
  openai: boolean
  anthropic: boolean
  google: boolean
  ollama: boolean
  vercel: boolean
}

/**
 * Setup status
 */
export interface SetupStatus {
  authEnabled: boolean
  llm: {
    isConfigured: boolean
    ollamaBaseUrl: string | null
    configuredProviders: ConfiguredProviders
  }
  providers: Array<{
    id: string
    name: string
    models: AIModel[]
    requiresApiKey: boolean
    isConfigured: boolean
  }>
}

/**
 * Auth status (unauthenticated endpoint)
 */
export interface AuthStatus {
  authEnabled: boolean
}

/**
 * Get auth status - unauthenticated, used for initial app load
 */
export async function getAuthStatus(): Promise<AuthStatus> {
  const response = await api.get('/setup/auth')
  return response.data
}

/**
 * Get setup status (requires authentication)
 */
export async function getSetupStatus(): Promise<SetupStatus> {
  const response = await api.get('/setup')
  return response.data
}

/**
 * Update setup configuration (PATCH /setup)
 * Note: Google OAuth must be configured via environment variables
 */
export async function updateSetup(data: {
  llm?: {
    ollamaBaseUrl?: string | null
    openaiApiKey?: string | null
    anthropicApiKey?: string | null
    googleAiApiKey?: string | null
    vercelApiKey?: string | null
  }
}): Promise<SetupStatus> {
  const response = await api.patch('/setup', data)
  return response.data
}

/**
 * Local mode login (for AUTH_ENABLED=false)
 */
export async function localLogin(): Promise<{
  success: boolean
  type: string
  user: { id: string; name: string | null; email: string | null }
}> {
  const response = await api.post('/auth/local')
  return response.data
}

/**
 * Get Google OAuth URL
 */
export async function getGoogleAuthUrl(
  redirect?: string
): Promise<{ url: string; state: unknown }> {
  const params = new URLSearchParams()
  if (redirect) params.set('redirect', redirect)

  const response = await api.get(`/auth/google?${params.toString()}`)
  return response.data
}

/**
 * Exchange OAuth code for session
 */
export async function exchangeOAuthCode(
  code: string,
  state: string
): Promise<{
  success: boolean
  type: string
  isNewUser?: boolean
  redirectUrl?: string
}> {
  const response = await api.post('/auth/google/exchange', { code, state })
  return response.data
}

/**
 * Get current user
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const response = await api.get('/user/me')
    return response.data
  } catch {
    return null
  }
}

/**
 * Logout
 */
export async function logout(): Promise<void> {
  await api.post('/auth/logout')
}

/**
 * Get user sessions
 */
export async function getUserSessions(): Promise<Session[]> {
  const response = await api.get('/auth/sessions')
  return response.data.sessions
}

/**
 * Revoke a session
 */
export async function revokeSession(sessionId: string): Promise<void> {
  await api.delete(`/auth/sessions/${sessionId}`)
}

/**
 * Revoke all other sessions
 */
export async function revokeOtherSessions(): Promise<{ revokedCount: number }> {
  const response = await api.delete('/auth/sessions')
  return response.data
}

/**
 * Delete account
 */
export async function deleteAccount(): Promise<void> {
  await api.delete('/auth/account', { data: { confirmation: 'DELETE' } })
}

// ============================================
// User / Onboarding API
// ============================================

/**
 * Get supported countries
 */
export async function getCountries(): Promise<Country[]> {
  const response = await api.get('/setup/countries')
  return response.data.countries
}

/**
 * Set user's country during onboarding
 */
export async function setUserCountry(country: string): Promise<User> {
  const response = await api.post('/user/onboarding', { country })
  return response.data.user
}

/**
 * Get current user details
 */
export async function getUserDetails(): Promise<User> {
  const response = await api.get('/user/me')
  return response.data.user
}

// ============================================
// Profile API
// ============================================

/**
 * Get all profiles for the current user
 */
export async function getProfiles(): Promise<Profile[]> {
  const response = await api.get('/profiles')
  return response.data.profiles
}

/**
 * Get a specific profile
 */
export async function getProfile(profileId: string): Promise<Profile> {
  const response = await api.get(`/profiles/${profileId}`)
  return response.data.profile
}

/**
 * Create a new profile
 */
export async function createProfile(data: {
  name: string
  relationship?: string | null
  summary?: string | null
  isDefault?: boolean
}): Promise<Profile> {
  const response = await api.post('/profiles', data)
  return response.data.profile
}

/**
 * Update a profile
 */
export async function updateProfile(
  profileId: string,
  data: {
    name?: string
    relationship?: string | null
    summary?: string | null
    isDefault?: boolean
  }
): Promise<Profile> {
  const response = await api.patch(`/profiles/${profileId}`, data)
  return response.data.profile
}

/**
 * Delete a profile
 */
export async function deleteProfile(profileId: string): Promise<void> {
  await api.delete(`/profiles/${profileId}`)
}

// ============================================
// LLM Settings API
// ============================================

/**
 * LLM Settings type
 */
export interface LLMSettings {
  ollamaBaseUrl: string | null
  hasOpenaiApiKey: boolean
  hasAnthropicApiKey: boolean
  hasGoogleAiApiKey: boolean
  hasVercelApiKey: boolean
  isConfigured: boolean
}

/**
 * AI Model type
 */
export interface AIModel {
  id: string
  name: string
  /** Model is capable of parsing statements (requires tool use, code generation) */
  supportsParsing?: boolean
  /** Recommended model for parsing statements */
  recommendedForParsing?: boolean
  /** Recommended model for categorization */
  recommendedForCategorization?: boolean
  supportsThinking?: boolean
  reasoningBuiltIn?: boolean
}

/**
 * LLM Provider info
 */
export interface LLMProvider {
  code: string
  label: string
  models: AIModel[]
  requiresApiKey: boolean
  isConfigured: boolean
}

/**
 * LLM Test result
 */
export interface LLMTestResult {
  success: boolean
  provider?: string
  model?: string
  response?: string
  latencyMs?: number
  error?: string
  message?: string
}

/**
 * Get LLM settings
 */
export async function getLLMSettings(): Promise<LLMSettings> {
  const response = await api.get('/llm/settings')
  return response.data
}

/**
 * Update LLM settings (API keys only)
 */
export async function updateLLMSettings(data: {
  ollamaBaseUrl?: string | null
  openaiApiKey?: string | null
  anthropicApiKey?: string | null
  googleAiApiKey?: string | null
  vercelApiKey?: string | null
}): Promise<LLMSettings> {
  const response = await api.put('/llm/settings', data)
  return response.data
}

/**
 * Get available LLM providers
 */
export async function getLLMProviders(): Promise<LLMProvider[]> {
  const response = await api.get('/llm/providers')
  return response.data.providers
}

/**
 * Test LLM connection
 */
export async function testLLMConnection(params: {
  provider: string
  model: string
  apiKey?: string
  ollamaBaseUrl?: string
}): Promise<LLMTestResult> {
  const response = await api.post('/llm/test', params)
  return response.data
}

// ============================================
// Accounts API
// ============================================

/**
 * Account type
 */
export interface Account {
  id: string
  profileId: string
  userId: string
  type: string
  institution: string | null
  accountNumber: string | null
  accountName: string | null
  /** Account product/variant name (e.g., "Regalia", "Savings Max", "Imperia") */
  productName: string | null
  currency: string
  isActive: boolean
  hasStatementPassword: boolean
  createdAt: string
  updatedAt: string
  /** Latest balance from the most recent statement */
  latestBalance: number | null
  /** Date of the latest statement (YYYY-MM-DD) */
  latestStatementDate: string | null
}

/**
 * Account type option
 */
export interface AccountType {
  code: string
  label: string
}

/**
 * Get all accounts
 */
export async function getAccounts(profileId?: string): Promise<Account[]> {
  const params = profileId ? `?profileId=${profileId}` : ''
  const response = await api.get(`/accounts${params}`)
  return response.data.accounts
}

/**
 * Get account by ID
 */
export async function getAccount(accountId: string): Promise<Account> {
  const response = await api.get(`/accounts/${accountId}`)
  return response.data.account
}

/**
 * Get account types for user's country
 */
export async function getAccountTypes(): Promise<AccountType[]> {
  const response = await api.get('/accounts/types')
  return response.data.accountTypes
}

/**
 * Create an account
 */
export async function createAccount(data: {
  profileId: string
  type: string
  currency: string
  institution?: string | null
  accountNumber?: string | null
  accountName?: string | null
  statementPassword?: string | null
}): Promise<Account> {
  const response = await api.post('/accounts', data)
  return response.data.account
}

/**
 * Update an account
 */
export async function updateAccount(
  accountId: string,
  data: {
    accountName?: string
    institution?: string | null
    statementPassword?: string | null
    isActive?: boolean
  }
): Promise<Account> {
  const response = await api.patch(`/accounts/${accountId}`, data)
  return response.data.account
}

/**
 * Delete a financial account
 */
export async function deleteFinancialAccount(accountId: string): Promise<void> {
  await api.delete(`/accounts/${accountId}`)
}

// ============================================
// Statements API
// ============================================

/**
 * Statement type
 */
export interface Statement {
  id: string
  accountId: string | null
  sourceId: string | null
  profileId: string
  userId: string
  documentType: 'bank_statement' | 'credit_card_statement' | 'investment_statement' | null
  originalFilename: string
  fileType: string
  fileSizeBytes: number | null
  periodStart: string | null
  periodEnd: string | null
  status: 'pending' | 'parsing' | 'completed' | 'failed'
  errorMessage: string | null
  summary: Record<string, unknown> | null
  transactionCount: number
  holdingsCount: number | null
  createdAt: string
  updatedAt: string
}

/**
 * Statement upload response
 */
export interface StatementUploadResponse {
  statement: Statement
  accountId: string
  isNewAccount: boolean
}

/**
 * Get all statements
 */
export async function getStatements(profileId?: string, accountId?: string): Promise<Statement[]> {
  const params = new URLSearchParams()
  if (profileId) params.set('profileId', profileId)
  if (accountId) params.set('accountId', accountId)
  const queryString = params.toString() ? `?${params.toString()}` : ''
  const response = await api.get(`/statements${queryString}`)
  return response.data.statements
}

/**
 * Get statement by ID
 */
export async function getStatement(statementId: string): Promise<Statement> {
  const response = await api.get(`/statements/${statementId}`)
  return response.data.statement
}

/**
 * Get statement status
 */
export async function getStatementStatus(
  statementId: string
): Promise<{ status: string; errorMessage?: string; transactionCount?: number }> {
  const response = await api.get(`/statements/${statementId}/status`)
  return response.data
}

/**
 * Upload response for multiple files
 */
export interface StatementsUploadResponse {
  statementIds: string[]
  status: 'pending'
  processedCount: number
  errors?: Array<{ filename: string; error: string }>
}

/**
 * Upload one or more statements
 */
export async function uploadStatements(
  files: File[],
  profileId: string,
  options?: {
    /** Document type: bank_statement or investment_statement */
    documentType?: 'bank_statement' | 'investment_statement'
    /** For bank statements: existing account ID (optional, auto-detect if not provided) */
    accountId?: string
    /** For investment statements: source type (e.g., zerodha, groww, mf_central) */
    sourceType?: string
    password?: string
    savePassword?: boolean
    /** Provider for statement parsing */
    parsingProvider?: string
    /** Model for statement parsing (code generation) */
    parsingModel?: string
    /** Provider for transaction categorization */
    categorizationProvider?: string
    /** Model for transaction categorization */
    categorizationModel?: string
  }
): Promise<StatementsUploadResponse> {
  const formData = new FormData()
  for (const file of files) {
    formData.append('files', file)
  }
  formData.append('profileId', profileId)
  if (options?.documentType) formData.append('documentType', options.documentType)
  if (options?.accountId) formData.append('accountId', options.accountId)
  if (options?.sourceType) formData.append('sourceType', options.sourceType)
  if (options?.password) formData.append('password', options.password)
  if (options?.savePassword !== undefined)
    formData.append('savePassword', String(options.savePassword))
  // Combine provider and model in format "provider:model" for backend
  if (options?.parsingProvider && options?.parsingModel) {
    formData.append('parsingModel', `${options.parsingProvider}:${options.parsingModel}`)
  }
  if (options?.categorizationProvider && options?.categorizationModel) {
    formData.append(
      'categorizationModel',
      `${options.categorizationProvider}:${options.categorizationModel}`
    )
  }

  const response = await api.post('/statements/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

/**
 * Delete a statement
 */
export async function deleteStatement(statementId: string): Promise<void> {
  await api.delete(`/statements/${statementId}`)
}

// ============================================
// Transactions API
// ============================================

/**
 * Transaction type
 */
export interface Transaction {
  id: string
  accountId: string
  statementId: string
  profileId: string
  userId: string
  date: string
  type: 'credit' | 'debit'
  amount: number
  currency: string
  originalDescription: string
  summary: string | null
  category: string
  categoryConfidence: number | null
  isSubscription: boolean
  linkedTransactionId: string | null
  linkType: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Transaction filters
 */
export interface TransactionFilters {
  profileId?: string
  accountId?: string[]
  statementId?: string[]
  category?: string[]
  type?: 'credit' | 'debit'
  startDate?: string
  endDate?: string
  search?: string
  minAmount?: number
  maxAmount?: number
  isSubscription?: boolean
}

/**
 * Transaction pagination
 */
export interface TransactionPagination {
  page?: number
  limit?: number
  sortBy?: 'date' | 'amount' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

/**
 * Transaction list response
 */
export interface TransactionListResponse {
  transactions: Transaction[]
  total: number
  page: number
  limit: number
}

/**
 * Transaction stats
 */
export interface TransactionStats {
  totalCredits: number
  totalDebits: number
  creditCount: number
  debitCount: number
  netAmount: number
  currency: string
  categoryBreakdown: { category: string; total: number; count: number }[]
}

/**
 * Category type
 */
export interface Category {
  code: string
  label: string
  color: string
}

/**
 * Get transactions
 */
export async function getTransactions(
  filters?: TransactionFilters,
  pagination?: TransactionPagination
): Promise<TransactionListResponse> {
  const params = new URLSearchParams()
  if (filters?.profileId) params.set('profileId', filters.profileId)
  if (filters?.accountId?.length) params.set('accountId', filters.accountId.join(','))
  if (filters?.statementId?.length) params.set('statementId', filters.statementId.join(','))
  if (filters?.category?.length) params.set('category', filters.category.join(','))
  if (filters?.type) params.set('type', filters.type)
  if (filters?.startDate) params.set('startDate', filters.startDate)
  if (filters?.endDate) params.set('endDate', filters.endDate)
  if (filters?.search) params.set('search', filters.search)
  if (filters?.minAmount !== undefined) params.set('minAmount', String(filters.minAmount))
  if (filters?.maxAmount !== undefined) params.set('maxAmount', String(filters.maxAmount))
  if (filters?.isSubscription !== undefined)
    params.set('isSubscription', String(filters.isSubscription))
  if (pagination?.page) params.set('page', String(pagination.page))
  if (pagination?.limit) params.set('limit', String(pagination.limit))
  if (pagination?.sortBy) params.set('sortBy', pagination.sortBy)
  if (pagination?.sortOrder) params.set('sortOrder', pagination.sortOrder)

  const queryString = params.toString() ? `?${params.toString()}` : ''
  const response = await api.get(`/transactions${queryString}`)
  return response.data
}

/**
 * Get transaction by ID
 */
export async function getTransaction(transactionId: string): Promise<Transaction> {
  const response = await api.get(`/transactions/${transactionId}`)
  return response.data.transaction
}

/**
 * Update transaction
 */
export async function updateTransaction(
  transactionId: string,
  data: { category?: string; summary?: string }
): Promise<Transaction> {
  const response = await api.patch(`/transactions/${transactionId}`, data)
  return response.data.transaction
}

/**
 * Get transaction stats
 */
export async function getTransactionStats(filters?: {
  profileId?: string
  accountId?: string[]
  statementId?: string[]
  startDate?: string
  endDate?: string
  category?: string[]
  type?: 'credit' | 'debit'
  search?: string
  isSubscription?: boolean
}): Promise<TransactionStats> {
  const params = new URLSearchParams()
  if (filters?.profileId) params.set('profileId', filters.profileId)
  if (filters?.accountId?.length) params.set('accountId', filters.accountId.join(','))
  if (filters?.statementId?.length) params.set('statementId', filters.statementId.join(','))
  if (filters?.startDate) params.set('startDate', filters.startDate)
  if (filters?.endDate) params.set('endDate', filters.endDate)
  if (filters?.category?.length) params.set('category', filters.category.join(','))
  if (filters?.type) params.set('type', filters.type)
  if (filters?.search) params.set('search', filters.search)
  if (filters?.isSubscription !== undefined)
    params.set('isSubscription', String(filters.isSubscription))

  const queryString = params.toString() ? `?${params.toString()}` : ''
  const response = await api.get(`/transactions/stats${queryString}`)
  return response.data
}

/**
 * Get categories for user's country
 */
export async function getCategories(): Promise<{ categories: Category[]; countryCode: string }> {
  const response = await api.get('/categories')
  return response.data
}

/**
 * Link transactions
 */
export async function linkTransactions(
  transactionId1: string,
  transactionId2: string,
  linkType: 'payment' | 'transfer' | 'refund'
): Promise<void> {
  await api.post('/transactions/link', { transactionId1, transactionId2, linkType })
}

/**
 * Unlink transaction
 */
export async function unlinkTransaction(transactionId: string): Promise<void> {
  await api.delete(`/transactions/${transactionId}/link`)
}

/**
 * Get link candidates for a transaction
 */
export async function getLinkCandidates(transactionId: string): Promise<Transaction[]> {
  const response = await api.get(`/transactions/${transactionId}/link-candidates`)
  return response.data.candidates
}

// ============================================
// Recategorization API
// ============================================

/**
 * Recategorize job status
 */
export interface RecategorizeJob {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  transactionCount?: number
  processedCount?: number
  errorMessage?: string
  createdAt: string
  completedAt?: string
}

/**
 * Trigger recategorization for an account or statement
 */
export async function recategorizeTransactions(data: {
  profileId: string
  accountId?: string
  statementId?: string
  categorizationProvider: string
  categorizationModel: string
}): Promise<{ success: boolean; jobId: string; message: string }> {
  // Combine provider and model in format "provider:model" for backend
  const categorizationModel = `${data.categorizationProvider}:${data.categorizationModel}`
  const response = await api.post('/transactions/recategorize', {
    profileId: data.profileId,
    accountId: data.accountId,
    statementId: data.statementId,
    categorizationModel,
  })
  return response.data
}

/**
 * Get recategorization job status
 */
export async function getRecategorizeJobStatus(jobId: string): Promise<RecategorizeJob> {
  const response = await api.get(`/transactions/recategorize/${jobId}`)
  return response.data
}

/**
 * Categorization status
 */
export interface CategorizationStatus {
  active: boolean
  type: 'parsing' | 'categorizing' | 'recategorizing' | null
  progress?: { current: number; total: number }
}

/**
 * Get current categorization status
 */
export async function getCategorizationStatus(): Promise<CategorizationStatus> {
  const response = await api.get('/transactions/categorization-status')
  return response.data
}

// ============================================
// Investments API (Sources, Holdings, Snapshots)
// ============================================

/**
 * Investment source (platform like Zerodha, Groww, etc.)
 */
export interface InvestmentSource {
  id: string
  profileId: string
  userId: string
  sourceType: string
  sourceName: string
  institution: string | null
  accountIdentifier: string | null
  countryCode: string
  currency: string
  lastStatementDate: string | null
  lastSyncAt: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Investment holding (individual security/instrument)
 */
export interface InvestmentHolding {
  id: string
  sourceId: string
  profileId: string
  userId: string
  investmentType: string
  symbol: string | null
  name: string
  isin: string | null
  units: number | null // null for balance-based holdings like PPF, EPF, FD
  averageCost: number | null
  currentPrice: number | null
  currentValue: number
  investedValue: number | null
  gainLoss: number | null
  gainLossPercent: number | null
  currency: string
  asOfDate: string
  folioNumber: string | null
  maturityDate: string | null
  interestRate: number | null
  createdAt: string
  updatedAt: string
}

/**
 * Holding detail in snapshot
 */
export interface SnapshotHoldingDetail {
  symbol: string | null
  name: string
  investmentType: string
  units: number | null // null for balance-based holdings like PPF, EPF, FD
  currentValue: number
  investedValue: number | null
  currency: string
}

/**
 * Investment snapshot (historical point-in-time)
 */
export interface InvestmentSnapshot {
  id: string
  sourceId: string | null
  profileId: string
  userId: string
  snapshotDate: string
  snapshotType: 'statement_import' | 'manual' | 'scheduled'
  totalInvested: number | null
  totalCurrent: number
  totalGainLoss: number | null
  gainLossPercent: number | null
  holdingsCount: number
  holdingsDetail: SnapshotHoldingDetail[] | null
  currency: string
  createdAt: string
}

/**
 * Investment source type option
 */
export interface InvestmentSourceType {
  code: string
  label: string
}

/**
 * Investment holding type option
 */
export interface InvestmentHoldingType {
  code: string
  label: string
}

/**
 * Investment summary (aggregated across all sources)
 */
export interface InvestmentSummary {
  totalInvested: number
  totalCurrent: number
  totalGainLoss: number
  gainLossPercent: number
  holdingsCount: number
  sourcesCount: number
  byType: { type: string; count: number; investedValue: number; currentValue: number }[]
  byCurrency: { currency: string; investedValue: number; currentValue: number }[]
}

/**
 * Get investment types (sources, holdings)
 */
export async function getInvestmentTypes(): Promise<{
  sourceTypes: InvestmentSourceType[]
  holdingTypes: InvestmentHoldingType[]
  countryCode: string
}> {
  const response = await api.get('/investments/types')
  return response.data
}

/**
 * Get investment summary
 */
export async function getInvestmentSummary(profileId?: string): Promise<InvestmentSummary> {
  const params = profileId ? `?profileId=${profileId}` : ''
  const response = await api.get(`/investments/summary${params}`)
  return response.data
}

/**
 * Get all investment sources
 */
export async function getInvestmentSources(profileId?: string): Promise<InvestmentSource[]> {
  const params = profileId ? `?profileId=${profileId}` : ''
  const response = await api.get(`/investments/sources${params}`)
  return response.data.sources
}

/**
 * Get investment source by ID
 */
export async function getInvestmentSource(sourceId: string): Promise<InvestmentSource> {
  const response = await api.get(`/investments/sources/${sourceId}`)
  return response.data.source
}

/**
 * Create an investment source (for manual entry)
 */
export async function createInvestmentSource(data: {
  profileId: string
  sourceType: string
  sourceName: string
  institution?: string | null
  accountIdentifier?: string | null
  countryCode?: string
  currency?: string
}): Promise<InvestmentSource> {
  const response = await api.post('/investments/sources', data)
  return response.data.source
}

/**
 * Update an investment source
 */
export async function updateInvestmentSource(
  sourceId: string,
  data: {
    sourceName?: string
    institution?: string | null
    accountIdentifier?: string | null
    countryCode?: string
    currency?: string
  }
): Promise<InvestmentSource> {
  const response = await api.patch(`/investments/sources/${sourceId}`, data)
  return response.data.source
}

/**
 * Delete an investment source
 */
export async function deleteInvestmentSource(sourceId: string): Promise<void> {
  await api.delete(`/investments/sources/${sourceId}`)
}

/**
 * Get holdings for a source
 */
export async function getHoldingsForSource(sourceId: string): Promise<InvestmentHolding[]> {
  const response = await api.get(`/investments/sources/${sourceId}/holdings`)
  return response.data.holdings
}

/**
 * Get all holdings (across all sources)
 */
export async function getAllHoldings(profileId?: string): Promise<InvestmentHolding[]> {
  const params = profileId ? `?profileId=${profileId}` : ''
  const response = await api.get(`/investments/holdings${params}`)
  return response.data.holdings
}

/**
 * Get holding by ID
 */
export async function getHolding(holdingId: string): Promise<InvestmentHolding> {
  const response = await api.get(`/investments/holdings/${holdingId}`)
  return response.data.holding
}

/**
 * Create a holding (for manual entry)
 */
export async function createHolding(data: {
  sourceId: string
  investmentType: string
  name: string
  units: number | null // null for balance-based holdings like PPF, EPF, FD
  currentValue: number
  currency: string
  asOfDate: string
  symbol?: string | null
  isin?: string | null
  averageCost?: number | null
  currentPrice?: number | null
  investedValue?: number | null
  folioNumber?: string | null
  maturityDate?: string | null
  interestRate?: number | null
}): Promise<InvestmentHolding> {
  const response = await api.post('/investments/holdings', data)
  return response.data.holding
}

/**
 * Update a holding
 */
export async function updateHolding(
  holdingId: string,
  data: {
    investmentType?: string
    name?: string
    units?: number | null
    currentValue?: number
    currency?: string
    asOfDate?: string
    symbol?: string | null
    isin?: string | null
    averageCost?: number | null
    currentPrice?: number | null
    investedValue?: number | null
    folioNumber?: string | null
    maturityDate?: string | null
    interestRate?: number | null
  }
): Promise<InvestmentHolding> {
  const response = await api.patch(`/investments/holdings/${holdingId}`, data)
  return response.data.holding
}

/**
 * Delete a holding
 */
export async function deleteHolding(holdingId: string): Promise<void> {
  await api.delete(`/investments/holdings/${holdingId}`)
}

/**
 * Get snapshots for a source
 */
export async function getSnapshotsForSource(
  sourceId: string,
  options?: { startDate?: string; endDate?: string; limit?: number }
): Promise<InvestmentSnapshot[]> {
  const params = new URLSearchParams()
  if (options?.startDate) params.set('startDate', options.startDate)
  if (options?.endDate) params.set('endDate', options.endDate)
  if (options?.limit) params.set('limit', options.limit.toString())
  const queryString = params.toString() ? `?${params.toString()}` : ''
  const response = await api.get(`/investments/sources/${sourceId}/snapshots${queryString}`)
  return response.data.snapshots
}

/**
 * Get all snapshots (across all sources)
 */
export async function getAllSnapshots(
  profileId?: string,
  options?: { startDate?: string; endDate?: string; limit?: number }
): Promise<InvestmentSnapshot[]> {
  const params = new URLSearchParams()
  if (profileId) params.set('profileId', profileId)
  if (options?.startDate) params.set('startDate', options.startDate)
  if (options?.endDate) params.set('endDate', options.endDate)
  if (options?.limit) params.set('limit', options.limit.toString())
  const queryString = params.toString() ? `?${params.toString()}` : ''
  const response = await api.get(`/investments/snapshots${queryString}`)
  return response.data.snapshots
}

/**
 * Create a snapshot manually
 */
export async function createSnapshot(data: {
  sourceId?: string | null
  profileId: string
  snapshotDate: string
  snapshotType: 'manual'
  totalCurrent: number
  holdingsCount: number
  currency: string
  totalInvested?: number | null
  holdingsDetail?: SnapshotHoldingDetail[] | null
}): Promise<InvestmentSnapshot> {
  const response = await api.post('/investments/snapshots', data)
  return response.data.snapshot
}

/**
 * Delete a snapshot
 */
export async function deleteSnapshot(snapshotId: string): Promise<void> {
  await api.delete(`/investments/snapshots/${snapshotId}`)
}

// ============================================
// Summary API
// ============================================

/**
 * Account balance info for net worth
 */
export interface AccountBalanceInfo {
  accountId: string
  accountName: string | null
  type: string
  institution: string | null
  currency: string
  latestBalance: number | null
  latestStatementDate: string | null
  isLiability: boolean
}

/**
 * Financial summary response
 */
export interface FinancialSummary {
  netWorth: {
    totalAssets: number
    totalLiabilities: number
    netWorth: number
    currency: string
    accounts: AccountBalanceInfo[]
    calculatedAt: string
  }
  investments: {
    totalInvested: number
    totalCurrent: number
    totalGainLoss: number
    gainLossPercent: number
    holdingsCount: number
    sourcesCount: number
    byType: { type: string; count: number; investedValue: number; currentValue: number }[]
    byCurrency: { currency: string; investedValue: number; currentValue: number }[]
  }
  transactions: {
    period: {
      startDate: string
      endDate: string
    }
    totalIncome: number
    totalExpenses: number
    incomeCount: number
    expenseCount: number
    netCashFlow: number
    currency: string
    categoryBreakdown: { category: string; total: number; count: number }[]
  }
  totals: {
    totalWealth: number
    currency: string
  }
}

/**
 * Get financial summary for a profile
 */
export async function getSummary(
  profileId: string,
  options?: { startDate?: string; endDate?: string }
): Promise<FinancialSummary> {
  const params = new URLSearchParams()
  params.set('profileId', profileId)
  if (options?.startDate) params.set('startDate', options.startDate)
  if (options?.endDate) params.set('endDate', options.endDate)

  const response = await api.get(`/summary?${params.toString()}`)
  return response.data
}

/**
 * Monthly trend data point
 */
export interface MonthlyTrendData {
  month: string
  monthLabel: string
  income: number
  expenses: number
  net: number
}

/**
 * Monthly trends response
 */
export interface MonthlyTrendsResponse {
  trends: MonthlyTrendData[]
  currency: string
  excludedCategories: string[]
}

/**
 * Options for monthly trends query
 */
export interface MonthlyTrendsOptions {
  /** Number of months to fetch (default: 12) - used if startDate/endDate not provided */
  months?: number
  /** Start date in YYYY-MM-DD format - takes precedence over months */
  startDate?: string
  /** End date in YYYY-MM-DD format - takes precedence over months */
  endDate?: string
  /** Categories to exclude from calculations */
  excludeCategories?: string[]
}

/**
 * Get monthly income/expense trends
 */
export async function getMonthlyTrends(
  profileId: string,
  options: MonthlyTrendsOptions = {}
): Promise<MonthlyTrendsResponse> {
  const { months = 12, startDate, endDate, excludeCategories } = options

  const params = new URLSearchParams()
  params.set('profileId', profileId)

  if (startDate) {
    params.set('startDate', startDate)
    if (endDate) {
      params.set('endDate', endDate)
    }
  } else {
    params.set('months', months.toString())
  }

  if (excludeCategories?.length) {
    params.set('excludeCategories', excludeCategories.join(','))
  }

  const response = await api.get(`/summary/monthly-trends?${params.toString()}`)
  return response.data
}

/**
 * Month transactions response (with netting and exclusions applied)
 */
export interface MonthTransactionsResponse {
  month: string
  monthLabel: string
  credits: Transaction[]
  debits: Transaction[]
  totals: {
    income: number
    expenses: number
    net: number
  }
  currency: string
  excludedCategories: string[]
}

/**
 * Get transactions for a specific month with netting and exclusions applied
 */
export async function getMonthTransactions(
  profileId: string,
  month: string,
  excludeCategories?: string[]
): Promise<MonthTransactionsResponse> {
  const params = new URLSearchParams()
  params.set('profileId', profileId)
  params.set('month', month)
  if (excludeCategories?.length) {
    params.set('excludeCategories', excludeCategories.join(','))
  }

  const response = await api.get(`/summary/month-transactions?${params.toString()}`)
  return response.data
}

// ============================================
// Preferences API
// ============================================

/**
 * Preference keys
 */
export const PREFERENCE_KEYS = {
  // Per-card category exclusions
  INCOME_EXPENSES_EXCLUDED_CATEGORIES: 'dashboard.income_expenses.excluded_categories',
  SPENDING_BY_CATEGORY_EXCLUDED_CATEGORIES: 'dashboard.spending_by_category.excluded_categories',
  // Other preferences
  DASHBOARD_CHART_TIMEFRAME: 'dashboard.chart_timeframe',
  // Profile selection
  SELECTED_PROFILE: 'selected_profile',
  // Chat preferences
  CHAT_PROVIDER: 'chat.provider',
  CHAT_MODEL: 'chat.model',
  CHAT_THINKING_LEVEL: 'chat.thinking_level',
  // Statement processing preferences
  STATEMENT_PARSING_PROVIDER: 'statement.parsing.provider',
  STATEMENT_PARSING_MODEL: 'statement.parsing.model',
  STATEMENT_CATEGORISATION_PROVIDER: 'statement.categorisation.provider',
  STATEMENT_CATEGORISATION_MODEL: 'statement.categorisation.model',
} as const

/**
 * Get all preferences
 */
export async function getPreferences(profileId?: string): Promise<Record<string, string>> {
  const params = profileId ? `?profileId=${profileId}` : ''
  const response = await api.get(`/preferences${params}`)
  return response.data.preferences
}

/**
 * Get a specific preference
 */
export async function getPreference(
  key: string,
  profileId?: string
): Promise<{ key: string; value: string | null; profileId: string | null }> {
  const params = profileId ? `?profileId=${profileId}` : ''
  const response = await api.get(`/preferences/${encodeURIComponent(key)}${params}`)
  return response.data
}

/**
 * Set a preference
 */
export async function setPreference(
  key: string,
  value: string,
  profileId?: string | null
): Promise<void> {
  await api.put('/preferences', { key, value, profileId })
}

/**
 * Delete a preference
 */
export async function deletePreference(key: string, profileId?: string): Promise<void> {
  const params = profileId ? `?profileId=${profileId}` : ''
  await api.delete(`/preferences/${encodeURIComponent(key)}${params}`)
}

// ============================================
// FX Rates API
// ============================================

/**
 * FX rates response
 */
export interface FxRatesResponse {
  success: boolean
  data?: {
    date: string
    baseCurrency: string
    rates: Record<string, number>
    fetchedAt: string
  }
  error?: string
}

/**
 * FX rate conversion response
 */
export interface FxRateResponse {
  success: boolean
  data?: {
    from: string
    to: string
    rate: number
  }
  error?: string
}

/**
 * Get FX rates for a base currency
 */
export async function getFxRates(baseCurrency: string = 'USD'): Promise<FxRatesResponse> {
  const response = await api.get(`/summary/fx-rates?base=${baseCurrency.toLowerCase()}`)
  return response.data
}

/**
 * Get conversion rate between two currencies
 */
export async function getFxRate(from: string, to: string): Promise<FxRateResponse> {
  const response = await api.get(`/summary/fx-rate?from=${from}&to=${to}`)
  return response.data
}

// ============================================
// Subscriptions API
// ============================================

/**
 * Detected subscription
 */
export interface DetectedSubscription {
  name: string
  category: string
  amount: number
  frequency: 'monthly' | 'quarterly' | 'yearly' | 'unknown'
  lastChargeDate: string
  chargeCount: number
  transactions: Array<{ id: string; date: string; amount: number }>
  // Account info
  accountId: string | null
  accountLast4: string | null
  accountType: string | null
  institution: string | null
  // Active status
  isActive: boolean
}

/**
 * Subscriptions response
 */
export interface SubscriptionsResponse {
  subscriptions: DetectedSubscription[]
  totalMonthly: number
  currency: string
}

/**
 * Get detected subscriptions
 */
export async function getSubscriptions(profileId: string): Promise<SubscriptionsResponse> {
  const params = new URLSearchParams()
  params.set('profileId', profileId)

  const response = await api.get(`/summary/subscriptions?${params.toString()}`)
  return response.data
}

// ============================================
// Constants API
// ============================================

/**
 * Institution type (bank, NBFC, etc.)
 */
export interface Institution {
  id: string
  name: string
  logo: string
  website?: string
}

/**
 * Investment source type (broker, platform, etc.)
 */
export interface InvestmentSourceType {
  code: string
  label: string
  logo: string
}

/**
 * Investment holding type
 */
export interface InvestmentHoldingType {
  code: string
  label: string
}

/**
 * All constants response
 */
export interface ConstantsResponse {
  countryCode: string
  institutions: Institution[]
  investmentSourceTypes: InvestmentSourceType[]
  accountTypes: AccountType[]
  categories: Category[]
  investmentTypes: { code: string; label: string }[]
  investmentHoldingTypes: InvestmentHoldingType[]
  countries: Country[]
}

/**
 * Get all constants for the user's country
 */
export async function getConstants(): Promise<ConstantsResponse> {
  const response = await api.get('/constants')
  return response.data
}

/**
 * Get institutions for the user's country
 */
export async function getInstitutions(): Promise<{
  institutions: Institution[]
  countryCode: string
}> {
  const response = await api.get('/constants/institutions')
  return response.data
}

/**
 * Get investment source types for the user's country
 */
export async function getInvestmentSourceTypes(): Promise<{
  sourceTypes: InvestmentSourceType[]
  countryCode: string
}> {
  const response = await api.get('/constants/investment-sources')
  return response.data
}

// ============================================
// Chat API
// ============================================

/**
 * Chat message role
 */
export type ChatMessageRole = 'user' | 'assistant' | 'tool'

/**
 * Step types for streaming response
 */
export type ReasoningStep = { type: 'reasoning'; content: string }
export type ToolCallStep = {
  type: 'tool-call'
  toolCallId: string
  toolName: string
  args: unknown
}
export type TextStep = { type: 'text'; content: string }
export type ChatStep = ReasoningStep | ToolCallStep | TextStep

/**
 * Chat message type
 */
export interface ChatMessage {
  id: string
  conversationId: string
  role: ChatMessageRole
  content: string | null
  provider: string | null
  model: string | null
  toolCalls: Array<{ toolCallId: string; toolName: string; args: unknown }> | null
  toolResults: Array<{ toolCallId: string; toolName: string; result: unknown }> | null
  reasoning: ChatStep[] | null
  approvalState: Array<{
    type: 'pending'
    toolCallId: string
    toolName: string
    confirmationData?: unknown
  }> | null
  createdAt: string
}

/**
 * Chat conversation type
 */
export interface ChatConversation {
  id: string
  profileId: string
  userId: string
  title: string | null
  summary: string | null
  createdAt: string
  updatedAt: string
  messages: ChatMessage[]
}

/**
 * AI model type
 */
export interface AIModel {
  id: string
  name: string
  supportsParsing?: boolean
  recommendedForParsing?: boolean
  recommendedForCategorization?: boolean
  supportsThinking?: boolean
  reasoningBuiltIn?: boolean
}

/**
 * AI provider type
 */
export interface AIProvider {
  id: string
  name: string
  hasApiKey: boolean
  models: AIModel[]
}

/**
 * Chat config response
 */
export interface ChatConfig {
  providers: AIProvider[]
  defaultProvider: string
  defaultModel: string
  isConfigured: boolean
}

/**
 * Get chat configuration
 */
export async function getChatConfig(): Promise<ChatConfig> {
  const response = await api.get('/chat/config')
  return response.data
}

/**
 * Get or create conversation for a profile
 */
/**
 * List all conversations for a profile
 */
export async function listConversations(
  profileId: string
): Promise<Omit<ChatConversation, 'messages'>[]> {
  const response = await api.get(`/chat/profiles/${profileId}/conversations`)
  return response.data
}

/**
 * Create a new conversation for a profile
 */
export async function createConversation(
  profileId: string
): Promise<Omit<ChatConversation, 'messages'>> {
  const response = await api.post(`/chat/profiles/${profileId}/conversations`)
  return response.data
}

/**
 * Get a specific conversation with messages
 */
export async function getConversationById(conversationId: string): Promise<ChatConversation> {
  const response = await api.get(`/chat/conversations/${conversationId}`)
  return response.data
}

/**
 * Get or create conversation for a profile (legacy - returns most recent)
 */
export async function getConversation(profileId: string): Promise<ChatConversation> {
  const response = await api.get(`/chat/profiles/${profileId}/conversation`)
  return response.data
}

/**
 * Delete a conversation
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  await api.delete(`/chat/conversations/${conversationId}`)
}

/**
 * Clear conversation messages (but keep the conversation)
 */
export async function clearConversation(conversationId: string): Promise<void> {
  await api.delete(`/chat/conversations/${conversationId}/messages`)
}

/**
 * Query data response for data-table components
 */
export interface QueryDataResponse {
  queryId: string
  dataType: 'transactions' | 'holdings' | 'accounts' | 'subscriptions' | 'monthly_trends' | 'stats'
  count: number
  schema: {
    fields: Array<{
      name: string
      type: 'string' | 'number' | 'boolean' | 'date' | 'object'
      description?: string
    }>
  }
  data: unknown[]
}

/**
 * Get query data for rendering in data-table components
 */
export async function getQueryData(queryId: string): Promise<QueryDataResponse> {
  const response = await api.get(`/chat/query/${queryId}`)
  return response.data
}

/**
 * SSE Event types
 */
export type ChatSSEEvent =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool-result'; toolCallId: string; toolName: string; result: unknown }
  | { type: 'done' }
  | { type: 'error'; error: string }

/**
 * Send a message and stream the response
 */
export async function sendChatMessage(
  conversationId: string,
  content: string,
  options: {
    provider: string
    model: string
    thinkingEnabled?: boolean
    thinkingBudget?: number
    reasoningEffort?: 'low' | 'medium' | 'high'
    thinkingLevel?: 'low' | 'medium' | 'high'
    onEvent: (event: ChatSSEEvent) => void
    signal?: AbortSignal
  }
): Promise<void> {
  const response = await fetch(
    `${api.defaults.baseURL}/chat/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        content,
        provider: options.provider,
        model: options.model,
        thinkingEnabled: options.thinkingEnabled,
        thinkingBudget: options.thinkingBudget,
        reasoningEffort: options.reasoningEffort,
        thinkingLevel: options.thinkingLevel,
      }),
      signal: options.signal,
    }
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to send message' }))
    throw new Error(error.error || 'Failed to send message')
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // Process SSE events
    const lines = buffer.split('\n')
    buffer = lines.pop() || '' // Keep incomplete line in buffer

    let currentEvent = ''
    for (const line of lines) {
      if (line.startsWith('event:')) {
        currentEvent = line.slice(6).trim()
        continue
      }
      if (line.startsWith('data:')) {
        const data = line.slice(5).trim()
        if (!data) continue

        try {
          const parsed = JSON.parse(data)

          // Handle events based on the event type from SSE
          switch (currentEvent) {
            case 'text':
              options.onEvent({ type: 'text', text: parsed.text })
              break
            case 'reasoning':
              options.onEvent({ type: 'reasoning', text: parsed.text })
              break
            case 'tool-call':
              options.onEvent({
                type: 'tool-call',
                toolCallId: parsed.toolCallId,
                toolName: parsed.toolName,
                args: parsed.args,
              })
              break
            case 'tool-result':
              options.onEvent({
                type: 'tool-result',
                toolCallId: parsed.toolCallId,
                toolName: parsed.toolName,
                result: parsed.result,
              })
              break
            case 'done':
              options.onEvent({ type: 'done' })
              break
            case 'error':
              options.onEvent({ type: 'error', error: parsed.error })
              break
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }
}
