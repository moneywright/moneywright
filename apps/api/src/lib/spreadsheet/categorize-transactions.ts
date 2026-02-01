/**
 * Batched transaction categorization using LLM
 * Sends minimal data to LLM for efficient categorization
 */

import { generateText } from 'ai'
import { createLLMClientFromSettings } from '../../llm'
import { getCategoriesForCountry, type CountryCode } from '../constants'
import type { RawTransaction, CategorizedTransaction } from './types'
import { logger } from '../logger'

/**
 * Batch size for categorization requests
 * Balance between efficiency and token limits
 */
const BATCH_SIZE = 50

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

    // Parse CSV line - handle quoted fields
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
 * Parse a CSV line handling quoted fields
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
 * Categorize a batch of transactions
 */
async function categorizeBatch(
  transactions: RawTransaction[],
  countryCode: CountryCode,
  modelOverride?: string
): Promise<Map<string, CategorizedTransaction>> {
  const { model, providerOptions } = await createLLMClientFromSettings(modelOverride)
  const categories = getCategoriesForCountry(countryCode)
  const categoryList = categories.map((c) => `${c.code}: ${c.label}`).join('\n')
  const validCategories = categories.map((c) => c.code)

  // Format transactions for LLM - minimal data
  const txnList = transactions
    .map((t) => `${t.id},${t.type},${t.amount},"${t.description.replace(/"/g, '""')}"`)
    .join('\n')

  const prompt = `Categorize these bank transactions and provide a brief summary for each.

TRANSACTIONS (id,type,amount,description):
${txnList}

CATEGORIES:
${categoryList}

OUTPUT FORMAT (CSV):
id,category,confidence,summary

RULES:
- id: exact ID from input
- category: code from categories list
- confidence: 0.0 to 1.0 (how confident in category)
- summary: 2-5 word description (e.g., "Amazon purchase", "Salary deposit", "ATM withdrawal")

Example:
abc123,shopping,0.95,"Amazon online purchase"
def456,salary,1.0,"Monthly salary"
ghi789,transfer,0.85,"Bank transfer to savings"`

  try {
    const { text } = await generateText({
      model,
      prompt,
      providerOptions,
    })

    return parseCategoryCSV(text, validCategories)
  } catch (error) {
    logger.error(`[Categorize] Batch error:`, error)
    // Return empty map on error - transactions will get default category
    return new Map()
  }
}

/**
 * Categorize all transactions in batches
 */
export async function categorizeTransactions(
  transactions: RawTransaction[],
  countryCode: CountryCode,
  modelOverride?: string
): Promise<CategorizedTransaction[]> {
  logger.debug(
    `[Categorize] Categorizing ${transactions.length} transactions in batches of ${BATCH_SIZE}`
  )

  const results: CategorizedTransaction[] = []
  const batches: RawTransaction[][] = []

  // Split into batches
  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    batches.push(transactions.slice(i, i + BATCH_SIZE))
  }

  logger.debug(`[Categorize] Processing ${batches.length} batches`)

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

  logger.debug(`[Categorize] Completed categorization of ${results.length} transactions`)
  return results
}
