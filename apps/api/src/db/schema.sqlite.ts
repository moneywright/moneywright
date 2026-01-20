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
 */
export const statements = sqliteTable(
  'statements',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

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
    index('statements_profile_id_idx').on(table.profileId),
    index('statements_user_id_idx').on(table.userId),
    index('statements_status_idx').on(table.status),
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
 * Investments table - manually declared investment holdings
 */
export const investments = sqliteTable(
  'investments',
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

    // Investment details
    type: text('type').notNull(), // country-specific
    institution: text('institution'), // broker/AMC name
    name: text('name').notNull(), // scheme/stock name

    // Holdings
    units: real('units'),
    purchaseValue: real('purchase_value'),
    currentValue: real('current_value'),
    currency: text('currency').notNull(),

    // Additional info
    folioNumber: text('folio_number'),
    accountNumber: text('account_number'), // encrypted
    maturityDate: text('maturity_date'), // ISO date string
    interestRate: real('interest_rate'),

    notes: text('notes'),

    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('investments_profile_id_idx').on(table.profileId),
    index('investments_user_id_idx').on(table.userId),
    index('investments_type_idx').on(table.type),
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

export type Investment = typeof investments.$inferSelect
export type NewInvestment = typeof investments.$inferInsert
