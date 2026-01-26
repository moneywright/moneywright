/**
 * Zod schemas for LLM structured output
 *
 * Note: OpenAI structured outputs require all fields to be in the 'required' array.
 * Use .nullable() for optional fields instead of .optional()
 *
 * Document Types:
 * - bank_statement: Bank account statements (savings, current, checking)
 * - credit_card_statement: Credit card statements
 * - investment_statement: Investment/portfolio statements (stocks, mutual funds, ETF, PPF, etc.)
 */

import { z } from 'zod/v4'

// ============================================================================
// Document Type Detection & Info Extraction
// ============================================================================

/**
 * Document types supported by the system
 */
export const documentTypes = [
  'bank_statement',
  'credit_card_statement',
  'investment_statement',
] as const

export type DocumentType = (typeof documentTypes)[number]

/**
 * Investment source types for detection
 */
export const investmentSourceTypes = [
  // India - Domestic brokers
  'zerodha',
  'groww',
  'upstox',
  'angel_one',
  'icici_direct',
  'hdfc_securities',
  'kotak_securities',
  // India - MF platforms
  'mf_central',
  'cams',
  'kfintech',
  // India - US stocks
  'vested',
  'indmoney',
  // India - Fixed income
  'ppf',
  'epf',
  'nps',
  'fd',
  // Generic
  'manual',
  'other',
] as const

export type InvestmentSourceType = (typeof investmentSourceTypes)[number]

/**
 * Transaction schema for parsing
 */
export const transactionSchema = z.object({
  date: z.string().describe('Transaction date in YYYY-MM-DD format'),
  type: z.enum(['credit', 'debit']).describe('Whether money came in (credit) or went out (debit)'),
  amount: z.number().positive().describe('Transaction amount as a positive number'),
  original_description: z.string().describe('Exact description text from the statement'),
  summary: z.string().describe('Brief, clear summary of what this transaction is for'),
  category: z.string().describe('Category code from the provided list'),
  category_confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence score for category assignment (0.0 to 1.0)'),
})

/**
 * Bank statement summary schema
 */
export const bankStatementSummarySchema = z.object({
  type: z.literal('bank_statement'),
  opening_balance: z.number().nullable().describe('Opening balance or null if not found'),
  closing_balance: z.number().nullable().describe('Closing balance or null if not found'),
  total_credits: z.number().nullable().describe('Total credits or null if not found'),
  total_debits: z.number().nullable().describe('Total debits or null if not found'),
  credit_count: z.number().nullable().describe('Number of credit transactions or null'),
  debit_count: z.number().nullable().describe('Number of debit transactions or null'),
})

/**
 * Credit card statement summary schema
 */
export const creditCardSummarySchema = z.object({
  type: z.literal('credit_card_statement'),
  credit_limit: z.number().nullable().describe('Credit limit or null if not found'),
  available_limit: z.number().nullable().describe('Available credit or null if not found'),
  previous_balance: z.number().nullable().describe('Previous balance or null if not found'),
  payments_received: z.number().nullable().describe('Payments received or null if not found'),
  new_charges: z.number().nullable().describe('New charges or null if not found'),
  total_due: z.number().nullable().describe('Total amount due or null if not found'),
  minimum_due: z.number().nullable().describe('Minimum payment due or null if not found'),
  due_date: z.string().nullable().describe('Payment due date or null if not found'),
  credit_count: z.number().nullable().describe('Number of credit transactions or null'),
  debit_count: z.number().nullable().describe('Number of debit transactions or null'),
})

/**
 * Page parse result schema
 */
export const pageParseResultSchema = z.object({
  statement_type: z
    .enum(['bank_statement', 'credit_card_statement'])
    .nullable()
    .describe('Type of statement or null if unclear'),
  period_start: z.string().nullable().describe('Statement period start date (YYYY-MM-DD) or null'),
  period_end: z.string().nullable().describe('Statement period end date (YYYY-MM-DD) or null'),
  summary: z
    .union([bankStatementSummarySchema, creditCardSummarySchema])
    .nullable()
    .describe('Statement summary or null if not on this page'),
  transactions: z.array(transactionSchema).describe('List of transactions found on this page'),
})

