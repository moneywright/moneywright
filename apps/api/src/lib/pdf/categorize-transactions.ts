/**
 * Batch transaction categorization using LLM
 * Sends all transactions together for better pattern recognition
 * (e.g., recurring salary, regular bills)
 *
 * Supports streaming mode with mini-batches for real-time updates
 */

import { generateText, streamText } from 'ai'
import { eq, inArray, and, isNull } from 'drizzle-orm'
import { createLLMClientFromSettings } from '../../llm'
import { getCategoriesForCountry, type CountryCode } from '../constants'
import { db, tables, dbType } from '../../db'
import { logger } from '../logger'
import type { CategorizedTransaction, TransactionForCategorization } from './types'

/**
 * Country-specific categorization hints for the LLM
 * Includes common merchants, services, and patterns for each country
 */
const CATEGORY_HINTS: Record<CountryCode, string> = {
  IN: `CATEGORY DETECTION (India):

=== SALARY DETECTION - BE VERY CAREFUL ===
SALARY in India is ONLY paid via NEFT/RTGS/IMPS from employer, NEVER via UPI!
- SALARY = NEFT/RTGS credit with "SALARY" in description OR from known employer company name
- SALARY must be consistent monthly amount (same or very similar amount each month)
- UPI credits from individuals are NEVER salary - they are "transfer" (even if recurring)
- Recurring UPI payments from same person = transfer (NOT salary)
- Just because credits are regular/monthly does NOT make them salary
- Credits from individuals (person names) = transfer, NOT salary

=== OTHER CATEGORIES ===
- NoBroker, Housing.com, 99acres, rent-related = rent
- Swiggy, Zomato, restaurant names, food delivery = food_dining
- BigBasket, Zepto, Blinkit, DMart, grocery stores = groceries
- Amazon, Flipkart, Myntra, Ajio, Meesho = shopping
- Netflix, Spotify, Prime Video, Hotstar, JioCinema = entertainment
- CRED, credit card payments, card bill = credit_card_payment
- Person names via UPI (P2P transfers) = transfer (even if recurring monthly!)
- ATM, cash withdrawal, CWDR = atm_withdrawal
- Electricity, BESCOM, Tata Power, gas, water, piped gas = utilities
- Airtel, Jio, Vi, BSNL, broadband, Hathway, ACT = mobile_internet
- Uber, Ola, Rapido, metro, IRCTC, MakeMyTrip = travel
- Apollo, Practo, 1mg, Netmeds, hospital, clinic = healthcare
- Zerodha, Groww, Vested, mutual fund, SIP, stocks, broking = investment
- LIC, HDFC Life, ICICI Prudential, insurance premium = insurance
- Petrol, diesel, HP, BPCL, IOCL, fuel station = fuel
- School, college, Byju's, Unacademy, course fee = education
- EMI, loan payment, HDFC Ltd, Bajaj Finance = emi`,

  US: `CATEGORY DETECTION (USA):
- Large regular deposits (same amount bi-weekly/monthly) = paycheck (direct deposit, payroll)
- Rent payments, apartment, landlord, property management = rent
- Mortgage, home loan, Wells Fargo Mortgage, Chase Home = mortgage
- DoorDash, Uber Eats, Grubhub, restaurants = food_dining
- Whole Foods, Trader Joe's, Kroger, Walmart Grocery = groceries
- Amazon, Target, Walmart, Best Buy, Costco = shopping
- Netflix, Spotify, HBO Max, Disney+, Hulu, Apple TV = entertainment
- Credit card payment, card services = credit_card_payment
- Venmo, Zelle, PayPal, Cash App (person names) = transfer
- ATM withdrawal, cash back = atm_withdrawal
- Electric, gas, water, PG&E, ConEd, utility company = utilities
- Verizon, AT&T, T-Mobile, Comcast, Spectrum = phone_internet
- Uber, Lyft, airline, Delta, United, Amtrak = travel
- CVS, Walgreens, hospital, doctor, pharmacy = healthcare
- Fidelity, Schwab, Vanguard, 401k, IRA, brokerage = investment
- State Farm, Geico, Progressive, Allstate, insurance = insurance
- Shell, Chevron, ExxonMobil, gas station = gas
- Daycare, preschool, childcare, nanny = childcare
- Tuition, student loan, college, university = education
- Petco, PetSmart, vet, veterinary = pet`,
}

