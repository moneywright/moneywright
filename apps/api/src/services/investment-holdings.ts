import { eq, and, desc } from 'drizzle-orm'
import { db, tables, dbType } from '../db'
import type { InvestmentHolding, NewInvestmentHolding } from '../db'
import { logger } from '../lib/logger'
import { fetchFxRates } from './fx-rates'

/**
 * Investment Holdings service
 * Handles CRUD operations for investment holdings
 */

/**
 * Holding response type
 */
export interface InvestmentHoldingResponse {
  id: string
  sourceId: string | null
  profileId: string
  userId: string
  investmentType: string
  symbol: string | null
  name: string
  isin: string | null
  units: number | null // null for balance-based holdings like PPF, EPF, FD
  averageCost: number | null
  currentPrice: number | null
  currentValue: number
  investedValue: number | null
  gainLoss: number | null
  gainLossPercent: number | null
  folioNumber: string | null
  maturityDate: string | null
  interestRate: number | null
  currency: string
  asOfDate: string
  createdAt: string | Date
  updatedAt: string | Date
}

/**
 * Transform holding to response format
 */
function toHoldingResponse(holding: InvestmentHolding): InvestmentHoldingResponse {
  const parseNum = (val: string | number | null | undefined): number | null => {
    if (val === null || val === undefined) return null
    return typeof val === 'string' ? parseFloat(val) : Number(val)
  }

  return {
    id: holding.id,
    sourceId: holding.sourceId,
    profileId: holding.profileId,
    userId: holding.userId,
    investmentType: holding.investmentType,
    symbol: holding.symbol,
    name: holding.name,
    isin: holding.isin,
    units: parseNum(holding.units),
    averageCost: parseNum(holding.averageCost),
    currentPrice: parseNum(holding.currentPrice),
    currentValue: parseNum(holding.currentValue) ?? 0,
    investedValue: parseNum(holding.investedValue),
    gainLoss: parseNum(holding.gainLoss),
    gainLossPercent: parseNum(holding.gainLossPercent),
    folioNumber: holding.folioNumber,
    maturityDate: holding.maturityDate,
    interestRate: parseNum(holding.interestRate),
    currency: holding.currency,
    asOfDate: holding.asOfDate,
    createdAt: holding.createdAt,
    updatedAt: holding.updatedAt,
  }
}

/**
 * Get all holdings for a user
 */
export async function getHoldingsByUserId(
  userId: string,
  options?: {
    profileId?: string
    sourceId?: string
  }
): Promise<InvestmentHoldingResponse[]> {
  let query = db
    .select()
    .from(tables.investmentHoldings)
    .where(eq(tables.investmentHoldings.userId, userId))
    .$dynamic()

  if (options?.profileId) {
    query = query.where(
      and(
        eq(tables.investmentHoldings.userId, userId),
        eq(tables.investmentHoldings.profileId, options.profileId)
      )
    )
  }

  if (options?.sourceId) {
    query = query.where(
      and(
        eq(tables.investmentHoldings.userId, userId),
        eq(tables.investmentHoldings.sourceId, options.sourceId)
      )
    )
  }

  const holdings = await query.orderBy(desc(tables.investmentHoldings.currentValue))

  return holdings.map(toHoldingResponse)
}

/**
 * Get holdings by source ID
 */
export async function getHoldingsBySourceId(
  sourceId: string,
  userId: string
): Promise<InvestmentHoldingResponse[]> {
  const holdings = await db
    .select()
    .from(tables.investmentHoldings)
    .where(
      and(
        eq(tables.investmentHoldings.sourceId, sourceId),
        eq(tables.investmentHoldings.userId, userId)
      )
    )
    .orderBy(desc(tables.investmentHoldings.currentValue))

  return holdings.map(toHoldingResponse)
}

/**
 * Get a holding by ID
 */
export async function getHoldingById(
  holdingId: string,
  userId: string
): Promise<InvestmentHoldingResponse | null> {
  const [holding] = await db
    .select()
    .from(tables.investmentHoldings)
    .where(
      and(eq(tables.investmentHoldings.id, holdingId), eq(tables.investmentHoldings.userId, userId))
    )
    .limit(1)

  return holding ? toHoldingResponse(holding) : null
}

