/**
 * Entity Linking Service
 *
 * Links transactions to entities (credit cards, insurance policies, loans)
 * after categorization is complete.
 *
 * Linking types:
 * - credit_card: Bank debit → CC account (for CC bill payments)
 * - insurance: Transaction → Insurance policy (for premium payments)
 * - loan: Transaction → Loan (for EMI payments)
 */

import { eq, and, gte, lte, inArray, isNull, or, desc } from 'drizzle-orm'
import { generateObject } from 'ai'
import { z } from 'zod/v4'
import { db, tables, dbType } from '../db'
import { logger } from '../lib/logger'
import { createLLMClientFromSettings } from '../llm'

// Bank account types (can make CC payments, insurance payments, loan EMIs)
const BANK_ACCOUNT_TYPES = ['savings_account', 'current_account', 'checking_account']

// Credit card account type
const CREDIT_CARD_TYPE = 'credit_card'

/**
 * Calculate amount tolerance for credit card payment matching
 *
 * Tiered tolerance to handle cashback (CRED, etc.) and convenience fees:
 * - Lower amounts: higher % tolerance (cashback is often a fixed amount, so % impact is higher)
 * - Higher amounts: lower % tolerance (to avoid false positives)
 *
 * Tiers:
 * - < ₹5,000: 10% tolerance
 * - ₹5,000 - ₹20,000: 7% tolerance
 * - ₹20,000 - ₹50,000: 5% tolerance
 * - ₹50,000 - ₹100,000: 3% tolerance
 * - > ₹100,000: 2% tolerance
 */
function getAmountTolerance(amount: number): { min: number; max: number } {
  const absAmount = Math.abs(amount)

  let tolerancePercent: number
  if (absAmount < 5000) {
    tolerancePercent = 0.1 // 10%
  } else if (absAmount < 20000) {
    tolerancePercent = 0.07 // 7%
  } else if (absAmount < 50000) {
    tolerancePercent = 0.05 // 5%
  } else if (absAmount < 100000) {
    tolerancePercent = 0.03 // 3%
  } else {
    tolerancePercent = 0.02 // 2%
  }

  const tolerance = absAmount * tolerancePercent
  return {
    min: absAmount - tolerance,
    max: absAmount + tolerance,
  }
}

/**
 * Main entry point: Link entities for an account after categorization
 */
export async function linkEntitiesForAccount(
  accountId: string,
  userId: string,
  modelOverride?: string
): Promise<void> {
  // Get account info to determine account type
  const [account] = await db
    .select({ type: tables.accounts.type, profileId: tables.accounts.profileId })
    .from(tables.accounts)
    .where(eq(tables.accounts.id, accountId))
    .limit(1)

  if (!account) {
    logger.warn(`[EntityLinking] Account ${accountId} not found`)
    return
  }

  const isBankAccount = BANK_ACCOUNT_TYPES.includes(account.type)
  const isCreditCard = account.type === CREDIT_CARD_TYPE

  logger.debug(
    `[EntityLinking] Processing account ${accountId} (type: ${account.type}, isBankAccount: ${isBankAccount}, isCreditCard: ${isCreditCard})`
  )

  if (isBankAccount) {
    // For bank accounts: link CC payments, insurance payments, loan EMIs
    await linkCreditCardPayments(accountId, userId)
    await linkInsuranceAndLoanPayments(accountId, userId, account.profileId, modelOverride)
  } else if (isCreditCard) {
    // For credit cards: link insurance payments, find matching bank debits
    await linkInsuranceAndLoanPayments(accountId, userId, account.profileId, modelOverride)
    await linkCreditCardCreditsToBank(accountId, userId)
  }
}

/**
 * Link bank account credit_card_payment debits to credit card accounts
 *
 * Matches by: exact amount, within ±3 days, opposite transaction types
 */
