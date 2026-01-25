/**
 * Investment statement parsing using LLM with intelligent caching
 *
 * ARCHITECTURE:
 * 1. Send full PDF to LLM → get document info (type, source, summary)
 * 2. Check app_config for cached parser code for this source type
 * 3. If cached: try all versions (latest first) until one works
 * 4. If no cache or all fail: generate new code, save as new version
 * 5. Replace all holdings for the source (replace-all strategy)
 * 6. Create snapshot for the statement date
 */

import { generateObject } from 'ai'
import { createLLMClientFromSettings } from './index'
import {
  documentInfoSchema,
  investmentMetadataSchema,
  type DocumentInfo,
  type InvestmentSourceType,
  type InvestmentMetadata,
} from './schemas'
import {
  getInvestmentSourceTypesForCountry,
  INVESTMENT_SOURCE_TYPES,
  type CountryCode,
  type FileType,
} from '../lib/constants'
import { db, tables, dbType } from '../db'
import { eq } from 'drizzle-orm'
import {
  findSourceByTypeAndIdentifier,
  createSource,
  updateSource,
} from '../services/investment-sources'
import { replaceHoldingsForSource } from '../services/investment-holdings'
import { upsertSnapshot, type SnapshotHoldingDetail } from '../services/investment-snapshots'
import { logger } from '../lib/logger'
import {
  generateInvestmentParserCode,
  generateInvestmentSourceKey,
  getInvestmentParserCodes,
  saveInvestmentParserCode,
  runInvestmentParserWithVersions,
  type RawInvestmentHolding,
  type ExpectedInvestmentSummary,
} from '../lib/pdf'

/**
 * Maximum characters for document info extraction
 */
const MAX_DOCUMENT_INFO_LENGTH = 80000

/**
 * Combine all pages into a single text with page markers
 */
function combinePages(pages: string[]): string {
  return pages.map((page, idx) => `\n--- PAGE ${idx + 1} ---\n${page}`).join('\n')
}

/**
 * Truncate text to a maximum length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text

  const truncated = text.slice(0, maxLength)
  const lastNewline = truncated.lastIndexOf('\n')
  if (lastNewline > maxLength * 0.7) {
    return truncated.slice(0, lastNewline) + '\n[...truncated]'
  }

  return truncated + '...[truncated]'
}

/**
 * Extract document info from the FULL statement
 * Detects document type (bank/credit card/investment) and extracts relevant metadata
 */
