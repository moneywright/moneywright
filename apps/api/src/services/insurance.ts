import { eq, and, desc, gte, lte } from 'drizzle-orm'
import { db, tables, dbType } from '../db'
import type { InsurancePolicy as DBInsurancePolicy } from '../db'
import { logger } from '../lib/logger'
import type { InsurancePolicyParsed } from '../llm/schemas'

/**
 * Insurance service
 * Handles CRUD operations for insurance policies
 */

// Type definitions
export type PolicyType = 'life_insurance' | 'health_insurance' | 'vehicle_insurance'
export type PremiumFrequency = 'monthly' | 'quarterly' | 'half_yearly' | 'yearly'
export type PolicyStatus = 'active' | 'expired' | 'cancelled'
export type ParseStatus = 'pending' | 'parsing' | 'completed' | 'failed'

/**
 * Insurance policy with optional profile name for family view
 */
export interface InsurancePolicy {
  id: string
  profileId: string
  userId: string
  policyType: PolicyType
  provider: string
  institution: string | null
  policyNumber: string | null
  policyHolderName: string | null
  sumInsured: number | null
  premiumAmount: number | null
  premiumFrequency: PremiumFrequency | null
  startDate: string | null
  endDate: string | null
  status: PolicyStatus
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
 * Input for creating a new policy
 */
export interface CreatePolicyInput {
  profileId: string
  userId: string
  policyType: PolicyType
  provider: string
  institution?: string | null
  policyNumber?: string | null
  policyHolderName?: string | null
  sumInsured?: number | null
  premiumAmount?: number | null
  premiumFrequency?: PremiumFrequency | null
  startDate?: string | null
  endDate?: string | null
  status?: PolicyStatus
  details?: Record<string, unknown> | null
  originalFilename?: string | null
  fileType?: string | null
  parseStatus?: ParseStatus
  errorMessage?: string | null
  rawText?: string | null
}

/**
 * Input for updating a policy
 */
export interface UpdatePolicyInput {
  policyType?: PolicyType
  provider?: string
  institution?: string | null
  policyNumber?: string | null
  policyHolderName?: string | null
  sumInsured?: number | null
  premiumAmount?: number | null
  premiumFrequency?: PremiumFrequency | null
  startDate?: string | null
  endDate?: string | null
  status?: PolicyStatus
  details?: Record<string, unknown> | null
  originalFilename?: string | null
  fileType?: string | null
  parseStatus?: ParseStatus
  errorMessage?: string | null
  rawText?: string | null
}

/**
 * Filters for querying policies
 */
export interface PolicyFilters {
  policyType?: PolicyType
  status?: PolicyStatus
  parseStatus?: ParseStatus
  startDateFrom?: string
  startDateTo?: string
  endDateFrom?: string
  endDateTo?: string
}

/**
 * Transform database policy to response format
 */
function toPolicyResponse(policy: DBInsurancePolicy, profileName?: string): InsurancePolicy {
  return {
    id: policy.id,
    profileId: policy.profileId,
    userId: policy.userId,
    policyType: policy.policyType as PolicyType,
    provider: policy.provider,
    institution: policy.institution,
    policyNumber: policy.policyNumber,
    policyHolderName: policy.policyHolderName,
    sumInsured: parseNumber(policy.sumInsured),
    premiumAmount: parseNumber(policy.premiumAmount),
    premiumFrequency: policy.premiumFrequency as PremiumFrequency | null,
    startDate: policy.startDate,
    endDate: policy.endDate,
    status: policy.status as PolicyStatus,
    details: parseDetails(policy.details),
    originalFilename: policy.originalFilename,
    fileType: policy.fileType,
    parseStatus: policy.parseStatus as ParseStatus,
    errorMessage: policy.errorMessage,
    rawText: policy.rawText,
    createdAt: policy.createdAt,
    updatedAt: policy.updatedAt,
    ...(profileName !== undefined && { profileName }),
  }
}

/**
 * Create a new insurance policy
 */
export async function createPolicy(input: CreatePolicyInput): Promise<InsurancePolicy> {
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  // Prepare details for database - Postgres uses jsonb, SQLite uses text
  const detailsValue = input.details
    ? dbType === 'postgres'
      ? input.details
      : JSON.stringify(input.details)
    : null

  // Prepare numeric values - Postgres decimal expects string
  const sumInsuredValue =
    input.sumInsured !== null && input.sumInsured !== undefined
      ? dbType === 'postgres'
        ? String(input.sumInsured)
        : input.sumInsured
      : null

  const premiumAmountValue =
    input.premiumAmount !== null && input.premiumAmount !== undefined
      ? dbType === 'postgres'
        ? String(input.premiumAmount)
        : input.premiumAmount
      : null

  const [policy] = await db
    .insert(tables.insurancePolicies)
    .values({
      profileId: input.profileId,
      userId: input.userId,
      policyType: input.policyType,
      provider: input.provider,
      institution: input.institution ?? null,
      policyNumber: input.policyNumber ?? null,
      policyHolderName: input.policyHolderName ?? null,
      sumInsured: sumInsuredValue as string | null,
      premiumAmount: premiumAmountValue as string | null,
      premiumFrequency: input.premiumFrequency ?? null,
      startDate: input.startDate ?? null,
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

  if (!policy) {
    throw new Error('Failed to create insurance policy')
  }

  logger.debug(`[Insurance] Created policy ${policy.id} for profile ${input.profileId}`)
  return toPolicyResponse(policy)
}

/**
 * Get a policy by ID with user ownership check
 */
export async function getPolicyById(id: string, userId: string): Promise<InsurancePolicy | null> {
  const [policy] = await db
    .select()
    .from(tables.insurancePolicies)
    .where(and(eq(tables.insurancePolicies.id, id), eq(tables.insurancePolicies.userId, userId)))
    .limit(1)

  return policy ? toPolicyResponse(policy) : null
}

/**
 * Get policies for a specific profile
 */
export async function getPoliciesByProfile(
  profileId: string,
  userId: string,
  filters?: PolicyFilters
): Promise<InsurancePolicy[]> {
  const conditions = [
    eq(tables.insurancePolicies.profileId, profileId),
    eq(tables.insurancePolicies.userId, userId),
  ]

  // Apply filters
  if (filters?.policyType) {
    conditions.push(eq(tables.insurancePolicies.policyType, filters.policyType))
  }
  if (filters?.status) {
    conditions.push(eq(tables.insurancePolicies.status, filters.status))
  }
  if (filters?.parseStatus) {
    conditions.push(eq(tables.insurancePolicies.parseStatus, filters.parseStatus))
  }
  if (filters?.startDateFrom) {
    conditions.push(gte(tables.insurancePolicies.startDate, filters.startDateFrom))
  }
  if (filters?.startDateTo) {
    conditions.push(lte(tables.insurancePolicies.startDate, filters.startDateTo))
  }
  if (filters?.endDateFrom) {
    conditions.push(gte(tables.insurancePolicies.endDate, filters.endDateFrom))
  }
  if (filters?.endDateTo) {
    conditions.push(lte(tables.insurancePolicies.endDate, filters.endDateTo))
  }

  const policies = await db
    .select()
    .from(tables.insurancePolicies)
    .where(and(...conditions))
    .orderBy(desc(tables.insurancePolicies.createdAt))

  return policies.map((p) => toPolicyResponse(p))
}

/**
 * Get all policies for a user (family view)
 * Joins with profiles table to get profileName
 */
export async function getPoliciesByUser(
  userId: string,
  filters?: PolicyFilters
): Promise<InsurancePolicy[]> {
  const conditions = [eq(tables.insurancePolicies.userId, userId)]

  // Apply filters
  if (filters?.policyType) {
    conditions.push(eq(tables.insurancePolicies.policyType, filters.policyType))
  }
  if (filters?.status) {
    conditions.push(eq(tables.insurancePolicies.status, filters.status))
  }
  if (filters?.parseStatus) {
    conditions.push(eq(tables.insurancePolicies.parseStatus, filters.parseStatus))
  }
  if (filters?.startDateFrom) {
    conditions.push(gte(tables.insurancePolicies.startDate, filters.startDateFrom))
  }
  if (filters?.startDateTo) {
    conditions.push(lte(tables.insurancePolicies.startDate, filters.startDateTo))
  }
  if (filters?.endDateFrom) {
    conditions.push(gte(tables.insurancePolicies.endDate, filters.endDateFrom))
  }
  if (filters?.endDateTo) {
    conditions.push(lte(tables.insurancePolicies.endDate, filters.endDateTo))
  }

  const results = await db
    .select({
      policy: tables.insurancePolicies,
      profileName: tables.profiles.name,
    })
    .from(tables.insurancePolicies)
    .leftJoin(tables.profiles, eq(tables.insurancePolicies.profileId, tables.profiles.id))
    .where(and(...conditions))
    .orderBy(desc(tables.insurancePolicies.createdAt))

  return results.map((r) => toPolicyResponse(r.policy, r.profileName ?? undefined))
}

/**
 * Update an insurance policy
 */
export async function updatePolicy(
  id: string,
  userId: string,
  input: UpdatePolicyInput
): Promise<InsurancePolicy> {
  // Verify ownership
  const existingPolicy = await getPolicyById(id, userId)
  if (!existingPolicy) {
    throw new Error('Policy not found')
  }

  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  // Build update object
  const updateData: Partial<DBInsurancePolicy> = {
    updatedAt: now as Date,
  }

  if (input.policyType !== undefined) {
    updateData.policyType = input.policyType
  }
  if (input.provider !== undefined) {
    updateData.provider = input.provider
  }
  if (input.institution !== undefined) {
    updateData.institution = input.institution
  }
  if (input.policyNumber !== undefined) {
    updateData.policyNumber = input.policyNumber
  }
  if (input.policyHolderName !== undefined) {
    updateData.policyHolderName = input.policyHolderName
  }
  if (input.sumInsured !== undefined) {
    updateData.sumInsured = (
      input.sumInsured !== null
        ? dbType === 'postgres'
          ? String(input.sumInsured)
          : input.sumInsured
        : null
    ) as string | null
  }
  if (input.premiumAmount !== undefined) {
    updateData.premiumAmount = (
      input.premiumAmount !== null
        ? dbType === 'postgres'
          ? String(input.premiumAmount)
          : input.premiumAmount
        : null
    ) as string | null
  }
  if (input.premiumFrequency !== undefined) {
    updateData.premiumFrequency = input.premiumFrequency
  }
  if (input.startDate !== undefined) {
    updateData.startDate = input.startDate
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

  const [updatedPolicy] = await db
    .update(tables.insurancePolicies)
    .set(updateData)
    .where(eq(tables.insurancePolicies.id, id))
    .returning()

  if (!updatedPolicy) {
    throw new Error('Failed to update insurance policy')
  }

  logger.debug(`[Insurance] Updated policy ${id}`)
  return toPolicyResponse(updatedPolicy)
}

/**
 * Delete an insurance policy
 */
export async function deletePolicy(id: string, userId: string): Promise<void> {
  // Verify ownership
  const existingPolicy = await getPolicyById(id, userId)
  if (!existingPolicy) {
    throw new Error('Policy not found')
  }

  // Unlink any transactions that reference this insurance policy
  await db
    .update(tables.transactions)
    .set({ linkedEntityId: null, linkedEntityType: null })
    .where(
      and(
        eq(tables.transactions.linkedEntityId, id),
        eq(tables.transactions.linkedEntityType, 'insurance')
      )
    )

  await db.delete(tables.insurancePolicies).where(eq(tables.insurancePolicies.id, id))

  logger.debug(`[Insurance] Deleted policy ${id}`)
}

// ============================================================================
// Processing Queue
// ============================================================================

/**
 * Input for queueing an insurance document for processing
 */
export interface InsuranceDocumentInput {
  policyId: string
  userId: string
  pages: string[]
  policyTypeHint?: PolicyType
  parsingModel?: string
}

/**
 * Processing queue for insurance documents
 */
const processingQueue: InsuranceDocumentInput[] = []
let isProcessing = false

/**
 * Queue an insurance document for processing
 * Returns immediately, processing happens in background
 */
export function queueInsuranceDocument(input: InsuranceDocumentInput): void {
  processingQueue.push(input)
  logger.debug(`[Insurance] Queued policy ${input.policyId} for processing`)
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
    await processInsuranceDocument(job)
  } catch (error) {
    logger.error('[Insurance] Processing failed:', error)
  } finally {
    isProcessing = false
    processQueue() // Process next job if any
  }
}

/**
 * Process an insurance document: parse with LLM and update policy record
 */
export async function processInsuranceDocument(input: InsuranceDocumentInput): Promise<void> {
  const { policyId, userId, pages, policyTypeHint, parsingModel } = input

  logger.debug(`[Insurance] Starting processing for policy ${policyId}`)

  // Update status to parsing
  await updatePolicy(policyId, userId, { parseStatus: 'parsing' })

  try {
    // Import the parser dynamically to avoid circular dependencies
    const { parseInsurancePolicy } = await import('../llm/insurance-parser')

    // Combine pages into raw text for storage
    const rawText = pages.map((page, idx) => `--- PAGE ${idx + 1} ---\n${page}`).join('\n\n')

    // Parse the document
    const parsed = await parseInsurancePolicy({
      pages,
      policyTypeHint,
      modelOverride: parsingModel,
    })

    // Build type-specific details object
    const details = buildDetailsFromParsed(parsed)

    // Update policy with parsed data and raw text
    await updatePolicy(policyId, userId, {
      policyType: parsed.policy_type,
      provider: parsed.provider,
      institution: parsed.institution,
      policyNumber: parsed.policy_number,
      policyHolderName: parsed.policy_holder_name,
      sumInsured: parsed.sum_insured,
      premiumAmount: parsed.premium_amount,
      premiumFrequency: parsed.premium_frequency as PremiumFrequency | null,
      startDate: parsed.start_date,
      endDate: parsed.end_date,
      status: determineStatus(parsed.end_date),
      details,
      parseStatus: 'completed',
      errorMessage: null,
      rawText,
    })

    logger.debug(
      `[Insurance] Successfully processed policy ${policyId}: ${parsed.policy_type} from ${parsed.provider}`
    )

    // Link existing transactions to this insurance policy
    try {
      const { linkTransactionsToInsurance } = await import('./entity-linking')
      await linkTransactionsToInsurance(policyId, userId, parsingModel)
      logger.debug(`[Insurance] Completed transaction linking for policy ${policyId}`)
    } catch (linkError) {
      logger.error(`[Insurance] Transaction linking failed for policy ${policyId}:`, linkError)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error'
    logger.error(`[Insurance] Failed to process policy ${policyId}:`, error)

    // Update status to failed with error message
    await updatePolicy(policyId, userId, {
      parseStatus: 'failed',
      errorMessage,
    })
  }
}

/**
 * Build the details object from parsed data based on policy type
 */
function buildDetailsFromParsed(parsed: InsurancePolicyParsed): Record<string, unknown> | null {
  switch (parsed.policy_type) {
    case 'life_insurance':
      return parsed.life_insurance_details
        ? {
            lifeInsuranceType: parsed.life_insurance_details.life_insurance_type,
            nomineeName: parsed.life_insurance_details.nominee_name,
            nomineeRelation: parsed.life_insurance_details.nominee_relation,
            deathBenefit: parsed.life_insurance_details.death_benefit,
            maturityBenefit: parsed.life_insurance_details.maturity_benefit,
            riderDetails: parsed.life_insurance_details.rider_details,
          }
        : null

    case 'health_insurance':
      return parsed.health_insurance_details
        ? {
            healthInsuranceType: parsed.health_insurance_details.health_insurance_type,
            coveredMembers: parsed.health_insurance_details.covered_members,
            roomRentLimit: parsed.health_insurance_details.room_rent_limit,
            coPayPercentage: parsed.health_insurance_details.co_pay_percentage,
            preExistingWaitingPeriod: parsed.health_insurance_details.pre_existing_waiting_period,
            networkHospitals: parsed.health_insurance_details.network_hospitals,
          }
        : null

    case 'vehicle_insurance':
      return parsed.vehicle_insurance_details
        ? {
            vehicleInsuranceType: parsed.vehicle_insurance_details.vehicle_insurance_type,
            vehicleMake: parsed.vehicle_insurance_details.vehicle_make,
            vehicleModel: parsed.vehicle_insurance_details.vehicle_model,
            vehicleYear: parsed.vehicle_insurance_details.vehicle_year,
            registrationNumber: parsed.vehicle_insurance_details.registration_number,
            idv: parsed.vehicle_insurance_details.idv,
            addOns: parsed.vehicle_insurance_details.add_ons,
          }
        : null

    default:
      return null
  }
}

/**
 * Determine policy status based on end date
 */
function determineStatus(endDate: string | null): PolicyStatus {
  if (!endDate) return 'active'

  const today = new Date()
  const policyEndDate = new Date(endDate)

  if (policyEndDate < today) {
    return 'expired'
  }

  return 'active'
}
