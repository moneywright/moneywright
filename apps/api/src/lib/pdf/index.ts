/**
 * PDF parsing module
 * Uses LLM to generate parsing code, then executes deterministically
 * Supports caching of parser code for reuse across statements
 *
 * Execution modes:
 * - E2B Sandbox (preferred): Set E2B_API_KEY for full VM isolation
 * - Local Function (fallback): Uses Function constructor with validation
 */

export * from './types'
export type { ExpectedSummary, ExtractedTotals } from './types'
export { generateParserCode } from './generate-parser-code'
export { validateCode, checkSyntax } from './validate-code'
export { runParser, runParserWithVersions } from './execute-parser'
export { isE2BConfigured, runParserInE2B, type ParsingMode } from './e2b-executor'
export { insertRawTransactions, updateTransactionCategories } from './insert-transactions'
export {
  categorizeTransactionsByIds,
  categorizeTransactionsStreaming,
  categorizeStatements,
} from './categorize-transactions'
export {
  generateBankKey,
  getParserCodes,
  getLatestVersion,
  saveParserCode,
  recordSuccess,
  recordFailure,
  clearParserCache,
  listCachedBanks,
} from './parser-code-cache'

// Investment statement parsing
export {
  generateInvestmentParserCode,
  type RawInvestmentHolding,
  type ExpectedInvestmentSummary,
  type ExtractedInvestmentTotals,
  type AgenticInvestmentParserResult,
} from './generate-investment-parser-code'
export {
  generateInvestmentSourceKey,
  getInvestmentParserCodes,
  getInvestmentLatestVersion,
  saveInvestmentParserCode,
  recordInvestmentSuccess,
  recordInvestmentFailure,
  clearInvestmentParserCache,
  listCachedInvestmentSources,
  runInvestmentParserWithVersions,
  type InvestmentParserCodeEntry,
} from './investment-parser-cache'
