/**
 * Application constants
 */

/**
 * Supported countries with their details
 * ISO 3166-1 alpha-2 codes
 */
export const SUPPORTED_COUNTRIES = [
  { code: 'IN', name: 'India', currency: 'INR', currencySymbol: '₹' },
  { code: 'US', name: 'United States', currency: 'USD', currencySymbol: '$' },
] as const

export type CountryCode = (typeof SUPPORTED_COUNTRIES)[number]['code']

/**
 * Relationship types for profiles
 */
export const RELATIONSHIP_TYPES = ['self', 'spouse', 'parent', 'child', 'sibling', 'other'] as const

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number]

/**
 * Default user ID for local mode (AUTH_ENABLED=false)
 */
export const DEFAULT_USER_ID = 'default'

/**
 * Account types by country
 */
export const ACCOUNT_TYPES = {
  IN: [
    { code: 'savings_account', label: 'Savings Account' },
    { code: 'current_account', label: 'Current Account' },
    { code: 'credit_card', label: 'Credit Card' },
    { code: 'fixed_deposit', label: 'Fixed Deposit' },
    { code: 'ppf', label: 'PPF' },
    { code: 'epf', label: 'EPF' },
    { code: 'nps', label: 'NPS' },
    { code: 'demat', label: 'Demat Account' },
    { code: 'other', label: 'Other' },
  ],
  US: [
    { code: 'checking_account', label: 'Checking Account' },
    { code: 'savings_account', label: 'Savings Account' },
    { code: 'credit_card', label: 'Credit Card' },
    { code: '401k', label: '401(k)' },
    { code: 'ira', label: 'IRA' },
    { code: 'brokerage', label: 'Brokerage Account' },
    { code: 'cd', label: 'Certificate of Deposit' },
    { code: 'other', label: 'Other' },
  ],
} as const

export type AccountTypeCode = (typeof ACCOUNT_TYPES)[CountryCode][number]['code']

/**
 * Transaction categories by country
 */
export const TRANSACTION_CATEGORIES = {
  IN: [
    { code: 'food_dining', label: 'Food & Dining' },
    { code: 'groceries', label: 'Groceries' },
    { code: 'shopping', label: 'Shopping' },
    { code: 'utilities', label: 'Utilities (Electricity, Water, Gas)' },
    { code: 'mobile_internet', label: 'Mobile & Internet' },
    { code: 'emi', label: 'EMI / Loan Payment' },
    { code: 'rent', label: 'Rent' },
    { code: 'fuel', label: 'Fuel' },
    { code: 'entertainment', label: 'Entertainment' },
    { code: 'travel', label: 'Travel' },
    { code: 'healthcare', label: 'Healthcare' },
    { code: 'education', label: 'Education' },
    { code: 'insurance', label: 'Insurance' },
    { code: 'investment', label: 'Investment' },
    { code: 'transfer', label: 'Transfer' },
    { code: 'atm_withdrawal', label: 'ATM Withdrawal' },
    { code: 'salary', label: 'Salary / Income' },
    { code: 'refund', label: 'Refund' },
    { code: 'cashback', label: 'Cashback / Rewards' },
    { code: 'tax', label: 'Tax Payment' },
    { code: 'government', label: 'Government Services' },
    { code: 'charity', label: 'Charity / Donations' },
    { code: 'dividend', label: 'Dividend' },
    { code: 'interest', label: 'Interest' },
    { code: 'credit_card_payment', label: 'Credit Card Payment' },
    { code: 'bank_charges', label: 'Bank Charges / Fees' },
    { code: 'forex', label: 'Foreign Exchange' },
    { code: 'other', label: 'Other' },
  ],
  US: [
    { code: 'food_dining', label: 'Food & Dining' },
    { code: 'groceries', label: 'Groceries' },
    { code: 'shopping', label: 'Shopping' },
    { code: 'utilities', label: 'Utilities' },
    { code: 'phone_internet', label: 'Phone & Internet' },
    { code: 'mortgage', label: 'Mortgage' },
    { code: 'rent', label: 'Rent' },
    { code: 'gas', label: 'Gas / Fuel' },
    { code: 'entertainment', label: 'Entertainment' },
    { code: 'travel', label: 'Travel' },
    { code: 'healthcare', label: 'Healthcare' },
    { code: 'education', label: 'Education' },
    { code: 'insurance', label: 'Insurance' },
    { code: 'investment', label: 'Investment' },
    { code: 'transfer', label: 'Transfer' },
    { code: 'atm_withdrawal', label: 'ATM Withdrawal' },
    { code: 'paycheck', label: 'Paycheck / Income' },
    { code: 'refund', label: 'Refund' },
    { code: 'cashback', label: 'Cashback / Rewards' },
    { code: 'tax', label: 'Tax Payment' },
    { code: 'subscription', label: 'Subscriptions' },
    { code: 'childcare', label: 'Childcare' },
    { code: 'pet', label: 'Pet Expenses' },
    { code: 'charity', label: 'Charity / Donations' },
    { code: 'dividend', label: 'Dividend' },
    { code: 'interest', label: 'Interest' },
    { code: 'credit_card_payment', label: 'Credit Card Payment' },
    { code: 'bank_charges', label: 'Bank Charges / Fees' },
    { code: 'forex', label: 'Foreign Exchange' },
    { code: 'other', label: 'Other' },
  ],
} as const

