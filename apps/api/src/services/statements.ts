import { eq, and, desc } from 'drizzle-orm'
import { db, tables, dbType } from '../db'
import type { Statement } from '../db'
import { logger } from '../lib/logger'
import { nanoid } from '../lib/id'
import type { CountryCode } from '../lib/constants'

/**
 * Statement service
 * Handles statement upload, parsing status, and management
 */

/**
 * Statement status types
 */
export type StatementStatus = 'pending' | 'parsing' | 'completed' | 'failed'

/**
 * Bank statement summary structure
 */
export interface BankStatementSummary {
  type: 'bank_statement'
  openingBalance?: number
  closingBalance?: number
  totalCredits?: number
  totalDebits?: number
  creditCount?: number
  debitCount?: number
}

/**
 * Credit card statement summary structure
 */
export interface CreditCardStatementSummary {
  type: 'credit_card_statement'
  creditLimit?: number
  availableLimit?: number
  previousBalance?: number
  paymentsReceived?: number
  newCharges?: number
  totalDue?: number
  minimumDue?: number
  dueDate?: string
  creditCount?: number
  debitCount?: number
}

export type StatementSummary = BankStatementSummary | CreditCardStatementSummary

/**
 * Statement response type
 */
export interface StatementResponse {
  id: string
  accountId: string
  profileId: string
  userId: string
  originalFilename: string
  fileType: string
  fileSizeBytes: number | null
  periodStart: string | null
  periodEnd: string | null
  openingBalance: number | null
  closingBalance: number | null
  status: StatementStatus
  errorMessage: string | null
  summary: StatementSummary | null
  transactionCount: number
  parseStartedAt: string | Date | null
  parseCompletedAt: string | Date | null
  parseDurationMs: number | null
  createdAt: string | Date
  updatedAt: string | Date
}

/**
 * Parse job for background processing
 */
export interface ParseJob {
  id: string
  statementId: string
  profileId: string
  userId: string
  countryCode: CountryCode
  pages: string[]
  /** Model for statement parsing (code generation) */
  parsingModel?: string
  /** Model for transaction categorization */
  categorizationModel?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: Date
}

// In-memory job queue
const parseJobs: Map<string, ParseJob> = new Map()
let isProcessing = false

/**
 * Transform statement to response format
 */
function toStatementResponse(statement: Statement): StatementResponse {
  // Parse summary JSON for SQLite
  let summary: StatementSummary | null = null
  if (statement.summary) {
    if (typeof statement.summary === 'string') {
      try {
        summary = JSON.parse(statement.summary)
      } catch {
        summary = null
      }
    } else {
      summary = statement.summary as StatementSummary
    }
  }

  // Calculate parse duration
  let parseDurationMs: number | null = null
  if (statement.parseStartedAt && statement.parseCompletedAt) {
    const startTime =
      typeof statement.parseStartedAt === 'string'
        ? new Date(statement.parseStartedAt).getTime()
        : statement.parseStartedAt.getTime()
    const endTime =
      typeof statement.parseCompletedAt === 'string'
        ? new Date(statement.parseCompletedAt).getTime()
        : statement.parseCompletedAt.getTime()
    parseDurationMs = endTime - startTime
  }

  return {
    id: statement.id,
    accountId: statement.accountId,
    profileId: statement.profileId,
    userId: statement.userId,
    originalFilename: statement.originalFilename,
    fileType: statement.fileType,
    fileSizeBytes: statement.fileSizeBytes,
    periodStart: statement.periodStart,
    periodEnd: statement.periodEnd,
    openingBalance: statement.openingBalance != null ? Number(statement.openingBalance) : null,
    closingBalance: statement.closingBalance != null ? Number(statement.closingBalance) : null,
    status: statement.status as StatementStatus,
    errorMessage: statement.errorMessage,
    summary,
    transactionCount: statement.transactionCount || 0,
    parseStartedAt: statement.parseStartedAt || null,
    parseCompletedAt: statement.parseCompletedAt || null,
    parseDurationMs,
    createdAt: statement.createdAt,
    updatedAt: statement.updatedAt,
  }
}

/**
 * Get all statements for a user
 */
export async function getStatementsByUserId(
  userId: string,
  options?: {
    profileId?: string
    accountId?: string
  }
): Promise<StatementResponse[]> {
  const conditions = [eq(tables.statements.userId, userId)]

  if (options?.profileId) {
    conditions.push(eq(tables.statements.profileId, options.profileId))
  }

  if (options?.accountId) {
    conditions.push(eq(tables.statements.accountId, options.accountId))
  }

  const statements = await db
    .select()
    .from(tables.statements)
    .where(and(...conditions))
    .orderBy(desc(tables.statements.createdAt))

  return statements.map(toStatementResponse)
}

