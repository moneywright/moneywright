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
 * IMPORTANT: Only extract values that are EXPLICITLY PRINTED in the document.
 * DO NOT calculate these values from individual holdings.
 */
export const investmentStatementSummarySchema = z.object({
  total_invested: z
    .number()
    .nullable()
    .describe(
      'Total invested amount / cost basis ONLY if explicitly printed in a summary section. DO NOT calculate from holdings. Return null if not explicitly shown.'
    ),
  total_current: z
    .number()
    .nullable()
    .describe(
      'Total current market value ONLY if explicitly printed in a summary section. DO NOT calculate from holdings. Return null if not explicitly shown.'
    ),
  total_gain_loss: z
    .number()
    .nullable()
    .describe(
      'Total gain/loss amount ONLY if explicitly printed in a summary section. DO NOT calculate. Return null if not explicitly shown.'
    ),
  gain_loss_percent: z
    .number()
    .nullable()
    .describe(
      'Total gain/loss percentage ONLY if explicitly printed in a summary section. DO NOT calculate. Return null if not explicitly shown.'
    ),
  holdings_count: z
    .number()
    .nullable()
    .describe(
      'Number of holdings ONLY if explicitly printed in a summary section. DO NOT count from the holdings table. Return null if not explicitly shown.'
    ),
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
// Insurance Policy Extraction Schemas
// ============================================================================

/**
 * Insurance policy types
 */
export const insurancePolicyTypes = [
  'life_insurance',
  'health_insurance',
  'vehicle_insurance',
] as const

export type InsurancePolicyType = (typeof insurancePolicyTypes)[number]

/**
 * Premium frequency options
 */
export const premiumFrequencies = ['monthly', 'quarterly', 'half_yearly', 'yearly'] as const

export type PremiumFrequency = (typeof premiumFrequencies)[number]

/**
 * Life insurance specific details schema
 */
export const lifeInsuranceDetailsSchema = z.object({
  life_insurance_type: z
    .enum(['term', 'whole_life', 'endowment', 'ulip', 'other'])
    .nullable()
    .describe('Type of life insurance policy'),
  nominee_name: z.string().nullable().describe('Name of the nominee'),
  nominee_relation: z.string().nullable().describe('Relationship with the nominee'),
  death_benefit: z.number().nullable().describe('Death benefit amount'),
  maturity_benefit: z.number().nullable().describe('Maturity benefit amount, if applicable'),
  rider_details: z
    .array(z.string())
    .nullable()
    .describe(
      'List of additional riders (e.g., "Critical Illness Rider", "Accidental Death Benefit")'
    ),
})

/**
 * Health insurance specific details schema
 */
export const healthInsuranceDetailsSchema = z.object({
  health_insurance_type: z
    .enum(['individual', 'family_floater', 'group', 'critical_illness'])
    .nullable()
    .describe('Type of health insurance policy'),
  covered_members: z
    .array(
      z.object({
        name: z.string().describe('Name of the covered member'),
        relation: z.string().describe('Relationship with the policyholder'),
        age: z.number().nullable().describe('Age of the member'),
      })
    )
    .nullable()
    .describe('List of members covered under the policy'),
  room_rent_limit: z
    .union([z.number(), z.literal('no_limit')])
    .nullable()
    .describe('Daily room rent limit or "no_limit" if unlimited'),
  co_pay_percentage: z.number().nullable().describe('Co-payment percentage, if applicable'),
  pre_existing_waiting_period: z
    .string()
    .nullable()
    .describe('Waiting period for pre-existing conditions (e.g., "4 years")'),
  network_hospitals: z.string().nullable().describe('Network hospital information'),
})

/**
 * Vehicle insurance specific details schema
 */
export const vehicleInsuranceDetailsSchema = z.object({
  vehicle_insurance_type: z
    .enum(['comprehensive', 'third_party', 'own_damage'])
    .nullable()
    .describe('Type of vehicle insurance policy'),
  vehicle_make: z.string().nullable().describe('Vehicle manufacturer (e.g., "Maruti", "Honda")'),
  vehicle_model: z.string().nullable().describe('Vehicle model (e.g., "Swift", "City")'),
  vehicle_year: z.number().nullable().describe('Year of manufacture'),
  registration_number: z
    .string()
    .nullable()
    .describe('Vehicle registration number (e.g., "MH12AB1234")'),
  idv: z.number().nullable().describe('Insured Declared Value of the vehicle'),
  add_ons: z
    .array(z.string())
    .nullable()
    .describe(
      'List of add-ons (e.g., "Zero Depreciation", "Roadside Assistance", "Engine Protection")'
    ),
})

/**
 * Insurance policy extraction schema - for LLM structured output
 * Used to parse insurance policy documents
 */
export const insurancePolicySchema = z.object({
  // Policy type detection
  policy_type: z
    .enum(['life_insurance', 'health_insurance', 'vehicle_insurance'])
    .describe(
      'Type of insurance policy: life_insurance (term, whole life, endowment, ULIP), ' +
        'health_insurance (individual, family floater, critical illness), or ' +
        'vehicle_insurance (car, bike comprehensive or third party)'
    ),

  // Common fields
  provider: z
    .string()
    .describe('Insurance company name (e.g., "HDFC Life", "ICICI Lombard", "Star Health")'),
  institution: z
    .string()
    .nullable()
    .describe(
      'Institution ID code from the provided list for logo lookup (e.g., "hdfc_life", "icici_lombard", "star_health", "lic"). ' +
        'Must be lowercase with underscores. Use null if provider is not in the list.'
    ),
  policy_number: z
    .string()
    .nullable()
    .describe('Policy number or certificate number as printed on the document'),
  policy_holder_name: z.string().nullable().describe('Name of the policyholder'),
  sum_insured: z.number().nullable().describe('Sum insured / coverage amount / sum assured'),
  premium_amount: z.number().nullable().describe('Premium amount to be paid'),
  premium_frequency: z
    .enum(['monthly', 'quarterly', 'half_yearly', 'yearly'])
    .nullable()
    .describe('How often the premium is paid'),
  start_date: z
    .string()
    .nullable()
    .describe('Policy start date / inception date in YYYY-MM-DD format'),
  end_date: z.string().nullable().describe('Policy end date / expiry date in YYYY-MM-DD format'),

  // Type-specific details (one will be populated based on policy_type)
  life_insurance_details: lifeInsuranceDetailsSchema
    .nullable()
    .describe('Life insurance specific details. Null if not life insurance.'),
  health_insurance_details: healthInsuranceDetailsSchema
    .nullable()
    .describe('Health insurance specific details. Null if not health insurance.'),
  vehicle_insurance_details: vehicleInsuranceDetailsSchema
    .nullable()
    .describe('Vehicle insurance specific details. Null if not vehicle insurance.'),
})

// ============================================================================
// Loan Document Extraction Schemas
// ============================================================================

/**
 * Loan types
 */
export const loanTypes = [
  'personal_loan',
  'home_loan',
  'vehicle_loan',
  'education_loan',
  'business_loan',
  'gold_loan',
] as const

export type LoanType = (typeof loanTypes)[number]

/**
 * Interest type options
 */
export const interestTypes = ['fixed', 'floating'] as const

export type InterestType = (typeof interestTypes)[number]

/**
 * Home loan specific details schema
 */
export const homeLoanDetailsSchema = z.object({
  property_address: z.string().nullable().describe('Address of the property'),
  property_type: z
    .enum(['apartment', 'house', 'plot', 'commercial'])
    .nullable()
    .describe('Type of property'),
  co_borrower_name: z.string().nullable().describe('Name of the co-borrower, if any'),
  collateral_value: z.number().nullable().describe('Value of the property/collateral'),
})

/**
 * Vehicle loan specific details schema
 */
export const vehicleLoanDetailsSchema = z.object({
  vehicle_make: z.string().nullable().describe('Vehicle manufacturer (e.g., "Honda", "Maruti")'),
  vehicle_model: z.string().nullable().describe('Vehicle model (e.g., "City", "Swift")'),
  vehicle_year: z.number().nullable().describe('Year of manufacture'),
  registration_number: z.string().nullable().describe('Vehicle registration number'),
  vehicle_type: z.enum(['car', 'two_wheeler', 'commercial']).nullable().describe('Type of vehicle'),
})

/**
 * Education loan specific details schema
 */
export const educationLoanDetailsSchema = z.object({
  institution_name: z.string().nullable().describe('Name of the educational institution'),
  course_name: z.string().nullable().describe('Name of the course/program'),
  student_name: z.string().nullable().describe('Name of the student'),
  moratorium_period: z
    .string()
    .nullable()
    .describe('Moratorium/repayment holiday period (e.g., "Course duration + 6 months")'),
})

/**
 * Business loan specific details schema
 */
export const businessLoanDetailsSchema = z.object({
  business_name: z.string().nullable().describe('Name of the business'),
  loan_purpose: z.string().nullable().describe('Purpose of the loan'),
  collateral_details: z.string().nullable().describe('Collateral/security details, if any'),
})

/**
 * Gold loan specific details schema
 */
export const goldLoanDetailsSchema = z.object({
  gold_weight: z.number().nullable().describe('Weight of gold in grams'),
  gold_purity: z.string().nullable().describe('Purity of gold (e.g., "22K", "24K")'),
  collateral_value: z.number().nullable().describe('Value of gold collateral'),
})

/**
 * Personal loan specific details schema
 */
export const personalLoanDetailsSchema = z.object({
  loan_purpose: z.string().nullable().describe('Purpose of the loan, if mentioned'),
})

/**
 * Loan document extraction schema - for LLM structured output
 * Used to parse loan documents
 */
export const loanDocumentSchema = z.object({
  // Loan type detection
  loan_type: z
    .enum([
      'personal_loan',
      'home_loan',
      'vehicle_loan',
      'education_loan',
      'business_loan',
      'gold_loan',
    ])
    .describe(
      'Type of loan: personal_loan (unsecured), home_loan (housing/mortgage), ' +
        'vehicle_loan (car/bike), education_loan (student), business_loan, or gold_loan'
    ),

  // Common fields
  lender: z.string().describe('Bank or NBFC name (e.g., "HDFC Bank", "SBI", "Bajaj Finserv")'),
  institution: z
    .string()
    .nullable()
    .describe(
      'Institution ID code from the provided list for logo lookup (e.g., "hdfc", "sbi", "icici", "axis", "kotak"). ' +
        'Must be lowercase. Use null if lender is not in the list.'
    ),
  loan_account_number: z.string().nullable().describe('Loan account number or reference number'),
  borrower_name: z.string().nullable().describe('Name of the primary borrower'),
  principal_amount: z.number().nullable().describe('Original loan amount / sanctioned amount'),
  interest_rate: z
    .number()
    .nullable()
    .describe('Interest rate in percentage (e.g., 10.5 for 10.5%)'),
  interest_type: z
    .enum(['fixed', 'floating'])
    .nullable()
    .describe('Type of interest rate: fixed or floating'),
  emi_amount: z.number().nullable().describe('Monthly EMI amount'),
  tenure_months: z.number().nullable().describe('Loan tenure in months'),
  disbursement_date: z
    .string()
    .nullable()
    .describe('Date when loan was disbursed in YYYY-MM-DD format'),
  first_emi_date: z.string().nullable().describe('Date of first EMI payment in YYYY-MM-DD format'),
  end_date: z.string().nullable().describe('Date of last EMI / loan maturity in YYYY-MM-DD format'),

  // Type-specific details (one will be populated based on loan_type)
  home_loan_details: homeLoanDetailsSchema
    .nullable()
    .describe('Home loan specific details. Null if not home loan.'),
  vehicle_loan_details: vehicleLoanDetailsSchema
    .nullable()
    .describe('Vehicle loan specific details. Null if not vehicle loan.'),
  education_loan_details: educationLoanDetailsSchema
    .nullable()
    .describe('Education loan specific details. Null if not education loan.'),
  business_loan_details: businessLoanDetailsSchema
    .nullable()
    .describe('Business loan specific details. Null if not business loan.'),
  gold_loan_details: goldLoanDetailsSchema
    .nullable()
    .describe('Gold loan specific details. Null if not gold loan.'),
  personal_loan_details: personalLoanDetailsSchema
    .nullable()
    .describe('Personal loan specific details. Null if not personal loan.'),
})

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
export type LifeInsuranceDetails = z.infer<typeof lifeInsuranceDetailsSchema>
export type HealthInsuranceDetails = z.infer<typeof healthInsuranceDetailsSchema>
export type VehicleInsuranceDetails = z.infer<typeof vehicleInsuranceDetailsSchema>
export type InsurancePolicyParsed = z.infer<typeof insurancePolicySchema>
export type HomeLoanDetails = z.infer<typeof homeLoanDetailsSchema>
export type VehicleLoanDetails = z.infer<typeof vehicleLoanDetailsSchema>
export type EducationLoanDetails = z.infer<typeof educationLoanDetailsSchema>
export type BusinessLoanDetails = z.infer<typeof businessLoanDetailsSchema>
export type GoldLoanDetails = z.infer<typeof goldLoanDetailsSchema>
export type PersonalLoanDetails = z.infer<typeof personalLoanDetailsSchema>
export type LoanDocumentParsed = z.infer<typeof loanDocumentSchema>
