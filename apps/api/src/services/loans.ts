import { eq, and, desc, gte, lte } from 'drizzle-orm'
import { db, tables, dbType } from '../db'
import type { Loan as DBLoan } from '../db'
import { logger } from '../lib/logger'
import type { LoanDocumentParsed } from '../llm/schemas'

/**
 * Loans service
 * Handles CRUD operations for loan documents
 */

// Type definitions
export type LoanType =
  | 'personal_loan'
  | 'home_loan'
  | 'vehicle_loan'
  | 'education_loan'
  | 'business_loan'
  | 'gold_loan'
export type InterestType = 'fixed' | 'floating'
export type LoanStatus = 'active' | 'closed'
export type ParseStatus = 'pending' | 'parsing' | 'completed' | 'failed'

/**
 * Loan with optional profile name for family view
 */
export interface Loan {
  id: string
  profileId: string
  userId: string
  loanType: LoanType
  lender: string
  institution: string | null
  loanAccountNumber: string | null
  borrowerName: string | null
  principalAmount: number | null
  interestRate: number | null
  interestType: InterestType | null
  emiAmount: number | null
  tenureMonths: number | null
  disbursementDate: string | null
  firstEmiDate: string | null
  endDate: string | null
  status: LoanStatus
  details: Record<string, unknown> | null
  originalFilename: string | null
  fileType: string | null
  parseStatus: ParseStatus
  errorMessage: string | null
  rawText: string | null
  createdAt: string | Date
  updatedAt: string | Date
  // Optional for family view join
  profileName?: string
}

/**
 * Parse a value to number (handles decimal fields that are strings in Postgres)
 */
function parseNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return value
  const parsed = parseFloat(value)
  return isNaN(parsed) ? null : parsed
}

/**
 * Parse details field (jsonb in Postgres, text in SQLite)
 */
function parseDetails(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  if (typeof value === 'object') {
    return value as Record<string, unknown>
  }
  return null
}

/**
 * Input for creating a new loan
 */
export interface CreateLoanInput {
  profileId: string
  userId: string
  loanType: LoanType
  lender: string
  institution?: string | null
  loanAccountNumber?: string | null
  borrowerName?: string | null
  principalAmount?: number | null
  interestRate?: number | null
  interestType?: InterestType | null
  emiAmount?: number | null
  tenureMonths?: number | null
  disbursementDate?: string | null
  firstEmiDate?: string | null
  endDate?: string | null
  status?: LoanStatus
  details?: Record<string, unknown> | null
  originalFilename?: string | null
  fileType?: string | null
  parseStatus?: ParseStatus
  errorMessage?: string | null
  rawText?: string | null
}

/**
 * Input for updating a loan
 */
export interface UpdateLoanInput {
  loanType?: LoanType
  lender?: string
  institution?: string | null
  loanAccountNumber?: string | null
  borrowerName?: string | null
  principalAmount?: number | null
  interestRate?: number | null
  interestType?: InterestType | null
  emiAmount?: number | null
  tenureMonths?: number | null
  disbursementDate?: string | null
  firstEmiDate?: string | null
  endDate?: string | null
  status?: LoanStatus
  details?: Record<string, unknown> | null
  originalFilename?: string | null
  fileType?: string | null
  parseStatus?: ParseStatus
  errorMessage?: string | null
  rawText?: string | null
}

/**
 * Filters for querying loans
 */
export interface LoanFilters {
  loanType?: LoanType
  status?: LoanStatus
  parseStatus?: ParseStatus
  disbursementDateFrom?: string
  disbursementDateTo?: string
  endDateFrom?: string
  endDateTo?: string
}

/**
 * Transform database loan to response format
 */
function toLoanResponse(loan: DBLoan, profileName?: string): Loan {
  return {
    id: loan.id,
    profileId: loan.profileId,
    userId: loan.userId,
    loanType: loan.loanType as LoanType,
    lender: loan.lender,
    institution: loan.institution,
    loanAccountNumber: loan.loanAccountNumber,
    borrowerName: loan.borrowerName,
    principalAmount: parseNumber(loan.principalAmount),
    interestRate: parseNumber(loan.interestRate),
    interestType: loan.interestType as InterestType | null,
    emiAmount: parseNumber(loan.emiAmount),
    tenureMonths: loan.tenureMonths,
    disbursementDate: loan.disbursementDate,
    firstEmiDate: loan.firstEmiDate,
    endDate: loan.endDate,
    status: loan.status as LoanStatus,
    details: parseDetails(loan.details),
    originalFilename: loan.originalFilename,
    fileType: loan.fileType,
    parseStatus: loan.parseStatus as ParseStatus,
    errorMessage: loan.errorMessage,
    rawText: loan.rawText,
    createdAt: loan.createdAt,
    updatedAt: loan.updatedAt,
    ...(profileName !== undefined && { profileName }),
  }
}

