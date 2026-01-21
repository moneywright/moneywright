import { sqliteTable, text, index, integer, unique, real } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { nanoid } from '../lib/id'

/**
 * Users table - authenticated users or default local user
 * In local mode (AUTH_ENABLED=false), a default user with id="default" is created
 */
export const users = sqliteTable(
  'users',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    email: text('email').unique(), // Nullable for default local user
    name: text('name'),
    picture: text('picture'), // Google profile picture URL
    googleId: text('google_id').unique(), // Nullable for default local user
    country: text('country'), // ISO 3166-1 alpha-2 (e.g., "IN", "US")
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
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
export const profiles = sqliteTable(
  'profiles',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(), // e.g., "Personal", "Spouse"
    relationship: text('relationship'), // e.g., "self", "spouse", "parent"
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false), // Primary profile for quick access
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
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
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull(), // SHA-256 hash of refresh token
    fingerprintHash: text('fingerprint_hash').notNull(), // SHA-256 hash of fingerprint cookie
    expiresAt: text('expires_at').notNull(), // ISO timestamp - refresh token expiry (7 days, rolling)
    absoluteExpiresAt: text('absolute_expires_at').notNull(), // ISO timestamp - hard limit (30 days)
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    lastUsedAt: text('last_used_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    revokedAt: text('revoked_at'), // ISO timestamp - soft revoke (null = active)
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
export const appConfig = sqliteTable('app_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(), // Encrypted for sensitive keys
  isEncrypted: text('is_encrypted').notNull().default('0'), // '1' = encrypted, '0' = plaintext
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

/**
 * Accounts table - financial accounts (bank, credit card, investment, etc.)
 * Auto-created when statements are uploaded
 */
export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Account identification
    type: text('type').notNull(), // account type (country-specific)
    institution: text('institution'), // bank/institution name (free text)
    accountNumber: text('account_number'), // encrypted, full account number
    accountName: text('account_name'), // user-friendly name
    productName: text('product_name'), // account product/variant name (e.g., "Regalia", "Savings Max", "Imperia")

    // Statement password (for password-protected PDFs)
    statementPassword: text('statement_password'), // encrypted

    // Metadata
    currency: text('currency').notNull(), // ISO currency code
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),

    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
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
export const statements = sqliteTable(
  'statements',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    // For bank/credit card statements
    accountId: text('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
    // For investment statements
    sourceId: text('source_id').references(() => investmentSources.id, { onDelete: 'cascade' }),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Document type - determines which linking field is used
    documentType: text('document_type').notNull().default('bank_statement'), // bank_statement, credit_card_statement, investment_statement

    // File info
    originalFilename: text('original_filename').notNull(),
    fileType: text('file_type').notNull(), // pdf, csv, xlsx
    fileSizeBytes: integer('file_size_bytes'),

    // Statement period
    periodStart: text('period_start'), // ISO date string
    periodEnd: text('period_end'), // ISO date string

    // Balance info (for bank statements)
    openingBalance: real('opening_balance'), // Balance at start of statement period
    closingBalance: real('closing_balance'), // Balance at end of statement period

    // Parsing status
    status: text('status').notNull().default('pending'), // pending, parsing, completed, failed
    errorMessage: text('error_message'),

    // Statement summary (JSON string)
    summary: text('summary'), // JSON string

    // Stats
    transactionCount: integer('transaction_count').default(0),
    holdingsCount: integer('holdings_count'), // For investment statements

    // Parse timing
    parseStartedAt: text('parse_started_at'), // ISO timestamp string
    parseCompletedAt: text('parse_completed_at'), // ISO timestamp string

    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
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
export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    statementId: text('statement_id')
      .notNull()
      .references(() => statements.id, { onDelete: 'cascade' }),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Transaction data
    date: text('date').notNull(), // ISO date string
    type: text('type').notNull(), // credit or debit
    amount: real('amount').notNull(),
    currency: text('currency').notNull(),
    balance: real('balance'), // Running balance after this transaction (if available)

    // Description
    originalDescription: text('original_description').notNull(),
    summary: text('summary'), // LLM-generated summary

    // Categorization
    category: text('category').notNull(),
    categoryConfidence: real('category_confidence'),
    isSubscription: integer('is_subscription', { mode: 'boolean' }), // LLM-detected recurring subscription

    // Deduplication
    hash: text('hash').notNull(), // SHA256

    // Cross-account linking
    linkedTransactionId: text('linked_transaction_id'),
    linkType: text('link_type'), // payment, transfer, refund

    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
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
export const investmentSources = sqliteTable(
  'investment_sources',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Source identification
    sourceType: text('source_type').notNull(), // zerodha, groww, mf_central, etc.
    sourceName: text('source_name').notNull(), // Display name like "Zerodha - Equity"
    institution: text('institution'), // Bank/broker name
    accountIdentifier: text('account_identifier'), // Demat ID, folio, Client ID (encrypted)

    // Location
    countryCode: text('country_code').notNull().default('IN'), // IN, US
    currency: text('currency').notNull().default('INR'),

    // Sync info
    lastStatementDate: text('last_statement_date'), // ISO date string
    lastSyncAt: text('last_sync_at'), // ISO timestamp string

    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
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
export const investmentHoldings = sqliteTable(
  'investment_holdings',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    sourceId: text('source_id').references(() => investmentSources.id, { onDelete: 'cascade' }),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Investment details
    investmentType: text('investment_type').notNull(), // stock, mutual_fund, etf, etc.
    symbol: text('symbol'), // Stock ticker, scheme code
    name: text('name').notNull(), // Full name of instrument
    isin: text('isin'), // ISIN code if available

    // Holdings
    units: real('units'), // Current units/shares (null for balance-based like PPF, EPF, FD)
    averageCost: real('average_cost'), // Avg buy price per unit
    currentPrice: real('current_price'), // Latest NAV/price
    currentValue: real('current_value').notNull(), // units × current_price
    investedValue: real('invested_value'), // units × average_cost
    gainLoss: real('gain_loss'), // current - invested
    gainLossPercent: real('gain_loss_percent'),

    // Additional info
    folioNumber: text('folio_number'), // For mutual funds
    maturityDate: text('maturity_date'), // ISO date string - For FD, bonds
    interestRate: real('interest_rate'), // For FD, PPF

    currency: text('currency').notNull(),
    asOfDate: text('as_of_date').notNull(), // ISO date string

    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
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
export const investmentTransactions = sqliteTable(
  'investment_transactions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    sourceId: text('source_id').references(() => investmentSources.id, { onDelete: 'cascade' }),
    holdingId: text('holding_id').references(() => investmentHoldings.id, { onDelete: 'set null' }),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Transaction details
    transactionType: text('transaction_type').notNull(), // buy, sell, dividend, etc.
    symbol: text('symbol'),
    name: text('name').notNull(),
    units: real('units'), // Units bought/sold
    pricePerUnit: real('price_per_unit'), // Price at transaction
    amount: real('amount').notNull(), // Total transaction value
    fees: real('fees'), // Brokerage, STT, etc.

    transactionDate: text('transaction_date').notNull(), // ISO date string
    settlementDate: text('settlement_date'), // ISO date string
    description: text('description'), // Original description from statement

    currency: text('currency').notNull(),
    hash: text('hash').notNull(), // For deduplication

    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
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
export const investmentSnapshots = sqliteTable(
  'investment_snapshots',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    sourceId: text('source_id').references(() => investmentSources.id, { onDelete: 'cascade' }),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Snapshot details
    snapshotDate: text('snapshot_date').notNull(), // ISO date string
    snapshotType: text('snapshot_type').notNull(), // statement_import, manual, scheduled

    // Portfolio totals
    totalInvested: real('total_invested'),
    totalCurrent: real('total_current').notNull(),
    totalGainLoss: real('total_gain_loss'),
    gainLossPercent: real('gain_loss_percent'),
    holdingsCount: integer('holdings_count').notNull(),

    // Snapshot of all holdings at this point (JSON string)
    holdingsDetail: text('holdings_detail'), // JSON string

    currency: text('currency').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('investment_snapshots_source_id_idx').on(table.sourceId),
    index('investment_snapshots_profile_id_idx').on(table.profileId),
    index('investment_snapshots_user_id_idx').on(table.userId),
    index('investment_snapshots_date_idx').on(table.snapshotDate),
    unique('investment_snapshots_source_date_unique').on(table.sourceId, table.snapshotDate),
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
