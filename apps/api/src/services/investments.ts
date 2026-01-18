import { eq, and, desc } from 'drizzle-orm'
import { db, tables, dbType } from '../db'
import type { Investment, NewInvestment } from '../db'
import { encryptOptional, decryptOptional } from '../lib/encryption'
import { getInvestmentTypesForCountry, type CountryCode } from '../lib/constants'
import { logger } from '../lib/logger'

/**
 * Investment service
 * Handles CRUD operations for manually declared investments
 */

/**
 * Investment response type (with decrypted fields)
 */
export interface InvestmentResponse {
  id: string
  profileId: string
  userId: string
  type: string
  institution: string | null
  name: string
  units: number | null
  purchaseValue: number | null
  currentValue: number | null
  currency: string
  folioNumber: string | null
  accountNumber: string | null // decrypted
  maturityDate: string | null
  interestRate: number | null
  notes: string | null
  createdAt: string | Date
  updatedAt: string | Date
}

/**
 * Transform investment to response format (decrypt sensitive fields)
 */
function toInvestmentResponse(investment: Investment): InvestmentResponse {
  return {
    id: investment.id,
    profileId: investment.profileId,
    userId: investment.userId,
    type: investment.type,
    institution: investment.institution,
    name: investment.name,
    units: investment.units
      ? typeof investment.units === 'string'
        ? parseFloat(investment.units)
        : Number(investment.units)
      : null,
    purchaseValue: investment.purchaseValue
      ? typeof investment.purchaseValue === 'string'
        ? parseFloat(investment.purchaseValue)
        : Number(investment.purchaseValue)
      : null,
    currentValue: investment.currentValue
      ? typeof investment.currentValue === 'string'
        ? parseFloat(investment.currentValue)
        : Number(investment.currentValue)
      : null,
    currency: investment.currency,
    folioNumber: investment.folioNumber,
    accountNumber: decryptOptional(investment.accountNumber),
    maturityDate: investment.maturityDate,
    interestRate: investment.interestRate
      ? typeof investment.interestRate === 'string'
        ? parseFloat(investment.interestRate)
        : Number(investment.interestRate)
      : null,
    notes: investment.notes,
    createdAt: investment.createdAt,
    updatedAt: investment.updatedAt,
  }
}

/**
 * Get all investments for a user
 */
export async function getInvestmentsByUserId(
  userId: string,
  profileId?: string
): Promise<InvestmentResponse[]> {
  let investments: Investment[]

  if (profileId) {
    investments = await db
      .select()
      .from(tables.investments)
      .where(
        and(eq(tables.investments.userId, userId), eq(tables.investments.profileId, profileId))
      )
      .orderBy(desc(tables.investments.createdAt))
  } else {
    investments = await db
      .select()
      .from(tables.investments)
      .where(eq(tables.investments.userId, userId))
      .orderBy(desc(tables.investments.createdAt))
  }

  return investments.map(toInvestmentResponse)
}

/**
 * Get an investment by ID (with user ownership check)
 */
export async function getInvestmentById(
  investmentId: string,
  userId: string
): Promise<InvestmentResponse | null> {
  const [investment] = await db
    .select()
    .from(tables.investments)
    .where(and(eq(tables.investments.id, investmentId), eq(tables.investments.userId, userId)))
    .limit(1)

  return investment ? toInvestmentResponse(investment) : null
}

/**
 * Get raw investment by ID (for internal use)
 */
async function getInvestmentByIdRaw(
  investmentId: string,
  userId: string
): Promise<Investment | null> {
  const [investment] = await db
    .select()
    .from(tables.investments)
    .where(and(eq(tables.investments.id, investmentId), eq(tables.investments.userId, userId)))
    .limit(1)

  return investment || null
}

/**
 * Create a new investment
 */
export async function createInvestment(data: {
  profileId: string
  userId: string
  type: string
  name: string
  currency: string
  institution?: string | null
  units?: number | null
  purchaseValue?: number | null
  currentValue?: number | null
  folioNumber?: string | null
  accountNumber?: string | null
  maturityDate?: string | null
  interestRate?: number | null
  notes?: string | null
}): Promise<InvestmentResponse> {
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  // Encrypt sensitive fields
  const encryptedAccountNumber = encryptOptional(data.accountNumber)

  const [investment] = await db
    .insert(tables.investments)
    .values({
      profileId: data.profileId,
      userId: data.userId,
      type: data.type,
      institution: data.institution || null,
      name: data.name,
      units: data.units?.toString() || null,
      purchaseValue: data.purchaseValue?.toString() || null,
      currentValue: data.currentValue?.toString() || null,
      currency: data.currency,
      folioNumber: data.folioNumber || null,
      accountNumber: encryptedAccountNumber,
      maturityDate: data.maturityDate || null,
      interestRate: data.interestRate?.toString() || null,
      notes: data.notes || null,
      createdAt: now as Date,
      updatedAt: now as Date,
    } as NewInvestment)
    .returning()

  if (!investment) {
    throw new Error('Failed to create investment')
  }

  logger.debug(`[Investment] Created investment ${investment.id} for profile ${data.profileId}`)
  return toInvestmentResponse(investment)
}