export async function extractDocumentInfo(
  fullText: string,
  countryCode: CountryCode,
  modelOverride?: string
): Promise<DocumentInfo> {
  logger.debug(
    `[InvestmentParser] Extracting document info, model: ${modelOverride || 'default'}, text length: ${fullText.length}`
  )

  const truncatedText = truncateText(fullText, MAX_DOCUMENT_INFO_LENGTH)
  if (truncatedText.length < fullText.length) {
    logger.debug(
      `[InvestmentParser] Document info text truncated from ${fullText.length} to ${truncatedText.length} chars`
    )
  }

  const model = await createLLMClientFromSettings(modelOverride)
  const sourceTypes = getInvestmentSourceTypesForCountry(countryCode)
  const sourceTypeList = sourceTypes.map((t) => `${t.code}: ${t.label}`).join(', ')

  const prompt = `Analyze this financial document and extract information.

DOCUMENT TEXT:
${truncatedText}

=== STEP 1: DETECT DOCUMENT TYPE ===
Determine what type of document this is:

1. **bank_statement**: A statement from a bank showing transactions in a savings, current, or checking account.
   - Has transaction history with dates, descriptions, amounts
   - Shows running balance
   - From banks like HDFC, ICICI, SBI, etc.

2. **credit_card_statement**: A credit card billing statement.
   - Shows card transactions, total due, minimum due
   - Has payment due date
   - From credit card issuers

3. **investment_statement**: A portfolio/holdings statement showing investments.
   - Shows stocks, mutual funds, ETFs, bonds, PPF, EPF, NPS, FD holdings
   - From brokers like Zerodha, Groww, or fund houses
   - Has units/shares, current value, NAV
   - CAS (Consolidated Account Statement) from CAMS/KFintech/MF Central
   - Passbooks for PPF, EPF
   - NPS statements

=== STEP 2: EXTRACT INFORMATION BASED ON TYPE ===

**For bank_statement / credit_card_statement:**
- Extract bank name, account number, account type
- Extract statement period dates
- Extract summary (opening/closing balance, transaction counts, totals)
- Leave investment fields as null

**For investment_statement:**
- Identify the source platform from: ${sourceTypeList}
- Extract source name (human readable like "Zerodha Holdings")
- Extract account identifier (Demat ID, Client ID, PAN, Folio number)
- Extract statement date (as-of date for holdings)
- Identify if it has holdings table and/or transaction history
- Extract portfolio summary if shown (total invested, current value, holdings count)
- Leave bank/credit card fields as null

=== IMPORTANT RULES ===
- All dates should be in YYYY-MM-DD format
- All amounts should be numbers (not strings), remove commas
- For nullable fields, return null if not found
- Be accurate - the document type determines which parsing flow to use`

  logger.debug(`[InvestmentParser] Document info prompt length: ${prompt.length} chars`)

  try {
    const { object } = await generateObject({
      model,
      schema: documentInfoSchema,
      prompt,
    })

    logger.debug(
      `[InvestmentParser] Document info extracted: type=${object.document_type}, source=${object.source_type || 'N/A'}`
    )
    logger.debug(`[InvestmentParser] Document info:`, JSON.stringify(object, null, 2))
    return object
  } catch (error) {
    logger.error(`[InvestmentParser] Error extracting document info:`, error)
    throw error
  }
}

/**
 * Get proper display name for a source type
 * Returns the label from constants with correct casing (e.g., "EPF" not "Epf")
 */
function getSourceTypeDisplayName(sourceType: string, countryCode: CountryCode): string {
  const sourceTypes = INVESTMENT_SOURCE_TYPES[countryCode] || INVESTMENT_SOURCE_TYPES.IN
  const found = sourceTypes.find((t) => t.code === sourceType)
  return found?.label || sourceType.toUpperCase()
}

/**
 * Generate a proper source name from source type and institution
 * Format: "Source Type - Institution" or just "Source Type" if no institution or same as type
 */
function generateSourceName(
  sourceType: string,
  institution: string | null,
  countryCode: CountryCode
): string {
  const typeName = getSourceTypeDisplayName(sourceType, countryCode)

  if (institution && institution.trim()) {
    const cleanInstitution = institution.trim()
    // Avoid duplication like "Zerodha - Zerodha" or "MF Central - MF Central"
    if (cleanInstitution.toLowerCase() === typeName.toLowerCase()) {
      return typeName
    }
    return `${typeName} - ${cleanInstitution}`
  }

  return typeName
}

/**
 * Extract investment metadata from statement text
 * Used to get account identifier, institution, and summary for proper source creation
 */