async function linkCreditCardPayments(bankAccountId: string, userId: string): Promise<void> {
  // Get all unlinked credit_card_payment debits from this bank account
  const bankDebits = await db
    .select({
      id: tables.transactions.id,
      date: tables.transactions.date,
      amount: tables.transactions.amount,
    })
    .from(tables.transactions)
    .where(
      and(
        eq(tables.transactions.accountId, bankAccountId),
        eq(tables.transactions.userId, userId),
        eq(tables.transactions.category, 'credit_card_payment'),
        eq(tables.transactions.type, 'debit'),
        eq(tables.transactions.isHidden, false),
        isNull(tables.transactions.linkedEntityId)
      )
    )

  if (bankDebits.length === 0) {
    logger.debug(`[EntityLinking] No unlinked CC payment debits in bank account ${bankAccountId}`)
    return
  }

  logger.debug(
    `[EntityLinking] Found ${bankDebits.length} unlinked CC payment debits in bank account ${bankAccountId}`
  )

  // Get all credit card accounts for this user
  const ccAccounts = await db
    .select({ id: tables.accounts.id })
    .from(tables.accounts)
    .where(and(eq(tables.accounts.userId, userId), eq(tables.accounts.type, CREDIT_CARD_TYPE)))

  if (ccAccounts.length === 0) {
    logger.debug(`[EntityLinking] No credit card accounts found for user`)
    return
  }

  const ccAccountIds = ccAccounts.map((a) => a.id)

  // For each bank debit, try to find matching CC credit
  for (const debit of bankDebits) {
    const debitDate = new Date(debit.date)
    const startDate = new Date(debitDate)
    startDate.setDate(startDate.getDate() - 3)
    const endDate = new Date(debitDate)
    endDate.setDate(endDate.getDate() + 3)

    const startDateStr = startDate.toISOString().split('T')[0]!
    const endDateStr = endDate.toISOString().split('T')[0]!

    // Calculate amount tolerance for fuzzy matching (handles cashback/fees)
    const debitAmount =
      typeof debit.amount === 'string' ? parseFloat(debit.amount) : Number(debit.amount)
    const { min: minAmount, max: maxAmount } = getAmountTolerance(debitAmount)

    // Find matching CC credits within amount tolerance and ±3 days
    const matchingCredits = await db
      .select({
        id: tables.transactions.id,
        accountId: tables.transactions.accountId,
        amount: tables.transactions.amount,
      })
      .from(tables.transactions)
      .where(
        and(
          inArray(tables.transactions.accountId, ccAccountIds),
          eq(tables.transactions.type, 'credit'),
          gte(tables.transactions.amount, minAmount.toString()),
          lte(tables.transactions.amount, maxAmount.toString()),
          eq(tables.transactions.isHidden, false),
          gte(tables.transactions.date, startDateStr),
          lte(tables.transactions.date, endDateStr),
          isNull(tables.transactions.linkedEntityId)
        )
      )

    if (matchingCredits.length === 0) continue

    // Pick the closest match by amount
    const matchingCredit = matchingCredits.reduce((closest, current) => {
      const currentAmount =
        typeof current.amount === 'string' ? parseFloat(current.amount) : Number(current.amount)
      const closestAmount =
        typeof closest.amount === 'string' ? parseFloat(closest.amount) : Number(closest.amount)

      const currentDiff = Math.abs(currentAmount - debitAmount)
      const closestDiff = Math.abs(closestAmount - debitAmount)

      return currentDiff < closestDiff ? current : closest
    })

    const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

    // Link bank debit to CC account
    await db
      .update(tables.transactions)
      .set({
        linkedEntityId: matchingCredit.accountId,
        linkedEntityType: 'credit_card',
        updatedAt: now as Date,
      })
      .where(eq(tables.transactions.id, debit.id))

    // Link CC credit to bank transaction
    await db
      .update(tables.transactions)
      .set({
        linkedEntityId: debit.id,
        linkedEntityType: 'transaction',
        updatedAt: now as Date,
      })
      .where(eq(tables.transactions.id, matchingCredit.id))

    const creditAmount =
      typeof matchingCredit.amount === 'string'
        ? parseFloat(matchingCredit.amount)
        : Number(matchingCredit.amount)
    const amountDiff = Math.abs(creditAmount - debitAmount)

    logger.debug(
      `[EntityLinking] Linked bank debit ${debit.id} (₹${debitAmount}) to CC account ${matchingCredit.accountId} (credit: ₹${creditAmount}, diff: ₹${amountDiff.toFixed(2)})`
    )
  }
}

/**
 * For credit card credits (payments received), find matching bank debits
 * This handles the case when CC statements are processed before bank statements
 */
