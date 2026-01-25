/**
 * E2B Sandbox executor for LLM-generated parser code
 * Uses E2B's secure sandboxed environment for safe code execution
 *
 * Benefits over Function constructor:
 * - Full sandbox isolation (separate process/VM)
 * - No need for manual security validation
 * - Support for both JavaScript and Python
 * - Built-in timeout handling
 */

import { Sandbox } from '@e2b/code-interpreter'
import { logger } from '../logger'
import type { RawPdfTransaction, RawInvestmentHolding, ExecutionResult } from './types'

/**
 * Parsing mode - determines which validation to apply
 */
export type ParsingMode = 'transaction' | 'holding'

/**
 * Maximum execution time in milliseconds
 */
const EXECUTION_TIMEOUT_MS = 30000 // 30 seconds for E2B (includes sandbox startup)

/**
 * Maximum number of transactions to accept
 */
const MAX_TRANSACTIONS = 10000

/**
 * Check if E2B is configured
 */
export function isE2BConfigured(): boolean {
  return !!process.env.E2B_API_KEY
}

/**
 * Validate a single transaction object
 */
function isValidTransaction(txn: unknown): txn is RawPdfTransaction {
  if (typeof txn !== 'object' || txn === null) return false

  const t = txn as Record<string, unknown>

  if (typeof t.date !== 'string') return false
  if (typeof t.amount !== 'number' || isNaN(t.amount) || t.amount <= 0) return false
  if (t.type !== 'credit' && t.type !== 'debit') return false
  if (typeof t.description !== 'string') return false

  // Validate date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) return false

  return true
}

/**
 * Normalize transaction (ensure consistent format)
 */
function normalizeTransaction(txn: RawPdfTransaction): RawPdfTransaction {
  return {
    date: txn.date.trim(),
    amount: Math.abs(txn.amount),
    type: txn.type,
    description: txn.description.trim().slice(0, 500),
    balance: typeof txn.balance === 'number' ? txn.balance : null,
  }
}

/**
 * Validate a single investment holding object
 */
function isValidHolding(holding: unknown): holding is RawInvestmentHolding {
  if (typeof holding !== 'object' || holding === null) return false

  const h = holding as Record<string, unknown>

  // Required fields
  if (typeof h.investment_type !== 'string' || h.investment_type.length === 0) return false
  if (typeof h.name !== 'string' || h.name.length === 0) return false
  if (typeof h.current_value !== 'number' || isNaN(h.current_value)) return false

  // units can be null for balance-based holdings (PPF, EPF, FD), or a number for unit-based
  if (h.units !== null && (typeof h.units !== 'number' || isNaN(h.units))) return false

  return true
}

/**
 * Valid ISO currency codes we support
 */
const VALID_CURRENCIES = new Set(['USD', 'INR', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'AED'])

/**
 * Normalize holding (ensure consistent format)
 */
function normalizeHolding(h: RawInvestmentHolding): RawInvestmentHolding {
  // Normalize and validate currency
  let currency: string | null = null
  if (typeof h.currency === 'string') {
    const upperCurrency = h.currency.trim().toUpperCase()
    if (VALID_CURRENCIES.has(upperCurrency)) {
      currency = upperCurrency
    }
  }

  return {
    investment_type: h.investment_type.trim().toLowerCase(),
    symbol: typeof h.symbol === 'string' ? h.symbol.trim() || null : null,
    name: h.name.trim().slice(0, 500),
    isin: typeof h.isin === 'string' ? h.isin.trim() || null : null,
    units: typeof h.units === 'number' && !isNaN(h.units) ? h.units : null,
    average_cost:
      typeof h.average_cost === 'number' && !isNaN(h.average_cost) ? h.average_cost : null,
    current_price:
      typeof h.current_price === 'number' && !isNaN(h.current_price) ? h.current_price : null,
    current_value: h.current_value,
    invested_value:
      typeof h.invested_value === 'number' && !isNaN(h.invested_value) ? h.invested_value : null,
    folio_number: typeof h.folio_number === 'string' ? h.folio_number.trim() || null : null,
    maturity_date: typeof h.maturity_date === 'string' ? h.maturity_date.trim() || null : null,
    interest_rate:
      typeof h.interest_rate === 'number' && !isNaN(h.interest_rate) ? h.interest_rate : null,
    currency,
  }
}

/**
 * Run parser code in E2B sandbox
 * @param parserCode - The parser code to execute
 * @param pdfText - The text to parse
 * @param mode - 'transaction' for bank statements, 'holding' for investment statements
 */