/**
 * Statement summary schema - extracted from the printed summary section of the statement
 * These are the EXACT numbers printed on the statement, NOT calculated from transactions
 */
export const statementSummarySchema = z.object({
  // Transaction counts (exact numbers printed on statement)
  debit_count: z
    .number()
    .nullable()
    .describe(
      'Number of debit/withdrawal transactions (Dr Count) printed on statement, or null if not shown'
    ),
  credit_count: z
    .number()
    .nullable()
    .describe(
      'Number of credit/deposit transactions (Cr Count) printed on statement, or null if not shown'
    ),

  // Transaction totals (exact amounts printed on statement)
  total_debits: z
    .number()
    .nullable()
    .describe('Total debit/withdrawal amount printed on statement summary, or null if not shown'),
  total_credits: z
    .number()
    .nullable()
    .describe('Total credit/deposit amount printed on statement summary, or null if not shown'),

  // Balances - CRITICAL: Always try to extract these
  opening_balance: z
    .number()
    .nullable()
    .describe(
      'Opening balance - from summary section OR derived from oldest transaction (balance +/- amount based on type). Only null if no transactions have balance data.'
    ),
  closing_balance: z
    .number()
    .nullable()
    .describe(
      'Closing balance - from summary section OR from the most recent transaction balance column. Only null if no transactions have balance data.'
    ),
})

/**
 * Account info schema (extracted from full statement) - for bank/credit card statements
 */
export const accountInfoSchema = z.object({
  account_type: z
    .string()
    .describe(
      'Type of account (savings_account, current_account, credit_card, checking_account, etc.)'
    ),
  institution_id: z
    .string()
    .describe('Institution ID code from the provided list (e.g., HDFC, ICICI, SBI)'),
  institution_name: z.string().describe('Full name of the bank or financial institution'),
  account_number: z.string().describe('Full account or card number'),
  account_holder_name: z.string().nullable().describe('Name on the account or null if not found'),
  product_name: z
    .string()
    .nullable()
    .describe(
      'Account product/variant name. For credit cards: "Biz Power", "Platinum Travel", "Regalia", "SimplyCLICK", "Millennia", "Amazon Pay", "Rewards". For bank accounts: "Savings Max", "Imperia", "Classic", "Premium", "Privilege", "Salary Account". For CO-BRANDED cards/accounts (bank partnered with fintech/app): include the partner name like "Slice", "Jupiter", "Fi", "Niyo", "OneCard", "Uni", "Cred", "Paytm", "PhonePe", "Google Pay". Example: "Jupiter" for Federal Bank + Jupiter, "Slice" for SBM + Slice. Extract the specific product/program/partner name, NOT the bank name. Return null if not found.'
    ),

  // Statement period
  period_start: z
    .string()
    .nullable()
    .describe('Statement period start date in YYYY-MM-DD format, or null if not found'),
  period_end: z
    .string()
    .nullable()
    .describe('Statement period end date in YYYY-MM-DD format, or null if not found'),

  // Statement summary - exact numbers from the printed summary section
  summary: statementSummarySchema.describe(
    'Statement summary with exact numbers printed on the statement'
  ),

  // Credit card specific fields
  total_dues: z
    .number()
    .nullable()
    .describe('Total amount due / statement balance (for credit cards), or null'),
  minimum_dues: z.number().nullable().describe('Minimum payment due (for credit cards), or null'),
  payment_due_date: z
    .string()
    .nullable()
    .describe('Payment due date in YYYY-MM-DD format (for credit cards), or null'),
})

// ============================================================================
// Unified Document Info Schema (for initial document type detection)
// ============================================================================

/**
 * Investment statement summary schema
 */