/**
 * Create a new holding
 */
export async function createHolding(data: {
  sourceId?: string | null
  profileId: string
  userId: string
  investmentType: string
  name: string
  units: number | null // null for balance-based like PPF, EPF, FD
  currentValue: number
  currency: string
  asOfDate: string
  symbol?: string | null
  isin?: string | null
  averageCost?: number | null
  currentPrice?: number | null
  investedValue?: number | null
  gainLoss?: number | null
  gainLossPercent?: number | null
  folioNumber?: string | null
  maturityDate?: string | null
  interestRate?: number | null
}): Promise<InvestmentHoldingResponse> {
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  const [holding] = await db
    .insert(tables.investmentHoldings)
    .values({
      sourceId: data.sourceId || null,
      profileId: data.profileId,
      userId: data.userId,
      investmentType: data.investmentType,
      symbol: data.symbol || null,
      name: data.name,
      isin: data.isin || null,
      units: data.units?.toString() || null,
      averageCost: data.averageCost?.toString() || null,
      currentPrice: data.currentPrice?.toString() || null,
      currentValue: data.currentValue.toString(),
      investedValue: data.investedValue?.toString() || null,
      gainLoss: data.gainLoss?.toString() || null,
      gainLossPercent: data.gainLossPercent?.toString() || null,
      folioNumber: data.folioNumber || null,
      maturityDate: data.maturityDate || null,
      interestRate: data.interestRate?.toString() || null,
      currency: data.currency,
      asOfDate: data.asOfDate,
      createdAt: now as Date,
      updatedAt: now as Date,
    } as NewInvestmentHolding)
    .returning()

  if (!holding) {
    throw new Error('Failed to create holding')
  }

  logger.debug(`[InvestmentHolding] Created holding ${holding.id}`)
  return toHoldingResponse(holding)
}

/**
 * Update a holding
 */
export async function updateHolding(
  holdingId: string,
  userId: string,
  data: Partial<{
    investmentType: string
    name: string
    symbol: string | null
    isin: string | null
    units: number | null
    averageCost: number | null
    currentPrice: number | null
    currentValue: number
    investedValue: number | null
    gainLoss: number | null
    gainLossPercent: number | null
    folioNumber: string | null
    maturityDate: string | null
    interestRate: number | null
    currency: string
    asOfDate: string
  }>
): Promise<InvestmentHoldingResponse> {
  const existing = await getHoldingById(holdingId, userId)
  if (!existing) {
    throw new Error('Holding not found')
  }

  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  const updateData: Partial<InvestmentHolding> = {
    updatedAt: now as Date,
  }

  if (data.investmentType !== undefined) updateData.investmentType = data.investmentType
  if (data.name !== undefined) updateData.name = data.name
  if (data.symbol !== undefined) updateData.symbol = data.symbol
  if (data.isin !== undefined) updateData.isin = data.isin
  if (data.units !== undefined) updateData.units = data.units?.toString() || null
  if (data.averageCost !== undefined) updateData.averageCost = data.averageCost?.toString() || null
  if (data.currentPrice !== undefined)
    updateData.currentPrice = data.currentPrice?.toString() || null
  if (data.currentValue !== undefined) updateData.currentValue = data.currentValue.toString()
  if (data.investedValue !== undefined)
    updateData.investedValue = data.investedValue?.toString() || null
  if (data.gainLoss !== undefined) updateData.gainLoss = data.gainLoss?.toString() || null
  if (data.gainLossPercent !== undefined)
    updateData.gainLossPercent = data.gainLossPercent?.toString() || null
  if (data.folioNumber !== undefined) updateData.folioNumber = data.folioNumber
  if (data.maturityDate !== undefined) updateData.maturityDate = data.maturityDate
  if (data.interestRate !== undefined)
    updateData.interestRate = data.interestRate?.toString() || null
  if (data.currency !== undefined) updateData.currency = data.currency
  if (data.asOfDate !== undefined) updateData.asOfDate = data.asOfDate

  const [updated] = await db
    .update(tables.investmentHoldings)
    .set(updateData)
    .where(eq(tables.investmentHoldings.id, holdingId))
    .returning()

  if (!updated) {
    throw new Error('Failed to update holding')
  }

  logger.debug(`[InvestmentHolding] Updated holding ${holdingId}`)
  return toHoldingResponse(updated)
}