export async function extractInvestmentMetadata(
  fullText: string,
  sourceType: string,
  countryCode: CountryCode,
  modelOverride?: string
): Promise<InvestmentMetadata> {
  logger.debug(
    `[InvestmentParser] Extracting investment metadata for ${sourceType}, model: ${modelOverride || 'default'}`
  )

  const truncatedText = truncateText(fullText, MAX_DOCUMENT_INFO_LENGTH)

  const model = await createLLMClientFromSettings(modelOverride)

  // Build source-specific hints for better extraction
  const sourceHints = getSourceSpecificHints(sourceType)

  const prompt = `Extract metadata from this ${sourceType.toUpperCase()} investment statement.

DOCUMENT TEXT:
${truncatedText}

=== EXTRACTION TASK ===

${sourceHints}

=== IMPORTANT RULES ===
- Extract the EXACT account identifier as shown in the document
- For dates, use YYYY-MM-DD format
- For amounts, use numbers without commas
- Return null for fields not found in the document
- Be precise - this metadata is used to identify unique accounts`

  try {
    const { object } = await generateObject({
      model,
      schema: investmentMetadataSchema,
      prompt,
    })

    logger.debug(
      `[InvestmentParser] Metadata extracted: identifier=${object.account_identifier || 'N/A'}, institution=${object.institution || 'N/A'}`
    )
    logger.debug(`[InvestmentParser] Metadata:`, JSON.stringify(object, null, 2))
    return object
  } catch (error) {
    logger.error(`[InvestmentParser] Error extracting metadata:`, error)
    // Return empty metadata on error - parser will continue with defaults
    return {
      account_identifier: null,
      institution: null,
      statement_date: null,
      summary: null,
    }
  }
}

/**
 * Get source-type-specific extraction hints
 */
function getSourceSpecificHints(sourceType: string): string {
  const hints: Record<string, string> = {
    epf: `**EPF Statement:**
- account_identifier: Extract the Member ID (UAN format like "TNMAS00123456789012" or member ID)
- institution: Extract the employer/establishment name
- Look for "Member ID", "UAN", "Establishment Name"`,

    ppf: `**PPF Statement:**
- account_identifier: Extract the PPF Account Number
- institution: Extract the bank name where PPF is held (e.g., "SBI", "HDFC Bank", "Post Office")
- Look for "Account No", "Account Number", bank header/logo`,

    nps: `**NPS Statement:**
- account_identifier: Extract the PRAN (Permanent Retirement Account Number)
- institution: Extract the POP (Point of Presence) or fund manager name
- Look for "PRAN", "Subscriber Name"`,

    zerodha: `**Zerodha Statement:**
- account_identifier: Extract the Client ID or Demat Account number
- institution: Should be "Zerodha"
- Look for "Client ID", "DP ID", "Demat Account"`,

    groww: `**Groww Statement:**
- account_identifier: Extract the Demat Account or Client ID
- institution: Should be "Groww"
- Look for "Demat Account", "Client ID", "DP ID"`,

    mf_central: `**MF Central CAS Statement:**
- account_identifier: Extract the PAN number
- institution: Can be "Various" if multiple AMCs, or specific AMC name
- Look for "PAN", "Consolidated Account Statement"`,

    cams: `**CAMS Statement:**
- account_identifier: Extract PAN or primary Folio number
- institution: Extract AMC name or "Various" if multiple
- Look for "PAN", "Folio", "AMC"`,

    fd: `**Fixed Deposit Statement:**
- account_identifier: Extract FD account/receipt number
- institution: Extract bank/NBFC name
- Look for "FD No", "Deposit No", "Receipt No"`,
  }

  return (
    hints[sourceType] ||
    `**${sourceType.toUpperCase()} Statement:**
- account_identifier: Extract any unique account/client/member ID
- institution: Extract the platform/bank/company name
- Look for account numbers, client IDs, or member IDs`
  )
}

/**
 * Parse an investment statement
 *
 * Flow:
 * 1. Extract investment metadata (account identifier, institution, summary)
 * 2. Create or find investment source (using account identifier for uniqueness)
 * 3. Check for cached parser code
 * 4. Try cached versions or generate new
 * 5. Replace holdings for source
 * 6. Create snapshot
 */