export const investmentStatementSummarySchema = z.object({
  total_invested: z
    .number()
    .nullable()
    .describe('Total invested amount / cost basis, or null if not shown'),
  total_current: z.number().nullable().describe('Total current market value, or null if not shown'),
  total_gain_loss: z.number().nullable().describe('Total gain/loss amount, or null if not shown'),
  gain_loss_percent: z
    .number()
    .nullable()
    .describe('Total gain/loss percentage, or null if not shown'),
  holdings_count: z.number().nullable().describe('Number of holdings, or null if not shown'),
})

/**
 * Unified document info schema - detects document type and extracts relevant info
 * Used for initial parsing to determine which parsing flow to use
 */
export const documentInfoSchema = z.object({
  // Document type detection (CRITICAL - determines parsing flow)
  document_type: z
    .enum(['bank_statement', 'credit_card_statement', 'investment_statement'])
    .describe(
      'Type of document: bank_statement (savings/current/checking account), credit_card_statement (credit card), or investment_statement (stocks, mutual funds, ETF, PPF, EPF, NPS, FD, bonds, demat holdings, portfolio statement)'
    ),

  // === Fields for bank_statement / credit_card_statement ===
  account_type: z
    .string()
    .nullable()
    .describe(
      'For bank/credit card: Type of account (savings_account, current_account, credit_card, etc.). Null for investment statements.'
    ),
  institution_id: z
    .string()
    .nullable()
    .describe(
      'For bank/credit card: Institution ID code (e.g., HDFC, ICICI, SBI). Null for investment statements.'
    ),
  institution_name: z
    .string()
    .nullable()
    .describe('For bank/credit card: Full name of the bank. Null for investment statements.'),
  account_number: z
    .string()
    .nullable()
    .describe('For bank/credit card: Full account or card number. Null for investment statements.'),
  account_holder_name: z.string().nullable().describe('Name on the account, or null if not found'),
  product_name: z.string().nullable().describe('Account product/variant name, or null'),

  // === Fields for investment_statement ===
  source_type: z
    .enum([
      'zerodha',
      'groww',
      'upstox',
      'angel_one',
      'icici_direct',
      'hdfc_securities',
      'kotak_securities',
      'mf_central',
      'cams',
      'kfintech',
      'vested',
      'indmoney',
      'ppf',
      'epf',
      'nps',
      'fd',
      'other',
    ])
    .nullable()
    .describe(
      'For investment: Source platform type. Zerodha, Groww for stocks/MF. MF Central/CAMS/KFintech for consolidated MF statements. PPF/EPF/NPS/FD for respective statements. Null for bank/credit card statements.'
    ),
  source_name: z
    .string()
    .nullable()
    .describe(
      'For investment: Human-readable source name like "Zerodha Holdings", "Groww Portfolio", "MF Central CAS". Null for bank/credit card statements.'
    ),
  account_identifier: z
    .string()
    .nullable()
    .describe(
      'For investment: Demat ID, Client ID, PAN, Folio number, or other unique identifier. Null for bank/credit card statements.'
    ),

  // === Common fields ===
  period_start: z
    .string()
    .nullable()
    .describe('Statement period start date in YYYY-MM-DD format, or null'),
  period_end: z
    .string()
    .nullable()
    .describe('Statement period end date in YYYY-MM-DD format, or null'),
  statement_date: z
    .string()
    .nullable()
    .describe(
      'For investment: The as-of date of the statement/holdings in YYYY-MM-DD format. For bank/credit card, this is the same as period_end.'
    ),

  // === Summary (type-specific) ===
  bank_summary: statementSummarySchema
    .nullable()
    .describe('For bank/credit card statements: transaction summary. Null for investments.'),
  investment_summary: investmentStatementSummarySchema
    .nullable()
    .describe('For investment statements: portfolio summary. Null for bank/credit card.'),

  // Credit card specific
  total_dues: z.number().nullable().describe('For credit cards: Total amount due, or null'),
  minimum_dues: z.number().nullable().describe('For credit cards: Minimum payment due, or null'),
  payment_due_date: z
    .string()
    .nullable()
    .describe('For credit cards: Payment due date in YYYY-MM-DD format, or null'),

  // Investment detection hints
  has_holdings: z
    .boolean()
    .nullable()
    .describe('For investment: Does the statement contain a holdings table/list?'),
  has_transactions: z
    .boolean()
    .nullable()
    .describe('For investment: Does the statement contain buy/sell transaction history?'),
})

