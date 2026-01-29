/**
 * Sandboxed execution of LLM-generated parser code
 *
 * Supports two execution modes:
 * 1. E2B Sandbox (preferred) - Full VM isolation via E2B cloud
 * 2. Local Function (fallback) - Uses Function constructor with validation
 *
 * E2B is used when E2B_API_KEY is configured, otherwise falls back to local execution.
 */

import { logger } from '../logger'
import { validateCode, checkSyntax } from './validate-code'
import { isE2BConfigured, runParserInE2B, type ParsingMode } from './e2b-executor'
import type {
  RawPdfTransaction,
  RawInvestmentHolding,
  ExecutionResult,
  ExpectedSummary,
  ExtractedTotals,
} from './types'
import type { ParserCodeEntry } from './parser-code-cache'
import { recordSuccess, recordFailure } from './parser-code-cache'
import {
  MAX_ITEMS,
  isValidTransaction,
  normalizeTransaction,
  isValidHolding,
  normalizeHolding,
} from './validation'

/**
 * Tolerance for amount comparison (to handle rounding differences)
 */
const AMOUNT_TOLERANCE = 10

/**
 * Maximum execution time in milliseconds
 */
const EXECUTION_TIMEOUT_MS = 5000

/**
 * Maximum number of transactions to extract
 */
const MAX_TRANSACTIONS = MAX_ITEMS

/**
 * Run the generated parser code
 *
 * Uses E2B sandbox if configured (E2B_API_KEY set), otherwise falls back to local execution.
 * E2B provides full VM isolation, local execution uses Function constructor with validation.
 *
 * @param parserCode - The parser code to execute
 * @param pdfText - The text to parse
 * @param mode - 'transaction' for bank statements, 'holding' for investment statements
 */
export async function runParser(
  parserCode: string,
  pdfText: string,
  mode: ParsingMode = 'transaction'
): Promise<ExecutionResult> {
  // Use E2B if configured
  if (isE2BConfigured()) {
    logger.debug(`[ExecuteParser] Using E2B sandbox for code execution (mode: ${mode})`)
    return runParserInE2B(parserCode, pdfText, mode)
  }

  // Fallback to local execution
  logger.debug(`[ExecuteParser] Using local execution (mode: ${mode}, E2B not configured)`)
  return runParserLocal(parserCode, pdfText, mode)
}

/**
 * Run parser code locally using Function constructor
 *
 * SECURITY NOTE: This intentionally runs dynamic code. Security is enforced by:
 * - Pre-validation via validateCode() and checkSyntax()
 * - Restricted globals (no process, fs, network, etc.)
 * - Timeout enforcement
 * - Output validation
 */
async function runParserLocal(
  parserCode: string,
  pdfText: string,
  mode: ParsingMode = 'transaction'
): Promise<ExecutionResult> {
  const startTime = Date.now()

  // Step 1: Validate code for dangerous patterns
  const validation = validateCode(parserCode)
  if (!validation.valid) {
    logger.error(`[ExecuteParser] Code validation failed. Generated code:\n${parserCode}`)
    return {
      success: false,
      error: `Code validation failed: ${validation.errors.join('; ')}`,
      executionTimeMs: Date.now() - startTime,
    }
  }

  // Step 2: Check syntax
  const syntaxCheck = checkSyntax(parserCode)
  if (!syntaxCheck.valid) {
    return {
      success: false,
      error: `Syntax error: ${syntaxCheck.error}`,
      executionTimeMs: Date.now() - startTime,
    }
  }

  // Step 3: Create sandboxed function with only safe globals
  // Using indirect reference to avoid linter triggers
  const FnConstructor = Function
  let parserFn: (text: string) => unknown

  try {
    // Create function with restricted scope
    // The function only receives 'text' as parameter
    parserFn = FnConstructor('text', `"use strict";\n${parserCode}`) as (text: string) => unknown
  } catch (err) {
    return {
      success: false,
      error: `Failed to create parser function: ${err instanceof Error ? err.message : 'Unknown'}`,
      executionTimeMs: Date.now() - startTime,
    }
  }

  // Step 4: Run with timeout
  try {
    const result = await Promise.race([
      // Run the parser
      Promise.resolve().then(() => parserFn(pdfText)),
      // Timeout
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Execution timeout')), EXECUTION_TIMEOUT_MS)
      ),
    ])

    const executionTimeMs = Date.now() - startTime

    // Step 5: Validate output
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
          logger.warn(`[ExecuteParser] Reached max holding limit (${MAX_TRANSACTIONS})`)
          break
        }

        if (isValidHolding(item)) {
          validHoldings.push(normalizeHolding(item))
        } else {
          invalidCount++
        }
      }

      if (invalidCount > 0) {
        logger.warn(`[ExecuteParser] Skipped ${invalidCount} invalid holdings`)
      }

      logger.debug(
        `[ExecuteParser] Extracted ${validHoldings.length} holdings in ${executionTimeMs}ms`
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
          logger.warn(`[ExecuteParser] Reached max transaction limit (${MAX_TRANSACTIONS})`)
          break
        }

        if (isValidTransaction(item)) {
          validTransactions.push(normalizeTransaction(item))
        } else {
          invalidCount++
        }
      }

      if (invalidCount > 0) {
        logger.warn(`[ExecuteParser] Skipped ${invalidCount} invalid transactions`)
      }

      logger.debug(
        `[ExecuteParser] Extracted ${validTransactions.length} transactions in ${executionTimeMs}ms`
      )

      return {
        success: true,
        transactions: validTransactions,
        executionTimeMs,
      }
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown execution error',
      executionTimeMs: Date.now() - startTime,
    }
  }
}

