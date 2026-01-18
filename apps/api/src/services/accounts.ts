import { eq, and } from 'drizzle-orm'
import { db, tables, dbType } from '../db'
import type { Account } from '../db'
import { encryptOptional, decryptOptional } from '../lib/encryption'
import { getAccountTypesForCountry, type CountryCode } from '../lib/constants'
import { logger } from '../lib/logger'

/**
 * Account service
 * Handles CRUD operations for financial accounts
 */

/**
 * Account response type (with decrypted fields)
 */
export interface AccountResponse {
  id: string
  profileId: string
  userId: string
  type: string
  institution: string | null
  accountNumber: string | null // decrypted
  accountName: string | null
  currency: string
  isActive: boolean
  hasStatementPassword: boolean // don't expose actual password
  createdAt: string | Date
  updatedAt: string | Date
}

/**
 * Transform account to response format (decrypt sensitive fields)
 */
function toAccountResponse(account: Account): AccountResponse {
  return {
    id: account.id,
    profileId: account.profileId,
    userId: account.userId,
    type: account.type,
    institution: account.institution,
    accountNumber: decryptOptional(account.accountNumber),
    accountName: account.accountName,
    currency: account.currency,
    isActive: account.isActive,
    hasStatementPassword: !!account.statementPassword,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  }
}

/**
 * Get all accounts for a user
 */
export async function getAccountsByUserId(
  userId: string,
  profileId?: string
): Promise<AccountResponse[]> {
  let query = db.select().from(tables.accounts).where(eq(tables.accounts.userId, userId))

  if (profileId) {
    query = db
      .select()
      .from(tables.accounts)
      .where(and(eq(tables.accounts.userId, userId), eq(tables.accounts.profileId, profileId)))
  }

  const accounts = await query.orderBy(tables.accounts.createdAt)
  return accounts.map(toAccountResponse)
}

/**
 * Get an account by ID (with user ownership check)
 */
export async function getAccountById(
  accountId: string,
  userId: string
): Promise<AccountResponse | null> {
  const [account] = await db
    .select()
    .from(tables.accounts)
    .where(and(eq(tables.accounts.id, accountId), eq(tables.accounts.userId, userId)))
    .limit(1)

  return account ? toAccountResponse(account) : null
}

/**
 * Get raw account by ID (for internal use, includes encrypted fields)
 */
export async function getAccountByIdRaw(
  accountId: string,
  userId: string
): Promise<Account | null> {
  const [account] = await db
    .select()
    .from(tables.accounts)
    .where(and(eq(tables.accounts.id, accountId), eq(tables.accounts.userId, userId)))
    .limit(1)

  return account || null
}

/**
 * Find account by encrypted account number (for deduplication)
 */
export async function findAccountByNumber(
  profileId: string,
  accountNumber: string
): Promise<Account | null> {
  // Get all accounts for profile and check decrypted numbers
  const accounts = await db
    .select()
    .from(tables.accounts)
    .where(eq(tables.accounts.profileId, profileId))

  for (const account of accounts) {
    if (account.accountNumber) {
      const decrypted = decryptOptional(account.accountNumber)
      if (decrypted === accountNumber) {
        return account
      }
    }
  }

  return null
}

/**
 * Create a new account
 */
export async function createAccount(data: {
  profileId: string
  userId: string
  type: string
  institution?: string | null
  accountNumber?: string | null
  accountName?: string | null
  currency: string
  statementPassword?: string | null
}): Promise<AccountResponse> {
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  // Encrypt sensitive fields
  const encryptedAccountNumber = encryptOptional(data.accountNumber)
  const encryptedPassword = encryptOptional(data.statementPassword)

  // Generate account name if not provided
  let accountName = data.accountName
  if (!accountName) {
    const typePart = data.type.replace(/_/g, ' ')
    const institutionPart = data.institution ? ` - ${data.institution}` : ''
    const numberPart = data.accountNumber ? ` (****${data.accountNumber.slice(-4)})` : ''
    accountName = `${typePart}${institutionPart}${numberPart}`.trim()
    // Capitalize first letter of each word
    accountName = accountName.replace(/\b\w/g, (c) => c.toUpperCase())
  }

  const [account] = await db
    .insert(tables.accounts)
    .values({
      profileId: data.profileId,
      userId: data.userId,
      type: data.type,
      institution: data.institution || null,
      accountNumber: encryptedAccountNumber,
      accountName,
      currency: data.currency,
      statementPassword: encryptedPassword,
      isActive: true,
      createdAt: now as Date,
      updatedAt: now as Date,
    })
    .returning()

  if (!account) {
    throw new Error('Failed to create account')
  }

  logger.debug(`[Account] Created account ${account.id} for profile ${data.profileId}`)
  return toAccountResponse(account)
}

/**
 * Update an account
 */
export async function updateAccount(
  accountId: string,
  userId: string,
  data: {
    accountName?: string
    institution?: string | null
    statementPassword?: string | null
    isActive?: boolean
  }
): Promise<AccountResponse> {
  // Verify ownership
  const existingAccount = await getAccountByIdRaw(accountId, userId)
  if (!existingAccount) {
    throw new Error('Account not found')
  }

  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  // Build update object
  const updateData: Partial<Account> = {
    updatedAt: now as Date,
  }

  if (data.accountName !== undefined) {
    updateData.accountName = data.accountName
  }

  if (data.institution !== undefined) {
    updateData.institution = data.institution
  }

  if (data.statementPassword !== undefined) {
    updateData.statementPassword = encryptOptional(data.statementPassword)
  }

  if (data.isActive !== undefined) {
    updateData.isActive = data.isActive
  }

  const [updatedAccount] = await db
    .update(tables.accounts)
    .set(updateData)
    .where(eq(tables.accounts.id, accountId))
    .returning()

  if (!updatedAccount) {
    throw new Error('Failed to update account')
  }

  logger.debug(`[Account] Updated account ${accountId}`)
  return toAccountResponse(updatedAccount)
}

/**
 * Delete an account (cascades to statements and transactions)
 */
export async function deleteAccount(accountId: string, userId: string): Promise<void> {
  // Verify ownership
  const existingAccount = await getAccountByIdRaw(accountId, userId)
  if (!existingAccount) {
    throw new Error('Account not found')
  }

  await db.delete(tables.accounts).where(eq(tables.accounts.id, accountId))

  logger.debug(`[Account] Deleted account ${accountId}`)
}

/**
 * Get the decrypted statement password for an account
 */
export async function getStatementPassword(
  accountId: string,
  userId: string
): Promise<string | null> {
  const account = await getAccountByIdRaw(accountId, userId)
  if (!account) {
    throw new Error('Account not found')
  }

  return decryptOptional(account.statementPassword)
}

/**
 * Update statement password for an account
 */
export async function updateStatementPassword(
  accountId: string,
  userId: string,
  password: string | null
): Promise<void> {
  const existingAccount = await getAccountByIdRaw(accountId, userId)
  if (!existingAccount) {
    throw new Error('Account not found')
  }

  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  await db
    .update(tables.accounts)
    .set({
      statementPassword: encryptOptional(password),
      updatedAt: now as Date,
    })
    .where(eq(tables.accounts.id, accountId))

  logger.debug(`[Account] Updated statement password for account ${accountId}`)
}

/**
 * Get account types for a country
 */
export function getAccountTypes(countryCode: CountryCode) {
  return getAccountTypesForCountry(countryCode)
}