export type CategoryCode = (typeof TRANSACTION_CATEGORIES)[CountryCode][number]['code']

/**
 * Investment types by country
 */
export const INVESTMENT_TYPES = {
  IN: [
    { code: 'mutual_fund', label: 'Mutual Fund' },
    { code: 'stocks', label: 'Stocks' },
    { code: 'fixed_deposit', label: 'Fixed Deposit' },
    { code: 'ppf', label: 'PPF' },
    { code: 'epf', label: 'EPF' },
    { code: 'nps', label: 'NPS' },
    { code: 'bonds', label: 'Bonds' },
    { code: 'gold', label: 'Gold' },
    { code: 'real_estate', label: 'Real Estate' },
    { code: 'other', label: 'Other' },
  ],
  US: [
    { code: 'mutual_fund', label: 'Mutual Fund' },
    { code: 'etf', label: 'ETF' },
    { code: 'stocks', label: 'Stocks' },
    { code: '401k', label: '401(k)' },
    { code: 'ira', label: 'IRA' },
    { code: 'cd', label: 'Certificate of Deposit' },
    { code: 'bonds', label: 'Bonds' },
    { code: 'real_estate', label: 'Real Estate' },
    { code: 'other', label: 'Other' },
  ],
} as const

export type InvestmentTypeCode = (typeof INVESTMENT_TYPES)[CountryCode][number]['code']

/**
 * Statement parsing status
 */
export const STATEMENT_STATUS = ['pending', 'parsing', 'completed', 'failed'] as const
export type StatementStatus = (typeof STATEMENT_STATUS)[number]

/**
 * Transaction types
 */
export const TRANSACTION_TYPES = ['credit', 'debit'] as const
export type TransactionType = (typeof TRANSACTION_TYPES)[number]

/**
 * Transaction link types
 */
export const TRANSACTION_LINK_TYPES = ['payment', 'transfer', 'refund'] as const
export type TransactionLinkType = (typeof TRANSACTION_LINK_TYPES)[number]

/**
 * Supported file types for statement upload
 */
export const SUPPORTED_FILE_TYPES = ['pdf', 'csv', 'xlsx'] as const
export type FileType = (typeof SUPPORTED_FILE_TYPES)[number]

/**
 * LLM Providers
 */
export const LLM_PROVIDERS = ['openai', 'anthropic', 'google', 'ollama', 'vercel'] as const
export type LLMProvider = (typeof LLM_PROVIDERS)[number]

/**
 * AI Model definition
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
 * AI Provider configuration
 */
export interface AIProviderConfig {
  id: LLMProvider
  name: string
  models: AIModel[]
}

/**
 * Available AI providers and their models
 * Updated January 2026
 *
 * Sources:
 * - OpenAI: https://platform.openai.com/docs/models
 * - Anthropic: https://docs.anthropic.com/en/docs/about-claude/models/overview
 * - Google: https://ai.google.dev/gemini-api/docs/models
 */
