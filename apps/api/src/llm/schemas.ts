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
 * Account info schema (extracted from first page)
 */
export const accountInfoSchema = z.object({
  account_type: z
    .string()
    .describe(
      'Type of account (savings_account, current_account, credit_card, checking_account, etc.)'
    ),
  institution: z.string().describe('Bank or financial institution name'),
  account_number: z.string().describe('Full account or card number'),
  account_holder_name: z.string().nullable().describe('Name on the account or null if not found'),
})

// Type exports
export type TransactionParsed = z.infer<typeof transactionSchema>
export type BankStatementSummary = z.infer<typeof bankStatementSummarySchema>
export type CreditCardSummary = z.infer<typeof creditCardSummarySchema>
export type PageParseResult = z.infer<typeof pageParseResultSchema>
export type AccountInfo = z.infer<typeof accountInfoSchema>