async function linkCreditCardCreditsToBank(ccAccountId: string, userId: string): Promise<void> {
  // Get all unlinked credits in this CC account (likely payments received)
  const ccCredits = await db
    .select({
      id: tables.transactions.id,
      date: tables.transactions.date,
      amount: tables.transactions.amount,
    })
    .from(tables.transactions)
    .where(
      and(
        eq(tables.transactions.accountId, ccAccountId),
        eq(tables.transactions.userId, userId),
        eq(tables.transactions.type, 'credit'),
        eq(tables.transactions.isHidden, false),
        isNull(tables.transactions.linkedEntityId)
      )
    )

  if (ccCredits.length === 0) {
    return
  }

  // Get all bank accounts for this user
  const bankAccounts = await db
    .select({ id: tables.accounts.id })
    .from(tables.accounts)
    .where(
      and(
        eq(tables.accounts.userId, userId),
        or(...BANK_ACCOUNT_TYPES.map((t) => eq(tables.accounts.type, t)))
      )
    )

  if (bankAccounts.length === 0) {
    return
  }

  const bankAccountIds = bankAccounts.map((a) => a.id)

  // For each CC credit, try to find matching bank debit
  for (const credit of ccCredits) {
    const creditDate = new Date(credit.date)
    const startDate = new Date(creditDate)
    startDate.setDate(startDate.getDate() - 3)
    const endDate = new Date(creditDate)
    endDate.setDate(endDate.getDate() + 3)

    const startDateStr = startDate.toISOString().split('T')[0]!
    const endDateStr = endDate.toISOString().split('T')[0]!

    // Calculate amount tolerance for fuzzy matching (handles cashback/fees)
    const creditAmount =
      typeof credit.amount === 'string' ? parseFloat(credit.amount) : Number(credit.amount)
    const { min: minAmount, max: maxAmount } = getAmountTolerance(creditAmount)

    // Find matching bank debits within amount tolerance and ±3 days
    const matchingDebits = await db
      .select({
        id: tables.transactions.id,
        amount: tables.transactions.amount,
      })
      .from(tables.transactions)
      .where(
        and(
          inArray(tables.transactions.accountId, bankAccountIds),
          eq(tables.transactions.type, 'debit'),
          eq(tables.transactions.category, 'credit_card_payment'),
          gte(tables.transactions.amount, minAmount.toString()),
          lte(tables.transactions.amount, maxAmount.toString()),
          eq(tables.transactions.isHidden, false),
          gte(tables.transactions.date, startDateStr),
          lte(tables.transactions.date, endDateStr),
          isNull(tables.transactions.linkedEntityId)
        )
      )

    if (matchingDebits.length === 0) continue

    // Pick the closest match by amount
    const matchingDebit = matchingDebits.reduce((closest, current) => {
      const currentAmount =
        typeof current.amount === 'string' ? parseFloat(current.amount) : Number(current.amount)
      const closestAmount =
        typeof closest.amount === 'string' ? parseFloat(closest.amount) : Number(closest.amount)

      const currentDiff = Math.abs(currentAmount - creditAmount)
      const closestDiff = Math.abs(closestAmount - creditAmount)

      return currentDiff < closestDiff ? current : closest
    })

    const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

    // Link CC credit to bank transaction
    await db
      .update(tables.transactions)
      .set({
        linkedEntityId: matchingDebit.id,
        linkedEntityType: 'transaction',
        updatedAt: now as Date,
      })
      .where(eq(tables.transactions.id, credit.id))

    // Link bank debit to CC account
    await db
      .update(tables.transactions)
      .set({
        linkedEntityId: ccAccountId,
        linkedEntityType: 'credit_card',
        updatedAt: now as Date,
      })
      .where(eq(tables.transactions.id, matchingDebit.id))

    const debitAmount =
      typeof matchingDebit.amount === 'string'
        ? parseFloat(matchingDebit.amount)
        : Number(matchingDebit.amount)
    const amountDiff = Math.abs(debitAmount - creditAmount)

    logger.debug(
      `[EntityLinking] Linked CC credit ${credit.id} (₹${creditAmount}) to bank debit ${matchingDebit.id} (₹${debitAmount}, diff: ₹${amountDiff.toFixed(2)})`
    )
  }
}

/**
 * Use LLM to link insurance and loan payments
 *
 * Sends unlinked insurance/emi category transactions along with
 * insurance policies and loans to the LLM for matching.
 */