/**
 * Update an investment
 */
export async function updateInvestment(
  investmentId: string,
  userId: string,
  data: {
    type?: string
    name?: string
    institution?: string | null
    units?: number | null
    purchaseValue?: number | null
    currentValue?: number | null
    currency?: string
    folioNumber?: string | null
    accountNumber?: string | null
    maturityDate?: string | null
    interestRate?: number | null
    notes?: string | null
  }
): Promise<InvestmentResponse> {
  // Verify ownership
  const existingInvestment = await getInvestmentByIdRaw(investmentId, userId)
  if (!existingInvestment) {
    throw new Error('Investment not found')
  }

  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  // Build update object
  const updateData: Partial<Investment> = {
    updatedAt: now as Date,
  }

  if (data.type !== undefined) {
    updateData.type = data.type
  }

  if (data.name !== undefined) {
    updateData.name = data.name
  }

  if (data.institution !== undefined) {
    updateData.institution = data.institution
  }

  if (data.units !== undefined) {
    updateData.units = data.units?.toString() || null
  }

  if (data.purchaseValue !== undefined) {
    updateData.purchaseValue = data.purchaseValue?.toString() || null
  }

  if (data.currentValue !== undefined) {
    updateData.currentValue = data.currentValue?.toString() || null
  }

  if (data.currency !== undefined) {
    updateData.currency = data.currency
  }

  if (data.folioNumber !== undefined) {
    updateData.folioNumber = data.folioNumber
  }

  if (data.accountNumber !== undefined) {
    updateData.accountNumber = encryptOptional(data.accountNumber)
  }

  if (data.maturityDate !== undefined) {
    updateData.maturityDate = data.maturityDate
  }

  if (data.interestRate !== undefined) {
    updateData.interestRate = data.interestRate?.toString() || null
  }

  if (data.notes !== undefined) {
    updateData.notes = data.notes
  }

  const [updatedInvestment] = await db
    .update(tables.investments)
    .set(updateData)
    .where(eq(tables.investments.id, investmentId))
    .returning()

  if (!updatedInvestment) {
    throw new Error('Failed to update investment')
  }

  logger.debug(`[Investment] Updated investment ${investmentId}`)
  return toInvestmentResponse(updatedInvestment)
}

/**
 * Delete an investment
 */
export async function deleteInvestment(investmentId: string, userId: string): Promise<void> {
  // Verify ownership
  const existingInvestment = await getInvestmentByIdRaw(investmentId, userId)
  if (!existingInvestment) {
    throw new Error('Investment not found')
  }

  await db.delete(tables.investments).where(eq(tables.investments.id, investmentId))

  logger.debug(`[Investment] Deleted investment ${investmentId}`)
}

/**
 * Get investment summary/stats for a user
 */
export async function getInvestmentSummary(
  userId: string,
  profileId?: string
): Promise<{
  totalPurchaseValue: number
  totalCurrentValue: number
  totalGainLoss: number
  gainLossPercentage: number
  byType: { type: string; count: number; purchaseValue: number; currentValue: number }[]
  byCurrency: { currency: string; purchaseValue: number; currentValue: number }[]
}> {
  const investments = await getInvestmentsByUserId(userId, profileId)

  let totalPurchaseValue = 0
  let totalCurrentValue = 0
  const typeMap = new Map<string, { count: number; purchaseValue: number; currentValue: number }>()
  const currencyMap = new Map<string, { purchaseValue: number; currentValue: number }>()

  for (const inv of investments) {
    const purchase = inv.purchaseValue || 0
    const current = inv.currentValue || 0

    totalPurchaseValue += purchase
    totalCurrentValue += current

    // By type
    const typeData = typeMap.get(inv.type) || { count: 0, purchaseValue: 0, currentValue: 0 }
    typeData.count++
    typeData.purchaseValue += purchase
    typeData.currentValue += current
    typeMap.set(inv.type, typeData)

    // By currency
    const currencyData = currencyMap.get(inv.currency) || { purchaseValue: 0, currentValue: 0 }
    currencyData.purchaseValue += purchase
    currencyData.currentValue += current
    currencyMap.set(inv.currency, currencyData)
  }

  const totalGainLoss = totalCurrentValue - totalPurchaseValue
  const gainLossPercentage = totalPurchaseValue > 0 ? (totalGainLoss / totalPurchaseValue) * 100 : 0

  return {
    totalPurchaseValue,
    totalCurrentValue,
    totalGainLoss,
    gainLossPercentage,
    byType: Array.from(typeMap.entries())
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.currentValue - a.currentValue),
    byCurrency: Array.from(currencyMap.entries())
      .map(([currency, data]) => ({ currency, ...data }))
      .sort((a, b) => b.currentValue - a.currentValue),
  }
}

/**
 * Get investment types for a country
 */
export function getInvestmentTypes(countryCode: CountryCode) {
  return getInvestmentTypesForCountry(countryCode)
}