/**
 * Create a new loan
 */
export async function createLoan(input: CreateLoanInput): Promise<Loan> {
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  // Prepare details for database - Postgres uses jsonb, SQLite uses text
  const detailsValue = input.details
    ? dbType === 'postgres'
      ? input.details
      : JSON.stringify(input.details)
    : null

  // Prepare numeric values - Postgres decimal expects string
  const principalAmountValue =
    input.principalAmount !== null && input.principalAmount !== undefined
      ? dbType === 'postgres'
        ? String(input.principalAmount)
        : input.principalAmount
      : null

  const interestRateValue =
    input.interestRate !== null && input.interestRate !== undefined
      ? dbType === 'postgres'
        ? String(input.interestRate)
        : input.interestRate
      : null

  const emiAmountValue =
    input.emiAmount !== null && input.emiAmount !== undefined
      ? dbType === 'postgres'
        ? String(input.emiAmount)
        : input.emiAmount
      : null

  const [loan] = await db
    .insert(tables.loans)
    .values({
      profileId: input.profileId,
      userId: input.userId,
      loanType: input.loanType,
      lender: input.lender,
      institution: input.institution ?? null,
      loanAccountNumber: input.loanAccountNumber ?? null,
      borrowerName: input.borrowerName ?? null,
      principalAmount: principalAmountValue as string | null,
      interestRate: interestRateValue as string | null,
      interestType: input.interestType ?? null,
      emiAmount: emiAmountValue as string | null,
      tenureMonths: input.tenureMonths ?? null,
      disbursementDate: input.disbursementDate ?? null,
      firstEmiDate: input.firstEmiDate ?? null,
      endDate: input.endDate ?? null,
      status: input.status ?? 'active',
      details: detailsValue as Record<string, unknown> | null,
      originalFilename: input.originalFilename ?? null,
      fileType: input.fileType ?? null,
      parseStatus: input.parseStatus ?? 'pending',
      errorMessage: input.errorMessage ?? null,
      rawText: input.rawText ?? null,
      createdAt: now as Date,
      updatedAt: now as Date,
    })
    .returning()

  if (!loan) {
    throw new Error('Failed to create loan')
  }

  logger.debug(`[Loans] Created loan ${loan.id} for profile ${input.profileId}`)
  return toLoanResponse(loan)
}

/**
 * Get a loan by ID with user ownership check
 */
export async function getLoanById(id: string, userId: string): Promise<Loan | null> {
  const [loan] = await db
    .select()
    .from(tables.loans)
    .where(and(eq(tables.loans.id, id), eq(tables.loans.userId, userId)))
    .limit(1)

  return loan ? toLoanResponse(loan) : null
}

/**
 * Get loans for a specific profile
 */
export async function getLoansByProfile(
  profileId: string,
  userId: string,
  filters?: LoanFilters
): Promise<Loan[]> {
  const conditions = [eq(tables.loans.profileId, profileId), eq(tables.loans.userId, userId)]

  // Apply filters
  if (filters?.loanType) {
    conditions.push(eq(tables.loans.loanType, filters.loanType))
  }
  if (filters?.status) {
    conditions.push(eq(tables.loans.status, filters.status))
  }
  if (filters?.parseStatus) {
    conditions.push(eq(tables.loans.parseStatus, filters.parseStatus))
  }
  if (filters?.disbursementDateFrom) {
    conditions.push(gte(tables.loans.disbursementDate, filters.disbursementDateFrom))
  }
  if (filters?.disbursementDateTo) {
    conditions.push(lte(tables.loans.disbursementDate, filters.disbursementDateTo))
  }
  if (filters?.endDateFrom) {
    conditions.push(gte(tables.loans.endDate, filters.endDateFrom))
  }
  if (filters?.endDateTo) {
    conditions.push(lte(tables.loans.endDate, filters.endDateTo))
  }

  const loans = await db
    .select()
    .from(tables.loans)
    .where(and(...conditions))
    .orderBy(desc(tables.loans.createdAt))

  return loans.map((l) => toLoanResponse(l))
}