async function linkInsuranceAndLoanPayments(
  accountId: string,
  userId: string,
  profileId: string,
  modelOverride?: string
): Promise<void> {
  // Get unlinked insurance and EMI transactions from this account
  const transactions = await db
    .select({
      id: tables.transactions.id,
      date: tables.transactions.date,
      amount: tables.transactions.amount,
      category: tables.transactions.category,
      summary: tables.transactions.summary,
      originalDescription: tables.transactions.originalDescription,
    })
    .from(tables.transactions)
    .where(
      and(
        eq(tables.transactions.accountId, accountId),
        eq(tables.transactions.userId, userId),
        or(eq(tables.transactions.category, 'insurance'), eq(tables.transactions.category, 'emi')),
        eq(tables.transactions.isHidden, false),
        isNull(tables.transactions.linkedEntityId)
      )
    )

  if (transactions.length === 0) {
    logger.debug(`[EntityLinking] No unlinked insurance/EMI transactions in account ${accountId}`)
    return
  }

  // Get insurance policies for this profile
  const insurancePolicies = await db
    .select({
      id: tables.insurancePolicies.id,
      policyType: tables.insurancePolicies.policyType,
      provider: tables.insurancePolicies.provider,
      policyNumber: tables.insurancePolicies.policyNumber,
      premiumAmount: tables.insurancePolicies.premiumAmount,
      premiumFrequency: tables.insurancePolicies.premiumFrequency,
    })
    .from(tables.insurancePolicies)
    .where(
      and(
        eq(tables.insurancePolicies.profileId, profileId),
        eq(tables.insurancePolicies.status, 'active')
      )
    )

  // Get loans for this profile
  const loans = await db
    .select({
      id: tables.loans.id,
      loanType: tables.loans.loanType,
      lender: tables.loans.lender,
      loanAccountNumber: tables.loans.loanAccountNumber,
      emiAmount: tables.loans.emiAmount,
      principalAmount: tables.loans.principalAmount,
    })
    .from(tables.loans)
    .where(and(eq(tables.loans.profileId, profileId), eq(tables.loans.status, 'active')))

  // If no policies or loans, nothing to link
  if (insurancePolicies.length === 0 && loans.length === 0) {
    logger.debug(`[EntityLinking] No insurance policies or loans found for profile ${profileId}`)
    return
  }

  // Filter transactions by category
  const insuranceTransactions = transactions.filter((t) => t.category === 'insurance')
  const emiTransactions = transactions.filter((t) => t.category === 'emi')

  // Link insurance transactions
  if (insuranceTransactions.length > 0 && insurancePolicies.length > 0) {
    await linkWithLLM(
      insuranceTransactions,
      insurancePolicies.map((p) => ({
        id: p.id,
        type: 'insurance',
        name: p.provider,
        identifier: p.policyNumber,
        amount: p.premiumAmount ? Number(p.premiumAmount) : null,
        details: `${p.policyType}, ${p.premiumFrequency || 'unknown frequency'}`,
      })),
      'insurance',
      modelOverride
    )
  }

  // Link EMI transactions
  if (emiTransactions.length > 0 && loans.length > 0) {
    await linkWithLLM(
      emiTransactions,
      loans.map((l) => ({
        id: l.id,
        type: 'loan',
        name: l.lender,
        identifier: l.loanAccountNumber,
        amount: l.emiAmount ? Number(l.emiAmount) : null,
        details: `${l.loanType}, principal: ${l.principalAmount || 'unknown'}`,
      })),
      'loan',
      modelOverride
    )
  }
}

/**
 * Use LLM to match transactions to entities
 */
async function linkWithLLM(
  transactions: Array<{
    id: string
    date: string
    amount: string | number
    summary: string | null
    originalDescription: string
  }>,
  entities: Array<{
    id: string
    type: 'insurance' | 'loan'
    name: string
    identifier: string | null
    amount: number | null
    details: string
  }>,
  entityType: 'insurance' | 'loan',
  modelOverride?: string
): Promise<void> {
  if (transactions.length === 0 || entities.length === 0) return

  const model = await createLLMClientFromSettings(modelOverride)

  // Build context for LLM
  const transactionList = transactions
    .map(
      (t) =>
        `- ID: ${t.id}, Date: ${t.date}, Amount: ${t.amount}, Description: "${t.summary || t.originalDescription}"`
    )
    .join('\n')

  const entityList = entities
    .map(
      (e) =>
        `- ID: ${e.id}, Name: ${e.name}, ${e.identifier ? `Account/Policy#: ${e.identifier}, ` : ''}Expected Amount: ${e.amount || 'unknown'}, Details: ${e.details}`
    )
    .join('\n')

  const prompt = `Match these ${entityType === 'insurance' ? 'insurance payment' : 'loan EMI'} transactions to ${entityType === 'insurance' ? 'insurance policies' : 'loans'}.

TRANSACTIONS:
${transactionList}

${entityType === 'insurance' ? 'INSURANCE POLICIES' : 'LOANS'}:
${entityList}

Match transactions to entities based on:
1. Amount similarity (exact match or close to expected amount)
2. Name/description containing the provider/lender name
3. Account/policy number match if present in description

Rules:
- A transaction can only match ONE entity
- Multiple transactions can match the same entity (e.g., monthly premiums/EMIs)
- If unsure, don't match (leave entityId as null)
- Consider pre-payments or partial payments (amount may differ from expected)

Return matches as JSON array.`

  try {
    const { object } = await generateObject({
      model,
      prompt,
      schema: z.object({
        matches: z.array(
          z.object({
            transactionId: z.string(),
            entityId: z.nullable(z.string()),
            confidence: z.number().min(0).max(1),
            reason: z.string(),
          })
        ),
      }),
    })

    // Apply matches with confidence > 0.6
    const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

    for (const match of object.matches) {
      if (match.entityId && match.confidence >= 0.6) {
        await db
          .update(tables.transactions)
          .set({
            linkedEntityId: match.entityId,
            linkedEntityType: entityType,
            updatedAt: now as Date,
          })
          .where(eq(tables.transactions.id, match.transactionId))

        logger.debug(
          `[EntityLinking] Linked transaction ${match.transactionId} to ${entityType} ${match.entityId} (confidence: ${match.confidence})`
        )
      }
    }
  } catch (error) {
    logger.error(`[EntityLinking] LLM matching failed for ${entityType}:`, error)
  }
}