/**
 * Get a statement by ID
 */
export async function getStatementById(
  statementId: string,
  userId: string
): Promise<StatementResponse | null> {
  const [statement] = await db
    .select()
    .from(tables.statements)
    .where(and(eq(tables.statements.id, statementId), eq(tables.statements.userId, userId)))
    .limit(1)

  return statement ? toStatementResponse(statement) : null
}

/**
 * Get statement status (for polling)
 */
export async function getStatementStatus(
  statementId: string,
  userId: string
): Promise<{
  status: StatementStatus
  transactionCount: number
  errorMessage: string | null
  parseStartedAt: string | Date | null
  parseCompletedAt: string | Date | null
  parseDurationMs: number | null
} | null> {
  const [statement] = await db
    .select({
      status: tables.statements.status,
      transactionCount: tables.statements.transactionCount,
      errorMessage: tables.statements.errorMessage,
      parseStartedAt: tables.statements.parseStartedAt,
      parseCompletedAt: tables.statements.parseCompletedAt,
    })
    .from(tables.statements)
    .where(and(eq(tables.statements.id, statementId), eq(tables.statements.userId, userId)))
    .limit(1)

  if (!statement) return null

  // Calculate parse duration
  let parseDurationMs: number | null = null
  if (statement.parseStartedAt && statement.parseCompletedAt) {
    const startTime =
      typeof statement.parseStartedAt === 'string'
        ? new Date(statement.parseStartedAt).getTime()
        : statement.parseStartedAt.getTime()
    const endTime =
      typeof statement.parseCompletedAt === 'string'
        ? new Date(statement.parseCompletedAt).getTime()
        : statement.parseCompletedAt.getTime()
    parseDurationMs = endTime - startTime
  }

  return {
    status: statement.status as StatementStatus,
    transactionCount: statement.transactionCount || 0,
    errorMessage: statement.errorMessage,
    parseStartedAt: statement.parseStartedAt || null,
    parseCompletedAt: statement.parseCompletedAt || null,
    parseDurationMs,
  }
}

/**
 * Create a statement record (called after file upload validation)
 */
export async function createStatement(data: {
  accountId: string
  profileId: string
  userId: string
  originalFilename: string
  fileType: string
  fileSizeBytes: number
}): Promise<Statement> {
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  const [statement] = await db
    .insert(tables.statements)
    .values({
      accountId: data.accountId,
      profileId: data.profileId,
      userId: data.userId,
      originalFilename: data.originalFilename,
      fileType: data.fileType,
      fileSizeBytes: data.fileSizeBytes,
      status: 'pending',
      transactionCount: 0,
      createdAt: now as Date,
      updatedAt: now as Date,
    })
    .returning()

  if (!statement) {
    throw new Error('Failed to create statement record')
  }

  logger.debug(`[Statement] Created statement ${statement.id}`)
  return statement
}

/**
 * Update statement status
 */
export async function updateStatementStatus(
  statementId: string,
  status: StatementStatus,
  errorMessage?: string
): Promise<void> {
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  await db
    .update(tables.statements)
    .set({
      status,
      errorMessage: errorMessage || null,
      updatedAt: now as Date,
    })
    .where(eq(tables.statements.id, statementId))

  logger.debug(`[Statement] Updated statement ${statementId} status to ${status}`)
}

/**
 * Update statement with parsing results
 */
