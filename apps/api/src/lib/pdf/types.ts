/**
 * Types for PDF statement parsing
 */

/**
 * Raw transaction extracted from PDF by generated parser code
 */
export interface RawPdfTransaction {
  date: string // YYYY-MM-DD format
  amount: number // Positive decimal
  type: 'credit' | 'debit'
  description: string
  balance?: number | null
}

/**
 * Validation totals computed from extracted transactions
 * Used to verify against statement summary
 */
export interface ExtractedTotals {
  debitCount: number
  creditCount: number
  totalDebits: number
  totalCredits: number
}

/**
 * Expected statement summary (from LLM extraction of printed summary)
 */
export interface ExpectedSummary {
  debitCount: number | null
  creditCount: number | null
  totalDebits: number | null
  totalCredits: number | null
  openingBalance: number | null
  closingBalance: number | null
}

/**
 * Result from LLM parser code generation
 */
export interface ParserCodeResult {
  parserCode: string
  detectedFormat: string
  dateFormat: string
  confidence: number
}

/**
 * Categorized transaction result
 */
export interface CategorizedTransaction {
  id: string
  category: string
  confidence: number
  summary: string
}

/**
 * Result from code execution
 */
export interface ExecutionResult {
  success: boolean
  transactions?: RawPdfTransaction[]
  error?: string
  executionTimeMs: number
}

/**
 * Result from transaction insertion
 */
export interface InsertResult {
  insertedCount: number
  skippedDuplicates: number
  transactionIds: string[]
}

/**
 * Transaction data for categorization (minimal info sent to LLM)
 */
export interface TransactionForCategorization {
  id: string
  date: string
  amount: number
  type: 'credit' | 'debit'
  description: string
}