/**
 * Link transactions when a new insurance policy is created
 * Searches for existing unlinked insurance transactions that might match
 */
export async function linkTransactionsToInsurance(
  policyId: string,
  userId: string,
  modelOverride?: string
): Promise<void> {
  // Get the policy details
  const [policy] = await db
    .select({
      id: tables.insurancePolicies.id,
      profileId: tables.insurancePolicies.profileId,
      provider: tables.insurancePolicies.provider,
      policyNumber: tables.insurancePolicies.policyNumber,
      premiumAmount: tables.insurancePolicies.premiumAmount,
      premiumFrequency: tables.insurancePolicies.premiumFrequency,
      policyType: tables.insurancePolicies.policyType,
    })
    .from(tables.insurancePolicies)
    .where(
      and(eq(tables.insurancePolicies.id, policyId), eq(tables.insurancePolicies.userId, userId))
    )
    .limit(1)

  if (!policy) return

  // Get all unlinked insurance transactions for this user
  const transactions = await db
    .select({
      id: tables.transactions.id,
      date: tables.transactions.date,
      amount: tables.transactions.amount,
      summary: tables.transactions.summary,
      originalDescription: tables.transactions.originalDescription,
    })
    .from(tables.transactions)
    .where(
      and(
        eq(tables.transactions.userId, userId),
        eq(tables.transactions.profileId, policy.profileId),
        eq(tables.transactions.category, 'insurance'),
        eq(tables.transactions.isHidden, false),
        isNull(tables.transactions.linkedEntityId)
      )
    )

  if (transactions.length === 0) return

  await linkWithLLM(
    transactions,
    [
      {
        id: policy.id,
        type: 'insurance',
        name: policy.provider,
        identifier: policy.policyNumber,
        amount: policy.premiumAmount ? Number(policy.premiumAmount) : null,
        details: `${policy.policyType}, ${policy.premiumFrequency || 'unknown frequency'}`,
      },
    ],
    'insurance',
    modelOverride
  )
}

/**
 * Link transactions when a new loan is created
 * Searches for existing unlinked EMI transactions that might match
 */
export async function linkTransactionsToLoan(
  loanId: string,
  userId: string,
  modelOverride?: string
): Promise<void> {
  // Get the loan details
  const [loan] = await db
    .select({
      id: tables.loans.id,
      profileId: tables.loans.profileId,
      lender: tables.loans.lender,
      loanAccountNumber: tables.loans.loanAccountNumber,
      emiAmount: tables.loans.emiAmount,
      principalAmount: tables.loans.principalAmount,
      loanType: tables.loans.loanType,
    })
    .from(tables.loans)
    .where(and(eq(tables.loans.id, loanId), eq(tables.loans.userId, userId)))
    .limit(1)

  if (!loan) return

  // Get all unlinked EMI transactions for this user
  const transactions = await db
    .select({
      id: tables.transactions.id,
      date: tables.transactions.date,
      amount: tables.transactions.amount,
      summary: tables.transactions.summary,
      originalDescription: tables.transactions.originalDescription,
    })
    .from(tables.transactions)
    .where(
      and(
        eq(tables.transactions.userId, userId),
        eq(tables.transactions.profileId, loan.profileId),
        eq(tables.transactions.category, 'emi'),
        eq(tables.transactions.isHidden, false),
        isNull(tables.transactions.linkedEntityId)
      )
    )

  if (transactions.length === 0) {
    return
  }

  await linkWithLLM(
    transactions,
    [
      {
        id: loan.id,
        type: 'loan',
        name: loan.lender,
        identifier: loan.loanAccountNumber,
        amount: loan.emiAmount ? Number(loan.emiAmount) : null,
        details: `${loan.loanType}, principal: ${loan.principalAmount || 'unknown'}`,
      },
    ],
    'loan',
    modelOverride
  )
}