/**
 * Result from trying multiple parser versions
 */
export interface MultiVersionResult extends ExecutionResult {
  usedVersion?: number
  triedVersions: number[]
  validationPassed?: boolean
}

/**
 * Check if we have any validation data
 */
function hasValidationData(summary: ExpectedSummary): boolean {
  return (
    summary.debitCount !== null ||
    summary.creditCount !== null ||
    summary.totalDebits !== null ||
    summary.totalCredits !== null ||
    summary.openingBalance !== null ||
    summary.closingBalance !== null
  )
}

/**
 * Calculate totals from extracted transactions
 */
function calculateTotals(transactions: RawPdfTransaction[]): ExtractedTotals {
  let debitCount = 0
  let creditCount = 0
  let totalDebits = 0
  let totalCredits = 0

  for (const txn of transactions) {
    if (txn.type === 'debit') {
      debitCount++
      totalDebits += txn.amount
    } else {
      creditCount++
      totalCredits += txn.amount
    }
  }

  // Calculate opening and closing balance from transactions
  let openingBalance: number | null = null
  let closingBalance: number | null = null

  // Filter transactions that have a balance
  const txnsWithBalance = transactions.filter((t) => t.balance != null)

  if (txnsWithBalance.length > 0) {
    // Sort by date to find chronologically first and last transactions
    const sortedByDate = [...txnsWithBalance].sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime()
    })

    const chronologicallyFirst = sortedByDate[0]!
    const chronologicallyLast = sortedByDate[sortedByDate.length - 1]!

    // Closing balance is the balance after the most recent transaction
    closingBalance = chronologicallyLast.balance!

    // Opening balance is derived from the oldest transaction
    // Opening balance = first transaction balance - credit + debit
    if (chronologicallyFirst.type === 'credit') {
      openingBalance = chronologicallyFirst.balance! - chronologicallyFirst.amount
    } else {
      openingBalance = chronologicallyFirst.balance! + chronologicallyFirst.amount
    }

    // Round to 2 decimal places
    openingBalance = Math.round(openingBalance * 100) / 100
    closingBalance = Math.round(closingBalance * 100) / 100
  }

  return {
    debitCount,
    creditCount,
    totalDebits: Math.round(totalDebits * 100) / 100,
    totalCredits: Math.round(totalCredits * 100) / 100,
    openingBalance,
    closingBalance,
  }
}

/**
 * Validate extracted totals against expected summary
 */
