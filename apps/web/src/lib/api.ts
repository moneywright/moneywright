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
 * Auth status response
 */
export interface AuthStatus {
  authEnabled: boolean
  authenticated: boolean
  user: User | null
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
 * Setup status
 */
export interface SetupStatus {
  setupRequired: boolean
  llmConfigured: boolean
  googleConfigured: boolean
  authEnabled: boolean
  setupComplete: boolean
}

/**
 * Get setup status
 */
export async function getSetupStatus(): Promise<SetupStatus> {
  const response = await api.get('/setup/status')
  return response.data
}

/**
 * Save setup configuration (legacy)
 */
export async function saveSetupConfig(config: {
  googleClientId: string
  googleClientSecret: string
  appUrl?: string
}): Promise<void> {
  await api.post('/setup/config', config)
}

/**
 * Save LLM setup configuration
 */
export async function saveLLMSetup(config: {
  provider: string
  model: string
  apiKey?: string
  apiBaseUrl?: string | null
}): Promise<void> {
  await api.post('/setup/llm', config)
}

/**
 * Save Google OAuth setup configuration
 */
export async function saveGoogleSetup(config: {
  googleClientId: string
  googleClientSecret: string
  appUrl?: string
}): Promise<void> {
  await api.post('/setup/google', config)
}

/**
 * Mark setup as complete
 */
export async function completeSetup(): Promise<void> {
  await api.post('/setup/complete')
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
    const response = await api.get('/auth/me')
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
// Auth Status API
// ============================================

/**
 * Get auth status - called on app initialization
 */
export async function getAuthStatus(): Promise<AuthStatus> {
  const response = await api.get('/auth/status')
  return response.data
}

// ============================================
// User / Onboarding API
// ============================================

/**
 * Get supported countries
 */
export async function getCountries(): Promise<Country[]> {
  const response = await api.get('/user/countries')
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
  provider: 'openai' | 'anthropic' | 'google' | 'ollama' | 'vercel'
  model: string
  apiBaseUrl: string | null
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
  recommended?: boolean
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
 * Update LLM settings
 */
export async function updateLLMSettings(data: {
  provider?: string
  model?: string
  apiBaseUrl?: string | null
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
export async function testLLMConnection(): Promise<LLMTestResult> {
  const response = await api.post('/llm/test')
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
  currency: string
  isActive: boolean
  hasStatementPassword: boolean
  createdAt: string
  updatedAt: string
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
  accountId: string
  profileId: string
  userId: string
  originalFilename: string
  fileType: string
  fileSizeBytes: number | null
  periodStart: string | null
  periodEnd: string | null
  status: 'pending' | 'parsing' | 'completed' | 'failed'
  errorMessage: string | null
  summary: Record<string, unknown> | null
  transactionCount: number
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
 * Upload a statement
 */
export async function uploadStatement(
  file: File,
  profileId: string,
  options?: {
    accountId?: string
    password?: string
    savePassword?: boolean
    model?: string
  }
): Promise<StatementUploadResponse> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('profileId', profileId)
  if (options?.accountId) formData.append('accountId', options.accountId)
  if (options?.password) formData.append('password', options.password)
  if (options?.savePassword !== undefined)
    formData.append('savePassword', String(options.savePassword))
  if (options?.model) formData.append('model', options.model)

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
  accountId?: string
  statementId?: string
  category?: string
  type?: 'credit' | 'debit'
  startDate?: string
  endDate?: string
  search?: string
  minAmount?: number
  maxAmount?: number
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
  if (filters?.accountId) params.set('accountId', filters.accountId)
  if (filters?.statementId) params.set('statementId', filters.statementId)
  if (filters?.category) params.set('category', filters.category)
  if (filters?.type) params.set('type', filters.type)
  if (filters?.startDate) params.set('startDate', filters.startDate)
  if (filters?.endDate) params.set('endDate', filters.endDate)
  if (filters?.search) params.set('search', filters.search)
  if (filters?.minAmount !== undefined) params.set('minAmount', String(filters.minAmount))
  if (filters?.maxAmount !== undefined) params.set('maxAmount', String(filters.maxAmount))
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
  accountId?: string
  startDate?: string
  endDate?: string
  category?: string
  type?: 'credit' | 'debit'
  search?: string
}): Promise<TransactionStats> {
  const params = new URLSearchParams()
  if (filters?.profileId) params.set('profileId', filters.profileId)
  if (filters?.accountId) params.set('accountId', filters.accountId)
  if (filters?.startDate) params.set('startDate', filters.startDate)
  if (filters?.endDate) params.set('endDate', filters.endDate)
  if (filters?.category) params.set('category', filters.category)
  if (filters?.type) params.set('type', filters.type)
  if (filters?.search) params.set('search', filters.search)

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
// Investments API
// ============================================

/**
 * Investment type
 */
export interface Investment {
  id: string
  profileId: string
  userId: string
  type: string
  institution: string | null
  name: string
  units: number | null
  purchaseValue: number | null
  currentValue: number | null
  currency: string
  folioNumber: string | null
  accountNumber: string | null
  maturityDate: string | null
  interestRate: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Investment type option
 */
export interface InvestmentType {
  code: string
  label: string
}

/**
 * Investment summary
 */
export interface InvestmentSummary {
  totalPurchaseValue: number
  totalCurrentValue: number
  totalGainLoss: number
  gainLossPercentage: number
  byType: { type: string; count: number; purchaseValue: number; currentValue: number }[]
  byCurrency: { currency: string; purchaseValue: number; currentValue: number }[]
}

/**
 * Get all investments
 */
export async function getInvestments(profileId?: string): Promise<Investment[]> {
  const params = profileId ? `?profileId=${profileId}` : ''
  const response = await api.get(`/investments${params}`)
  return response.data.investments
}

/**
 * Get investment by ID
 */
export async function getInvestment(investmentId: string): Promise<Investment> {
  const response = await api.get(`/investments/${investmentId}`)
  return response.data.investment
}

/**
 * Get investment types for user's country
 */
export async function getInvestmentTypes(): Promise<{
  investmentTypes: InvestmentType[]
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
 * Create an investment
 */
export async function createInvestment(data: {
  profileId: string
  type: string
  name: string
  currency: string
  institution?: string | null
  units?: number | null
  purchaseValue?: number | null
  currentValue?: number | null
  folioNumber?: string | null
  accountNumber?: string | null
  maturityDate?: string | null
  interestRate?: number | null
  notes?: string | null
}): Promise<Investment> {
  const response = await api.post('/investments', data)
  return response.data.investment
}

/**
 * Update an investment
 */
export async function updateInvestment(
  investmentId: string,
  data: {
    type?: string
    name?: string
    institution?: string | null
    units?: number | null
    purchaseValue?: number | null
    currentValue?: number | null
    currency?: string
    folioNumber?: string | null
    accountNumber?: string | null
    maturityDate?: string | null
    interestRate?: number | null
    notes?: string | null
  }
): Promise<Investment> {
  const response = await api.patch(`/investments/${investmentId}`, data)
  return response.data.investment
}

/**
 * Delete an investment
 */
export async function deleteInvestment(investmentId: string): Promise<void> {
  await api.delete(`/investments/${investmentId}`)
}
