/**
 * Chat Query Cache Service
 *
 * Stores query results for data registry pattern.
 * Allows displaying full data in chat history and E2B code execution.
 *
 * Flow:
 * 1. Tool (e.g., queryTransactions) stores filters + full results here
 * 2. LLM receives only summary + sample + queryId + schema
 * 3. Frontend fetches full data by queryId to display in data-table
 * 4. executeCode tool fetches full data by queryId, injects into E2B sandbox
 *
 * Note: Cache entries are permanent (no expiration) since they're used in chat history.
 */

import { eq } from 'drizzle-orm'
import { db, tables, dbType } from '../../db'

/** Maximum data size in bytes (1MB) - larger results are truncated */
const MAX_DATA_SIZE_BYTES = 1 * 1024 * 1024

/** Supported data types for caching */
export type CacheDataType =
  | 'transactions'
  | 'holdings'
  | 'accounts'
  | 'subscriptions'
  | 'monthly_trends'
  | 'stats'

/** Schema definition for LLM reference */
export interface DataSchema {
  fields: Array<{
    name: string
    type: 'string' | 'number' | 'boolean' | 'date' | 'object'
    description?: string
  }>
}

/** Cached query with full data */
export interface CachedQuery<T = unknown> {
  queryId: string
  profileId: string
  dataType: CacheDataType
  filters: Record<string, unknown>
  count: number
  data: T[]
  schema: DataSchema
  dataSizeBytes: number
  createdAt: Date
}

/** Options for storing query cache */
export interface StoreQueryCacheOptions<T> {
  queryId: string
  profileId: string
  dataType: CacheDataType
  filters: Record<string, unknown>
  data: T[]
  schema: DataSchema
}

/**
 * Store query results in cache
 */
export async function storeQueryCache<T>(options: StoreQueryCacheOptions<T>): Promise<{
  queryId: string
  count: number
  truncated: boolean
}> {
  const { queryId, profileId, dataType, filters, data, schema } = options

  // Serialize data
  let dataJson = JSON.stringify(data)
  let truncated = false

  // Truncate if too large
  if (dataJson.length > MAX_DATA_SIZE_BYTES) {
    // Estimate how many records we can fit
    const avgRecordSize = dataJson.length / data.length
    const maxRecords = Math.floor(MAX_DATA_SIZE_BYTES / avgRecordSize) - 10 // Safety margin
    const truncatedData = data.slice(0, Math.max(maxRecords, 1))
    dataJson = JSON.stringify(truncatedData)
    truncated = true
  }

  const now = new Date()
  const createdAtValue = dbType === 'postgres' ? now : now.toISOString()

  await db.insert(tables.chatQueryCache).values({
    queryId,
    profileId,
    dataType,
    filters: JSON.stringify(filters),
    count: data.length,
    data: dataJson,
    schema: JSON.stringify(schema),
    dataSizeBytes: dataJson.length,
    createdAt: createdAtValue as Date,
  })

  return {
    queryId,
    count: data.length,
    truncated,
  }
}

/**
 * Get query data from cache
 */
export async function getQueryCache<T = unknown>(queryId: string): Promise<CachedQuery<T> | null> {
  const [result] = await db
    .select()
    .from(tables.chatQueryCache)
    .where(eq(tables.chatQueryCache.queryId, queryId))
    .limit(1)

  if (!result) return null

  return {
    queryId: result.queryId,
    profileId: result.profileId,
    dataType: result.dataType as CacheDataType,
    filters: JSON.parse(result.filters) as Record<string, unknown>,
    count: result.count,
    data: JSON.parse(result.data) as T[],
    schema: JSON.parse(result.schema) as DataSchema,
    dataSizeBytes: result.dataSizeBytes ?? 0,
    createdAt: new Date(result.createdAt),
  }
}

/**
 * Get only the data from cache (for E2B injection)
 * More efficient than getQueryCache when you only need the data
 */