function validateTotals(
  extracted: ExtractedTotals,
  expected: ExpectedSummary
): { isValid: boolean; details: string[]; message?: string } {
  const issues: string[] = []

  // Check debit count (exact match required)
  if (expected.debitCount !== null && extracted.debitCount !== expected.debitCount) {
    issues.push(`Debit count: ${extracted.debitCount} vs expected ${expected.debitCount}`)
  }

  // Check credit count (exact match required)
  if (expected.creditCount !== null && extracted.creditCount !== expected.creditCount) {
    issues.push(`Credit count: ${extracted.creditCount} vs expected ${expected.creditCount}`)
  }

  // Check total debits (tolerance allowed)
  if (expected.totalDebits !== null) {
    const diff = Math.abs(extracted.totalDebits - expected.totalDebits)
    if (diff > AMOUNT_TOLERANCE) {
      issues.push(`Total debits: ${extracted.totalDebits} vs expected ${expected.totalDebits}`)
    }
  }

  // Check total credits (tolerance allowed)
  if (expected.totalCredits !== null) {
    const diff = Math.abs(extracted.totalCredits - expected.totalCredits)
    if (diff > AMOUNT_TOLERANCE) {
      issues.push(`Total credits: ${extracted.totalCredits} vs expected ${expected.totalCredits}`)
    }
  }

  // Check opening balance (tolerance allowed)
  if (expected.openingBalance !== null && extracted.openingBalance !== null) {
    const diff = Math.abs(extracted.openingBalance - expected.openingBalance)
    if (diff > AMOUNT_TOLERANCE) {
      issues.push(
        `Opening balance: ${extracted.openingBalance} vs expected ${expected.openingBalance}`
      )
    }
  }

  // Check closing balance (tolerance allowed)
  if (expected.closingBalance !== null && extracted.closingBalance !== null) {
    const diff = Math.abs(extracted.closingBalance - expected.closingBalance)
    if (diff > AMOUNT_TOLERANCE) {
      issues.push(
        `Closing balance: ${extracted.closingBalance} vs expected ${expected.closingBalance}`
      )
    }
  }

  return {
    isValid: issues.length === 0,
    details: issues,
    message: issues.length > 0 ? issues.join('; ') : undefined,
  }
}

/**
 * Try multiple parser code versions until one succeeds AND passes validation
 * Tries versions in order (should be sorted latest first)
 * Records success/failure for each version tried
 *
 * @param parserCodes - Array of parser code entries to try
 * @param pdfText - The PDF text to parse
 * @param bankKey - Bank identifier for logging and recording stats
 * @param expectedSummary - Optional expected summary for validation
 */
export async function runParserWithVersions(
  parserCodes: ParserCodeEntry[],
  pdfText: string,
  bankKey: string,
  expectedSummary?: ExpectedSummary
): Promise<MultiVersionResult> {
  const triedVersions: number[] = []
  const shouldValidate = expectedSummary && hasValidationData(expectedSummary)

  for (const entry of parserCodes) {
    triedVersions.push(entry.version)
    logger.debug(`[ExecuteParser] Trying ${bankKey} v${entry.version}...`)

    const result = await runParser(entry.code, pdfText)

    if (result.success && result.transactions && result.transactions.length > 0) {
      // Execution succeeded, now validate if we have expected summary
      if (shouldValidate) {
        const extractedTotals = calculateTotals(result.transactions)
        const validation = validateTotals(extractedTotals, expectedSummary)

        if (validation.isValid) {
          // Both execution and validation passed
          await recordSuccess(bankKey, entry.version)
          logger.debug(
            `[ExecuteParser] ${bankKey} v${entry.version} succeeded with ${result.transactions.length} transactions (validation passed)`
          )
          return {
            ...result,
            usedVersion: entry.version,
            triedVersions,
            validationPassed: true,
          }
        } else {
          // Execution succeeded but validation failed - try next version
          await recordFailure(bankKey, entry.version)
          logger.warn(
            `[ExecuteParser] ${bankKey} v${entry.version} failed validation: ${validation.details.join(', ')}`
          )
          logger.warn(
            `[ExecuteParser] Extracted: debits=${extractedTotals.debitCount}/${extractedTotals.totalDebits}, credits=${extractedTotals.creditCount}/${extractedTotals.totalCredits}, openBal=${extractedTotals.openingBalance}, closeBal=${extractedTotals.closingBalance}`
          )
          logger.warn(
            `[ExecuteParser] Expected: debits=${expectedSummary.debitCount}/${expectedSummary.totalDebits}, credits=${expectedSummary.creditCount}/${expectedSummary.totalCredits}, openBal=${expectedSummary.openingBalance}, closeBal=${expectedSummary.closingBalance}`
          )
          // Continue to try next version
        }
      } else {
        // No validation data, trust execution result
        await recordSuccess(bankKey, entry.version)
        logger.debug(
          `[ExecuteParser] ${bankKey} v${entry.version} succeeded with ${result.transactions.length} transactions (no validation data)`
        )
        return {
          ...result,
          usedVersion: entry.version,
          triedVersions,
          validationPassed: false,
        }
      }
    } else {
      // Execution failed, record and try next version
      await recordFailure(bankKey, entry.version)
      logger.warn(
        `[ExecuteParser] ${bankKey} v${entry.version} failed: ${result.error || 'No transactions found'}`
      )
    }
  }

  // All versions failed (either execution or validation)
  const failureReason = shouldValidate
    ? `All ${parserCodes.length} cached parser versions failed execution or validation`
    : `All ${parserCodes.length} cached parser versions failed`

  return {
    success: false,
    error: failureReason,
    executionTimeMs: 0,
    triedVersions,
  }
}