/**
 * Get payment history for a credit card account
 */
export async function getCreditCardPaymentHistory(
  accountId: string,
  userId: string
): Promise<
  Array<{
    id: string
    date: string
    amount: number
    summary: string | null
    sourceAccountId: string
  }>
> {
  const payments = await db
    .select({
      id: tables.transactions.id,
      date: tables.transactions.date,
      amount: tables.transactions.amount,
      summary: tables.transactions.summary,
      accountId: tables.transactions.accountId,
    })
    .from(tables.transactions)
    .where(
      and(
        eq(tables.transactions.userId, userId),
        eq(tables.transactions.linkedEntityId, accountId),
        eq(tables.transactions.linkedEntityType, 'credit_card'),
        eq(tables.transactions.isHidden, false)
      )
    )
    .orderBy(desc(tables.transactions.date))

  return payments.map((p) => ({
    id: p.id,
    date: p.date,
    amount: typeof p.amount === 'string' ? parseFloat(p.amount) : Number(p.amount),
    summary: p.summary,
    sourceAccountId: p.accountId,
  }))
}

/**
 * Get payment history for an insurance policy
 */
export async function getInsurancePaymentHistory(
  policyId: string,
  userId: string
): Promise<
  Array<{
    id: string
    date: string
    amount: number
    summary: string | null
    accountId: string
  }>
> {
  const payments = await db
    .select({
      id: tables.transactions.id,
      date: tables.transactions.date,
      amount: tables.transactions.amount,
      summary: tables.transactions.summary,
      accountId: tables.transactions.accountId,
    })
    .from(tables.transactions)
    .where(
      and(
        eq(tables.transactions.userId, userId),
        eq(tables.transactions.linkedEntityId, policyId),
        eq(tables.transactions.linkedEntityType, 'insurance'),
        eq(tables.transactions.isHidden, false)
      )
    )
    .orderBy(desc(tables.transactions.date))

  return payments.map((p) => ({
    id: p.id,
    date: p.date,
    amount: typeof p.amount === 'string' ? parseFloat(p.amount) : Number(p.amount),
    summary: p.summary,
    accountId: p.accountId,
  }))
}

/**
 * Get payment history for a loan
 */
export async function getLoanPaymentHistory(
  loanId: string,
  userId: string
): Promise<
  Array<{
    id: string
    date: string
    amount: number
    summary: string | null
    accountId: string
  }>
> {
  const payments = await db
    .select({
      id: tables.transactions.id,
      date: tables.transactions.date,
      amount: tables.transactions.amount,
      summary: tables.transactions.summary,
      accountId: tables.transactions.accountId,
    })
    .from(tables.transactions)
    .where(
      and(
        eq(tables.transactions.userId, userId),
        eq(tables.transactions.linkedEntityId, loanId),
        eq(tables.transactions.linkedEntityType, 'loan'),
        eq(tables.transactions.isHidden, false)
      )
    )
    .orderBy(desc(tables.transactions.date))

  return payments.map((p) => ({
    id: p.id,
    date: p.date,
    amount: typeof p.amount === 'string' ? parseFloat(p.amount) : Number(p.amount),
    summary: p.summary,
    accountId: p.accountId,
  }))
}

/**
 * Payment-by-payment simulation result
 */
interface PaymentSimulationResult {
  outstandingPrincipal: number
  principalPaid: number
  interestPaid: number
}

/**
 * Simulate loan payments to calculate accurate outstanding principal
 *
 * This handles all payment scenarios correctly:
 * - Regular EMI payments (split between interest and principal)
 * - Prepayments (extra lump sums that go directly to principal)
 * - Multiple EMIs paid at once
 * - Irregular payment schedules
 * - Early/late payments
 *
 * How it works:
 * 1. Sort payments by date
 * 2. For each payment, calculate interest accrued since last payment
 * 3. Payment covers accrued interest first, rest reduces principal
 * 4. Prepayments (amounts > EMI) naturally reduce principal faster
 */
