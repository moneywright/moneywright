import { eq, and, desc } from 'drizzle-orm'
import { db, tables, dbType } from '../db'
import type { InvestmentSource, NewInvestmentSource } from '../db'
import { encryptOptional, decryptOptional } from '../lib/encryption'
import { logger } from '../lib/logger'

/**
 * Investment Sources service
 * Handles CRUD operations for investment sources (platforms like Zerodha, Groww, etc.)
 */

/**
 * Investment source response type (with decrypted fields)
 */
export interface InvestmentSourceResponse {
  id: string
  profileId: string
  userId: string
  sourceType: string
  sourceName: string
  institution: string | null
  accountIdentifier: string | null // decrypted
  countryCode: string
  currency: string
  lastStatementDate: string | null
  lastSyncAt: string | Date | null
  createdAt: string | Date
  updatedAt: string | Date
}

/**
 * Transform source to response format (decrypt sensitive fields)
 */
function toSourceResponse(source: InvestmentSource): InvestmentSourceResponse {
  return {
    id: source.id,
    profileId: source.profileId,
    userId: source.userId,
    sourceType: source.sourceType,
    sourceName: source.sourceName,
    institution: source.institution,
    accountIdentifier: decryptOptional(source.accountIdentifier),
    countryCode: source.countryCode,
    currency: source.currency,
    lastStatementDate: source.lastStatementDate,
    lastSyncAt: source.lastSyncAt,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  }
}

/**
 * Get all investment sources for a user
 */
export async function getSourcesByUserId(
  userId: string,
  profileId?: string
): Promise<InvestmentSourceResponse[]> {
  let sources: InvestmentSource[]

  if (profileId) {
    sources = await db
      .select()
      .from(tables.investmentSources)
      .where(
        and(
          eq(tables.investmentSources.userId, userId),
          eq(tables.investmentSources.profileId, profileId)
        )
      )
      .orderBy(desc(tables.investmentSources.updatedAt))
  } else {
    sources = await db
      .select()
      .from(tables.investmentSources)
      .where(eq(tables.investmentSources.userId, userId))
      .orderBy(desc(tables.investmentSources.updatedAt))
  }

  return sources.map(toSourceResponse)
}

/**
 * Get a source by ID (with user ownership check)
 */
export async function getSourceById(
  sourceId: string,
  userId: string
): Promise<InvestmentSourceResponse | null> {
  const [source] = await db
    .select()
    .from(tables.investmentSources)
    .where(
      and(eq(tables.investmentSources.id, sourceId), eq(tables.investmentSources.userId, userId))
    )
    .limit(1)

  return source ? toSourceResponse(source) : null
}

/**
 * Find a source by type and account identifier
 */
export async function findSourceByTypeAndIdentifier(
  userId: string,
  profileId: string,
  sourceType: string,
  accountIdentifier: string | null
): Promise<InvestmentSourceResponse | null> {
  // Get all sources for user/profile with this type
  const sources = await db
    .select()
    .from(tables.investmentSources)
    .where(
      and(
        eq(tables.investmentSources.userId, userId),
        eq(tables.investmentSources.profileId, profileId),
        eq(tables.investmentSources.sourceType, sourceType)
      )
    )

  // If no account identifier provided, return first match
  if (!accountIdentifier) {
    return sources.length > 0 ? toSourceResponse(sources[0]!) : null
  }

  // Find matching by decrypted account identifier
  for (const source of sources) {
    const decryptedId = decryptOptional(source.accountIdentifier)
    if (decryptedId === accountIdentifier) {
      return toSourceResponse(source)
    }
  }

  return null
}

/**
 * Create a new investment source
 */
export async function createSource(data: {
  profileId: string
  userId: string
  sourceType: string
  sourceName: string
  institution?: string | null
  accountIdentifier?: string | null
  countryCode?: string
  currency?: string
}): Promise<InvestmentSourceResponse> {
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  const [source] = await db
    .insert(tables.investmentSources)
    .values({
      profileId: data.profileId,
      userId: data.userId,
      sourceType: data.sourceType,
      sourceName: data.sourceName,
      institution: data.institution || null,
      accountIdentifier: encryptOptional(data.accountIdentifier),
      countryCode: data.countryCode || 'IN',
      currency: data.currency || 'INR',
      createdAt: now as Date,
      updatedAt: now as Date,
    } as NewInvestmentSource)
    .returning()

  if (!source) {
    throw new Error('Failed to create investment source')
  }

  logger.debug(`[InvestmentSource] Created source ${source.id} for profile ${data.profileId}`)
  return toSourceResponse(source)
}

/**
 * Update an investment source
 */
export async function updateSource(
  sourceId: string,
  userId: string,
  data: {
    sourceName?: string
    institution?: string | null
    accountIdentifier?: string | null
    countryCode?: string
    currency?: string
    lastStatementDate?: string | null
    lastSyncAt?: Date | string | null
  }
): Promise<InvestmentSourceResponse> {
  // Verify ownership
  const existing = await getSourceById(sourceId, userId)
  if (!existing) {
    throw new Error('Investment source not found')
  }

  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  const updateData: Partial<InvestmentSource> = {
    updatedAt: now as Date,
  }

  if (data.sourceName !== undefined) {
    updateData.sourceName = data.sourceName
  }
  if (data.institution !== undefined) {
    updateData.institution = data.institution
  }
  if (data.accountIdentifier !== undefined) {
    updateData.accountIdentifier = encryptOptional(data.accountIdentifier)
  }
  if (data.countryCode !== undefined) {
    updateData.countryCode = data.countryCode
  }
  if (data.currency !== undefined) {
    updateData.currency = data.currency
  }
  if (data.lastStatementDate !== undefined) {
    updateData.lastStatementDate = data.lastStatementDate
  }
  if (data.lastSyncAt !== undefined) {
    // Convert Date to ISO string for SQLite
    if (data.lastSyncAt instanceof Date) {
      updateData.lastSyncAt = (
        dbType === 'postgres' ? data.lastSyncAt : data.lastSyncAt.toISOString()
      ) as Date
    } else if (typeof data.lastSyncAt === 'string') {
      updateData.lastSyncAt = (
        dbType === 'postgres' ? new Date(data.lastSyncAt) : data.lastSyncAt
      ) as Date
    }
  }

  const [updated] = await db
    .update(tables.investmentSources)
    .set(updateData)
    .where(eq(tables.investmentSources.id, sourceId))
    .returning()

  if (!updated) {
    throw new Error('Failed to update investment source')
  }

  logger.debug(`[InvestmentSource] Updated source ${sourceId}`)
  return toSourceResponse(updated)
}

/**
 * Delete an investment source
 */
export async function deleteSource(sourceId: string, userId: string): Promise<void> {
  // Verify ownership
  const existing = await getSourceById(sourceId, userId)
  if (!existing) {
    throw new Error('Investment source not found')
  }

  await db.delete(tables.investmentSources).where(eq(tables.investmentSources.id, sourceId))

  logger.debug(`[InvestmentSource] Deleted source ${sourceId}`)
}
