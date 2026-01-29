/**
 * Shared validation and normalization logic for PDF parsing
 *
 * Used by both local execution and E2B sandbox execution
 */

import type { RawPdfTransaction, RawInvestmentHolding } from './types'

/**
 * Maximum number of transactions/holdings to accept
 */
export const MAX_ITEMS = 50000

/**
 * Valid ISO currency codes we support
 */
export const VALID_CURRENCIES = new Set([
  'USD',
  'INR',
  'EUR',
  'GBP',
  'JPY',
  'AUD',
  'CAD',
  'SGD',
  'AED',
])

/**
 * Validate a single transaction object
 */
export function isValidTransaction(txn: unknown): txn is RawPdfTransaction {
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
export function normalizeTransaction(txn: RawPdfTransaction): RawPdfTransaction {
  return {
    date: txn.date.trim(),
    amount: Math.abs(txn.amount),
    type: txn.type,
    description: txn.description.trim().slice(0, 500),
    balance: typeof txn.balance === 'number' ? txn.balance : null,
  }
}

/**
 * Validate a single investment holding object
 */
export function isValidHolding(holding: unknown): holding is RawInvestmentHolding {
  if (typeof holding !== 'object' || holding === null) return false

  const h = holding as Record<string, unknown>

  // Required fields
  if (typeof h.investment_type !== 'string' || h.investment_type.length === 0) return false
  if (typeof h.name !== 'string' || h.name.length === 0) return false
  if (typeof h.current_value !== 'number' || isNaN(h.current_value)) return false

  // units can be null for balance-based holdings (PPF, EPF, FD), or a number for unit-based
  if (h.units !== null && (typeof h.units !== 'number' || isNaN(h.units))) return false

  return true
}

/**
 * Normalize holding (ensure consistent format)
 */
export function normalizeHolding(h: RawInvestmentHolding): RawInvestmentHolding {
  // Normalize and validate currency
  let currency: string | null = null
  if (typeof h.currency === 'string') {
    const upperCurrency = h.currency.trim().toUpperCase()
    if (VALID_CURRENCIES.has(upperCurrency)) {
      currency = upperCurrency
    }
  }

  return {
    investment_type: h.investment_type.trim().toLowerCase(),
    symbol: typeof h.symbol === 'string' ? h.symbol.trim() || null : null,
    name: h.name.trim().slice(0, 500),
    isin: typeof h.isin === 'string' ? h.isin.trim() || null : null,
    units: typeof h.units === 'number' && !isNaN(h.units) ? h.units : null,
    average_cost:
      typeof h.average_cost === 'number' && !isNaN(h.average_cost) ? h.average_cost : null,
    current_price:
      typeof h.current_price === 'number' && !isNaN(h.current_price) ? h.current_price : null,
    current_value: h.current_value,
    invested_value:
      typeof h.invested_value === 'number' && !isNaN(h.invested_value) ? h.invested_value : null,
    folio_number: typeof h.folio_number === 'string' ? h.folio_number.trim() || null : null,
    maturity_date: typeof h.maturity_date === 'string' ? h.maturity_date.trim() || null : null,
    interest_rate:
      typeof h.interest_rate === 'number' && !isNaN(h.interest_rate) ? h.interest_rate : null,
    currency,
  }
}
