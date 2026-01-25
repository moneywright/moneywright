/**
 * Transaction extraction using parser configuration
 * No LLM calls - pure deterministic parsing based on config
 */

import { parse, isValid } from 'date-fns'
import { nanoid } from 'nanoid'
import type { ParserConfig, RawTransaction, SheetData } from './types'
import { logger } from '../logger'

/**
 * Common date formats to try when parsing
 */
const DATE_FORMATS = [
  'yyyy-MM-dd',
  'dd-MM-yyyy',
  'dd/MM/yyyy',
  'MM/dd/yyyy',
  'dd-MMM-yyyy',
  'dd-MMM-yy',
  'dd MMM yyyy',
  'dd MMM yy',
  'MMM dd, yyyy',
  'yyyy/MM/dd',
  'd-M-yyyy',
  'd/M/yyyy',
]

/**
 * Convert config date format to date-fns format
 */
function convertDateFormat(format: string): string {
  const mapping: Record<string, string> = {
    'YYYY-MM-DD': 'yyyy-MM-dd',
    'DD-MM-YYYY': 'dd-MM-yyyy',
    'DD/MM/YYYY': 'dd/MM/yyyy',
    'MM/DD/YYYY': 'MM/dd/yyyy',
    'DD-MMM-YYYY': 'dd-MMM-yyyy',
    'DD-MMM-YY': 'dd-MMM-yy',
    'DD MMM YYYY': 'dd MMM yyyy',
    'DD MMM YY': 'dd MMM yy',
    'MMM DD, YYYY': 'MMM dd, yyyy',
    'YYYY/MM/DD': 'yyyy/MM/dd',
  }
  return (
    mapping[format] ||
    format.toLowerCase().replace(/yyyy/g, 'yyyy').replace(/dd/g, 'dd').replace(/mm/g, 'MM')
  )
}

/**
 * Parse a date string using the config format or auto-detect
 */
function parseDate(value: string | number | null | boolean, configFormat: string): string | null {
  if (value === null || value === undefined) return null

  const dateStr = String(value).trim()
  if (!dateStr) return null

  // Try config format first
  const fnsFormat = convertDateFormat(configFormat)
  try {
    const parsed = parse(dateStr, fnsFormat, new Date())
    if (isValid(parsed)) {
      return parsed.toISOString().split('T')[0]!
    }
  } catch {
    // Continue to try other formats
  }

  // Try common formats
  for (const fmt of DATE_FORMATS) {
    try {
      const parsed = parse(dateStr, fmt, new Date())
      if (isValid(parsed)) {
        return parsed.toISOString().split('T')[0]!
      }
    } catch {
      continue
    }
  }

  // Try direct Date parsing as last resort
  const directParsed = new Date(dateStr)
  if (isValid(directParsed)) {
    return directParsed.toISOString().split('T')[0]!
  }

  return null
}

/**
 * Parse an amount string to a number
 */
function parseAmount(value: string | number | null | boolean): number | null {
  if (value === null || value === undefined) return null

  if (typeof value === 'number') return Math.abs(value)

  const str = String(value).trim()
  if (!str) return null

  // Remove currency symbols, commas, spaces
  let cleaned = str.replace(/[₹$€£,\s]/g, '')

  // Handle parentheses for negative (accounting format)
  const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')')
  if (isNegative) {
    cleaned = cleaned.slice(1, -1)
  }

  // Handle CR/DR suffixes
  cleaned = cleaned.replace(/\s*(CR|DR)$/i, '')

  // Handle negative sign
  cleaned = cleaned.replace(/^-/, '')

  const num = parseFloat(cleaned)
  return isNaN(num) ? null : Math.abs(num)
}

/**
 * Get column value by name or index
 */
function getColumnValue(
  row: (string | number | null | boolean)[],
  headers: string[],
  column: string | number
): string | number | null | boolean {
  if (typeof column === 'number') {
    return row[column] ?? null
  }

  const index = headers.findIndex((h) => h.toLowerCase() === column.toLowerCase())
  return index >= 0 ? (row[index] ?? null) : null
}

/**
 * Extract transactions from sheet data using parser config
 */
export function extractTransactions(sheetData: SheetData, config: ParserConfig): RawTransaction[] {
  const transactions: RawTransaction[] = []
  const { headers, data } = sheetData

  logger.debug(`[TxnExtract] Extracting from ${data.length} rows`)
  logger.debug(`[TxnExtract] Config: ${JSON.stringify(config)}`)

  // Skip rows before data start
  const startRow = Math.max(0, config.dataStartRow - config.headerRow - 1)
  const dataRows = data.slice(startRow)

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    if (!row) continue

    try {
      // Extract date
      const dateValue = getColumnValue(row, headers, config.dateColumn)
      const date = parseDate(dateValue, config.dateFormat)

      if (!date) {
        logger.debug(`[TxnExtract] Row ${i}: skipping - no valid date from "${dateValue}"`)
        continue
      }

      // Extract description
      const description = String(
        getColumnValue(row, headers, config.descriptionColumn) || ''
      ).trim()
      if (!description) {
        logger.debug(`[TxnExtract] Row ${i}: skipping - no description`)
        continue
      }

      // Extract amount and determine type
      let amount: number | null = null
      let type: 'credit' | 'debit' = 'debit'

      if (config.amountFormat === 'split') {
        // Separate credit/debit columns
        const creditValue = config.creditColumn
          ? getColumnValue(row, headers, config.creditColumn)
          : null
        const debitValue = config.debitColumn
          ? getColumnValue(row, headers, config.debitColumn)
          : null

        const creditAmount = parseAmount(creditValue)
        const debitAmount = parseAmount(debitValue)

        if (creditAmount && creditAmount > 0) {
          amount = creditAmount
          type = 'credit'
        } else if (debitAmount && debitAmount > 0) {
          amount = debitAmount
          type = 'debit'
        }
      } else {
        // Single amount column
        const amountValue = config.amountColumn
          ? getColumnValue(row, headers, config.amountColumn)
          : null
        amount = parseAmount(amountValue)

        if (config.typeDetection === 'sign') {
          // Determine type from sign
          const rawValue = String(amountValue || '')
          const isNegative =
            rawValue.includes('-') || (rawValue.includes('(') && rawValue.includes(')'))
          type = isNegative ? 'debit' : 'credit'
        } else if (config.typeDetection === 'column' && config.typeColumn) {
          // Determine type from type column
          const typeValue = String(
            getColumnValue(row, headers, config.typeColumn) || ''
          ).toLowerCase()
          if (
            typeValue.includes('cr') ||
            typeValue.includes('credit') ||
            typeValue.includes('deposit')
          ) {
            type = 'credit'
          } else {
            type = 'debit'
          }
        }
      }

      if (!amount || amount <= 0) {
        logger.debug(`[TxnExtract] Row ${i}: skipping - no valid amount`)
        continue
      }

      // Extract balance if available
      let balance: number | null = null
      if (config.balanceColumn) {
        balance = parseAmount(getColumnValue(row, headers, config.balanceColumn))
      }

      transactions.push({
        id: nanoid(),
        date,
        amount,
        type,
        description,
        balance,
      })
    } catch (error) {
      logger.warn(
        `[TxnExtract] Row ${i}: error - ${error instanceof Error ? error.message : 'Unknown'}`
      )
      continue
    }
  }

  logger.debug(
    `[TxnExtract] Extracted ${transactions.length} transactions from ${dataRows.length} rows`
  )
  return transactions
}