// ============================================================================
// Investment Holdings Extraction Schemas
// ============================================================================

/**
 * Investment holding types
 */
export const investmentHoldingTypes = [
  'stock',
  'mutual_fund',
  'etf',
  'bond',
  'ppf',
  'epf',
  'nps',
  'fd',
  'gold',
  'reit',
  'other',
] as const

export type InvestmentHoldingType = (typeof investmentHoldingTypes)[number]

/**
 * Single investment holding schema (extracted from statement)
 */
export const investmentHoldingSchema = z.object({
  investment_type: z
    .enum([
      'stock',
      'mutual_fund',
      'etf',
      'bond',
      'ppf',
      'epf',
      'nps',
      'fd',
      'gold',
      'reit',
      'other',
    ])
    .describe(
      'Type of investment: stock, mutual_fund, etf, bond, ppf, epf, nps, fd, gold, reit, or other'
    ),
  symbol: z
    .string()
    .nullable()
    .describe('Stock ticker symbol, mutual fund scheme code, or ISIN. Null if not available.'),
  name: z.string().describe('Full name of the instrument (stock name, fund name, etc.)'),
  isin: z.string().nullable().describe('ISIN code if available, or null'),
  units: z
    .number()
    .nullable()
    .describe(
      'Number of units/shares held. For PPF, EPF, FD, and other balance-based investments where units do not apply, return null.'
    ),
  average_cost: z
    .number()
    .nullable()
    .describe('Average buy price per unit (cost basis per unit), or null if not shown'),
  current_price: z
    .number()
    .nullable()
    .describe('Current NAV or market price per unit, or null if not shown'),
  current_value: z.number().describe('Current market value of the holding (units × current_price)'),
  invested_value: z
    .number()
    .nullable()
    .describe('Total invested amount (units × average_cost), or null if not shown'),
  folio_number: z
    .string()
    .nullable()
    .describe('For mutual funds: Folio number. Null for other types.'),
  maturity_date: z
    .string()
    .nullable()
    .describe('For FD, bonds: Maturity date in YYYY-MM-DD format. Null for others.'),
  interest_rate: z
    .number()
    .nullable()
    .describe(
      'For FD, PPF, bonds: Interest rate as percentage (e.g., 7.1 for 7.1%). Null for others.'
    ),
})

/**
 * Investment holdings extraction result schema
 */
export const investmentHoldingsResultSchema = z.object({
  statement_date: z.string().describe('The as-of date for these holdings in YYYY-MM-DD format'),
  currency: z.string().describe('Currency code (INR, USD, etc.)'),
  holdings: z
    .array(investmentHoldingSchema)
    .describe('List of holdings extracted from the statement'),
  summary: z.object({
    total_invested: z
      .number()
      .nullable()
      .describe('Sum of all invested values, or null if not calculable'),
    total_current: z.number().describe('Sum of all current values'),
    total_gain_loss: z
      .number()
      .nullable()
      .describe('Total gain/loss (current - invested), or null if not calculable'),
    holdings_count: z.number().describe('Number of holdings'),
  }),
})

// ============================================================================
// Investment Transactions Extraction Schemas
// ============================================================================

/**
 * Investment transaction types
 */
export const investmentTransactionTypes = [
  'buy',
  'sell',
  'dividend',
  'interest',
  'sip',
  'switch_in',
  'switch_out',
  'contribution',
  'withdrawal',
] as const

export type InvestmentTransactionType = (typeof investmentTransactionTypes)[number]

/**
 * Single investment transaction schema
 */
