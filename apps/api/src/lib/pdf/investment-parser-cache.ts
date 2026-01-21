/**
 * Investment parser code caching using app_config table
 * Stores and retrieves generated parser code for reuse across investment statements
 *
 * Key format: inv_parser_code:{source_key}:{file_type}:v{version}
 * Example: inv_parser_code:zerodha:pdf:v1
 * Example: inv_parser_code:zerodha:csv:v1
 * Example: inv_parser_code:zerodha:xlsx:v1
 */

import { eq, like } from 'drizzle-orm'
import { db, tables, dbType } from '../../db'
import { logger } from '../logger'
import type { FileType } from '../constants'

/**
 * Generate a normalized source key from source type and file type
 * e.g., "zerodha" + "pdf" -> "zerodha:pdf"
 * e.g., "mf_central" + "csv" -> "mf_central:csv"
 *
 * @param sourceType - Source type code (e.g., zerodha, groww, mf_central)
 * @param fileType - File type (pdf, csv, xlsx)
 */
export function generateInvestmentSourceKey(
  sourceType: string,
  fileType: FileType = 'pdf'
): string {
  const normalizedSource = sourceType.toLowerCase().replace(/[^a-z0-9]+/g, '_')
  return `${normalizedSource}:${fileType}`
}

/**
 * Investment parser code entry stored in app_config
 */
export interface InvestmentParserCodeEntry {
  sourceKey: string
  version: number
  code: string
  detectedFormat: string
  confidence: number
  createdAt: Date
  successCount: number
  failCount: number
}

/**
 * Get all investment parser code versions for a source key (includes file type), sorted by version descending (latest first)
 * Note: sourceKey now includes file type, e.g., "zerodha:pdf"
 */
export async function getInvestmentParserCodes(
  sourceKey: string
): Promise<InvestmentParserCodeEntry[]> {
  const prefix = `inv_parser_code:${sourceKey}:`

  const rows = await db
    .select()
    .from(tables.appConfig)
    .where(like(tables.appConfig.key, `${prefix}%`))

  const entries: InvestmentParserCodeEntry[] = []

  for (const row of rows) {
    try {
      const versionMatch = row.key.match(/:v(\d+)$/)
      if (!versionMatch) continue

      const data = JSON.parse(row.value)
      entries.push({
        sourceKey,
        version: parseInt(versionMatch[1]!, 10),
        code: data.code,
        detectedFormat: data.detectedFormat,
        confidence: data.confidence,
        createdAt: new Date(data.createdAt),
        successCount: data.successCount || 0,
        failCount: data.failCount || 0,
      })
    } catch (err) {
      logger.warn(`[InvestmentParserCache] Failed to parse entry ${row.key}:`, err)
    }
  }

  // Sort by version descending (latest first)
  return entries.sort((a, b) => b.version - a.version)
}

/**
 * Get the latest version number for a source
 */
export async function getInvestmentLatestVersion(sourceKey: string): Promise<number> {
  const codes = await getInvestmentParserCodes(sourceKey)
  if (codes.length === 0) return 0
  return codes[0]!.version
}

/**
 * Save a new investment parser code version
 */
export async function saveInvestmentParserCode(
  sourceKey: string,
  code: string,
  metadata: {
    detectedFormat: string
    confidence: number
  }
): Promise<number> {
  const currentVersion = await getInvestmentLatestVersion(sourceKey)
  const newVersion = currentVersion + 1

  const key = `inv_parser_code:${sourceKey}:v${newVersion}`
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  const value = JSON.stringify({
    code,
    detectedFormat: metadata.detectedFormat,
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

  logger.info(`[InvestmentParserCache] Saved parser code for ${sourceKey} v${newVersion}`)
  return newVersion
}

/**
 * Increment success count for an investment parser code version
 */
export async function recordInvestmentSuccess(sourceKey: string, version: number): Promise<void> {
  const key = `inv_parser_code:${sourceKey}:v${version}`
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
    logger.warn(`[InvestmentParserCache] Failed to record success for ${key}:`, err)
  }
}

/**
 * Increment fail count for an investment parser code version
 */
export async function recordInvestmentFailure(sourceKey: string, version: number): Promise<void> {
  const key = `inv_parser_code:${sourceKey}:v${version}`
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
    logger.warn(`[InvestmentParserCache] Failed to record failure for ${key}:`, err)
  }
}

/**
 * Delete all cached investment parser code versions for a source
 */
