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
    isDefault: boolean('is_default').notNull().default(false), // Primary profile for quick access
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
 */
export const statements = pgTable(
  'statements',
  {
    id: varchar('id', { length: 21 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    accountId: varchar('account_id', { length: 21 })
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    profileId: varchar('profile_id', { length: 21 })
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 21 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // File info
    originalFilename: text('original_filename').notNull(),
    fileType: varchar('file_type', { length: 10 }).notNull(), // pdf, csv, xlsx
    fileSizeBytes: integer('file_size_bytes'),

    // Statement period
    periodStart: date('period_start'),
    periodEnd: date('period_end'),

    // Parsing status
    status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, parsing, completed, failed
    errorMessage: text('error_message'),

    // Statement summary (type-specific JSON)
    summary: jsonb('summary'),

    // Stats
    transactionCount: integer('transaction_count').default(0),

    // Parse timing
    parseStartedAt: timestamp('parse_started_at', { withTimezone: true }),
    parseCompletedAt: timestamp('parse_completed_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
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

    // Description
    originalDescription: text('original_description').notNull(),
    summary: text('summary'), // LLM-generated summary

    // Categorization
    category: varchar('category', { length: 50 }).notNull(),
    categoryConfidence: decimal('category_confidence', { precision: 3, scale: 2 }),

    // Deduplication
    hash: varchar('hash', { length: 64 }).notNull(), // SHA256

    // Cross-account linking
    linkedTransactionId: varchar('linked_transaction_id', { length: 21 }),
    linkType: varchar('link_type', { length: 20 }), // payment, transfer, refund

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
 * Investments table - manually declared investment holdings
 */
export const investments = pgTable(
  'investments',
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

    // Investment details
    type: varchar('type', { length: 50 }).notNull(), // country-specific
    institution: text('institution'), // broker/AMC name
    name: text('name').notNull(), // scheme/stock name

    // Holdings
    units: decimal('units', { precision: 15, scale: 4 }),
    purchaseValue: decimal('purchase_value', { precision: 15, scale: 2 }),
    currentValue: decimal('current_value', { precision: 15, scale: 2 }),
    currency: varchar('currency', { length: 3 }).notNull(),

    // Additional info
    folioNumber: text('folio_number'),
    accountNumber: text('account_number'), // encrypted
    maturityDate: date('maturity_date'),
    interestRate: decimal('interest_rate', { precision: 5, scale: 2 }),

    notes: text('notes'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
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
