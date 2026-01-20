/**
 * Zod schemas for LLM structured output
 *
 * Note: OpenAI structured outputs require all fields to be in the 'required' array.
 * Use .nullable() for optional fields instead of .optional()
 */

import { z } from 'zod/v4'

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

  // Balances
  opening_balance: z
    .number()
    .nullable()
    .describe('Opening balance printed on statement, or null if not shown'),
  closing_balance: z
    .number()
    .nullable()
    .describe('Closing balance printed on statement, or null if not shown'),
})

/**
 * Account info schema (extracted from full statement)
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

// Type exports
export type TransactionParsed = z.infer<typeof transactionSchema>
export type BankStatementSummary = z.infer<typeof bankStatementSummarySchema>
export type StatementSummary = z.infer<typeof statementSummarySchema>
export type CreditCardSummary = z.infer<typeof creditCardSummarySchema>
export type PageParseResult = z.infer<typeof pageParseResultSchema>
export type AccountInfo = z.infer<typeof accountInfoSchema>