export const investmentTransactionSchema = z.object({
  transaction_type: z
    .enum([
      'buy',
      'sell',
      'dividend',
      'interest',
      'sip',
      'switch_in',
      'switch_out',
      'contribution',
      'withdrawal',
    ])
    .describe('Type of transaction'),
  transaction_date: z.string().describe('Transaction date in YYYY-MM-DD format'),
  symbol: z.string().nullable().describe('Stock ticker or scheme code, or null'),
  name: z.string().describe('Name of the instrument'),
  units: z
    .number()
    .nullable()
    .describe('Number of units bought/sold, or null for dividends/interest'),
  price_per_unit: z
    .number()
    .nullable()
    .describe('Price per unit at transaction, or null for dividends/interest'),
  amount: z.number().describe('Total transaction value (positive number)'),
  fees: z
    .number()
    .nullable()
    .describe('Brokerage, STT, stamp duty, or other fees. Null if not shown.'),
  description: z.string().nullable().describe('Original description from statement, or null'),
})

/**
 * Investment transactions extraction result schema
 */
export const investmentTransactionsResultSchema = z.object({
  transactions: z
    .array(investmentTransactionSchema)
    .describe('List of transactions extracted from the statement'),
  summary: z.object({
    total_buy: z.number().describe('Total amount of buy transactions'),
    total_sell: z.number().describe('Total amount of sell transactions'),
    total_dividend: z.number().describe('Total dividend received'),
    transaction_count: z.number().describe('Total number of transactions'),
  }),
})

// ============================================================================
// Investment Metadata Extraction Schema
// ============================================================================

/**
 * Schema for extracting investment metadata from statement
 * Used specifically for identifying accounts and creating proper source names
 */
export const investmentMetadataSchema = z.object({
  // Account identifier - CRITICAL for distinguishing multiple accounts of same type
  account_identifier: z
    .string()
    .nullable()
    .describe(
      'Unique account identifier. For EPF: Member ID (e.g., "TNMAS00123456789012"). ' +
        'For PPF: Account number. For Zerodha/Groww: Demat account or Client ID. ' +
        'For MF Central/CAMS: PAN or Folio number. For NPS: PRAN number. ' +
        'Extract the MOST SPECIFIC identifier that uniquely identifies this account.'
    ),

  // Institution name - for generating source name
  institution: z
    .string()
    .nullable()
    .describe(
      'Institution/company name managing the account. For EPF: Employer name or "EPFO". ' +
        'For PPF: Bank name (e.g., "SBI", "HDFC Bank"). For demat: Broker name. ' +
        'For MF: AMC name or "Various" if multiple. Extract the specific institution name.'
    ),

  // Statement date
  statement_date: z
    .string()
    .nullable()
    .describe(
      'As-of date for the statement in YYYY-MM-DD format. The date when holdings were valued.'
    ),

  // Portfolio summary
  summary: investmentStatementSummarySchema
    .nullable()
    .describe('Portfolio summary if available in the statement'),
})

export type InvestmentMetadata = z.infer<typeof investmentMetadataSchema>

// ============================================================================
// Type exports
// ============================================================================

export type TransactionParsed = z.infer<typeof transactionSchema>
export type BankStatementSummary = z.infer<typeof bankStatementSummarySchema>
export type StatementSummary = z.infer<typeof statementSummarySchema>
export type CreditCardSummary = z.infer<typeof creditCardSummarySchema>
export type PageParseResult = z.infer<typeof pageParseResultSchema>
export type AccountInfo = z.infer<typeof accountInfoSchema>
export type DocumentInfo = z.infer<typeof documentInfoSchema>
export type InvestmentStatementSummary = z.infer<typeof investmentStatementSummarySchema>
export type InvestmentHoldingParsed = z.infer<typeof investmentHoldingSchema>
export type InvestmentHoldingsResult = z.infer<typeof investmentHoldingsResultSchema>
export type InvestmentTransactionParsed = z.infer<typeof investmentTransactionSchema>
export type InvestmentTransactionsResult = z.infer<typeof investmentTransactionsResultSchema>