/**
 * Account type specific hints to help LLM understand context
 */
const ACCOUNT_TYPE_HINTS: Record<string, string> = {
  credit_card: `CREDIT CARD STATEMENT CONTEXT:
- This is a CREDIT CARD statement, NOT a bank account
- Credits in credit card statements are typically: refunds, cashback, rewards, or PAYMENT RECEIVED (credit card bill payment)
- "PAYMENT RECEIVED" or "PAYMENT THANK YOU" = credit_card_payment (NOT salary!)
- Large credits are usually bill payments from bank account, NOT salary
- Debits are purchases/spending made using the credit card`,

  savings_account: `BANK ACCOUNT (SAVINGS) CONTEXT:
- This is a bank savings account statement
- Large regular credits (same amount monthly) are likely salary
- Debits to credit card companies = credit_card_payment
- UPI transfers to individuals = transfer`,

  current_account: `BANK ACCOUNT (CURRENT) CONTEXT:
- This is a bank current/checking account statement
- Large regular credits may be salary or business income
- Debits to credit card companies = credit_card_payment`,

  checking_account: `BANK ACCOUNT (CHECKING) CONTEXT:
- This is a bank checking account statement
- Large regular credits may be salary or business income (paycheck)
- Debits to credit card companies = credit_card_payment`,
}

/**
 * Country-specific summary examples for the LLM
 */
const SUMMARY_EXAMPLES: Record<CountryCode, string> = {
  IN: `SUMMARY GUIDELINES - Be specific, extract merchant/purpose from description:
BAD SUMMARIES (too generic, avoid these):
- "misc credit", "payment", "transfer", "transaction", "UPI payment", "online purchase", "order", "food order"

GOOD SUMMARIES (specific, mention merchant/recipient):
- "Salary from [Company]" or "Monthly salary"
- "Rent to [Landlord/Platform]" (e.g., "Rent via NoBroker", "Rent to landlord")
- "Swiggy food delivery" (NOT just "food order")
- "Zomato restaurant order"
- "Amazon electronics purchase" or "Amazon order"
- "Flipkart fashion purchase"
- "Netflix monthly subscription"
- "Spotify subscription"
- "ATM cash withdrawal"
- "BESCOM electricity bill"
- "Airtel mobile recharge"
- "ACT broadband payment"
- "Transfer to [Person name]" (extract name from description)
- "Received from [Person name]"
- "HP petrol refuel"
- "Zerodha stock investment"
- "LIC premium payment"
- "Credit card bill payment"
- "Uber cab ride"
- "Ola auto ride"

Extract the MERCHANT NAME or RECIPIENT NAME from the description. Don't use generic terms.`,

  US: `SUMMARY GUIDELINES - Be specific, extract merchant/purpose from description:
BAD SUMMARIES (too generic, avoid these):
- "misc credit", "payment", "transfer", "transaction", "debit", "online purchase", "food delivery"

GOOD SUMMARIES (specific, mention merchant/recipient):
- "Paycheck from [Company]" or "Direct deposit salary"
- "Rent to [Landlord/Property]"
- "Mortgage to Wells Fargo"
- "DoorDash food delivery"
- "Uber Eats order"
- "Amazon household purchase"
- "Target grocery shopping"
- "Netflix subscription"
- "Spotify premium"
- "ATM cash withdrawal"
- "PG&E electric bill"
- "Verizon phone bill"
- "Comcast internet"
- "Venmo to [Person name]" (extract name)
- "Zelle from [Person name]"
- "Shell gas fill-up"
- "Chevron fuel"
- "Fidelity 401k contribution"
- "Vanguard IRA deposit"
- "Geico car insurance"
- "Credit card bill payment"
- "Uber ride"
- "Lyft ride"

Extract the MERCHANT NAME or RECIPIENT NAME from the description. Don't use generic terms.`,
}

/**
 * Batch size for categorization - only batch if more than this many transactions
 * We want to send enough transactions together for pattern recognition (salary, recurring, etc.)
 * but not so many that it overwhelms the LLM's output capacity
 */
const BATCH_THRESHOLD = 250
const BATCH_SIZE = 250

/**
 * Maximum retry attempts for categorizing remaining uncategorized transactions
 */
const MAX_CATEGORIZATION_RETRIES = 5

/**
 * Parse CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current)

  return fields.map((f) => f.trim())
}

/**
 * Parse LLM CSV response into categorized transactions
 */