export async function parseInvestmentStatement(options: {
  statementId: string
  profileId: string
  userId: string
  countryCode: CountryCode
  pages: string[]
  /** File type (pdf, csv, xlsx) - affects cache key and parsing strategy */
  fileType: FileType
  documentInfo: DocumentInfo | null
  /** User-specified source type (takes precedence over documentInfo) */
  sourceType?: string
  parsingModel?: string
}): Promise<{
  sourceId: string
  holdingsCount: number
  snapshotId: string
}> {
  const { statementId, profileId, userId, countryCode, pages, documentInfo, parsingModel } = options

  // Get fileType from options, or fallback to fetching from the statement record
  let fileType = options.fileType
  if (!fileType) {
    const [stmt] = await db
      .select({ fileType: tables.statements.fileType })
      .from(tables.statements)
      .where(eq(tables.statements.id, statementId))
      .limit(1)
    fileType = (stmt?.fileType as FileType) || 'pdf'
    logger.warn(`[InvestmentParser] fileType not provided, fetched from DB: ${fileType}`)
  }

  // Use user-specified sourceType if provided, otherwise fall back to documentInfo
  const effectiveSourceType = options.sourceType || documentInfo?.source_type || 'other'

  const parseStartTime = Date.now()
  logger.debug(
    `[InvestmentParser] Starting parse for statement ${statementId}, source: ${effectiveSourceType} (user-specified: ${!!options.sourceType})`
  )

  // Combine all pages
  const fullText = combinePages(pages)
  logger.debug(`[InvestmentParser] Combined ${pages.length} pages into ${fullText.length} chars`)

  // Step 1: Extract investment metadata (account identifier, institution, summary)
  // This is critical for creating separate sources for different accounts of the same type
  const metadata = await extractInvestmentMetadata(
    fullText,
    effectiveSourceType,
    countryCode,
    parsingModel
  )

  // Use extracted metadata, falling back to documentInfo if available
  const accountIdentifier = metadata.account_identifier || documentInfo?.account_identifier || null
  const institution = metadata.institution || null
  const statementDateFromMetadata =
    metadata.statement_date || documentInfo?.statement_date || documentInfo?.period_end

  // Step 2: Create or find investment source using account identifier for uniqueness
  const sourceType = effectiveSourceType

  let source = await findSourceByTypeAndIdentifier(userId, profileId, sourceType, accountIdentifier)

  if (source) {
    logger.debug(
      `[InvestmentParser] Found existing source ${source.id} for ${sourceType} (identifier: ${accountIdentifier || 'N/A'})`
    )

    // Update institution if we extracted a new one and source doesn't have it
    if (institution && !source.institution) {
      const updatedSourceName = generateSourceName(sourceType, institution, countryCode)
      await updateSource(source.id, userId, {
        institution,
        sourceName: updatedSourceName,
      })
      logger.debug(`[InvestmentParser] Updated source with institution: ${institution}`)
    }
  } else {
    // Create new source with proper naming
    const currency = countryCode === 'US' ? 'USD' : 'INR'
    const sourceName = generateSourceName(sourceType, institution, countryCode)

    source = await createSource({
      profileId,
      userId,
      sourceType,
      sourceName,
      institution,
      accountIdentifier,
      countryCode,
      currency,
    })
    logger.debug(
      `[InvestmentParser] Created new source ${source.id}: "${sourceName}" (identifier: ${accountIdentifier || 'N/A'})`
    )
  }

  // Update statement with source ID
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()
  await db
    .update(tables.statements)
    .set({
      sourceId: source.id,
      documentType: 'investment_statement',
      updatedAt: now as Date,
    })
    .where(eq(tables.statements.id, statementId))

  // Step 2: Generate source key for caching (includes file type)
  // Skip caching for "other" source type since it's too generic
  const shouldCache = sourceType !== 'other'
  const sourceKey = generateInvestmentSourceKey(sourceType, fileType)
  logger.debug(
    `[InvestmentParser] Source key: ${sourceKey} (file type: ${fileType}, caching: ${shouldCache})`
  )

  // Build expected summary for validation (prefer metadata, fall back to documentInfo)
  const summarySource = metadata.summary || documentInfo?.investment_summary
  const expectedSummary: ExpectedInvestmentSummary | undefined = summarySource
    ? {
        totalInvested: summarySource.total_invested,
        totalCurrent: summarySource.total_current,
        holdingsCount: summarySource.holdings_count,
      }
    : undefined

  // Step 3: Check for cached parser code (skip for "other" source type)
  let rawHoldings: RawInvestmentHolding[] = []
  let usedCachedCode = false

  if (shouldCache) {
    const cachedCodes = await getInvestmentParserCodes(sourceKey)
    if (cachedCodes.length > 0) {
      logger.debug(
        `[InvestmentParser] Found ${cachedCodes.length} cached parser versions for ${sourceKey}`
      )

      const result = await runInvestmentParserWithVersions(
        cachedCodes,
        fullText,
        sourceKey,
        expectedSummary
      )

      if (result.success && result.holdings && result.holdings.length > 0) {
        rawHoldings = result.holdings
        usedCachedCode = true
        const validationStatus = result.validationPassed
          ? 'validation passed'
          : 'no validation data'
        logger.debug(
          `[InvestmentParser] Used cached code v${result.usedVersion}: ${rawHoldings.length} holdings (${validationStatus})`
        )
      } else {
        logger.warn(
          `[InvestmentParser] All ${cachedCodes.length} cached versions failed (tried: ${result.triedVersions.join(', ')}), generating new code`
        )
      }
    } else {
      logger.debug(`[InvestmentParser] No cached parser code for ${sourceKey}`)
    }
  } else {
    logger.debug(`[InvestmentParser] Skipping cache lookup for "other" source type`)
  }

  // Step 4: Generate new code if no cache or all cached versions failed
  if (!usedCachedCode) {
    logger.debug(`[InvestmentParser] Generating new parser code with agentic retry...`)

    const agentResult = await generateInvestmentParserCode(
      fullText,
      parsingModel,
      sourceType as InvestmentSourceType,
      expectedSummary,
      fileType
    )

    logger.debug(
      `[InvestmentParser] Generated code for format: ${agentResult.detectedFormat} (confidence: ${agentResult.confidence}, attempts: ${agentResult.attempts})`
    )

    // Check if agent succeeded
    if (agentResult.finalError || !agentResult.holdings || agentResult.holdings.length === 0) {
      logger.error(
        `[InvestmentParser] Agent failed after ${agentResult.attempts} attempts: ${agentResult.finalError || 'No holdings found'}`
      )
      throw new Error(
        `Investment parser generation failed: ${agentResult.finalError || 'No holdings found'}`
      )
    }

    // Use holdings from the successful test run
    rawHoldings = agentResult.holdings
    logger.debug(`[InvestmentParser] Using ${rawHoldings.length} holdings from agent test run`)

    // Save new code as new version (skip for "other" source type)
    if (shouldCache) {
      const newVersion = await saveInvestmentParserCode(sourceKey, agentResult.code, {
        detectedFormat: agentResult.detectedFormat,
        confidence: agentResult.confidence,
      })
      logger.debug(`[InvestmentParser] Saved parser code as ${sourceKey} v${newVersion}`)
    } else {
      logger.debug(`[InvestmentParser] Skipping cache save for "other" source type`)
    }
  }

  if (rawHoldings.length === 0) {
    throw new Error('No holdings found in investment statement')
  }

  // Step 5: Replace holdings for source (replace-all strategy)
  const statementDate: string = statementDateFromMetadata || new Date().toISOString().split('T')[0]!
  const sourceCurrency = source.currency

  // Check if any holdings have a detected currency different from source
  // If so, update the source currency to match (for brokers like Vested that are USD)
  const detectedCurrencies = new Set(rawHoldings.map((h) => h.currency).filter(Boolean))
  if (detectedCurrencies.size === 1) {
    const detectedCurrency = Array.from(detectedCurrencies)[0]!
    if (detectedCurrency !== sourceCurrency) {
      logger.debug(
        `[InvestmentParser] Detected currency ${detectedCurrency} differs from source currency ${sourceCurrency}, updating source`
      )
      await updateSource(source.id, userId, { currency: detectedCurrency })
      source.currency = detectedCurrency
    }
  }

  const holdingsData = rawHoldings.map((h) => {
    // Use holding-level currency if detected, otherwise fall back to source currency
    const holdingCurrency = h.currency || source.currency

    return {
      investmentType: h.investment_type,
      name: h.name,
      units: h.units,
      currentValue: h.current_value,
      currency: holdingCurrency,
      asOfDate: statementDate,
      symbol: h.symbol,
      isin: h.isin,
      averageCost: h.average_cost,
      currentPrice: h.current_price,
      investedValue: h.invested_value,
      gainLoss: h.invested_value != null ? h.current_value - h.invested_value : null,
      gainLossPercent:
        h.invested_value != null && h.invested_value > 0
          ? ((h.current_value - h.invested_value) / h.invested_value) * 100
          : null,
      folioNumber: h.folio_number,
      maturityDate: h.maturity_date,
      interestRate: h.interest_rate,
    }
  })

  const holdings = await replaceHoldingsForSource(source.id, userId, profileId, holdingsData)
  logger.debug(
    `[InvestmentParser] Replaced holdings for source ${source.id}: ${holdings.length} holdings`
  )

  // Update statement with holdings count
  await db
    .update(tables.statements)
    .set({
      holdingsCount: holdings.length,
      updatedAt: now as Date,
    })
    .where(eq(tables.statements.id, statementId))

  // Step 6: Create snapshot
  const totalInvested = holdings.reduce((sum, h) => sum + (h.investedValue || 0), 0)
  const totalCurrent = holdings.reduce((sum, h) => sum + h.currentValue, 0)
  const totalGainLoss = totalCurrent - totalInvested
  const gainLossPercent = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0

  const holdingsDetail: SnapshotHoldingDetail[] = holdings.map((h) => ({
    symbol: h.symbol,
    name: h.name,
    investmentType: h.investmentType,
    units: h.units,
    currentValue: h.currentValue,
    investedValue: h.investedValue,
    currency: h.currency,
  }))

  const snapshot = await upsertSnapshot({
    sourceId: source.id,
    profileId,
    userId,
    snapshotDate: statementDate,
    snapshotType: 'statement_import',
    totalCurrent,
    holdingsCount: holdings.length,
    currency: source.currency,
    totalInvested: totalInvested > 0 ? totalInvested : null,
    totalGainLoss: totalInvested > 0 ? totalGainLoss : null,
    gainLossPercent: totalInvested > 0 ? gainLossPercent : null,
    holdingsDetail,
  })

  logger.debug(
    `[InvestmentParser] Created/updated snapshot ${snapshot.id} for date ${statementDate}`
  )

  // Update source with last statement date
  await updateSource(source.id, userId, {
    lastStatementDate: statementDate,
    lastSyncAt: new Date(),
  })

  const parseEndTime = Date.now()
  const parseDurationMs = parseEndTime - parseStartTime
  const parseDurationSec = (parseDurationMs / 1000).toFixed(2)

  // Update statement with completion info
  await db
    .update(tables.statements)
    .set({
      status: 'completed',
      parseStartedAt: (dbType === 'postgres'
        ? new Date(parseStartTime)
        : new Date(parseStartTime).toISOString()) as Date,
      parseCompletedAt: (dbType === 'postgres'
        ? new Date(parseEndTime)
        : new Date(parseEndTime).toISOString()) as Date,
      updatedAt: now as Date,
    })
    .where(eq(tables.statements.id, statementId))

  logger.debug(
    `[InvestmentParser] Completed parsing statement ${statementId}: ${holdings.length} holdings in ${parseDurationSec}s`
  )

  return {
    sourceId: source.id,
    holdingsCount: holdings.length,
    snapshotId: snapshot.id,
  }
}