/**
 * Delete a holding
 */
export async function deleteHolding(holdingId: string, userId: string): Promise<void> {
  const existing = await getHoldingById(holdingId, userId)
  if (!existing) {
    throw new Error('Holding not found')
  }

  await db.delete(tables.investmentHoldings).where(eq(tables.investmentHoldings.id, holdingId))
  logger.debug(`[InvestmentHolding] Deleted holding ${holdingId}`)
}

/**
 * Delete all holdings for a source
 */
export async function deleteHoldingsBySourceId(sourceId: string): Promise<number> {
  const result = await db
    .delete(tables.investmentHoldings)
    .where(eq(tables.investmentHoldings.sourceId, sourceId))
    .returning()

  logger.debug(`[InvestmentHolding] Deleted ${result.length} holdings for source ${sourceId}`)
  return result.length
}

/**
 * Bulk upsert holdings for a source (replace all strategy)
 * Used when importing new statement - replaces all existing holdings
 */
export async function replaceHoldingsForSource(
  sourceId: string,
  userId: string,
  profileId: string,
  holdings: Array<{
    investmentType: string
    name: string
    units: number | null // null for balance-based like PPF, EPF, FD
    currentValue: number
    currency: string
    asOfDate: string
    symbol?: string | null
    isin?: string | null
    averageCost?: number | null
    currentPrice?: number | null
    investedValue?: number | null
    gainLoss?: number | null
    gainLossPercent?: number | null
    folioNumber?: string | null
    maturityDate?: string | null
    interestRate?: number | null
  }>
): Promise<InvestmentHoldingResponse[]> {
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  // Delete existing holdings for this source
  await deleteHoldingsBySourceId(sourceId)

  // Insert new holdings
  if (holdings.length === 0) {
    return []
  }

  const values = holdings.map((h) => ({
    sourceId,
    profileId,
    userId,
    investmentType: h.investmentType,
    symbol: h.symbol || null,
    name: h.name,
    isin: h.isin || null,
    units: h.units?.toString() || null,
    averageCost: h.averageCost?.toString() || null,
    currentPrice: h.currentPrice?.toString() || null,
    currentValue: h.currentValue.toString(),
    investedValue: h.investedValue?.toString() || null,
    gainLoss: h.gainLoss?.toString() || null,
    gainLossPercent: h.gainLossPercent?.toString() || null,
    folioNumber: h.folioNumber || null,
    maturityDate: h.maturityDate || null,
    interestRate: h.interestRate?.toString() || null,
    currency: h.currency,
    asOfDate: h.asOfDate,
    createdAt: now as Date,
    updatedAt: now as Date,
  }))

  const inserted = await db
    .insert(tables.investmentHoldings)
    .values(values as NewInvestmentHolding[])
    .returning()

  logger.debug(
    `[InvestmentHolding] Replaced holdings for source ${sourceId}: ${inserted.length} holdings`
  )
  return inserted.map(toHoldingResponse)
}

/**
 * Get investment summary for a user
 * All values are converted to INR for consistent totals
 */
