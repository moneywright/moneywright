import { eq, and, desc } from 'drizzle-orm'
import { db, tables, dbType } from '../db'
import type { Statement } from '../db'
import { logger } from '../lib/logger'
import type { CountryCode, FileType } from '../lib/constants'
import { nanoid } from '../lib/id'

/**
 * Statement service - simplified
 */

export type StatementStatus = 'pending' | 'parsing' | 'completed' | 'failed'

export interface BankStatementSummary {
  type: 'bank_statement'
  openingBalance?: number
  closingBalance?: number
  totalCredits?: number
  totalDebits?: number
  creditCount?: number
  debitCount?: number
}

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

export interface StatementResponse {
  id: string
  accountId: string | null
  sourceId: string | null
  profileId: string
  userId: string
  originalFilename: string
  fileType: string
  fileSizeBytes: number | null
  documentType: string
  periodStart: string | null
  periodEnd: string | null
  openingBalance: number | null
  closingBalance: number | null
  status: StatementStatus
  errorMessage: string | null
  summary: StatementSummary | null
  transactionCount: number
  holdingsCount: number | null
  parseStartedAt: string | Date | null
  parseCompletedAt: string | Date | null
  parseDurationMs: number | null
  createdAt: string | Date
  updatedAt: string | Date
}

/**
 * Input for processing a statement
 */
export interface StatementInput {
  statementId: string
  profileId: string
  userId: string
  pages: string[]
  fileType: FileType
  documentType?: 'bank_statement' | 'investment_statement'
  sourceType?: string
  parsingModel?: string
  /** Password used to decrypt the file (for saving to account after parsing) */
  password?: string
  /** Whether to save the password to the account */
  savePassword?: boolean
}

function toStatementResponse(statement: Statement): StatementResponse {
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
    sourceId: statement.sourceId || null,
    profileId: statement.profileId,
    userId: statement.userId,
    originalFilename: statement.originalFilename,
    fileType: statement.fileType,
    fileSizeBytes: statement.fileSizeBytes,
    documentType: statement.documentType || 'bank_statement',
    periodStart: statement.periodStart,
    periodEnd: statement.periodEnd,
    openingBalance: statement.openingBalance != null ? Number(statement.openingBalance) : null,
    closingBalance: statement.closingBalance != null ? Number(statement.closingBalance) : null,
    status: statement.status as StatementStatus,
    errorMessage: statement.errorMessage,
    summary,
    transactionCount: statement.transactionCount || 0,
    holdingsCount: statement.holdingsCount || null,
    parseStartedAt: statement.parseStartedAt || null,
    parseCompletedAt: statement.parseCompletedAt || null,
    parseDurationMs,
    createdAt: statement.createdAt,
    updatedAt: statement.updatedAt,
  }
}

export async function getStatementsByUserId(
  userId: string,
  options?: { profileId?: string; accountId?: string }
): Promise<StatementResponse[]> {
  const conditions = [eq(tables.statements.userId, userId)]
  if (options?.profileId) conditions.push(eq(tables.statements.profileId, options.profileId))
  if (options?.accountId) conditions.push(eq(tables.statements.accountId, options.accountId))

  const statements = await db
    .select()
    .from(tables.statements)
    .where(and(...conditions))
    .orderBy(desc(tables.statements.createdAt))

  return statements.map(toStatementResponse)
}

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

export async function createStatement(data: {
  accountId: string | null
  profileId: string
  userId: string
  originalFilename: string
  fileType: string
  fileSizeBytes: number
  documentType?: 'bank_statement' | 'investment_statement'
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
      documentType: data.documentType || 'bank_statement',
      status: 'pending',
      transactionCount: 0,
      createdAt: now as Date,
      updatedAt: now as Date,
    })
    .returning()

  if (!statement) throw new Error('Failed to create statement record')
  return statement
}

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
}

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

  const summaryValue =
    dbType === 'postgres' ? data.summary : data.summary ? JSON.stringify(data.summary) : null

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
}

export async function deleteStatement(statementId: string, userId: string): Promise<void> {
  const statement = await getStatementById(statementId, userId)
  if (!statement) throw new Error('Statement not found')

  await db.delete(tables.statements).where(eq(tables.statements.id, statementId))
}

// ============================================================================
// SIMPLE ASYNC PROCESSING
// ============================================================================

// Flag to prevent concurrent processing
let isProcessing = false
// Queue of jobs waiting to be processed
const processingQueue: Array<{
  statements: StatementInput[]
  countryCode: CountryCode
  categorizationModel?: string
}> = []

// Categorization status tracking
let categorizationStatus: {
  active: boolean
  type: 'parsing' | 'categorizing' | 'recategorizing' | null
  progress?: { current: number; total: number }
} = { active: false, type: null }

/**
 * Get current categorization status
 */
export function getCategorizationStatus() {
  return { ...categorizationStatus }
}

/**
 * Queue statements for processing (async, non-blocking)
 * Returns immediately, processing happens in background
 */
export function queueStatements(data: {
  statements: StatementInput[]
  countryCode: CountryCode
  categorizationModel?: string
}): void {
  processingQueue.push(data)
  logger.debug(`[Statement] Queued ${data.statements.length} statements for processing`)
  processQueue()
}

/**
 * Process the queue - one job at a time
 */
async function processQueue(): Promise<void> {
  if (isProcessing) return

  const job = processingQueue.shift()
  if (!job) return

  isProcessing = true

  try {
    await processStatements(job.statements, job.countryCode, job.categorizationModel)
  } catch (error) {
    logger.error('[Statement] Processing failed:', error)
  } finally {
    isProcessing = false
    processQueue() // Process next job if any
  }
}