function parseCategoryCSV(
  csvText: string,
  validCategories: string[]
): Map<string, CategorizedTransaction> {
  const result = new Map<string, CategorizedTransaction>()
  const lines = csvText.trim().split('\n')

  for (const line of lines) {
    // Skip empty lines and header
    if (!line.trim() || line.toLowerCase().startsWith('id,')) continue

    const fields = parseCSVLine(line)
    if (fields.length < 4) {
      logger.warn(`[Categorize] Skipping malformed CSV line: ${line}`)
      continue
    }

    const [id, category, confidenceStr, summary] = fields

    if (!id) continue

    // Validate category
    const categoryCode = category?.toLowerCase().trim() || 'other'
    const finalCategory = validCategories.includes(categoryCode) ? categoryCode : 'other'

    // Parse confidence
    const confidence = parseFloat(confidenceStr || '0.8')

    result.set(id.trim(), {
      id: id.trim(),
      category: finalCategory,
      confidence: isNaN(confidence) ? 0.8 : Math.min(1, Math.max(0, confidence)),
      summary: summary?.trim() || '',
    })
  }

  return result
}

/**
 * Categorize a batch of transactions
 */
async function categorizeBatch(
  transactions: TransactionForCategorization[],
  countryCode: CountryCode,
  modelOverride?: string
): Promise<Map<string, CategorizedTransaction>> {
  const model = await createLLMClientFromSettings(modelOverride)
  const categories = getCategoriesForCountry(countryCode)
  const categoryList = categories.map((c) => `${c.code}: ${c.label}`).join('\n')
  const validCategories = categories.map((c) => c.code)

  // Format transactions for LLM - include all info for pattern detection
  const txnList = transactions
    .map((t) => `${t.id},${t.date},${t.type},${t.amount},"${t.description.replace(/"/g, '""')}"`)
    .join('\n')

  const prompt = `Categorize these bank transactions. Look for patterns like recurring payments (salary, rent, subscriptions).

TRANSACTIONS (id,date,type,amount,description):
${txnList}

CATEGORIES:
${categoryList}

OUTPUT FORMAT (CSV):
id,category,confidence,summary

RULES:
- id: exact ID from input
- category: code from categories list
- confidence: 0.0 to 1.0 (higher for recurring patterns you're sure about)
- summary: 2-5 word description (e.g., "Monthly salary", "Netflix subscription", "ATM withdrawal")

PATTERN DETECTION:
- Same amount on similar dates = likely recurring (salary, rent, subscription)
- Same merchant = same category
- Regular intervals = subscription or bill

Example:
abc123,salary,1.0,"Monthly salary deposit"
def456,entertainment,0.95,"Netflix subscription"
ghi789,utilities,0.9,"Monthly electricity bill"`

  try {
    const { text } = await generateText({
      model,
      prompt,
      maxTokens: 3000,
    })

    return parseCategoryCSV(text, validCategories)
  } catch (error) {
    logger.error(`[Categorize] Batch error:`, error)
    return new Map()
  }
}

/**
 * Fetch transactions by IDs from the database
 */
async function fetchTransactionsByIds(
  transactionIds: string[]
): Promise<TransactionForCategorization[]> {
  if (transactionIds.length === 0) return []

  const rows = await db
    .select({
      id: tables.transactions.id,
      date: tables.transactions.date,
      amount: tables.transactions.amount,
      type: tables.transactions.type,
      description: tables.transactions.originalDescription,
    })
    .from(tables.transactions)
    .where(inArray(tables.transactions.id, transactionIds))

  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    amount: parseFloat(r.amount),
    type: r.type as 'credit' | 'debit',
    description: r.description || '',
  }))
}

/**
 * Fetch uncategorized transactions (where summary is null)
 * These are transactions that were inserted but not yet categorized by LLM
 */
async function fetchUncategorizedTransactions(
  transactionIds: string[]
): Promise<TransactionForCategorization[]> {
  if (transactionIds.length === 0) return []

  const rows = await db
    .select({
      id: tables.transactions.id,
      date: tables.transactions.date,
      amount: tables.transactions.amount,
      type: tables.transactions.type,
      description: tables.transactions.originalDescription,
    })
    .from(tables.transactions)
    .where(
      and(inArray(tables.transactions.id, transactionIds), isNull(tables.transactions.summary))
    )

  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    amount: parseFloat(r.amount),
    type: r.type as 'credit' | 'debit',
    description: r.description || '',
  }))
}