export const AI_PROVIDERS: AIProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      {
        id: 'gpt-5.2',
        name: 'GPT-5.2',
        supportsParsing: true,
        recommendedForParsing: true,
        supportsThinking: true,
      },
      {
        id: 'gpt-5-mini',
        name: 'GPT-5 Mini',
        supportsParsing: true,
        recommendedForCategorization: true,
        supportsThinking: true,
      },
      { id: 'gpt-5-nano', name: 'GPT-5 Nano', supportsThinking: true },
      { id: 'gpt-4.1', name: 'GPT-4.1', supportsParsing: true, supportsThinking: true },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      {
        id: 'claude-opus-4-5',
        name: 'Claude Opus 4.5',
        supportsParsing: true,
        recommendedForParsing: true,
        supportsThinking: true,
      },
      {
        id: 'claude-sonnet-4-5',
        name: 'Claude Sonnet 4.5',
        supportsParsing: true,
        supportsThinking: true,
      },
      {
        id: 'claude-haiku-4-5',
        name: 'Claude Haiku 4.5',
        recommendedForCategorization: true,
        supportsThinking: true,
      },
    ],
  },
  {
    id: 'google',
    name: 'Google',
    models: [
      {
        id: 'gemini-3-pro-preview',
        name: 'Gemini 3 Pro',
        supportsParsing: true,
        recommendedForParsing: true,
        supportsThinking: true,
      },
      {
        id: 'gemini-3-flash-preview',
        name: 'Gemini 3 Flash',
        supportsParsing: true,
        recommendedForCategorization: true,
        supportsThinking: true,
      },
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        supportsParsing: true,
        supportsThinking: true,
      },
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        recommendedForCategorization: true,
        supportsThinking: true,
      },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    models: [
      { id: 'llama3.2', name: 'Llama 3.2', supportsParsing: true, recommendedForParsing: true },
      { id: 'llama3.1', name: 'Llama 3.1', supportsParsing: true },
      { id: 'mixtral', name: 'Mixtral', supportsParsing: true },
      { id: 'qwen2.5', name: 'Qwen 2.5', supportsParsing: true },
      { id: 'mistral', name: 'Mistral', recommendedForCategorization: true },
      { id: 'phi3', name: 'Phi-3' },
    ],
  },
  {
    id: 'vercel',
    name: 'Vercel AI Gateway',
    models: [
      // Anthropic models via Gateway
      {
        id: 'anthropic/claude-opus-4-5',
        name: 'Claude Opus 4.5',
        supportsParsing: true,
        recommendedForParsing: true,
        supportsThinking: true,
      },
      {
        id: 'anthropic/claude-sonnet-4-5',
        name: 'Claude Sonnet 4.5',
        supportsParsing: true,
        supportsThinking: true,
      },
      { id: 'anthropic/claude-haiku-4-5', name: 'Claude Haiku 4.5', supportsThinking: true },
      // OpenAI models via Gateway
      { id: 'openai/gpt-5.2', name: 'GPT-5.2', supportsParsing: true, supportsThinking: true },
      {
        id: 'openai/gpt-5-mini',
        name: 'GPT-5 Mini',
        supportsParsing: true,
        supportsThinking: true,
      },
      { id: 'openai/gpt-5-nano', name: 'GPT-5 Nano', supportsThinking: true },
      { id: 'openai/gpt-4.1', name: 'GPT-4.1', supportsParsing: true, supportsThinking: true },
      // Google models via Gateway
      {
        id: 'google/gemini-3-pro-preview',
        name: 'Gemini 3 Pro',
        supportsParsing: true,
        supportsThinking: true,
      },
      {
        id: 'google/gemini-3-flash-preview',
        name: 'Gemini 3 Flash',
        supportsParsing: true,
        supportsThinking: true,
      },
      {
        id: 'google/gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        supportsParsing: true,
        supportsThinking: true,
      },
      { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', supportsThinking: true },
      // xAI Grok models via Gateway
      { id: 'xai/grok-4', name: 'Grok 4', supportsParsing: true },
      {
        id: 'xai/grok-4.1-fast-reasoning',
        name: 'Grok 4.1 Fast Reasoning',
        supportsThinking: true,
        reasoningBuiltIn: true,
      },
      {
        id: 'xai/grok-4.1-fast-non-reasoning',
        name: 'Grok 4.1 Fast',
        recommendedForCategorization: true,
      },
      // Minimax models via Gateway (reasoning is built-in)
      {
        id: 'minimax/minimax-m2.1',
        name: 'Minimax M2.1',
        supportsParsing: true,
        supportsThinking: true,
        reasoningBuiltIn: true,
      },
      {
        id: 'minimax/minimax-m2',
        name: 'Minimax M2',
        supportsParsing: true,
        supportsThinking: true,
        reasoningBuiltIn: true,
      },
    ],
  },
]