export async function getInvestmentSummary(
  userId: string,
  profileId?: string
): Promise<{
  totalInvested: number
  totalCurrent: number
  totalGainLoss: number
  gainLossPercent: number
  holdingsCount: number
  sourcesCount: number
  byType: Array<{
    type: string
    count: number
    invested: number
    current: number
    gainLoss: number
  }>
  byCurrency: Array<{
    currency: string
    invested: number
    current: number
  }>
}> {
  const holdings = await getHoldingsByUserId(userId, { profileId })

  // Build FX rates map for currency conversion to INR
  // We need rates from USD to INR, EUR to INR, etc.
  const fxRates: Record<string, number> = { INR: 1 }
  const uniqueCurrencies = new Set(holdings.map((h) => h.currency.toUpperCase()))

  // Fetch FX rates if we have non-INR holdings
  if (uniqueCurrencies.size > 1 || !uniqueCurrencies.has('INR')) {
    try {
      // Fetch USD-based rates (most common base)
      const usdRates = await fetchFxRates('usd')
      const usdToInr = usdRates.rates['inr'] || 83 // fallback

      // USD to INR
      fxRates['USD'] = usdToInr

      // For other currencies, calculate via USD
      // EUR to INR = USD/EUR rate inverted * USD to INR
      if (usdRates.rates['eur']) {
        fxRates['EUR'] = usdToInr / usdRates.rates['eur']
      }
      if (usdRates.rates['gbp']) {
        fxRates['GBP'] = usdToInr / usdRates.rates['gbp']
      }
      if (usdRates.rates['jpy']) {
        fxRates['JPY'] = usdToInr / usdRates.rates['jpy']
      }
      if (usdRates.rates['aud']) {
        fxRates['AUD'] = usdToInr / usdRates.rates['aud']
      }
      if (usdRates.rates['cad']) {
        fxRates['CAD'] = usdToInr / usdRates.rates['cad']
      }
      if (usdRates.rates['sgd']) {
        fxRates['SGD'] = usdToInr / usdRates.rates['sgd']
      }

      logger.debug(`[InvestmentSummary] FX rates loaded: USD/INR=${usdToInr}`)
    } catch (error) {
      logger.warn(`[InvestmentSummary] Failed to fetch FX rates, using fallback values`)
      // Fallback rates
      fxRates['USD'] = 83
      fxRates['EUR'] = 90
      fxRates['GBP'] = 105
    }
  }

  // Helper to convert to INR
  const toINR = (amount: number, currency: string): number => {
    const rate = fxRates[currency.toUpperCase()]
    if (rate) return amount * rate
    // If unknown currency, assume it's already in INR or use 1:1
    logger.warn(`[InvestmentSummary] Unknown currency ${currency}, using 1:1 rate`)
    return amount
  }

  let totalInvested = 0
  let totalCurrent = 0
  let totalCurrentWithInvested = 0 // Only current value of holdings that have invested value
  const typeMap = new Map<
    string,
    { count: number; invested: number; current: number; gainLoss: number }
  >()
  const currencyMap = new Map<string, { invested: number; current: number }>()
  const sourceIds = new Set<string>()

  for (const h of holdings) {
    const current = h.currentValue || 0
    const hasValidInvested = h.investedValue !== null && h.investedValue > 0
    const invested = hasValidInvested ? h.investedValue! : 0

    // Convert to INR for totals
    const investedINR = toINR(invested, h.currency)
    const currentINR = toINR(current, h.currency)

    // For gain calculations, only include holdings with valid invested value
    if (hasValidInvested) {
      totalInvested += investedINR
      totalCurrentWithInvested += currentINR
    }

    // Total current always includes all holdings
    totalCurrent += currentINR

    // Track unique sources
    if (h.sourceId) {
      sourceIds.add(h.sourceId)
    }

    // By type (in INR) - only include invested if valid
    const typeData = typeMap.get(h.investmentType) || {
      count: 0,
      invested: 0,
      current: 0,
      gainLoss: 0,
    }
    typeData.count++
    typeData.invested += investedINR
    typeData.current += currentINR
    if (hasValidInvested) {
      typeData.gainLoss += currentINR - investedINR
    }
    typeMap.set(h.investmentType, typeData)

    // By currency (original currency values)
    const currData = currencyMap.get(h.currency) || { invested: 0, current: 0 }
    currData.invested += invested
    currData.current += current
    currencyMap.set(h.currency, currData)
  }

  // Gain/loss is calculated only from holdings with valid invested values
  const totalGainLoss = totalCurrentWithInvested - totalInvested
  const gainLossPercent = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0

  return {
    totalInvested,
    totalCurrent,
    totalGainLoss,
    gainLossPercent,
    holdingsCount: holdings.length,
    sourcesCount: sourceIds.size,
    byType: Array.from(typeMap.entries())
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.current - a.current),
    byCurrency: Array.from(currencyMap.entries())
      .map(([currency, data]) => ({ currency, ...data }))
      .sort((a, b) => b.current - a.current),
  }
}
