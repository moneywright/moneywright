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
import type { RawPdfTransaction, ExecutionResult } from './types'

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
 * Run parser code in E2B sandbox
 */
export async function runParserInE2B(
  parserCode: string,
  pdfText: string
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
    logger.info('[E2BExecutor] Creating sandbox...')
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

    logger.info('[E2BExecutor] Executing parser code in sandbox...')
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
      logger.warn('[E2BExecutor] stderr:', execution.logs.stderr.join('\n'))
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

    // Filter and validate transactions
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

    logger.info(
      `[E2BExecutor] Extracted ${validTransactions.length} transactions in ${executionTimeMs}ms`
    )

    return {
      success: true,
      transactions: validTransactions,
      executionTimeMs,
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
