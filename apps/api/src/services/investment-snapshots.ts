import { eq, and, desc, between } from 'drizzle-orm'
import { db, tables, dbType } from '../db'
import type { InvestmentSnapshot, NewInvestmentSnapshot } from '../db'
import { logger } from '../lib/logger'
import type { SnapshotType } from '../lib/constants'

/**
 * Investment Snapshots service
 * Handles historical portfolio snapshots
 */

/**
 * Holding detail in snapshot
 */
export interface SnapshotHoldingDetail {
  symbol: string | null
  name: string
  investmentType: string
  units: number
  currentValue: number
  investedValue: number | null
  currency: string
}

/**
 * Snapshot response type
 */
export interface InvestmentSnapshotResponse {
  id: string
  sourceId: string | null
  profileId: string
  userId: string
  snapshotDate: string
  snapshotType: string
  totalInvested: number | null
  totalCurrent: number
  totalGainLoss: number | null
  gainLossPercent: number | null
  holdingsCount: number
  holdingsDetail: SnapshotHoldingDetail[] | null
  currency: string
  createdAt: string | Date
}

/**
 * Transform snapshot to response format
 */
function toSnapshotResponse(snapshot: InvestmentSnapshot): InvestmentSnapshotResponse {
  const parseNum = (val: string | number | null | undefined): number | null => {
    if (val === null || val === undefined) return null
    return typeof val === 'string' ? parseFloat(val) : Number(val)
  }

  let holdingsDetail: SnapshotHoldingDetail[] | null = null
  if (snapshot.holdingsDetail) {
    try {
      holdingsDetail =
        typeof snapshot.holdingsDetail === 'string'
          ? JSON.parse(snapshot.holdingsDetail)
          : (snapshot.holdingsDetail as SnapshotHoldingDetail[])
    } catch {
      holdingsDetail = null
    }
  }

  return {
    id: snapshot.id,
    sourceId: snapshot.sourceId,
    profileId: snapshot.profileId,
    userId: snapshot.userId,
    snapshotDate: snapshot.snapshotDate,
    snapshotType: snapshot.snapshotType,
    totalInvested: parseNum(snapshot.totalInvested),
    totalCurrent: parseNum(snapshot.totalCurrent) ?? 0,
    totalGainLoss: parseNum(snapshot.totalGainLoss),
    gainLossPercent: parseNum(snapshot.gainLossPercent),
    holdingsCount: snapshot.holdingsCount,
    holdingsDetail,
    currency: snapshot.currency,
    createdAt: snapshot.createdAt,
  }
}

/**
 * Get snapshots for a source
 */
export async function getSnapshotsBySourceId(
  sourceId: string,
  userId: string,
  options?: {
    startDate?: string
    endDate?: string
    limit?: number
  }
): Promise<InvestmentSnapshotResponse[]> {
  let query = db
    .select()
    .from(tables.investmentSnapshots)
    .where(
      and(
        eq(tables.investmentSnapshots.sourceId, sourceId),
        eq(tables.investmentSnapshots.userId, userId)
      )
    )
    .$dynamic()

  if (options?.startDate && options?.endDate) {
    query = query.where(
      and(
        eq(tables.investmentSnapshots.sourceId, sourceId),
        eq(tables.investmentSnapshots.userId, userId),
        between(tables.investmentSnapshots.snapshotDate, options.startDate, options.endDate)
      )
    )
  }

  const snapshots = await query
    .orderBy(desc(tables.investmentSnapshots.snapshotDate))
    .limit(options?.limit || 100)

  return snapshots.map(toSnapshotResponse)
}

/**
 * Get all snapshots for a user (across all sources)
 */
export async function getSnapshotsByUserId(
  userId: string,
  options?: {
    profileId?: string
    startDate?: string
    endDate?: string
    limit?: number
  }
): Promise<InvestmentSnapshotResponse[]> {
  const conditions = [eq(tables.investmentSnapshots.userId, userId)]

  if (options?.profileId) {
    conditions.push(eq(tables.investmentSnapshots.profileId, options.profileId))
  }

  if (options?.startDate && options?.endDate) {
    conditions.push(
      between(tables.investmentSnapshots.snapshotDate, options.startDate, options.endDate)
    )
  }

  const snapshots = await db
    .select()
    .from(tables.investmentSnapshots)
    .where(and(...conditions))
    .orderBy(desc(tables.investmentSnapshots.snapshotDate))
    .limit(options?.limit || 100)

  return snapshots.map(toSnapshotResponse)
}

/**
 * Get a snapshot by ID
 */
export async function getSnapshotById(
  snapshotId: string,
  userId: string
): Promise<InvestmentSnapshotResponse | null> {
  const [snapshot] = await db
    .select()
    .from(tables.investmentSnapshots)
    .where(
      and(
        eq(tables.investmentSnapshots.id, snapshotId),
        eq(tables.investmentSnapshots.userId, userId)
      )
    )
    .limit(1)

  return snapshot ? toSnapshotResponse(snapshot) : null
}