/**
 * Get all loans for a user (family view)
 * Joins with profiles table to get profileName
 */
export async function getLoansByUser(userId: string, filters?: LoanFilters): Promise<Loan[]> {
  const conditions = [eq(tables.loans.userId, userId)]

  // Apply filters
  if (filters?.loanType) {
    conditions.push(eq(tables.loans.loanType, filters.loanType))
  }
  if (filters?.status) {
    conditions.push(eq(tables.loans.status, filters.status))
  }
  if (filters?.parseStatus) {
    conditions.push(eq(tables.loans.parseStatus, filters.parseStatus))
  }
  if (filters?.disbursementDateFrom) {
    conditions.push(gte(tables.loans.disbursementDate, filters.disbursementDateFrom))
  }
  if (filters?.disbursementDateTo) {
    conditions.push(lte(tables.loans.disbursementDate, filters.disbursementDateTo))
  }
  if (filters?.endDateFrom) {
    conditions.push(gte(tables.loans.endDate, filters.endDateFrom))
  }
  if (filters?.endDateTo) {
    conditions.push(lte(tables.loans.endDate, filters.endDateTo))
  }

  const results = await db
    .select({
      loan: tables.loans,
      profileName: tables.profiles.name,
    })
    .from(tables.loans)
    .leftJoin(tables.profiles, eq(tables.loans.profileId, tables.profiles.id))
    .where(and(...conditions))
    .orderBy(desc(tables.loans.createdAt))

  return results.map((r) => toLoanResponse(r.loan, r.profileName ?? undefined))
}

/**
 * Update a loan
 */
export async function updateLoan(
  id: string,
  userId: string,
  input: UpdateLoanInput
): Promise<Loan> {
  // Verify ownership
  const existingLoan = await getLoanById(id, userId)
  if (!existingLoan) {
    throw new Error('Loan not found')
  }

  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  // Build update object
  const updateData: Partial<DBLoan> = {
    updatedAt: now as Date,
  }

  if (input.loanType !== undefined) {
    updateData.loanType = input.loanType
  }
  if (input.lender !== undefined) {
    updateData.lender = input.lender
  }
  if (input.institution !== undefined) {
    updateData.institution = input.institution
  }
  if (input.loanAccountNumber !== undefined) {
    updateData.loanAccountNumber = input.loanAccountNumber
  }
  if (input.borrowerName !== undefined) {
    updateData.borrowerName = input.borrowerName
  }
  if (input.principalAmount !== undefined) {
    updateData.principalAmount = (
      input.principalAmount !== null
        ? dbType === 'postgres'
          ? String(input.principalAmount)
          : input.principalAmount
        : null
    ) as string | null
  }
  if (input.interestRate !== undefined) {
    updateData.interestRate = (
      input.interestRate !== null
        ? dbType === 'postgres'
          ? String(input.interestRate)
          : input.interestRate
        : null
    ) as string | null
  }
  if (input.interestType !== undefined) {
    updateData.interestType = input.interestType
  }
  if (input.emiAmount !== undefined) {
    updateData.emiAmount = (
      input.emiAmount !== null
        ? dbType === 'postgres'
          ? String(input.emiAmount)
          : input.emiAmount
        : null
    ) as string | null
  }
  if (input.tenureMonths !== undefined) {
    updateData.tenureMonths = input.tenureMonths
  }
  if (input.disbursementDate !== undefined) {
    updateData.disbursementDate = input.disbursementDate
  }
  if (input.firstEmiDate !== undefined) {
    updateData.firstEmiDate = input.firstEmiDate
  }
  if (input.endDate !== undefined) {
    updateData.endDate = input.endDate
  }
  if (input.status !== undefined) {
    updateData.status = input.status
  }
  if (input.details !== undefined) {
    updateData.details = input.details
      ? dbType === 'postgres'
        ? input.details
        : JSON.stringify(input.details)
      : null
  }
  if (input.originalFilename !== undefined) {
    updateData.originalFilename = input.originalFilename
  }
  if (input.fileType !== undefined) {
    updateData.fileType = input.fileType
  }
  if (input.parseStatus !== undefined) {
    updateData.parseStatus = input.parseStatus
  }
  if (input.errorMessage !== undefined) {
    updateData.errorMessage = input.errorMessage
  }
  if (input.rawText !== undefined) {
    updateData.rawText = input.rawText
  }

  const [updatedLoan] = await db
    .update(tables.loans)
    .set(updateData)
    .where(eq(tables.loans.id, id))
    .returning()

  if (!updatedLoan) {
    throw new Error('Failed to update loan')
  }

  logger.debug(`[Loans] Updated loan ${id}`)
  return toLoanResponse(updatedLoan)
}