export async function runParserInE2B(
  parserCode: string,
  pdfText: string,
  mode: ParsingMode = 'transaction'
): Promise<ExecutionResult> {
  const startTime = Date.now()

  if (!isE2BConfigured()) {
    return {
      success: false,
      error: 'E2B not configured (missing E2B_API_KEY)',
      executionTimeMs: Date.now() - startTime,
    }
  }

  let sandbox: Sandbox | null = null

  try {
    logger.debug('[E2BExecutor] Creating sandbox...')
    sandbox = await Sandbox.create({ timeoutMs: EXECUTION_TIMEOUT_MS })

    // Wrap the parser code in a function and execute it
    // The LLM generates a function body, we need to wrap it
    // We use console.log with markers to capture full output (execution.text truncates)
    const OUTPUT_MARKER_START = '___E2B_JSON_START___'
    const OUTPUT_MARKER_END = '___E2B_JSON_END___'

    const wrappedCode = `
const text = ${JSON.stringify(pdfText)};

// Parser function body (LLM-generated)
function parseTransactions(text) {
${parserCode}
}

// Execute and output result with markers (console.log doesn't truncate like execution.text)
const result = parseTransactions(text);
const jsonOutput = JSON.stringify(result, null, 0);
console.log('${OUTPUT_MARKER_START}' + jsonOutput + '${OUTPUT_MARKER_END}');
`

    logger.debug('[E2BExecutor] Executing parser code in sandbox...')
    logger.debug(`[E2BExecutor] Code length: ${wrappedCode.length} chars`)

    const execution = await sandbox.runCode(wrappedCode, {
      language: 'javascript',
      timeoutMs: EXECUTION_TIMEOUT_MS - 5000, // Leave 5s buffer for sandbox operations
    })

    const executionTimeMs = Date.now() - startTime

    // Check for errors
    if (execution.error) {
      logger.error('[E2BExecutor] Execution error:', execution.error)
      return {
        success: false,
        error: `Sandbox execution error: ${execution.error.name}: ${execution.error.value}`,
        executionTimeMs,
      }
    }

    // Log stderr for debugging
    if (execution.logs.stderr.length > 0) {
      logger.debug('[E2BExecutor] stderr:', execution.logs.stderr.join('\n'))
    }

    // Extract JSON from stdout using markers (handles large outputs without truncation)
    const stdout = execution.logs.stdout.join('')
    const startMarker = OUTPUT_MARKER_START
    const endMarker = OUTPUT_MARKER_END

    const startIdx = stdout.indexOf(startMarker)
    const endIdx = stdout.indexOf(endMarker)

    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      logger.error('[E2BExecutor] Could not find output markers in stdout')
      logger.error('[E2BExecutor] stdout:', stdout.slice(0, 2000))
      return {
        success: false,
        error: 'Parser did not return valid output (missing markers)',
        executionTimeMs,
      }
    }

    const jsonText = stdout.slice(startIdx + startMarker.length, endIdx)
    logger.debug(`[E2BExecutor] Extracted JSON length: ${jsonText.length} chars`)

    // Parse the JSON result
    let result: unknown
    try {
      result = JSON.parse(jsonText)
    } catch (parseErr) {
      logger.error('[E2BExecutor] Failed to parse result JSON:', parseErr)
      logger.error('[E2BExecutor] jsonText (first 1000 chars):', jsonText.slice(0, 1000))

      return {
        success: false,
        error: `Failed to parse result as JSON: ${parseErr instanceof Error ? parseErr.message : 'Unknown error'}`,
        executionTimeMs,
      }
    }

    // Validate output is an array
    if (!Array.isArray(result)) {
      return {
        success: false,
        error: 'Parser did not return an array',
        executionTimeMs,
      }
    }

    // Filter and validate based on mode
    if (mode === 'holding') {
      // Validate as investment holdings
      const validHoldings: RawInvestmentHolding[] = []
      let invalidCount = 0

      for (const item of result) {
        if (validHoldings.length >= MAX_TRANSACTIONS) {
          logger.warn(`[E2BExecutor] Reached max holding limit (${MAX_TRANSACTIONS})`)
          break
        }

        if (isValidHolding(item)) {
          validHoldings.push(normalizeHolding(item))
        } else {
          invalidCount++
          if (invalidCount <= 3) {
            logger.debug(`[E2BExecutor] Invalid holding: ${JSON.stringify(item).slice(0, 200)}`)
          }
        }
      }

      if (invalidCount > 0) {
        logger.warn(`[E2BExecutor] Skipped ${invalidCount} invalid holdings`)
      }

      logger.debug(
        `[E2BExecutor] Extracted ${validHoldings.length} holdings in ${executionTimeMs}ms`
      )

      return {
        success: true,
        holdings: validHoldings,
        executionTimeMs,
      }
    } else {
      // Validate as bank transactions
      const validTransactions: RawPdfTransaction[] = []
      let invalidCount = 0

      for (const item of result) {
        if (validTransactions.length >= MAX_TRANSACTIONS) {
          logger.warn(`[E2BExecutor] Reached max transaction limit (${MAX_TRANSACTIONS})`)
          break
        }

        if (isValidTransaction(item)) {
          validTransactions.push(normalizeTransaction(item))
        } else {
          invalidCount++
        }
      }

      if (invalidCount > 0) {
        logger.warn(`[E2BExecutor] Skipped ${invalidCount} invalid transactions`)
      }

      logger.debug(
        `[E2BExecutor] Extracted ${validTransactions.length} transactions in ${executionTimeMs}ms`
      )

      return {
        success: true,
        transactions: validTransactions,
        executionTimeMs,
      }
    }
  } catch (err) {
    const executionTimeMs = Date.now() - startTime
    logger.error('[E2BExecutor] Error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      executionTimeMs,
    }
  } finally {
    // Always close the sandbox
    if (sandbox) {
      try {
        await sandbox.kill()
        logger.debug('[E2BExecutor] Sandbox closed')
      } catch (killErr) {
        logger.warn('[E2BExecutor] Failed to close sandbox:', killErr)
      }
    }
  }
}