export async function clearInvestmentParserCache(sourceKey: string): Promise<number> {
  const prefix = `inv_parser_code:${sourceKey}:`

  const rows = await db
    .select({ key: tables.appConfig.key })
    .from(tables.appConfig)
    .where(like(tables.appConfig.key, `${prefix}%`))

  for (const row of rows) {
    await db.delete(tables.appConfig).where(eq(tables.appConfig.key, row.key))
  }

  logger.info(
    `[InvestmentParserCache] Cleared ${rows.length} cached parser versions for ${sourceKey}`
  )
  return rows.length
}

/**
 * List all source keys that have cached investment parser code
 */
export async function listCachedInvestmentSources(): Promise<
  { sourceKey: string; versionCount: number; latestVersion: number }[]
> {
  const rows = await db
    .select()
    .from(tables.appConfig)
    .where(like(tables.appConfig.key, 'inv_parser_code:%'))

  // Group by source key
  const sourceMap = new Map<string, number[]>()

  for (const row of rows) {
    const match = row.key.match(/^inv_parser_code:(.+):v(\d+)$/)
    if (!match) continue

    const sourceKey = match[1]!
    const version = parseInt(match[2]!, 10)

    if (!sourceMap.has(sourceKey)) {
      sourceMap.set(sourceKey, [])
    }
    sourceMap.get(sourceKey)!.push(version)
  }

  return Array.from(sourceMap.entries()).map(([sourceKey, versions]) => ({
    sourceKey,
    versionCount: versions.length,
    latestVersion: Math.max(...versions),
  }))
}

/**
 * Run investment parser with cached versions, trying each until one succeeds
 */
export async function runInvestmentParserWithVersions(
  cachedCodes: InvestmentParserCodeEntry[],
  pdfText: string,
  sourceKey: string,
  expectedSummary?: {
    totalInvested: number | null
    totalCurrent: number | null
    holdingsCount: number | null
  }
): Promise<{
  success: boolean
  holdings?: Array<{
    investment_type: string
    symbol: string | null
    name: string
    isin: string | null
    units: number
    average_cost: number | null
    current_price: number | null
    current_value: number
    invested_value: number | null
    folio_number: string | null
    maturity_date: string | null
    interest_rate: number | null
  }>
  usedVersion?: number
  triedVersions: number[]
  validationPassed?: boolean
}> {
  const { runParser } = await import('./execute-parser')
  const triedVersions: number[] = []

  for (const entry of cachedCodes) {
    triedVersions.push(entry.version)
    logger.info(`[InvestmentParserCache] Trying cached parser v${entry.version} for ${sourceKey}`)

    try {
      // Use 'holding' mode for investment parsing
      const result = await runParser(entry.code, pdfText, 'holding')

      if (result.success && result.holdings && result.holdings.length > 0) {
        const holdings = result.holdings

        // Validate if we have expected summary
        let validationPassed = true
        if (expectedSummary) {
          const extractedTotal = holdings.reduce((sum, h) => sum + (h.current_value || 0), 0)

          if (
            expectedSummary.holdingsCount !== null &&
            holdings.length !== expectedSummary.holdingsCount
          ) {
            validationPassed = false
            logger.warn(
              `[InvestmentParserCache] v${entry.version} failed validation: count ${holdings.length} != ${expectedSummary.holdingsCount}`
            )
            await recordInvestmentFailure(sourceKey, entry.version)
            continue
          }

          if (expectedSummary.totalCurrent !== null) {
            const diff = Math.abs(extractedTotal - expectedSummary.totalCurrent)
            if (diff > 100) {
              validationPassed = false
              logger.warn(
                `[InvestmentParserCache] v${entry.version} failed validation: total ${extractedTotal} != ${expectedSummary.totalCurrent}`
              )
              await recordInvestmentFailure(sourceKey, entry.version)
              continue
            }
          }
        }

        await recordInvestmentSuccess(sourceKey, entry.version)
        logger.info(
          `[InvestmentParserCache] v${entry.version} succeeded: ${holdings.length} holdings`
        )

        return {
          success: true,
          holdings,
          usedVersion: entry.version,
          triedVersions,
          validationPassed,
        }
      } else {
        logger.warn(
          `[InvestmentParserCache] v${entry.version} failed: ${result.error || 'no holdings'}`
        )
        await recordInvestmentFailure(sourceKey, entry.version)
      }
    } catch (err) {
      logger.warn(`[InvestmentParserCache] v${entry.version} threw error:`, err)
      await recordInvestmentFailure(sourceKey, entry.version)
    }
  }

  return {
    success: false,
    triedVersions,
  }
}