/**
 * Create a snapshot
 */
export async function createSnapshot(data: {
  sourceId?: string | null
  profileId: string
  userId: string
  snapshotDate: string
  snapshotType: SnapshotType
  totalCurrent: number
  holdingsCount: number
  currency: string
  totalInvested?: number | null
  totalGainLoss?: number | null
  gainLossPercent?: number | null
  holdingsDetail?: SnapshotHoldingDetail[] | null
}): Promise<InvestmentSnapshotResponse> {
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  // For SQLite, stringify the holdingsDetail
  const holdingsDetailValue =
    dbType === 'postgres'
      ? data.holdingsDetail
      : data.holdingsDetail
        ? JSON.stringify(data.holdingsDetail)
        : null

  const [snapshot] = await db
    .insert(tables.investmentSnapshots)
    .values({
      sourceId: data.sourceId || null,
      profileId: data.profileId,
      userId: data.userId,
      snapshotDate: data.snapshotDate,
      snapshotType: data.snapshotType,
      totalInvested: data.totalInvested?.toString() || null,
      totalCurrent: data.totalCurrent.toString(),
      totalGainLoss: data.totalGainLoss?.toString() || null,
      gainLossPercent: data.gainLossPercent?.toString() || null,
      holdingsCount: data.holdingsCount,
      holdingsDetail: holdingsDetailValue,
      currency: data.currency,
      createdAt: now as Date,
    } as NewInvestmentSnapshot)
    .returning()

  if (!snapshot) {
    throw new Error('Failed to create snapshot')
  }

  logger.debug(`[InvestmentSnapshot] Created snapshot ${snapshot.id} for date ${data.snapshotDate}`)
  return toSnapshotResponse(snapshot)
}

/**
 * Create or update snapshot for a source on a specific date
 * (upsert - one snapshot per source per day)
 */
export async function upsertSnapshot(data: {
  sourceId: string
  profileId: string
  userId: string
  snapshotDate: string
  snapshotType: SnapshotType
  totalCurrent: number
  holdingsCount: number
  currency: string
  totalInvested?: number | null
  totalGainLoss?: number | null
  gainLossPercent?: number | null
  holdingsDetail?: SnapshotHoldingDetail[] | null
}): Promise<InvestmentSnapshotResponse> {
  // Check if snapshot exists for this source and date
  const [existing] = await db
    .select()
    .from(tables.investmentSnapshots)
    .where(
      and(
        eq(tables.investmentSnapshots.sourceId, data.sourceId),
        eq(tables.investmentSnapshots.snapshotDate, data.snapshotDate)
      )
    )
    .limit(1)

  if (existing) {
    // Update existing
    const holdingsDetailValue =
      dbType === 'postgres'
        ? data.holdingsDetail
        : data.holdingsDetail
          ? JSON.stringify(data.holdingsDetail)
          : null

    const [updated] = await db
      .update(tables.investmentSnapshots)
      .set({
        snapshotType: data.snapshotType,
        totalInvested: data.totalInvested?.toString() || null,
        totalCurrent: data.totalCurrent.toString(),
        totalGainLoss: data.totalGainLoss?.toString() || null,
        gainLossPercent: data.gainLossPercent?.toString() || null,
        holdingsCount: data.holdingsCount,
        holdingsDetail: holdingsDetailValue,
      } as Partial<InvestmentSnapshot>)
      .where(eq(tables.investmentSnapshots.id, existing.id))
      .returning()

    if (!updated) {
      throw new Error('Failed to update snapshot')
    }

    logger.debug(
      `[InvestmentSnapshot] Updated snapshot ${updated.id} for date ${data.snapshotDate}`
    )
    return toSnapshotResponse(updated)
  }

  // Create new
  return createSnapshot(data)
}

/**
 * Delete a snapshot
 */
export async function deleteSnapshot(snapshotId: string, userId: string): Promise<void> {
  const existing = await getSnapshotById(snapshotId, userId)
  if (!existing) {
    throw new Error('Snapshot not found')
  }

  await db.delete(tables.investmentSnapshots).where(eq(tables.investmentSnapshots.id, snapshotId))
  logger.debug(`[InvestmentSnapshot] Deleted snapshot ${snapshotId}`)
}

/**
 * Get the latest snapshot for each source for a user
 */
export async function getLatestSnapshotPerSource(
  userId: string,
  profileId?: string
): Promise<Map<string, InvestmentSnapshotResponse>> {
  // Get all snapshots
  const snapshots = await getSnapshotsByUserId(userId, { profileId })

  // Group by sourceId, keep latest
  const latestBySource = new Map<string, InvestmentSnapshotResponse>()

  for (const snapshot of snapshots) {
    if (!snapshot.sourceId) continue

    const existing = latestBySource.get(snapshot.sourceId)
    if (!existing || snapshot.snapshotDate > existing.snapshotDate) {
      latestBySource.set(snapshot.sourceId, snapshot)
    }
  }

  return latestBySource
}