/**
 * Delete a loan
 */
export async function deleteLoan(id: string, userId: string): Promise<void> {
  // Verify ownership
  const existingLoan = await getLoanById(id, userId)
  if (!existingLoan) {
    throw new Error('Loan not found')
  }

  // Unlink any transactions that reference this loan
  await db
    .update(tables.transactions)
    .set({ linkedEntityId: null, linkedEntityType: null })
    .where(
      and(
        eq(tables.transactions.linkedEntityId, id),
        eq(tables.transactions.linkedEntityType, 'loan')
      )
    )

  await db.delete(tables.loans).where(eq(tables.loans.id, id))

  logger.debug(`[Loans] Deleted loan ${id}`)
}

// ============================================================================
// Processing Queue
// ============================================================================

/**
 * Input for queueing a loan document for processing
 */
export interface LoanDocumentInput {
  loanId: string
  userId: string
  pages: string[]
  loanTypeHint?: LoanType
  parsingModel?: string
}

/**
 * Processing queue for loan documents
 */
const processingQueue: LoanDocumentInput[] = []
let isProcessing = false

/**
 * Queue a loan document for processing
 * Returns immediately, processing happens in background
 */
export function queueLoanDocument(input: LoanDocumentInput): void {
  processingQueue.push(input)
  logger.debug(`[Loans] Queued loan ${input.loanId} for processing`)
  processQueue()
}

/**
 * Process the queue - one document at a time
 */
async function processQueue(): Promise<void> {
  if (isProcessing) return

  const job = processingQueue.shift()
  if (!job) return

  isProcessing = true

  try {
    await processLoanDocument(job)
  } catch (error) {
    logger.error('[Loans] Processing failed:', error)
  } finally {
    isProcessing = false
    processQueue() // Process next job if any
  }
}

/**
 * Process a loan document: parse with LLM and update loan record
 */