/**
 * Categorize transactions by their IDs
 * Fetches transactions from DB, sends to LLM, returns categorizations
 */
export async function categorizeTransactionsByIds(
  transactionIds: string[],
  countryCode: CountryCode,
  modelOverride?: string
): Promise<CategorizedTransaction[]> {
  if (transactionIds.length === 0) return []

  logger.info(
    `[Categorize] Categorizing ${transactionIds.length} transactions in batches of ${BATCH_SIZE}`
  )

  // Fetch transaction data from DB
  const transactions = await fetchTransactionsByIds(transactionIds)

  const results: CategorizedTransaction[] = []
  const batches: TransactionForCategorization[][] = []

  // Split into batches
  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    batches.push(transactions.slice(i, i + BATCH_SIZE))
  }

  logger.info(`[Categorize] Processing ${batches.length} batches`)

  // Process batches sequentially to avoid rate limits
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]!
    logger.debug(
      `[Categorize] Processing batch ${i + 1}/${batches.length} (${batch.length} transactions)`
    )

    const categoryMap = await categorizeBatch(batch, countryCode, modelOverride)

    // Match results back to transactions
    for (const txn of batch) {
      const categorized = categoryMap.get(txn.id)
      if (categorized) {
        results.push(categorized)
      } else {
        // Default categorization if LLM missed it
        results.push({
          id: txn.id,
          category: 'other',
          confidence: 0.5,
          summary: txn.description.slice(0, 50),
        })
      }
    }
  }

  logger.info(`[Categorize] Completed categorization of ${results.length} transactions`)
  return results
}

/**
 * Update a single transaction's category in the database
 * Returns true if a row was updated, false if the ID didn't match any transaction
 */
async function updateTransactionCategory(cat: CategorizedTransaction): Promise<boolean> {
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  // Ensure summary is never empty string - use a default if needed
  const summary = cat.summary?.trim() || 'Transaction'

  const result = await db
    .update(tables.transactions)
    .set({
      category: cat.category,
      categoryConfidence: cat.confidence.toString(),
      summary,
      updatedAt: now as Date,
    })
    .where(eq(tables.transactions.id, cat.id))
    .returning({ id: tables.transactions.id })

  if (result.length === 0) {
    logger.warn(`[Categorize] No transaction found with ID: ${cat.id}`)
    return false
  }
  return true
}

/**
 * Process a single batch of transactions with streaming
 * Returns the number of successfully categorized transactions
 */