export async function updateStatementResults(
  statementId: string,
  data: {
    periodStart?: string | null
    periodEnd?: string | null
    openingBalance?: number | null
    closingBalance?: number | null
    summary?: StatementSummary | null
    transactionCount: number
    parseStartedAt?: Date
    parseCompletedAt?: Date
  }
): Promise<void> {
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  // For SQLite, stringify the summary
  const summaryValue =
    dbType === 'postgres' ? data.summary : data.summary ? JSON.stringify(data.summary) : null

  // Format timestamps for SQLite vs Postgres
  const parseStartedAt = data.parseStartedAt
    ? dbType === 'postgres'
      ? data.parseStartedAt
      : data.parseStartedAt.toISOString()
    : null
  const parseCompletedAt = data.parseCompletedAt
    ? dbType === 'postgres'
      ? data.parseCompletedAt
      : data.parseCompletedAt.toISOString()
    : null

  // Handle balance values - Postgres decimal expects string, SQLite real expects number
  const openingBalanceValue =
    data.openingBalance != null
      ? dbType === 'postgres'
        ? data.openingBalance.toString()
        : data.openingBalance
      : null
  const closingBalanceValue =
    data.closingBalance != null
      ? dbType === 'postgres'
        ? data.closingBalance.toString()
        : data.closingBalance
      : null

  await db
    .update(tables.statements)
    .set({
      periodStart: data.periodStart || null,
      periodEnd: data.periodEnd || null,
      openingBalance: openingBalanceValue as typeof tables.statements.$inferSelect.openingBalance,
      closingBalance: closingBalanceValue as typeof tables.statements.$inferSelect.closingBalance,
      summary: summaryValue as typeof tables.statements.$inferSelect.summary,
      transactionCount: data.transactionCount,
      parseStartedAt: parseStartedAt as Date,
      parseCompletedAt: parseCompletedAt as Date,
      status: 'completed',
      updatedAt: now as Date,
    })
    .where(eq(tables.statements.id, statementId))

  // Calculate duration for logging
  const durationMs =
    data.parseStartedAt && data.parseCompletedAt
      ? data.parseCompletedAt.getTime() - data.parseStartedAt.getTime()
      : null
  const durationSec = durationMs ? (durationMs / 1000).toFixed(2) : 'unknown'

  logger.debug(
    `[Statement] Updated statement ${statementId} with results (parsed in ${durationSec}s)`
  )
}

/**
 * Delete a statement (cascades to transactions)
 */
export async function deleteStatement(statementId: string, userId: string): Promise<void> {
  // Verify ownership
  const statement = await getStatementById(statementId, userId)
  if (!statement) {
    throw new Error('Statement not found')
  }

  await db.delete(tables.statements).where(eq(tables.statements.id, statementId))

  logger.debug(`[Statement] Deleted statement ${statementId}`)
}

/**
 * Add a parsing job to the queue
 */
export function queueParseJob(data: {
  statementId: string
  profileId: string
  userId: string
  countryCode: CountryCode
  pages: string[]
  /** Model for statement parsing (code generation) */
  parsingModel?: string
  /** Model for transaction categorization */
  categorizationModel?: string
}): string {
  const jobId = nanoid()
  const job: ParseJob = {
    id: jobId,
    statementId: data.statementId,
    profileId: data.profileId,
    userId: data.userId,
    countryCode: data.countryCode,
    pages: data.pages,
    parsingModel: data.parsingModel,
    categorizationModel: data.categorizationModel,
    status: 'pending',
    createdAt: new Date(),
  }

  parseJobs.set(jobId, job)
  logger.debug(`[Statement] Queued parse job ${jobId} for statement ${data.statementId}`)

  // Trigger processing
  processNextJob()

  return jobId
}

/**
 * Process the next job in the queue
 */
async function processNextJob(): Promise<void> {
  if (isProcessing) return

  const pendingJob = Array.from(parseJobs.values()).find((j) => j.status === 'pending')
  if (!pendingJob) return

  isProcessing = true
  pendingJob.status = 'processing'

  try {
    await updateStatementStatus(pendingJob.statementId, 'parsing')

    // Import parser dynamically to avoid circular dependencies
    const { parseStatement } = await import('../llm/parser')

    await parseStatement({
      statementId: pendingJob.statementId,
      profileId: pendingJob.profileId,
      userId: pendingJob.userId,
      countryCode: pendingJob.countryCode,
      pages: pendingJob.pages,
      parsingModel: pendingJob.parsingModel,
      categorizationModel: pendingJob.categorizationModel,
    })

    pendingJob.status = 'completed'
    logger.debug(`[Statement] Parse job ${pendingJob.id} completed`)
  } catch (error) {
    pendingJob.status = 'failed'
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error(`[Statement] Parse job ${pendingJob.id} failed:`, errorMessage)

    // Update statement with error
    await updateStatementStatus(pendingJob.statementId, 'failed', errorMessage)

    // Delete any partial transactions
    await db
      .delete(tables.transactions)
      .where(eq(tables.transactions.statementId, pendingJob.statementId))
  } finally {
    isProcessing = false
    // Process next job if any
    processNextJob()
  }
}

/**
 * Get job status
 */
export function getJobStatus(jobId: string): ParseJob | undefined {
  return parseJobs.get(jobId)
}