function simulateLoanPayments(
  principal: number,
  annualInterestRate: number | null,
  firstEmiDate: string | null,
  disbursementDate: string | null,
  payments: Array<{ date: string; amount: number }>
): PaymentSimulationResult {
  // Edge case: No payments made
  if (payments.length === 0) {
    return {
      outstandingPrincipal: principal,
      principalPaid: 0,
      interestPaid: 0,
    }
  }

  // Edge case: Zero or no interest rate - all payments go to principal
  if (annualInterestRate === null || annualInterestRate === 0) {
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
    const principalPaid = Math.min(principal, totalPaid)
    return {
      outstandingPrincipal: Math.max(0, principal - principalPaid),
      principalPaid,
      interestPaid: 0,
    }
  }

  // Sort payments by date (ascending)
  const sortedPayments = [...payments].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  const monthlyRate = annualInterestRate / 12 / 100
  let outstanding = principal
  let totalInterestPaid = 0
  let totalPrincipalPaid = 0

  // Determine when interest starts accruing (disbursement date)
  // This is when the bank gives you the money, so interest starts from here
  let interestStartDate: Date
  if (disbursementDate) {
    interestStartDate = new Date(disbursementDate)
  } else if (firstEmiDate) {
    // If no disbursement date, assume 1 month before first EMI
    const firstEmi = new Date(firstEmiDate)
    interestStartDate = new Date(firstEmi)
    interestStartDate.setMonth(interestStartDate.getMonth() - 1)
  } else {
    // Fallback: assume 1 month before first payment
    const firstPayment = new Date(sortedPayments[0].date)
    interestStartDate = new Date(firstPayment)
    interestStartDate.setMonth(interestStartDate.getMonth() - 1)
  }

  // Validate interest start date
  if (isNaN(interestStartDate.getTime())) {
    const firstPayment = new Date(sortedPayments[0].date)
    if (isNaN(firstPayment.getTime())) {
      // Can't calculate without valid dates - fallback to simple calculation
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
      return {
        outstandingPrincipal: Math.max(0, principal - totalPaid),
        principalPaid: Math.min(principal, totalPaid),
        interestPaid: 0,
      }
    }
    interestStartDate = new Date(firstPayment)
    interestStartDate.setMonth(interestStartDate.getMonth() - 1)
  }

  // Start calculating interest from disbursement/start date
  let lastCalculationDate = interestStartDate

  for (const payment of sortedPayments) {
    // Loan already paid off
    if (outstanding <= 0) break

    const paymentDate = new Date(payment.date)

    // Skip payments before interest starts (edge case - shouldn't happen normally)
    if (paymentDate < interestStartDate) {
      // Treat as prepayment - goes directly to principal
      const principalReduction = Math.min(outstanding, payment.amount)
      totalPrincipalPaid += principalReduction
      outstanding -= principalReduction
      continue
    }

    // Calculate time elapsed since last calculation (in months)
    const msPerDay = 24 * 60 * 60 * 1000
    const daysElapsed = Math.max(
      0,
      (paymentDate.getTime() - lastCalculationDate.getTime()) / msPerDay
    )
    const monthsElapsed = daysElapsed / 30.44 // Average days per month

    // Calculate interest accrued during this period
    const interestAccrued = outstanding * monthlyRate * monthsElapsed

    // Payment allocation:
    // 1. First, cover accrued interest
    // 2. Remaining amount reduces principal (this is how prepayments work)
    if (payment.amount >= interestAccrued) {
      // Payment covers interest and reduces principal
      const interestPortion = interestAccrued
      const principalPortion = Math.min(outstanding, payment.amount - interestAccrued)

      totalInterestPaid += interestPortion
      totalPrincipalPaid += principalPortion
      outstanding = Math.max(0, outstanding - principalPortion)
    } else {
      // Payment doesn't cover full interest (partial payment)
      // All goes to interest, principal unchanged
      totalInterestPaid += payment.amount
    }

    lastCalculationDate = paymentDate
  }

  return {
    outstandingPrincipal: Math.max(0, outstanding),
    principalPaid: totalPrincipalPaid,
    interestPaid: totalInterestPaid,
  }
}

/**
 * Calculate loan outstanding with principal progress
 * Uses payment-by-payment simulation for accurate calculation
 *
 * Handles:
 * - Regular EMI payments
 * - Prepayments (lump sum principal reduction)
 * - Multiple EMIs paid at once
 * - Irregular payment schedules
 */