export async function processLoanDocument(input: LoanDocumentInput): Promise<void> {
  const { loanId, userId, pages, loanTypeHint, parsingModel } = input

  logger.debug(`[Loans] Starting processing for loan ${loanId}`)

  // Update status to parsing
  await updateLoan(loanId, userId, { parseStatus: 'parsing' })

  try {
    // Import the parser dynamically to avoid circular dependencies
    const { parseLoanDocument } = await import('../llm/loan-parser')

    // Combine pages into raw text for storage
    const rawText = pages.map((page, idx) => `--- PAGE ${idx + 1} ---\n${page}`).join('\n\n')

    // Parse the document
    const parsed = await parseLoanDocument({
      pages,
      loanTypeHint,
      modelOverride: parsingModel,
    })

    // Build type-specific details object
    const details = buildDetailsFromParsed(parsed)

    // Determine status based on end date
    const status = determineStatus(parsed.end_date)

    // Update loan with parsed data and raw text
    await updateLoan(loanId, userId, {
      loanType: parsed.loan_type,
      lender: parsed.lender,
      institution: parsed.institution,
      loanAccountNumber: parsed.loan_account_number,
      borrowerName: parsed.borrower_name,
      principalAmount: parsed.principal_amount,
      interestRate: parsed.interest_rate,
      interestType: parsed.interest_type as InterestType | null,
      emiAmount: parsed.emi_amount,
      tenureMonths: parsed.tenure_months,
      disbursementDate: parsed.disbursement_date,
      firstEmiDate: parsed.first_emi_date,
      endDate: parsed.end_date,
      status,
      details,
      parseStatus: 'completed',
      errorMessage: null,
      rawText,
    })

    logger.debug(
      `[Loans] Successfully processed loan ${loanId}: ${parsed.loan_type} from ${parsed.lender}`
    )

    // Link existing transactions to this loan
    try {
      const { linkTransactionsToLoan } = await import('./entity-linking')
      await linkTransactionsToLoan(loanId, userId, parsingModel)
      logger.debug(`[Loans] Completed transaction linking for loan ${loanId}`)
    } catch (linkError) {
      logger.error(`[Loans] Transaction linking failed for loan ${loanId}:`, linkError)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error'
    logger.error(`[Loans] Failed to process loan ${loanId}:`, error)

    // Update status to failed with error message
    await updateLoan(loanId, userId, {
      parseStatus: 'failed',
      errorMessage,
    })
  }
}

/**
 * Build the details object from parsed data based on loan type
 */
function buildDetailsFromParsed(parsed: LoanDocumentParsed): Record<string, unknown> | null {
  switch (parsed.loan_type) {
    case 'home_loan':
      return parsed.home_loan_details
        ? {
            propertyAddress: parsed.home_loan_details.property_address,
            propertyType: parsed.home_loan_details.property_type,
            coBorrowerName: parsed.home_loan_details.co_borrower_name,
            collateralValue: parsed.home_loan_details.collateral_value,
          }
        : null

    case 'vehicle_loan':
      return parsed.vehicle_loan_details
        ? {
            vehicleMake: parsed.vehicle_loan_details.vehicle_make,
            vehicleModel: parsed.vehicle_loan_details.vehicle_model,
            vehicleYear: parsed.vehicle_loan_details.vehicle_year,
            registrationNumber: parsed.vehicle_loan_details.registration_number,
            vehicleType: parsed.vehicle_loan_details.vehicle_type,
          }
        : null

    case 'education_loan':
      return parsed.education_loan_details
        ? {
            institutionName: parsed.education_loan_details.institution_name,
            courseName: parsed.education_loan_details.course_name,
            studentName: parsed.education_loan_details.student_name,
            moratoriumPeriod: parsed.education_loan_details.moratorium_period,
          }
        : null

    case 'business_loan':
      return parsed.business_loan_details
        ? {
            businessName: parsed.business_loan_details.business_name,
            loanPurpose: parsed.business_loan_details.loan_purpose,
            collateralDetails: parsed.business_loan_details.collateral_details,
          }
        : null

    case 'gold_loan':
      return parsed.gold_loan_details
        ? {
            goldWeight: parsed.gold_loan_details.gold_weight,
            goldPurity: parsed.gold_loan_details.gold_purity,
            collateralValue: parsed.gold_loan_details.collateral_value,
          }
        : null

    case 'personal_loan':
      return parsed.personal_loan_details
        ? {
            loanPurpose: parsed.personal_loan_details.loan_purpose,
          }
        : null

    default:
      return null
  }
}

/**
 * Determine loan status based on end date
 */
function determineStatus(endDate: string | null): LoanStatus {
  if (!endDate) return 'active'

  const today = new Date()
  const loanEndDate = new Date(endDate)

  if (loanEndDate < today) {
    return 'closed'
  }

  return 'active'
}

// ============================================================================
// Loan Liability Calculations for Net Worth
// ============================================================================

/**
 * Simulate loan payments to calculate accurate outstanding principal
 *
 * Handles all payment scenarios:
 * - Regular EMI payments
 * - Prepayments (lump sums to principal)
 * - Multiple EMIs at once
 * - Irregular schedules
 */
function simulateLoanPayments(
  principal: number,
  annualInterestRate: number | null,
  firstEmiDate: string | null,
  disbursementDate: string | null,
  payments: Array<{ date: string; amount: number }>
): number {
  // No payments: full principal outstanding
  if (payments.length === 0) return principal

  // Zero/no interest: all payments go to principal
  if (annualInterestRate === null || annualInterestRate === 0) {
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
    return Math.max(0, principal - totalPaid)
  }

  // Sort payments by date
  const sortedPayments = [...payments].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  const monthlyRate = annualInterestRate / 12 / 100
  let outstanding = principal

  // Determine interest start date
  let interestStartDate: Date
  if (firstEmiDate) {
    const firstEmi = new Date(firstEmiDate)
    interestStartDate = new Date(firstEmi)
    interestStartDate.setMonth(interestStartDate.getMonth() - 1)
  } else if (disbursementDate) {
    interestStartDate = new Date(disbursementDate)
  } else {
    interestStartDate = new Date(sortedPayments[0].date)
  }

  let lastDate = interestStartDate

  for (const payment of sortedPayments) {
    if (outstanding <= 0) break

    const paymentDate = new Date(payment.date)

    // Payment before interest starts
    if (paymentDate < interestStartDate) {
      outstanding = Math.max(0, outstanding - payment.amount)
      continue
    }

    // Calculate interest accrued
    const msPerDay = 24 * 60 * 60 * 1000
    const daysElapsed = Math.max(0, (paymentDate.getTime() - lastDate.getTime()) / msPerDay)
    const monthsElapsed = daysElapsed / 30.44
    const interestAccrued = outstanding * monthlyRate * monthsElapsed

    // Payment covers interest first, rest reduces principal
    if (payment.amount >= interestAccrued) {
      const principalPortion = Math.min(outstanding, payment.amount - interestAccrued)
      outstanding = Math.max(0, outstanding - principalPortion)
    }
    // If payment < interest, principal unchanged (partial payment)

    lastDate = paymentDate
  }

  return Math.max(0, outstanding)
}

/**
 * Loan liability info for net worth calculation
 */
export interface LoanLiabilityInfo {
  loanId: string
  loanType: string
  lender: string
  institution: string | null
  principalAmount: number
  outstandingBalance: number
  totalPaid: number
  paymentsMade: number
  interestRate: number | null
  tenureMonths: number | null
  status: string
}

/**
 * Get all active loans with their outstanding balances for net worth calculation
 */
export async function getLoanLiabilities(
  userId: string,
  profileId?: string
): Promise<{
  totalLoanLiabilities: number
  loans: LoanLiabilityInfo[]
}> {
  // Build conditions
  const conditions = [eq(tables.loans.userId, userId)]
  if (profileId) {
    conditions.push(eq(tables.loans.profileId, profileId))
  }

  // Get all loans (including closed ones for complete picture)
  const loans = await db
    .select()
    .from(tables.loans)
    .where(and(...conditions))

  const loanLiabilities: LoanLiabilityInfo[] = []
  let totalLoanLiabilities = 0

  for (const loan of loans) {
    const principal = parseNumber(loan.principalAmount)

    // Skip loans without principal amount
    if (principal === null || principal <= 0) continue

    // Closed loans have 0 outstanding
    if (loan.status === 'closed') {
      loanLiabilities.push({
        loanId: loan.id,
        loanType: loan.loanType,
        lender: loan.lender,
        institution: loan.institution,
        principalAmount: principal,
        outstandingBalance: 0,
        totalPaid: principal, // Assume fully paid if closed
        paymentsMade: loan.tenureMonths ?? 0,
        interestRate: parseNumber(loan.interestRate),
        tenureMonths: loan.tenureMonths,
        status: loan.status,
      })
      continue
    }

    // Get payments with dates from linked transactions (exclude hidden)
    const payments = await db
      .select({
        id: tables.transactions.id,
        date: tables.transactions.date,
        amount: tables.transactions.amount,
      })
      .from(tables.transactions)
      .where(
        and(
          eq(tables.transactions.userId, userId),
          eq(tables.transactions.linkedEntityId, loan.id),
          eq(tables.transactions.linkedEntityType, 'loan'),
          eq(tables.transactions.isHidden, false)
        )
      )

    const paymentsMade = payments.length
    const totalPaid = payments.reduce((sum, p) => {
      const amount = typeof p.amount === 'string' ? parseFloat(p.amount) : Number(p.amount)
      return sum + amount
    }, 0)

    const interestRate = parseNumber(loan.interestRate)
    const tenureMonths = loan.tenureMonths

    // Use payment simulation for accurate outstanding (handles prepayments)
    const outstandingBalance = simulateLoanPayments(
      principal,
      interestRate,
      loan.firstEmiDate,
      loan.disbursementDate,
      payments.map((p) => ({
        date: p.date,
        amount: typeof p.amount === 'string' ? parseFloat(p.amount) : Number(p.amount),
      }))
    )

    loanLiabilities.push({
      loanId: loan.id,
      loanType: loan.loanType,
      lender: loan.lender,
      institution: loan.institution,
      principalAmount: principal,
      outstandingBalance,
      totalPaid,
      paymentsMade,
      interestRate,
      tenureMonths,
      status: loan.status,
    })

    // Only active loans contribute to liabilities
    if (loan.status === 'active') {
      totalLoanLiabilities += outstandingBalance
    }
  }

  return {
    totalLoanLiabilities,
    loans: loanLiabilities,
  }
}