async function categorizeBatchStreaming(
  transactions: TransactionForCategorization[],
  validCategories: string[],
  categoryList: string,
  countryCode: CountryCode,
  model: Awaited<ReturnType<typeof createLLMClientFromSettings>>,
  onCategorized: (cat: CategorizedTransaction) => Promise<void>,
  accountType?: string
): Promise<{ success: number; failed: number }> {
  const txnList = transactions
    .map((t) => `${t.id},${t.date},${t.type},${t.amount},"${t.description.replace(/"/g, '""')}"`)
    .join('\n')

  // Get country-specific hints
  const categoryHints = CATEGORY_HINTS[countryCode] || CATEGORY_HINTS.US
  const summaryExamples = SUMMARY_EXAMPLES[countryCode] || SUMMARY_EXAMPLES.US

  // Get account type specific hints
  const accountTypeHint = accountType ? ACCOUNT_TYPE_HINTS[accountType] || '' : ''

  const systemPrompt = `You are a transaction categorization engine. You ONLY output CSV data. You NEVER ask questions, provide explanations, or include any text other than CSV lines. Start outputting CSV immediately.`

  const prompt = `Categorize ALL ${transactions.length} transactions below. Output CSV ONLY - no explanations, no questions.
${accountTypeHint ? `\n${accountTypeHint}\n` : ''}

TRANSACTIONS (id,date,type,amount,description):
${txnList}

CATEGORIES:
${categoryList}

OUTPUT FORMAT - CSV ONLY, one line per transaction:
id,category,confidence,summary

RULES:
- Output EXACTLY ${transactions.length} CSV lines, one per transaction
- NO explanations, NO questions, NO commentary - ONLY CSV lines
- id: exact ID from input (copy exactly)
- category: code from categories list
- confidence: 0.0 to 1.0
- summary: Short, meaningful description (see examples below)

${categoryHints}

${summaryExamples}

START OUTPUT NOW:`

  let success = 0
  let failed = 0
  let buffer = ''

  try {
    logger.info(`[Categorize] Starting stream for ${transactions.length} transactions`)

    const { textStream } = streamText({
      model,
      system: systemPrompt,
      prompt,
    })

    let linesProcessed = 0
    let chunkCount = 0

    for await (const chunk of textStream) {
      chunkCount++
      buffer += chunk

      // Log first few chunks to see streaming behavior
      if (chunkCount <= 3) {
        logger.debug(`[Categorize] Chunk ${chunkCount}: ${chunk.length} chars`)
      }

      // Process complete lines immediately as they arrive
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim() || line.toLowerCase().startsWith('id,')) continue

        const fields = parseCSVLine(line)
        if (fields.length < 4) {
          failed++
          continue
        }

        const [id, category, confidenceStr, summary] = fields
        if (!id) {
          failed++
          continue
        }

        const categoryCode = category?.toLowerCase().trim() || 'other'
        const finalCategory = validCategories.includes(categoryCode) ? categoryCode : 'other'
        const confidence = parseFloat(confidenceStr || '0.8')

        try {
          await onCategorized({
            id: id.trim(),
            category: finalCategory,
            confidence: isNaN(confidence) ? 0.8 : Math.min(1, Math.max(0, confidence)),
            summary: summary?.trim() || '',
          })
          success++
          linesProcessed++

          // Log progress every 10 transactions
          if (linesProcessed % 10 === 0) {
            logger.info(`[Categorize] Saved ${linesProcessed} transactions to DB...`)
          }
        } catch (err) {
          logger.warn(`[Categorize] Failed to save transaction ${id}:`, err)
          failed++
        }
      }
    }

    // Process remaining buffer (last line without newline)
    if (buffer.trim() && !buffer.toLowerCase().startsWith('id,')) {
      const fields = parseCSVLine(buffer)
      if (fields.length >= 4 && fields[0]) {
        const [id, category, confidenceStr, summary] = fields
        const categoryCode = category?.toLowerCase().trim() || 'other'
        const finalCategory = validCategories.includes(categoryCode) ? categoryCode : 'other'
        const confidence = parseFloat(confidenceStr || '0.8')

        try {
          await onCategorized({
            id: id!.trim(),
            category: finalCategory,
            confidence: isNaN(confidence) ? 0.8 : Math.min(1, Math.max(0, confidence)),
            summary: summary?.trim() || '',
          })
          success++
        } catch {
          failed++
        }
      }
    }

    logger.info(`[Categorize] Stream finished after ${chunkCount} chunks`)

    // Log if we didn't get all transactions
    const total = success + failed
    if (total < transactions.length) {
      logger.warn(
        `[Categorize] Stream ended early: got ${total}/${transactions.length} transactions`
      )
    }

    return { success, failed: failed + (transactions.length - total) }
  } catch (error) {
    logger.error(`[Categorize] Streaming error:`, error)
    return { success, failed: failed + (transactions.length - success - failed) }
  }
}

/**
 * Process a single categorization pass for given transactions
 * Returns the number of successfully categorized transactions
 */
async function runCategorizationPass(
  transactions: TransactionForCategorization[],
  countryCode: CountryCode,
  model: Awaited<ReturnType<typeof createLLMClientFromSettings>>,
  onProgress?: (categorized: number, total: number) => void,
  progressOffset: number = 0,
  totalForProgress: number = 0,
  accountType?: string
): Promise<{ success: number; failed: number }> {
  const categories = getCategoriesForCountry(countryCode)
  const categoryList = categories.map((c) => `${c.code}: ${c.label}`).join('\n')
  const validCategories = categories.map((c) => c.code)

  // Only batch if we have more than threshold - we want all transactions together for pattern recognition
  const shouldBatch = transactions.length > BATCH_THRESHOLD

  if (shouldBatch) {
    logger.info(
      `[Categorize] Large dataset (${transactions.length} transactions), batching into groups of ${BATCH_SIZE}`
    )
  } else {
    logger.info(
      `[Categorize] Processing all ${transactions.length} transactions together for pattern recognition`
    )
  }

  // Split into batches only if needed
  const batches: TransactionForCategorization[][] = []
  if (shouldBatch) {
    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      batches.push(transactions.slice(i, i + BATCH_SIZE))
    }
  } else {
    batches.push(transactions) // Single batch with all transactions
  }

  let totalSuccess = 0
  let totalFailed = 0

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx]!

    if (shouldBatch) {
      logger.info(
        `[Categorize] Processing batch ${batchIdx + 1}/${batches.length} (${batch.length} transactions)`
      )
    }

    const { success, failed } = await categorizeBatchStreaming(
      batch,
      validCategories,
      categoryList,
      countryCode,
      model,
      async (cat) => {
        const updated = await updateTransactionCategory(cat)
        if (updated) {
          totalSuccess++

          // Log progress every 10 transactions
          if (totalSuccess % 10 === 0) {
            logger.debug(
              `[Categorize] Progress: ${progressOffset + totalSuccess}/${totalForProgress}`
            )
          }
          onProgress?.(progressOffset + totalSuccess, totalForProgress)
        }
      },
      accountType
    )

    if (shouldBatch) {
      logger.info(
        `[Categorize] Batch ${batchIdx + 1} complete: ${success} success, ${failed} failed`
      )
    } else {
      logger.info(`[Categorize] Pass complete: ${success} success, ${failed} failed`)
    }

    totalFailed += failed
  }

  return { success: totalSuccess, failed: totalFailed }
}

