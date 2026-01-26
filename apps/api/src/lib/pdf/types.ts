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
  openingBalance: number | null
  closingBalance: number | null
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
  isSubscription: boolean
}

/**
 * Raw investment holding extracted from investment statement
 */
export interface RawInvestmentHolding {
  investment_type: string
  symbol: string | null
  name: string
  isin: string | null
  units: number | null // null for balance-based holdings like PPF, EPF, FD
  average_cost: number | null
  current_price: number | null
  current_value: number
  invested_value: number | null
  folio_number: string | null
  maturity_date: string | null
  interest_rate: number | null
  currency: string | null // ISO currency code (USD, INR, etc.) - null uses source default
}

/**
 * Result from code execution
 * Can contain either transactions (bank statements) or holdings (investment statements)
 */
export interface ExecutionResult {
  success: boolean
  transactions?: RawPdfTransaction[]
  holdings?: RawInvestmentHolding[]
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