/**
 * Get provider configuration by ID
 */
export function getProviderConfig(providerId: LLMProvider): AIProviderConfig | undefined {
  return AI_PROVIDERS.find((p) => p.id === providerId)
}

/**
 * Get provider name by ID
 */
export function getProviderName(providerId: LLMProvider): string {
  return getProviderConfig(providerId)?.name ?? providerId
}

/**
 * Check if a model ID is valid for a given provider
 */
export function isValidModel(providerId: LLMProvider, modelId: string): boolean {
  const provider = getProviderConfig(providerId)
  if (!provider) return false
  return provider.models.some((m) => m.id === modelId)
}

/**
 * Get the recommended model for parsing statements
 */
export function getRecommendedParsingModel(providerId: LLMProvider): AIModel | undefined {
  const provider = getProviderConfig(providerId)
  if (!provider) return undefined
  // First try to find recommended parsing model, then any parsing-capable model
  return (
    provider.models.find((m) => m.recommendedForParsing && m.supportsParsing) ??
    provider.models.find((m) => m.supportsParsing) ??
    provider.models[0]
  )
}

/**
 * Get the recommended model for categorization
 */
export function getRecommendedCategorizationModel(providerId: LLMProvider): AIModel | undefined {
  const provider = getProviderConfig(providerId)
  if (!provider) return undefined
  return provider.models.find((m) => m.recommendedForCategorization) ?? provider.models[0]
}

/**
 * Get all models that support parsing for a provider
 */
export function getParsingModels(providerId: LLMProvider): AIModel[] {
  const provider = getProviderConfig(providerId)
  if (!provider) return []
  return provider.models.filter((m) => m.supportsParsing)
}

/**
 * Get all models for a provider
 */
export function getProviderModels(providerId: LLMProvider): AIModel[] {
  return getProviderConfig(providerId)?.models ?? []
}

/**
 * Get the default parsing model ID for a provider
 */
export function getDefaultParsingModelId(provider: LLMProvider): string {
  const recommended = getRecommendedParsingModel(provider)
  return recommended?.id ?? 'gpt-5-mini'
}

/**
 * Get the default categorization model ID for a provider
 */
export function getDefaultCategorizationModelId(provider: LLMProvider): string {
  const recommended = getRecommendedCategorizationModel(provider)
  return recommended?.id ?? 'gpt-5-mini'
}

/**
 * Check if a country code is supported
 */
export function isValidCountryCode(code: string): code is CountryCode {
  return SUPPORTED_COUNTRIES.some((c) => c.code === code)
}

/**
 * Check if a relationship type is valid
 */
export function isValidRelationshipType(type: string): type is RelationshipType {
  return RELATIONSHIP_TYPES.includes(type as RelationshipType)
}

/**
 * Get country details by code
 */
export function getCountryByCode(code: CountryCode) {
  return SUPPORTED_COUNTRIES.find((c) => c.code === code)
}

/**
 * Get account types for a country
 */
export function getAccountTypesForCountry(countryCode: CountryCode) {
  return ACCOUNT_TYPES[countryCode] || ACCOUNT_TYPES.US
}

/**
 * Get transaction categories for a country
 */
export function getCategoriesForCountry(countryCode: CountryCode) {
  return TRANSACTION_CATEGORIES[countryCode] || TRANSACTION_CATEGORIES.US
}

/**
 * Get investment types for a country
 */
export function getInvestmentTypesForCountry(countryCode: CountryCode) {
  return INVESTMENT_TYPES[countryCode] || INVESTMENT_TYPES.US
}

/**
 * Check if account type is valid for a country
 */
export function isValidAccountType(countryCode: CountryCode, accountType: string): boolean {
  const types = getAccountTypesForCountry(countryCode)
  return types.some((t) => t.code === accountType)
}

/**
 * Check if category is valid for a country
 */
export function isValidCategory(countryCode: CountryCode, category: string): boolean {
  const categories = getCategoriesForCountry(countryCode)
  return categories.some((c) => c.code === category)
}