/**
 * Streaming categorization with real-time DB updates
 * Sends all transactions together for pattern recognition (salary, recurring payments, etc.)
 * Only batches if there are more than BATCH_THRESHOLD transactions
 *
 * Automatically retries for any transactions that weren't categorized (summary is null)
 * until all transactions are categorized or max retries reached.
 *
 * @param transactionIds - IDs of transactions to categorize
 * @param countryCode - Country code for category list
 * @param modelOverride - Optional model override
 * @param startFromIndex - Resume from this index if previous run failed (deprecated, kept for compatibility)
 * @param onProgress - Optional callback for progress updates
 * @param accountType - Optional account type for context (credit_card, savings_account, etc.)
 */
export async function categorizeTransactionsStreaming(
  transactionIds: string[],
  countryCode: CountryCode,
  modelOverride?: string,
  _startFromIndex: number = 0,
  onProgress?: (categorized: number, total: number) => void,
  accountType?: string
): Promise<{ categorizedCount: number; failedAtIndex?: number }> {
  if (transactionIds.length === 0) return { categorizedCount: 0 }

  const model = await createLLMClientFromSettings(modelOverride)
  const totalTransactions = transactionIds.length

  logger.info(`[Categorize] Starting categorization for ${totalTransactions} transactions`)

  let totalCategorized = 0
  let retryCount = 0

  // Initial pass - fetch uncategorized transactions
  let uncategorized = await fetchUncategorizedTransactions(transactionIds)

  if (uncategorized.length === 0) {
    logger.info(`[Categorize] All transactions already categorized`)
    return { categorizedCount: totalTransactions }
  }

  logger.info(`[Categorize] Found ${uncategorized.length} uncategorized transactions`)

  // Keep retrying until all transactions are categorized or max retries reached
  while (uncategorized.length > 0 && retryCount < MAX_CATEGORIZATION_RETRIES) {
    if (retryCount > 0) {
      const uncatIds = uncategorized.map((t) => t.id).join(', ')
      logger.info(
        `[Categorize] Retry ${retryCount}/${MAX_CATEGORIZATION_RETRIES}: ${uncategorized.length} transactions still need categorization`
      )
      logger.debug(`[Categorize] Uncategorized IDs: ${uncatIds}`)
    }

    const { success } = await runCategorizationPass(
      uncategorized,
      countryCode,
      model,
      onProgress,
      totalCategorized,
      totalTransactions,
      accountType
    )

    totalCategorized += success

    // Check if any transactions are still uncategorized (summary is null)
    uncategorized = await fetchUncategorizedTransactions(transactionIds)

    if (uncategorized.length === 0) {
      logger.info(`[Categorize] All ${totalTransactions} transactions successfully categorized`)
      break
    }

    retryCount++
  }

  // Final status
  if (uncategorized.length > 0) {
    logger.warn(
      `[Categorize] After ${retryCount} retries, ${uncategorized.length} transactions still uncategorized`
    )
  }

  logger.info(`[Categorize] Streaming complete: ${totalCategorized} transactions categorized`)

  return {
    categorizedCount: totalCategorized,
    failedAtIndex: uncategorized.length > 0 ? totalCategorized : undefined,
  }
}
