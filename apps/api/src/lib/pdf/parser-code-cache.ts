/**
 * Parser code caching using app_config table
 * Stores and retrieves generated parser code for reuse across statements
 *
 * Key format: parser_code:{bank_key}:v{version}
 * Example: parser_code:hdfc_bank_statement:v1
 */

import { eq, like } from 'drizzle-orm'
import { db, tables, dbType } from '../../db'
import { logger } from '../logger'

/**
 * Generate a normalized bank key from institution ID and account type
 * e.g., "HDFC" + "savings_account" -> "hdfc_savings_account"
 *
 * @param institutionId - Institution ID code (e.g., HDFC, ICICI, SBI)
 * @param accountType - Account type code (e.g., savings_account, credit_card)
 */
export function generateBankKey(institutionId: string, accountType: string): string {
  const normalizedInstitution = institutionId.toLowerCase().replace(/[^a-z0-9]+/g, '_')
  const normalizedType = accountType.toLowerCase().replace(/[^a-z0-9]+/g, '_')

  return `${normalizedInstitution}_${normalizedType}`
}

/**
 * Parser code entry stored in app_config
 */
export interface ParserCodeEntry {
  bankKey: string
  version: number
  code: string
  detectedFormat: string
  dateFormat: string
  confidence: number
  createdAt: Date
  successCount: number
  failCount: number
}

/**
 * Get all parser code versions for a bank, sorted by version descending (latest first)
 */
export async function getParserCodes(bankKey: string): Promise<ParserCodeEntry[]> {
  const prefix = `parser_code:${bankKey}:`

  const rows = await db
    .select()
    .from(tables.appConfig)
    .where(like(tables.appConfig.key, `${prefix}%`))

  const entries: ParserCodeEntry[] = []

  for (const row of rows) {
    try {
      const versionMatch = row.key.match(/:v(\d+)$/)
      if (!versionMatch) continue

      const data = JSON.parse(row.value)
      entries.push({
        bankKey,
        version: parseInt(versionMatch[1]!, 10),
        code: data.code,
        detectedFormat: data.detectedFormat,
        dateFormat: data.dateFormat,
        confidence: data.confidence,
        createdAt: new Date(data.createdAt),
        successCount: data.successCount || 0,
        failCount: data.failCount || 0,
      })
    } catch (err) {
      logger.warn(`[ParserCache] Failed to parse entry ${row.key}:`, err)
    }
  }

  // Sort by version descending (latest first)
  return entries.sort((a, b) => b.version - a.version)
}

/**
 * Get the latest version number for a bank
 */
export async function getLatestVersion(bankKey: string): Promise<number> {
  const codes = await getParserCodes(bankKey)
  if (codes.length === 0) return 0
  return codes[0]!.version
}

/**
 * Save a new parser code version
 */
export async function saveParserCode(
  bankKey: string,
  code: string,
  metadata: {
    detectedFormat: string
    dateFormat: string
    confidence: number
  }
): Promise<number> {
  const currentVersion = await getLatestVersion(bankKey)
  const newVersion = currentVersion + 1

  const key = `parser_code:${bankKey}:v${newVersion}`
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  const value = JSON.stringify({
    code,
    detectedFormat: metadata.detectedFormat,
    dateFormat: metadata.dateFormat,
    confidence: metadata.confidence,
    createdAt: new Date().toISOString(),
    successCount: 0,
    failCount: 0,
  })

  await db
    .insert(tables.appConfig)
    .values({
      key,
      value,
      isEncrypted: '0',
      createdAt: now as Date,
      updatedAt: now as Date,
    })
    .onConflictDoUpdate({
      target: tables.appConfig.key,
      set: {
        value,
        updatedAt: now as Date,
      },
    })

  logger.info(`[ParserCache] Saved parser code for ${bankKey} v${newVersion}`)
  return newVersion
}

/**
 * Increment success count for a parser code version
 */
export async function recordSuccess(bankKey: string, version: number): Promise<void> {
  const key = `parser_code:${bankKey}:v${version}`
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  const [row] = await db
    .select()
    .from(tables.appConfig)
    .where(eq(tables.appConfig.key, key))
    .limit(1)

  if (!row) return

  try {
    const data = JSON.parse(row.value)
    data.successCount = (data.successCount || 0) + 1

    await db
      .update(tables.appConfig)
      .set({
        value: JSON.stringify(data),
        updatedAt: now as Date,
      })
      .where(eq(tables.appConfig.key, key))
  } catch (err) {
    logger.warn(`[ParserCache] Failed to record success for ${key}:`, err)
  }
}

/**
 * Increment fail count for a parser code version
 */
export async function recordFailure(bankKey: string, version: number): Promise<void> {
  const key = `parser_code:${bankKey}:v${version}`
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  const [row] = await db
    .select()
    .from(tables.appConfig)
    .where(eq(tables.appConfig.key, key))
    .limit(1)

  if (!row) return

  try {
    const data = JSON.parse(row.value)
    data.failCount = (data.failCount || 0) + 1

    await db
      .update(tables.appConfig)
      .set({
        value: JSON.stringify(data),
        updatedAt: now as Date,
      })
      .where(eq(tables.appConfig.key, key))
  } catch (err) {
    logger.warn(`[ParserCache] Failed to record failure for ${key}:`, err)
  }
}

/**
 * Delete all cached parser code versions for a bank
 * Use this when the parser is producing incorrect results and needs to be regenerated
 */
export async function clearParserCache(bankKey: string): Promise<number> {
  const prefix = `parser_code:${bankKey}:`

  const rows = await db
    .select({ key: tables.appConfig.key })
    .from(tables.appConfig)
    .where(like(tables.appConfig.key, `${prefix}%`))

  for (const row of rows) {
    await db.delete(tables.appConfig).where(eq(tables.appConfig.key, row.key))
  }

  logger.info(`[ParserCache] Cleared ${rows.length} cached parser versions for ${bankKey}`)
  return rows.length
}

/**
 * List all bank keys that have cached parser code
 */
export async function listCachedBanks(): Promise<
  { bankKey: string; versionCount: number; latestVersion: number }[]
> {
  const rows = await db
    .select()
    .from(tables.appConfig)
    .where(like(tables.appConfig.key, 'parser_code:%'))

  // Group by bank key
  const bankMap = new Map<string, number[]>()

  for (const row of rows) {
    const match = row.key.match(/^parser_code:(.+):v(\d+)$/)
    if (!match) continue

    const bankKey = match[1]!
    const version = parseInt(match[2]!, 10)

    if (!bankMap.has(bankKey)) {
      bankMap.set(bankKey, [])
    }
    bankMap.get(bankKey)!.push(version)
  }

  return Array.from(bankMap.entries()).map(([bankKey, versions]) => ({
    bankKey,
    versionCount: versions.length,
    latestVersion: Math.max(...versions),
  }))
}