export async function getQueryData<T = unknown>(queryId: string): Promise<T[] | null> {
  const [result] = await db
    .select({
      data: tables.chatQueryCache.data,
    })
    .from(tables.chatQueryCache)
    .where(eq(tables.chatQueryCache.queryId, queryId))
    .limit(1)

  if (!result) return null

  return JSON.parse(result.data) as T[]
}

/**
 * Get query metadata (without full data) for validation
 */
export async function getQueryMetadata(queryId: string): Promise<{
  profileId: string
  dataType: CacheDataType
  count: number
  schema: DataSchema
} | null> {
  const [result] = await db
    .select({
      profileId: tables.chatQueryCache.profileId,
      dataType: tables.chatQueryCache.dataType,
      count: tables.chatQueryCache.count,
      schema: tables.chatQueryCache.schema,
    })
    .from(tables.chatQueryCache)
    .where(eq(tables.chatQueryCache.queryId, queryId))
    .limit(1)

  if (!result) return null

  return {
    profileId: result.profileId,
    dataType: result.dataType as CacheDataType,
    count: result.count,
    schema: JSON.parse(result.schema) as DataSchema,
  }
}

/**
 * Delete a query from cache
 */
export async function deleteQueryCache(queryId: string): Promise<void> {
  await db.delete(tables.chatQueryCache).where(eq(tables.chatQueryCache.queryId, queryId))
}

/**
 * Generate a unique query ID with prefix
 */
export function generateQueryId(prefix: CacheDataType | string = 'q'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Build schema definition for transactions
 */
export function buildTransactionSchema(): DataSchema {
  return {
    fields: [
      { name: 'id', type: 'string', description: 'Unique transaction ID' },
      { name: 'date', type: 'date', description: 'Transaction date (YYYY-MM-DD)' },
      { name: 'type', type: 'string', description: 'credit or debit' },
      { name: 'amount', type: 'number', description: 'Transaction amount' },
      { name: 'currency', type: 'string', description: 'Currency code (INR, USD, etc.)' },
      { name: 'category', type: 'string', description: 'Transaction category' },
      { name: 'summary', type: 'string', description: 'Transaction description' },
      {
        name: 'originalDescription',
        type: 'string',
        description: 'Raw description from statement',
      },
      { name: 'accountId', type: 'string', description: 'Account ID' },
      { name: 'balance', type: 'number', description: 'Running balance after transaction' },
    ],
  }
}

/**
 * Build schema definition for holdings
 */
export function buildHoldingsSchema(): DataSchema {
  return {
    fields: [
      { name: 'id', type: 'string', description: 'Unique holding ID' },
      { name: 'name', type: 'string', description: 'Investment name' },
      { name: 'symbol', type: 'string', description: 'Stock ticker or scheme code' },
      {
        name: 'investmentType',
        type: 'string',
        description: 'Type (stock, mutual_fund, etf, etc.)',
      },
      { name: 'units', type: 'number', description: 'Number of units/shares' },
      { name: 'averageCost', type: 'number', description: 'Average buy price per unit' },
      { name: 'currentPrice', type: 'number', description: 'Current price per unit' },
      { name: 'currentValue', type: 'number', description: 'Total current value' },
      { name: 'investedValue', type: 'number', description: 'Total invested amount' },
      { name: 'gainLoss', type: 'number', description: 'Unrealized gain/loss' },
      { name: 'gainLossPercent', type: 'number', description: 'Gain/loss percentage' },
      { name: 'currency', type: 'string', description: 'Currency code' },
    ],
  }
}

/**
 * Build schema definition for accounts
 */
export function buildAccountsSchema(): DataSchema {
  return {
    fields: [
      { name: 'id', type: 'string', description: 'Unique account ID' },
      { name: 'accountName', type: 'string', description: 'Account name' },
      { name: 'type', type: 'string', description: 'Account type (savings, credit_card, etc.)' },
      { name: 'institution', type: 'string', description: 'Bank/institution name' },
      { name: 'latestBalance', type: 'number', description: 'Current balance' },
      { name: 'currency', type: 'string', description: 'Currency code' },
      { name: 'isActive', type: 'boolean', description: 'Whether account is active' },
    ],
  }
}
