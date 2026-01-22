import { eq, and, desc } from 'drizzle-orm'
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
  productName: string | null // account product/variant name (e.g., "Regalia", "Savings Max", "Imperia")
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
    productName: account.productName ?? null,
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
 * Account with balance info
 */
export interface AccountWithBalance extends AccountResponse {
  latestBalance: number | null
  latestStatementDate: string | null
}

/**
 * Get all accounts for a user with their latest balances
 * Balances are derived from the closing balance of the most recent statement
 */
export async function getAccountsWithBalances(
  userId: string,
  profileId?: string
): Promise<AccountWithBalance[]> {
  // Get base accounts
  const accountConditions = [eq(tables.accounts.userId, userId)]
  if (profileId) {
    accountConditions.push(eq(tables.accounts.profileId, profileId))
  }

  const accounts = await db
    .select()
    .from(tables.accounts)
    .where(and(...accountConditions))
    .orderBy(tables.accounts.createdAt)

  // For each account, get the latest statement with a closing balance
  const accountsWithBalances: AccountWithBalance[] = []

  for (const account of accounts) {
    const [latestStatement] = await db
      .select({
        closingBalance: tables.statements.closingBalance,
        periodEnd: tables.statements.periodEnd,
      })
      .from(tables.statements)
      .where(
        and(eq(tables.statements.accountId, account.id), eq(tables.statements.status, 'completed'))
      )
      .orderBy(desc(tables.statements.periodEnd))
      .limit(1)

    accountsWithBalances.push({
      ...toAccountResponse(account),
      latestBalance: latestStatement?.closingBalance
        ? Number(latestStatement.closingBalance)
        : null,
      latestStatementDate: latestStatement?.periodEnd ?? null,
    })
  }

  return accountsWithBalances
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
 * Matches by exact account number OR by first 4 + last 4 digits if the number contains masked characters (X)
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

  // Extract digits only for comparison
  const searchDigits = accountNumber.replace(/[^0-9]/g, '')
  const searchFirst4 = searchDigits.slice(0, 4)
  const searchLast4 = searchDigits.slice(-4)

  logger.debug(
    `[Account] findAccountByNumber: searching for "${accountNumber}" (first4: ${searchFirst4}, last4: ${searchLast4}) in ${accounts.length} accounts`
  )

  for (const account of accounts) {
    if (account.accountNumber) {
      const decrypted = decryptOptional(account.accountNumber)
      if (!decrypted) continue

      // Extract digits from stored account
      const storedDigits = decrypted.replace(/[^0-9]/g, '')
      const storedFirst4 = storedDigits.slice(0, 4)
      const storedLast4 = storedDigits.slice(-4)

      // Exact match
      if (decrypted === accountNumber) {
        logger.debug(`[Account] Exact match found: ${account.id}`)
        return account
      }

      // For masked account numbers (containing X), match by first 4 + last 4 digits
      // This handles variations like "4572XXXXXXXXXX68" vs "4572XXXXXXXXXXXX4468"
      const isMasked = accountNumber.includes('X') || decrypted.includes('X')
      if (isMasked && searchFirst4 === storedFirst4 && searchLast4 === storedLast4) {
        logger.debug(
          `[Account] First4+Last4 match found: ${account.id} (${searchFirst4}...${searchLast4})`
        )
        return account
      }
    }
  }

  logger.debug(`[Account] No match found for "${accountNumber}"`)
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
  productName?: string | null
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
      productName: data.productName || null,
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
    productName?: string | null
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

  if (data.productName !== undefined) {
    updateData.productName = data.productName
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

/**
 * Account balance info for net worth calculation
 */
export interface AccountBalanceInfo {
  accountId: string
  accountName: string | null
  type: string
  institution: string | null
  currency: string
  latestBalance: number | null
  latestStatementDate: string | null
  isLiability: boolean // true for credit cards (balance = money owed)
}

/**
 * Net worth response
 */
export interface NetWorthResponse {
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  currency: string
  accounts: AccountBalanceInfo[]
  calculatedAt: string
}

/**
 * Calculate net worth for a user by summing the latest closing balance from each account
 * Credit card balances are treated as liabilities (negative)
 */
export async function calculateNetWorth(
  userId: string,
  profileId?: string
): Promise<NetWorthResponse> {
  // Get all active accounts for the user
  const accountConditions = [eq(tables.accounts.userId, userId), eq(tables.accounts.isActive, true)]
  if (profileId) {
    accountConditions.push(eq(tables.accounts.profileId, profileId))
  }

  const accounts = await db
    .select()
    .from(tables.accounts)
    .where(and(...accountConditions))

  const accountBalances: AccountBalanceInfo[] = []
  let totalAssets = 0
  let totalLiabilities = 0

  // For each account, get the latest statement with a closing balance
  for (const account of accounts) {
    const [latestStatement] = await db
      .select({
        closingBalance: tables.statements.closingBalance,
        periodEnd: tables.statements.periodEnd,
      })
      .from(tables.statements)
      .where(
        and(eq(tables.statements.accountId, account.id), eq(tables.statements.status, 'completed'))
      )
      .orderBy(desc(tables.statements.periodEnd))
      .limit(1)

    const isLiability = account.type === 'credit_card'
    const balance = latestStatement?.closingBalance ? Number(latestStatement.closingBalance) : null

    accountBalances.push({
      accountId: account.id,
      accountName: account.accountName,
      type: account.type,
      institution: account.institution,
      currency: account.currency,
      latestBalance: balance,
      latestStatementDate: latestStatement?.periodEnd ?? null,
      isLiability,
    })

    if (balance !== null) {
      if (isLiability) {
        // Credit card balance is money owed (liability)
        totalLiabilities += balance
      } else {
        // Bank account balance is an asset
        totalAssets += balance
      }
    }
  }

  // Determine primary currency (use most common, default to INR)
  const currencyCounts = accountBalances.reduce(
    (acc, ab) => {
      acc[ab.currency] = (acc[ab.currency] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )
  const primaryCurrency =
    Object.entries(currencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'INR'

  return {
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
    currency: primaryCurrency,
    accounts: accountBalances,
    calculatedAt: new Date().toISOString(),
  }
}