/**
 * Process statements: parse serially, then categorize all together
 */
async function processStatements(
  statements: StatementInput[],
  countryCode: CountryCode,
  categorizationModel?: string
): Promise<void> {
  const { parseStatement } = await import('../llm/parser')
  const { categorizeStatements } = await import('../lib/pdf')
  const { updateStatementPassword } = await import('./accounts')

  const successfulStatementIds: string[] = []

  // Step 1: Parse each statement serially (for caching benefits)
  logger.debug(`[Statement] Parsing ${statements.length} statements serially`)
  categorizationStatus = {
    active: true,
    type: 'parsing',
    progress: { current: 0, total: statements.length },
  }

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]!
    categorizationStatus.progress = { current: i + 1, total: statements.length }
    logger.debug(`[Statement] Parsing ${i + 1}/${statements.length}: ${stmt.statementId}`)

    try {
      await updateStatementStatus(stmt.statementId, 'parsing')

      await parseStatement({
        statementId: stmt.statementId,
        profileId: stmt.profileId,
        userId: stmt.userId,
        countryCode,
        pages: stmt.pages,
        fileType: stmt.fileType,
        documentType: stmt.documentType,
        sourceType: stmt.sourceType,
        parsingModel: stmt.parsingModel,
      })

      successfulStatementIds.push(stmt.statementId)

      // Save password to account if requested (after parsing, account is now created)
      if (stmt.password && stmt.savePassword) {
        // Get the statement to find the account ID
        const [parsedStatement] = await db
          .select({ accountId: tables.statements.accountId })
          .from(tables.statements)
          .where(eq(tables.statements.id, stmt.statementId))
          .limit(1)

        if (parsedStatement?.accountId) {
          await updateStatementPassword(parsedStatement.accountId, stmt.userId, stmt.password)
          logger.debug(`[Statement] Saved password for account ${parsedStatement.accountId}`)
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error(`[Statement] Failed to parse ${stmt.statementId}:`, errorMessage)
      await updateStatementStatus(stmt.statementId, 'failed', errorMessage)

      // Clean up partial transactions
      await db
        .delete(tables.transactions)
        .where(eq(tables.transactions.statementId, stmt.statementId))
    }
  }

  logger.debug(
    `[Statement] Parsing complete: ${successfulStatementIds.length}/${statements.length} succeeded`
  )

  // Step 2: Categorize all successful statements together
  if (successfulStatementIds.length > 0) {
    logger.debug(`[Statement] Categorizing ${successfulStatementIds.length} statements together`)
    categorizationStatus = { active: true, type: 'categorizing' }

    // Get profileId from first statement (all statements in batch should have same profileId)
    const profileId = statements[0]?.profileId

    try {
      const result = await categorizeStatements(
        successfulStatementIds,
        countryCode,
        categorizationModel,
        undefined,
        profileId
      )
      logger.debug(
        `[Statement] Categorized ${result.categorizedCount}/${result.totalCount} transactions`
      )
    } catch (error) {
      logger.error('[Statement] Categorization failed:', error)
    }
  }

  categorizationStatus = { active: false, type: null }
}

// ============================================================================
// RECATEGORIZATION (kept simple)
// ============================================================================

export interface RecategorizeJob {
  id: string
  profileId: string
  userId: string
  countryCode: CountryCode
  accountId?: string
  statementId?: string
  categorizationModel: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  transactionCount?: number
  processedCount?: number
  errorMessage?: string
  createdAt: Date
  completedAt?: Date
}

const recategorizeJobs: Map<string, RecategorizeJob> = new Map()
let isRecategorizing = false

export function queueRecategorizeJob(data: {
  profileId: string
  userId: string
  countryCode: CountryCode
  accountId?: string
  statementId?: string
  categorizationModel: string
}): string {
  const jobId = nanoid()

  const job: RecategorizeJob = {
    id: jobId,
    ...data,
    status: 'pending',
    createdAt: new Date(),
  }

  recategorizeJobs.set(jobId, job)
  logger.debug(`[Recategorize] Queued job ${jobId}`)
  processNextRecategorizeJob()

  return jobId
}

async function processNextRecategorizeJob(): Promise<void> {
  if (isRecategorizing) return

  const job = Array.from(recategorizeJobs.values()).find((j) => j.status === 'pending')
  if (!job) return

  isRecategorizing = true
  job.status = 'processing'
  categorizationStatus = { active: true, type: 'recategorizing' }

  try {
    const { recategorizeTransactions } = await import('./recategorize')

    const result = await recategorizeTransactions({
      profileId: job.profileId,
      userId: job.userId,
      countryCode: job.countryCode,
      accountId: job.accountId,
      statementId: job.statementId,
      categorizationModel: job.categorizationModel,
      onProgress: (processed, total) => {
        job.processedCount = processed
        job.transactionCount = total
        categorizationStatus.progress = { current: processed, total }
      },
    })

    job.status = 'completed'
    job.transactionCount = result.totalCount
    job.processedCount = result.categorizedCount
    job.completedAt = new Date()
    logger.debug(
      `[Recategorize] Job ${job.id} completed: ${result.categorizedCount}/${result.totalCount}`
    )
  } catch (error) {
    job.status = 'failed'
    job.errorMessage = error instanceof Error ? error.message : 'Unknown error'
    job.completedAt = new Date()
    logger.error(`[Recategorize] Job ${job.id} failed:`, job.errorMessage)
  } finally {
    isRecategorizing = false
    categorizationStatus = { active: false, type: null }
    processNextRecategorizeJob()
  }
}

export function getRecategorizeJobStatus(jobId: string): RecategorizeJob | undefined {
  return recategorizeJobs.get(jobId)
}