export async function calculateLoanOutstanding(
  loanId: string,
  userId: string
): Promise<{
  principalAmount: number
  totalPaid: number
  paymentCount: number
  emisCompleted: number
  totalEmis: number
  // Principal progress (using payment simulation)
  outstandingPrincipal: number
  principalPaid: number
  interestPaid: number
  principalProgressPercent: number
  // Total payable progress (original schedule)
  totalPayable: number | null
  totalInterest: number | null
  remainingPayable: number | null
  // Interest savings from prepayments
  interestSaved: number | null
} | null> {
  // Get loan details
  const [loan] = await db
    .select({
      principalAmount: tables.loans.principalAmount,
      interestRate: tables.loans.interestRate,
      tenureMonths: tables.loans.tenureMonths,
      emiAmount: tables.loans.emiAmount,
      firstEmiDate: tables.loans.firstEmiDate,
      disbursementDate: tables.loans.disbursementDate,
    })
    .from(tables.loans)
    .where(and(eq(tables.loans.id, loanId), eq(tables.loans.userId, userId)))
    .limit(1)

  if (!loan || !loan.principalAmount) return null

  // Get all payments with dates
  const payments = await getLoanPaymentHistory(loanId, userId)

  const principalAmount = Number(loan.principalAmount)
  const interestRate = loan.interestRate ? Number(loan.interestRate) : null
  const tenureMonths = loan.tenureMonths
  const emiAmount = loan.emiAmount ? Number(loan.emiAmount) : null

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  const paymentCount = payments.length

  // EMI count (approximate - for display purposes)
  const emisCompleted =
    emiAmount && emiAmount > 0 ? Math.floor(totalPaid / emiAmount) : paymentCount
  const totalEmis = tenureMonths ?? 0

  // Simulate payments to get accurate principal/interest split
  const simulation = simulateLoanPayments(
    principalAmount,
    interestRate,
    loan.firstEmiDate,
    loan.disbursementDate,
    payments.map((p) => ({ date: p.date, amount: p.amount }))
  )

  const principalProgressPercent =
    principalAmount > 0 ? Math.min(100, (simulation.principalPaid / principalAmount) * 100) : 0

  // Original schedule calculations (for comparison)
  const totalPayable = emiAmount && tenureMonths ? emiAmount * tenureMonths : null
  const totalInterestOriginal = totalPayable ? totalPayable - principalAmount : null

  // Remaining payable based on actual outstanding
  // If prepayments were made, this will be less than original schedule
  let remainingPayable: number | null = null
  if (emiAmount && simulation.outstandingPrincipal > 0 && interestRate) {
    // Estimate remaining payments needed at current EMI
    // This is simplified - actual remaining depends on new amortization
    const monthlyRate = interestRate / 12 / 100
    if (monthlyRate > 0) {
      // Calculate remaining EMIs needed using loan formula
      // n = -log(1 - P*r/EMI) / log(1+r)
      const ratio = (simulation.outstandingPrincipal * monthlyRate) / emiAmount
      if (ratio < 1) {
        const remainingEmis = Math.ceil(-Math.log(1 - ratio) / Math.log(1 + monthlyRate))
        remainingPayable = remainingEmis * emiAmount
      } else {
        // EMI doesn't cover interest - use simple estimate
        remainingPayable = simulation.outstandingPrincipal * 1.5
      }
    } else {
      remainingPayable = simulation.outstandingPrincipal
    }
  } else if (simulation.outstandingPrincipal > 0) {
    remainingPayable = simulation.outstandingPrincipal
  } else {
    remainingPayable = 0
  }

  // Calculate interest saved from prepayments
  // Compare actual interest paid vs what would have been paid on schedule
  let interestSaved: number | null = null
  if (totalInterestOriginal !== null && paymentCount > 0) {
    // Expected interest paid by now if following original schedule
    const expectedInterestRatio = emisCompleted / totalEmis
    const expectedInterestPaid = totalInterestOriginal * expectedInterestRatio
    // If we paid less interest than expected, we saved money
    interestSaved = Math.max(0, expectedInterestPaid - simulation.interestPaid)
  }

  return {
    principalAmount,
    totalPaid,
    paymentCount,
    emisCompleted,
    totalEmis,
    outstandingPrincipal: simulation.outstandingPrincipal,
    principalPaid: simulation.principalPaid,
    interestPaid: simulation.interestPaid,
    principalProgressPercent,
    totalPayable,
    totalInterest: totalInterestOriginal,
    remainingPayable,
    interestSaved,
  }
}
