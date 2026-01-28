import {
  pgTable,
  text,
  timestamp,
  index,
  varchar,
  boolean,
  unique,
  decimal,
  integer,
  date,
  jsonb,
} from 'drizzle-orm/pg-core'
import { nanoid } from '../lib/id'

/**
 * Users table - authenticated users or default local user
 * In local mode (AUTH_ENABLED=false), a default user with id="default" is created
 */
export const users = pgTable(
  'users',
  {
    id: varchar('id', { length: 21 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    email: text('email').unique(), // Nullable for default local user
    name: text('name'),
    picture: text('picture'), // Google profile picture URL
    googleId: text('google_id').unique(), // Nullable for default local user
    country: varchar('country', { length: 2 }), // ISO 3166-1 alpha-2 (e.g., "IN", "US")
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('users_google_id_idx').on(table.googleId),
    index('users_email_idx').on(table.email),
  ]
)

/**
 * Profiles table - each user can have multiple profiles (e.g., "Me", "Spouse", "Parent")
 * Profiles are used to segment financial data for family finance management
 */
export const profiles = pgTable(
  'profiles',
  {
    id: varchar('id', { length: 21 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: varchar('user_id', { length: 21 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 50 }).notNull(), // e.g., "Personal", "Spouse"
    relationship: varchar('relationship', { length: 20 }), // e.g., "self", "spouse", "parent"
    summary: text('summary'), // Free-form text about the profile owner (employer, income sources, etc.) - used to help LLM categorize transactions
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('profiles_user_id_idx').on(table.userId),
    unique('profiles_user_id_name_unique').on(table.userId, table.name),
  ]
)

/**
 * Sessions table - for tracking active user sessions
 * Supports multiple sessions per user, revocation, and token rotation
 */
export const sessions = pgTable(
  'sessions',
  {
    id: varchar('id', { length: 21 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: varchar('user_id', { length: 21 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull(), // SHA-256 hash of refresh token
    fingerprintHash: text('fingerprint_hash').notNull(), // SHA-256 hash of fingerprint cookie
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), // Refresh token expiry (7 days, rolling)
    absoluteExpiresAt: timestamp('absolute_expires_at', { withTimezone: true }).notNull(), // Hard limit (30 days from creation)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }), // Soft revoke (null = active)
    userAgent: text('user_agent'), // Browser/device info for display
    ipAddress: text('ip_address'), // For display in session management UI
  },
  (table) => [
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_token_hash_idx').on(table.refreshTokenHash),
    index('sessions_expires_at_idx').on(table.expiresAt),
  ]
)

/**
 * Application configuration stored in database.
 * Allows runtime configuration without environment variables.
 * Sensitive values (like client secrets) are encrypted before storage.
 *
 * Known keys:
 * - google_client_id: Google OAuth client ID
 * - google_client_secret: Google OAuth client secret (encrypted)
 * - app_url: Public URL for OAuth redirects
 * - setup_completed: Whether initial setup is done ('true'/'false')
 */
export const appConfig = pgTable('app_config', {
  key: varchar('key', { length: 255 }).primaryKey(),
  value: text('value').notNull(), // Encrypted for sensitive keys
  isEncrypted: text('is_encrypted').notNull().default('0'), // '1' = encrypted, '0' = plaintext
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Accounts table - financial accounts (bank, credit card, investment, etc.)
 * Auto-created when statements are uploaded
 */
export const accounts = pgTable(
  'accounts',
  {
    id: varchar('id', { length: 21 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    profileId: varchar('profile_id', { length: 21 })
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 21 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Account identification
    type: varchar('type', { length: 50 }).notNull(), // account type (country-specific)
    institution: text('institution'), // bank/institution name (free text)
    accountNumber: text('account_number'), // encrypted, full account number
    accountName: text('account_name'), // user-friendly name
    productName: text('product_name'), // account product/variant name (e.g., "Regalia", "Savings Max", "Imperia")

    // Statement password (for password-protected PDFs)
    statementPassword: text('statement_password'), // encrypted

    // Metadata
    currency: varchar('currency', { length: 3 }).notNull(), // ISO currency code
    isActive: boolean('is_active').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('accounts_profile_id_idx').on(table.profileId),
    index('accounts_user_id_idx').on(table.userId),
  ]
)

/**
 * Statements table - uploaded statement documents
 * Supports both bank/credit card statements and investment statements
 */
export const statements = pgTable(
  'statements',
  {
    id: varchar('id', { length: 21 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    // For bank/credit card statements
    accountId: varchar('account_id', { length: 21 }).references(() => accounts.id, {
      onDelete: 'cascade',
    }),
    // For investment statements
    sourceId: varchar('source_id', { length: 21 }).references(() => investmentSources.id, {
      onDelete: 'cascade',
    }),
    profileId: varchar('profile_id', { length: 21 })
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 21 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Document type - determines which linking field is used
    documentType: varchar('document_type', { length: 30 }).notNull().default('bank_statement'), // bank_statement, credit_card_statement, investment_statement

    // File info
    originalFilename: text('original_filename').notNull(),
    fileType: varchar('file_type', { length: 10 }).notNull(), // pdf, csv, xlsx
    fileSizeBytes: integer('file_size_bytes'),

    // Statement period
    periodStart: date('period_start'),
    periodEnd: date('period_end'),

    // Balance info (for bank statements)
    openingBalance: decimal('opening_balance', { precision: 15, scale: 2 }),
    closingBalance: decimal('closing_balance', { precision: 15, scale: 2 }),

    // Parsing status
    status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, parsing, completed, failed
    errorMessage: text('error_message'),

    // Statement summary (type-specific JSON)
    summary: jsonb('summary'),

    // Stats
    transactionCount: integer('transaction_count').default(0),
    holdingsCount: integer('holdings_count'), // For investment statements

    // Parse timing
    parseStartedAt: timestamp('parse_started_at', { withTimezone: true }),
    parseCompletedAt: timestamp('parse_completed_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('statements_account_id_idx').on(table.accountId),
    index('statements_source_id_idx').on(table.sourceId),
    index('statements_profile_id_idx').on(table.profileId),
    index('statements_user_id_idx').on(table.userId),
    index('statements_status_idx').on(table.status),
    index('statements_document_type_idx').on(table.documentType),
  ]
)

/**
 * Transactions table - individual transactions from statements
 */
export const transactions = pgTable(
  'transactions',
  {
    id: varchar('id', { length: 21 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    accountId: varchar('account_id', { length: 21 })
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    statementId: varchar('statement_id', { length: 21 })
      .notNull()
      .references(() => statements.id, { onDelete: 'cascade' }),
    profileId: varchar('profile_id', { length: 21 })
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 21 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Transaction data
    date: date('date').notNull(),
    type: varchar('type', { length: 10 }).notNull(), // credit or debit
    amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    balance: decimal('balance', { precision: 15, scale: 2 }), // Running balance after this transaction (if available)

    // Description
    originalDescription: text('original_description').notNull(),
    summary: text('summary'), // LLM-generated summary

    // Categorization
    category: varchar('category', { length: 50 }).notNull(),
    categoryConfidence: decimal('category_confidence', { precision: 3, scale: 2 }),
    isSubscription: boolean('is_subscription'), // LLM-detected recurring subscription

    // Deduplication
    hash: varchar('hash', { length: 64 }).notNull(), // SHA256

    // Cross-account linking
    linkedTransactionId: varchar('linked_transaction_id', { length: 21 }),
    linkType: varchar('link_type', { length: 20 }), // payment, transfer, refund

    // Manual editing and visibility
    isManuallyCategorized: boolean('is_manually_categorized').default(false), // true if user manually edited summary or category
    isHidden: boolean('is_hidden').default(false), // true if user hides this transaction from queries

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('transactions_account_id_idx').on(table.accountId),
    index('transactions_statement_id_idx').on(table.statementId),
    index('transactions_profile_id_idx').on(table.profileId),
    index('transactions_user_id_idx').on(table.userId),
    index('transactions_date_idx').on(table.date),
    index('transactions_category_idx').on(table.category),
    unique('transactions_account_hash_unique').on(table.accountId, table.hash),
  ]
)

/**
 * Investment Sources table - represents investment platforms/accounts
 * Examples: Zerodha, Groww, MF Central, PPF account, etc.
 */
export const investmentSources = pgTable(
  'investment_sources',
  {
    id: varchar('id', { length: 21 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    profileId: varchar('profile_id', { length: 21 })
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 21 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Source identification
    sourceType: varchar('source_type', { length: 50 }).notNull(), // zerodha, groww, mf_central, etc.
    sourceName: text('source_name').notNull(), // Display name like "Zerodha - Equity"
    institution: text('institution'), // Bank/broker name
    accountIdentifier: text('account_identifier'), // Demat ID, folio, Client ID (encrypted)

    // Location
    countryCode: varchar('country_code', { length: 2 }).notNull().default('IN'), // IN, US
    currency: varchar('currency', { length: 3 }).notNull().default('INR'),

    // Sync info
    lastStatementDate: date('last_statement_date'), // Date of most recent statement
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('investment_sources_profile_id_idx').on(table.profileId),
    index('investment_sources_user_id_idx').on(table.userId),
    index('investment_sources_source_type_idx').on(table.sourceType),
  ]
)

/**
 * Investment Holdings table - current holdings extracted from statements
 * One row per holding per source
 */
export const investmentHoldings = pgTable(
  'investment_holdings',
  {
    id: varchar('id', { length: 21 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    sourceId: varchar('source_id', { length: 21 }).references(() => investmentSources.id, {
      onDelete: 'cascade',
    }),
    profileId: varchar('profile_id', { length: 21 })
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 21 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Investment details
    investmentType: varchar('investment_type', { length: 50 }).notNull(), // stock, mutual_fund, etf, etc.
    symbol: varchar('symbol', { length: 50 }), // Stock ticker, scheme code
    name: text('name').notNull(), // Full name of instrument
    isin: varchar('isin', { length: 20 }), // ISIN code if available

    // Holdings
    units: decimal('units', { precision: 18, scale: 6 }), // Current units/shares (null for balance-based like PPF, EPF, FD)
    averageCost: decimal('average_cost', { precision: 15, scale: 4 }), // Avg buy price per unit
    currentPrice: decimal('current_price', { precision: 15, scale: 4 }), // Latest NAV/price
    currentValue: decimal('current_value', { precision: 15, scale: 2 }).notNull(), // units × current_price
    investedValue: decimal('invested_value', { precision: 15, scale: 2 }), // units × average_cost
    gainLoss: decimal('gain_loss', { precision: 15, scale: 2 }), // current - invested
    gainLossPercent: decimal('gain_loss_percent', { precision: 8, scale: 4 }),

    // Additional info
    folioNumber: text('folio_number'), // For mutual funds
    maturityDate: date('maturity_date'), // For FD, bonds
    interestRate: decimal('interest_rate', { precision: 6, scale: 3 }), // For FD, PPF

    currency: varchar('currency', { length: 3 }).notNull(),
    asOfDate: date('as_of_date').notNull(), // Date this holding data is from

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('investment_holdings_source_id_idx').on(table.sourceId),
    index('investment_holdings_profile_id_idx').on(table.profileId),
    index('investment_holdings_user_id_idx').on(table.userId),
    index('investment_holdings_investment_type_idx').on(table.investmentType),
  ]
)

/**
 * Investment Transactions table - buy/sell/dividend transactions from statements
 */
export const investmentTransactions = pgTable(
  'investment_transactions',
  {
    id: varchar('id', { length: 21 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    sourceId: varchar('source_id', { length: 21 }).references(() => investmentSources.id, {
      onDelete: 'cascade',
    }),
    holdingId: varchar('holding_id', { length: 21 }).references(() => investmentHoldings.id, {
      onDelete: 'set null',
    }),
    profileId: varchar('profile_id', { length: 21 })
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 21 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Transaction details
    transactionType: varchar('transaction_type', { length: 20 }).notNull(), // buy, sell, dividend, etc.
    symbol: varchar('symbol', { length: 50 }),
    name: text('name').notNull(),
    units: decimal('units', { precision: 18, scale: 6 }), // Units bought/sold
    pricePerUnit: decimal('price_per_unit', { precision: 15, scale: 4 }), // Price at transaction
    amount: decimal('amount', { precision: 15, scale: 2 }).notNull(), // Total transaction value
    fees: decimal('fees', { precision: 15, scale: 2 }), // Brokerage, STT, etc.

    transactionDate: date('transaction_date').notNull(),
    settlementDate: date('settlement_date'),
    description: text('description'), // Original description from statement

    currency: varchar('currency', { length: 3 }).notNull(),
    hash: varchar('hash', { length: 64 }).notNull(), // For deduplication

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('investment_transactions_source_id_idx').on(table.sourceId),
    index('investment_transactions_holding_id_idx').on(table.holdingId),
    index('investment_transactions_profile_id_idx').on(table.profileId),
    index('investment_transactions_user_id_idx').on(table.userId),
    index('investment_transactions_date_idx').on(table.transactionDate),
    unique('investment_transactions_source_hash_unique').on(table.sourceId, table.hash),
  ]
)

/**
 * Investment Snapshots table - historical portfolio value snapshots per source
 */
export const investmentSnapshots = pgTable(
  'investment_snapshots',
  {
    id: varchar('id', { length: 21 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    sourceId: varchar('source_id', { length: 21 }).references(() => investmentSources.id, {
      onDelete: 'cascade',
    }),
    profileId: varchar('profile_id', { length: 21 })
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 21 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Snapshot details
    snapshotDate: date('snapshot_date').notNull(),
    snapshotType: varchar('snapshot_type', { length: 20 }).notNull(), // statement_import, manual, scheduled

    // Portfolio totals
    totalInvested: decimal('total_invested', { precision: 15, scale: 2 }),
    totalCurrent: decimal('total_current', { precision: 15, scale: 2 }).notNull(),
    totalGainLoss: decimal('total_gain_loss', { precision: 15, scale: 2 }),
    gainLossPercent: decimal('gain_loss_percent', { precision: 8, scale: 4 }),
    holdingsCount: integer('holdings_count').notNull(),

    // Snapshot of all holdings at this point
    holdingsDetail: jsonb('holdings_detail'), // [{symbol, name, units, value}, ...]

    currency: varchar('currency', { length: 3 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('investment_snapshots_source_id_idx').on(table.sourceId),
    index('investment_snapshots_profile_id_idx').on(table.profileId),
    index('investment_snapshots_user_id_idx').on(table.userId),
    index('investment_snapshots_date_idx').on(table.snapshotDate),
    unique('investment_snapshots_source_date_unique').on(table.sourceId, table.snapshotDate),
  ]
)

/**
 * Insurance Policies table - tracks insurance policies uploaded by users
 * Supports life, health, and vehicle insurance with type-specific details in JSON
 */
export const insurancePolicies = pgTable(
  'insurance_policies',
  {
    id: varchar('id', { length: 21 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    profileId: varchar('profile_id', { length: 21 })
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 21 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Policy identification
    policyType: varchar('policy_type', { length: 30 }).notNull(), // 'life_insurance' | 'health_insurance' | 'vehicle_insurance'
    provider: text('provider').notNull(), // Insurance company name
    policyNumber: text('policy_number'),
    policyHolderName: text('policy_holder_name'),

    // Coverage and premium
    sumInsured: decimal('sum_insured', { precision: 15, scale: 2 }), // Coverage amount
    premiumAmount: decimal('premium_amount', { precision: 15, scale: 2 }),
    premiumFrequency: varchar('premium_frequency', { length: 20 }), // 'monthly' | 'quarterly' | 'half_yearly' | 'yearly'

    // Policy dates
    startDate: date('start_date'), // YYYY-MM-DD
    endDate: date('end_date'), // YYYY-MM-DD

    // Status
    status: varchar('status', { length: 20 }).notNull().default('active'), // 'active' | 'expired' | 'cancelled'

    // Type-specific details stored as JSON
    details: jsonb('details'), // JSON for type-specific fields

    // File info
    originalFilename: text('original_filename'),
    fileType: varchar('file_type', { length: 10 }), // 'pdf'

    // Parsing status
    parseStatus: varchar('parse_status', { length: 20 }).notNull().default('pending'), // 'pending' | 'parsing' | 'completed' | 'failed'
    errorMessage: text('error_message'),

    // Raw text extracted from PDF (for detailed queries)
    rawText: text('raw_text'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('insurance_policies_profile_id_idx').on(table.profileId),
    index('insurance_policies_user_id_idx').on(table.userId),
    index('insurance_policies_policy_type_idx').on(table.policyType),
    index('insurance_policies_status_idx').on(table.status),
    index('insurance_policies_end_date_idx').on(table.endDate),
  ]
)

/**
 * User Preferences table - key-value store for user/profile settings
 * profileId is nullable - null means the preference applies to all profiles for the user
 */
export const userPreferences = pgTable(
  'user_preferences',
  {
    id: varchar('id', { length: 21 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: varchar('user_id', { length: 21 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    profileId: varchar('profile_id', { length: 21 }).references(() => profiles.id, {
      onDelete: 'cascade',
    }), // null = applies to all profiles
    key: varchar('key', { length: 100 }).notNull(), // e.g., 'dashboard.excluded_categories', 'dashboard.chart_timeframe'
    value: text('value').notNull(), // JSON string for complex values

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('user_preferences_user_id_idx').on(table.userId),
    index('user_preferences_profile_id_idx').on(table.profileId),
    unique('user_preferences_user_profile_key_unique').on(table.userId, table.profileId, table.key),
  ]
)

// Type exports for use throughout the application
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert

export type Profile = typeof profiles.$inferSelect
export type NewProfile = typeof profiles.$inferInsert

export type AppConfig = typeof appConfig.$inferSelect
export type NewAppConfig = typeof appConfig.$inferInsert

export type Account = typeof accounts.$inferSelect
export type NewAccount = typeof accounts.$inferInsert

export type Statement = typeof statements.$inferSelect
export type NewStatement = typeof statements.$inferInsert

export type Transaction = typeof transactions.$inferSelect
export type NewTransaction = typeof transactions.$inferInsert

export type InvestmentSource = typeof investmentSources.$inferSelect
export type NewInvestmentSource = typeof investmentSources.$inferInsert

export type InvestmentHolding = typeof investmentHoldings.$inferSelect
export type NewInvestmentHolding = typeof investmentHoldings.$inferInsert

export type InvestmentTransaction = typeof investmentTransactions.$inferSelect
export type NewInvestmentTransaction = typeof investmentTransactions.$inferInsert

export type InvestmentSnapshot = typeof investmentSnapshots.$inferSelect
export type NewInvestmentSnapshot = typeof investmentSnapshots.$inferInsert

export type InsurancePolicy = typeof insurancePolicies.$inferSelect
export type NewInsurancePolicy = typeof insurancePolicies.$inferInsert

export type UserPreferences = typeof userPreferences.$inferSelect
export type NewUserPreferences = typeof userPreferences.$inferInsert

/**
 * Chat Conversations table - one conversation per profile
 * Used for AI-powered financial assistant chat
 */
export const chatConversations = pgTable(
  'chat_conversations',
  {
    id: varchar('id', { length: 21 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    profileId: varchar('profile_id', { length: 21 }).references(() => profiles.id, {
      onDelete: 'cascade',
    }), // null = family view
    userId: varchar('user_id', { length: 21 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title'), // Auto-generated from first message
    summary: text('summary'), // Compressed context from older messages
    summaryUpToMessageId: varchar('summary_up_to_message_id', { length: 21 }), // Last message included in summary
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('chat_conversations_profile_id_idx').on(table.profileId),
    index('chat_conversations_user_id_idx').on(table.userId),
  ]
)

/**
 * Chat Messages table - individual messages in a conversation
 * Stores user messages, assistant responses, tool calls, and reasoning
 */
export const chatMessages = pgTable(
  'chat_messages',
  {
    id: varchar('id', { length: 21 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    conversationId: varchar('conversation_id', { length: 21 })
      .notNull()
      .references(() => chatConversations.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).notNull(), // 'user' | 'assistant' | 'tool'
    content: text('content'), // Message text content
    provider: varchar('provider', { length: 50 }), // AI provider used (openai, anthropic, etc.)
    model: varchar('model', { length: 100 }), // Model ID used
    toolCalls: text('tool_calls'), // JSON: Array of {toolCallId, toolName, args}
    toolResults: text('tool_results'), // JSON: Array of {toolCallId, toolName, result}
    reasoning: text('reasoning'), // JSON: Array of steps [{type: 'reasoning'|'tool-call'|'text', ...}]
    approvalState: text('approval_state'), // JSON: Pending approval data if waiting for user
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('chat_messages_conversation_id_idx').on(table.conversationId),
    index('chat_messages_created_at_idx').on(table.createdAt),
  ]
)

/**
 * Chat Query Cache table - stores query results for data registry pattern
 * Allows E2B code execution to access full data without bloating AI context
 *
 * Data flow:
 * 1. Tool (e.g., queryTransactions) stores filters + full results here
 * 2. LLM receives only summary + sample + queryId
 * 3. executeCode tool fetches full data by queryId, injects into E2B sandbox
 * 4. Frontend fetches full data by queryId to display in data-table
 *
 * Note: Entries are permanent (no expiration) since they're used in chat history.
 */
export const chatQueryCache = pgTable(
  'chat_query_cache',
  {
    queryId: varchar('query_id', { length: 50 }).primaryKey(),
    profileId: varchar('profile_id', { length: 21 }), // null = family view query
    dataType: varchar('data_type', { length: 50 }).notNull(), // 'transactions' | 'holdings' | 'accounts' | etc.
    filters: text('filters').notNull(), // JSON: Query filters used
    count: integer('count').notNull(), // Number of records
    data: text('data').notNull(), // JSON: Full result array
    schema: text('schema').notNull(), // JSON: Field names and types for LLM reference
    dataSizeBytes: integer('data_size_bytes'), // Size of data field in bytes
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('chat_query_cache_profile_id_idx').on(table.profileId)]
)

export type ChatConversation = typeof chatConversations.$inferSelect
export type NewChatConversation = typeof chatConversations.$inferInsert

export type ChatMessage = typeof chatMessages.$inferSelect
export type NewChatMessage = typeof chatMessages.$inferInsert

export type ChatQueryCache = typeof chatQueryCache.$inferSelect
export type NewChatQueryCache = typeof chatQueryCache.$inferInsert
