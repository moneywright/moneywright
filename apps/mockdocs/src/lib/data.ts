import { addDays, addMonths, isBefore, isAfter, startOfMonth, endOfMonth } from 'date-fns'
import type {
  CountryCode,
  MoneyScale,
  Transaction,
  BankAccount,
  CreditCard,
  Subscription,
  InsurancePolicy,
  Loan,
  GenerationContext,
} from '../types'
import { getMerchants, getSubscriptions, getPersonNames, getEmployers } from '../config/merchants'
import {
  randomBetween,
  randomDecimal,
  randomPick,
  randomPickMultiple,
  generateId,
  getSalaryRange,
  getTransactionFrequency,
  getSubscriptionCount,
  getDateInMonth,
  getNextBusinessDay,
  scaleAmount,
  formatDate,
} from './utils'

// Generate a single transaction
export function createTransaction(
  date: Date,
  description: string,
  amount: number,
  type: 'credit' | 'debit',
  category: Transaction['category'],
  merchant?: string
): Transaction {
  return {
    id: generateId('TXN'),
    date,
    description,
    amount: Math.round(amount * 100) / 100,
    type,
    category,
    merchant,
    reference: generateId('REF'),
  }
}

// Generate salary transactions for the year (only for primary account)
export function generateSalaryTransactions(
  ctx: GenerationContext,
  account: BankAccount,
  isPrimaryAccount: boolean
): Transaction[] {
  // Salary only goes to primary account
  if (!isPrimaryAccount) {
    return []
  }

  const transactions: Transaction[] = []
  const { country, scale, startDate, endDate } = ctx.config
  const { min, max } = getSalaryRange(country, scale)
  const baseSalary = randomBetween(min, max)
  const employer = randomPick(getEmployers(country))

  let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
  while (isBefore(current, endDate) || current.getMonth() === endDate.getMonth()) {
    // Salary typically on 1st-5th of month
    const salaryDay = randomBetween(1, 5)
    const salaryDate = getNextBusinessDay(getDateInMonth(current.getFullYear(), current.getMonth(), salaryDay))

    if (isBefore(salaryDate, startDate) || isAfter(salaryDate, endDate)) {
      current = addMonths(current, 1)
      continue
    }

    // Small monthly variance in salary
    const variance = baseSalary * (Math.random() * 0.02 - 0.01)
    const salary = Math.round(baseSalary + variance)

    transactions.push(
      createTransaction(
        salaryDate,
        `SALARY ${employer.toUpperCase()}`,
        salary,
        'credit',
        country === 'IN' ? 'salary' : 'paycheck'
      )
    )

    current = addMonths(current, 1)
  }

  return transactions
}

// Generate other income for secondary accounts (dividends, rent, transfers)
export function generateSecondaryAccountIncome(
  ctx: GenerationContext,
  account: BankAccount
): Transaction[] {
  const transactions: Transaction[] = []
  const { country, scale, startDate, endDate } = ctx.config
  const salaryRange = getSalaryRange(country, scale)

  let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
  while (isBefore(current, endDate) || current.getMonth() === endDate.getMonth()) {
    // Occasional rent income (if scale 3+)
    if (scale >= 3 && Math.random() > 0.7) {
      const rentDate = getDateInMonth(current.getFullYear(), current.getMonth(), randomBetween(1, 10))
      if (!isBefore(rentDate, startDate) && !isAfter(rentDate, endDate)) {
        const rentIncome = Math.round(salaryRange.min * randomDecimal(0.15, 0.25))
        transactions.push(
          createTransaction(rentDate, 'RENT RECEIVED', rentIncome, 'credit', 'rent')
        )
      }
    }

    // Occasional transfers from primary account
    if (Math.random() > 0.5) {
      const transferDate = getDateInMonth(current.getFullYear(), current.getMonth(), randomBetween(5, 25))
      if (!isBefore(transferDate, startDate) && !isAfter(transferDate, endDate)) {
        const transferAmount = Math.round(salaryRange.min * randomDecimal(0.1, 0.3))
        transactions.push(
          createTransaction(transferDate, 'TRANSFER FROM SELF', transferAmount, 'credit', 'transfer')
        )
      }
    }

    current = addMonths(current, 1)
  }

  return transactions
}

// Generate all CC spending transactions once, then distribute to cards
export function generateAllCCSpending(ctx: GenerationContext): Map<string, Transaction[]> {
  const { country, scale, startDate, endDate } = ctx.config
  const merchants = getMerchants(country)
  const salaryRange = getSalaryRange(country, scale)
  const baseSalary = (salaryRange.min + salaryRange.max) / 2

  // Total CC spending budget: 20-30% of salary (reasonable)
  const totalMonthlyBudget = baseSalary * randomDecimal(0.20, 0.30)

  const allTransactions: Transaction[] = []

  let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
  while (isBefore(current, endDate) || current.getMonth() === endDate.getMonth()) {
    const monthStart = startOfMonth(current)
    let monthSpent = 0
    // Monthly budget varies slightly (85-110% of base budget)
    const monthBudget = totalMonthlyBudget * randomDecimal(0.85, 1.10)

    // Generate transactions until budget is exhausted
    let attempts = 0
    const maxAttempts = 80

    while (monthSpent < monthBudget && attempts < maxAttempts) {
      attempts++
      const dayOffset = randomBetween(0, 27)
      const txDate = addDays(monthStart, dayOffset)

      if (isBefore(txDate, startDate) || isAfter(txDate, endDate)) {
        continue
      }

      const merchant = randomPick(merchants)
      // Cap merchant amount to remaining budget
      const maxAmount = Math.min(merchant.maxAmount, (monthBudget - monthSpent) * 0.6)
      if (maxAmount < merchant.minAmount) {
        continue
      }

      const amount = randomDecimal(merchant.minAmount, maxAmount)
      const finalAmount = Math.round(amount)

      if (monthSpent + finalAmount > monthBudget * 1.05) {
        continue
      }

      monthSpent += finalAmount

      allTransactions.push(
        createTransaction(
          txDate,
          `${merchant.name.toUpperCase()} ${generateId('').slice(0, 4)}`,
          finalAmount,
          'debit',
          merchant.category,
          merchant.name
        )
      )
    }

    current = addMonths(current, 1)
  }

  // Distribute transactions across cards
  const cardTransactions = new Map<string, Transaction[]>()
  const cardCount = ctx.creditCards.length

  for (const card of ctx.creditCards) {
    cardTransactions.set(card.id, [])
  }

  // Distribute transactions round-robin style
  allTransactions.forEach((tx, index) => {
    const cardIndex = index % cardCount
    const cardId = ctx.creditCards[cardIndex].id
    cardTransactions.get(cardId)!.push(tx)
  })

  return cardTransactions
}

// Generate subscription transactions - all go to first card
export function generateAllSubscriptions(ctx: GenerationContext): Transaction[] {
  const transactions: Transaction[] = []
  const { country, scale, startDate, endDate } = ctx.config
  const allSubs = getSubscriptions(country)
  const subCount = getSubscriptionCount(scale)
  const selectedSubs = randomPickMultiple(allSubs, subCount)

  let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
  while (isBefore(current, endDate) || current.getMonth() === endDate.getMonth()) {
    for (const sub of selectedSubs) {
      const billingDate = getDateInMonth(current.getFullYear(), current.getMonth(), sub.billingDay)

      if (isBefore(billingDate, startDate) || isAfter(billingDate, endDate)) {
        continue
      }

      transactions.push(
        createTransaction(billingDate, sub.name.toUpperCase(), sub.amount, 'debit', sub.category, sub.name)
      )
    }
    current = addMonths(current, 1)
  }

  return transactions
}

// Generate P2P transfer transactions (bank account)
export function generateP2PTransfers(
  ctx: GenerationContext,
  account: BankAccount
): Transaction[] {
  const transactions: Transaction[] = []
  const { country, scale, startDate, endDate } = ctx.config
  const names = getPersonNames(country)
  const frequency = getTransactionFrequency(scale)
  const salaryRange = getSalaryRange(country, scale)

  let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
  while (isBefore(current, endDate) || current.getMonth() === endDate.getMonth()) {
    const txCount = randomBetween(frequency.bankPerMonth.min, frequency.bankPerMonth.max)

    for (let i = 0; i < txCount; i++) {
      const dayOffset = randomBetween(1, 28)
      const txDate = addDays(startOfMonth(current), dayOffset)

      if (isBefore(txDate, startDate) || isAfter(txDate, endDate)) {
        continue
      }

      const person = randomPick(names)
      const isCredit = Math.random() > 0.6 // 40% credits, 60% debits
      const baseAmount = salaryRange.min * (isCredit ? 0.05 : 0.1)
      const amount = randomBetween(baseAmount * 0.5, baseAmount * 2)

      const descriptions = isCredit
        ? [`IMPS FROM ${person.toUpperCase()}`, `NEFT FROM ${person.toUpperCase()}`, `UPI-${person.split(' ')[0].toUpperCase()}`]
        : [`IMPS TO ${person.toUpperCase()}`, `NEFT TO ${person.toUpperCase()}`, `UPI-${person.split(' ')[0].toUpperCase()}`]

      transactions.push(
        createTransaction(txDate, randomPick(descriptions), Math.round(amount), isCredit ? 'credit' : 'debit', 'transfer')
      )
    }

    current = addMonths(current, 1)
  }

  return transactions.sort((a, b) => a.date.getTime() - b.date.getTime())
}

// Generate rent transactions (bank account debit)
export function generateRentTransactions(
  ctx: GenerationContext,
  account: BankAccount
): Transaction[] {
  const transactions: Transaction[] = []
  const { country, scale, startDate, endDate } = ctx.config
  const salaryRange = getSalaryRange(country, scale)
  // Rent is typically 20-25% of salary
  const rent = Math.round(salaryRange.min * randomDecimal(0.20, 0.25))

  let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
  while (isBefore(current, endDate) || current.getMonth() === endDate.getMonth()) {
    const rentDay = randomBetween(1, 5)
    const rentDate = getDateInMonth(current.getFullYear(), current.getMonth(), rentDay)

    if (isBefore(rentDate, startDate) || isAfter(rentDate, endDate)) {
      current = addMonths(current, 1)
      continue
    }

    const landlord = randomPick(getPersonNames(country))
    transactions.push(
      createTransaction(rentDate, `RENT PAYMENT TO ${landlord.toUpperCase()}`, rent, 'debit', 'rent')
    )

    current = addMonths(current, 1)
  }

  return transactions
}

// Generate utility bill transactions (bank account)
export function generateUtilityTransactions(
  ctx: GenerationContext,
  account: BankAccount
): Transaction[] {
  const transactions: Transaction[] = []
  const { country, scale, startDate, endDate } = ctx.config

  const utilities =
    country === 'IN'
      ? [
          { name: 'ELECTRICITY BILL', min: 500, max: 3000 },
          { name: 'PIPED GAS BILL', min: 300, max: 1000 },
          { name: 'WATER BILL', min: 200, max: 800 },
        ]
      : [
          { name: 'ELECTRIC COMPANY', min: 80, max: 250 },
          { name: 'GAS COMPANY', min: 50, max: 150 },
          { name: 'WATER UTILITY', min: 30, max: 100 },
        ]

  let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
  while (isBefore(current, endDate) || current.getMonth() === endDate.getMonth()) {
    for (const utility of utilities) {
      const billDay = randomBetween(10, 20)
      const billDate = getDateInMonth(current.getFullYear(), current.getMonth(), billDay)

      if (isBefore(billDate, startDate) || isAfter(billDate, endDate)) {
        continue
      }

      const amount = scaleAmount(randomBetween(utility.min, utility.max), scale, 0.3)
      transactions.push(createTransaction(billDate, utility.name, amount, 'debit', 'utilities'))
    }

    current = addMonths(current, 1)
  }

  return transactions
}

// Generate EMI transactions from loans
export function generateEMITransactions(ctx: GenerationContext, account: BankAccount): Transaction[] {
  const transactions: Transaction[] = []
  const { startDate, endDate } = ctx.config

  for (const loan of ctx.loans) {
    if (loan.linkedBankAccount.id !== account.id) continue

    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
    while (isBefore(current, endDate) || current.getMonth() === endDate.getMonth()) {
      const emiDay = randomBetween(5, 10)
      const emiDate = getDateInMonth(current.getFullYear(), current.getMonth(), emiDay)

      if (isBefore(emiDate, startDate) || isAfter(emiDate, endDate)) {
        current = addMonths(current, 1)
        continue
      }

      const loanTypeLabel =
        loan.type === 'home' ? 'HOME LOAN' : loan.type === 'car' ? 'CAR LOAN' : 'PERSONAL LOAN'

      transactions.push(
        createTransaction(
          emiDate,
          `EMI ${loanTypeLabel} ${loan.lender.name.toUpperCase()}`,
          loan.emi,
          'debit',
          'emi'
        )
      )

      current = addMonths(current, 1)
    }
  }

  return transactions
}

// Generate insurance premium transactions
export function generateInsuranceTransactions(ctx: GenerationContext, account: BankAccount): Transaction[] {
  const transactions: Transaction[] = []
  const { startDate, endDate } = ctx.config

  for (const policy of ctx.insurancePolicies) {
    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)

    while (isBefore(current, endDate) || current.getMonth() === endDate.getMonth()) {
      // Determine if premium is due this month
      let isDue = false
      if (policy.premiumFrequency === 'monthly') {
        isDue = true
      } else if (policy.premiumFrequency === 'quarterly') {
        isDue = current.getMonth() % 3 === 0
      } else if (policy.premiumFrequency === 'yearly') {
        // Premium due in the start month of the policy
        isDue = current.getMonth() === policy.startDate.getMonth()
      }

      if (isDue) {
        const premiumDay = randomBetween(1, 10)
        const premiumDate = getDateInMonth(current.getFullYear(), current.getMonth(), premiumDay)

        if (!isBefore(premiumDate, startDate) && !isAfter(premiumDate, endDate)) {
          const typeLabel = policy.type.toUpperCase().replace('_', ' ')
          transactions.push(
            createTransaction(
              premiumDate,
              `${typeLabel} PREMIUM ${policy.provider.name.toUpperCase()}`,
              policy.premium,
              'debit',
              'insurance'
            )
          )
        }
      }

      current = addMonths(current, 1)
    }
  }

  return transactions
}

// Generate credit card payment transactions (bank debit)
export function generateCCPaymentTransactions(
  ctx: GenerationContext,
  account: BankAccount
): Transaction[] {
  const transactions: Transaction[] = []
  const { startDate, endDate } = ctx.config

  // For each credit card, generate monthly payments
  for (const card of ctx.creditCards) {
    if (card.linkedBankAccount.id !== account.id) continue

    const ccPayments: { date: Date; amount: number }[] = []
    let current = addMonths(new Date(startDate.getFullYear(), startDate.getMonth(), 1), 1) // Payments start from second month

    while (isBefore(current, endDate) || current.getMonth() === endDate.getMonth()) {
      const paymentDay = randomBetween(25, 28)
      const paymentDate = getDateInMonth(current.getFullYear(), current.getMonth(), paymentDay)

      if (isAfter(paymentDate, endDate)) {
        current = addMonths(current, 1)
        continue
      }

      // Calculate total CC spend for previous month
      const prevMonth = addMonths(current, -1)
      const prevMonthStart = startOfMonth(prevMonth)
      const prevMonthEnd = endOfMonth(prevMonth)

      const ccTxns = ctx.ccTransactions.get(card.id) || []
      const monthSpend = ccTxns
        .filter((t) => t.type === 'debit' && !isBefore(t.date, prevMonthStart) && !isAfter(t.date, prevMonthEnd))
        .reduce((sum, t) => sum + t.amount, 0)

      if (monthSpend > 0) {
        transactions.push(
          createTransaction(
            paymentDate,
            `CREDIT CARD PAYMENT ${card.institution.name.toUpperCase()} ${card.cardNumber.slice(-4)}`,
            Math.round(monthSpend),
            'debit',
            'credit_card_payment'
          )
        )

        ccPayments.push({ date: paymentDate, amount: Math.round(monthSpend) })
      }

      current = addMonths(current, 1)
    }

    ctx.ccPayments.set(card.id, ccPayments)
  }

  return transactions
}

// Pre-calculate CC payments for all cards (must be called after CC transactions are generated)
// This populates ctx.ccPayments so CC statements can show payment received
export function calculateCCPayments(ctx: GenerationContext): void {
  const { startDate, endDate } = ctx.config

  for (const card of ctx.creditCards) {
    const ccPayments: { date: Date; amount: number }[] = []
    let current = addMonths(new Date(startDate.getFullYear(), startDate.getMonth(), 1), 1) // Payments start from second month

    while (isBefore(current, endDate) || current.getMonth() === endDate.getMonth()) {
      const paymentDay = randomBetween(25, 28)
      const paymentDate = getDateInMonth(current.getFullYear(), current.getMonth(), paymentDay)

      if (isAfter(paymentDate, endDate)) {
        current = addMonths(current, 1)
        continue
      }

      // Calculate total CC spend for previous month
      const prevMonth = addMonths(current, -1)
      const prevMonthStart = startOfMonth(prevMonth)
      const prevMonthEnd = endOfMonth(prevMonth)

      const ccTxns = ctx.ccTransactions.get(card.id) || []
      const monthSpend = ccTxns
        .filter((t) => t.type === 'debit' && !isBefore(t.date, prevMonthStart) && !isAfter(t.date, prevMonthEnd))
        .reduce((sum, t) => sum + t.amount, 0)

      if (monthSpend > 0) {
        ccPayments.push({ date: paymentDate, amount: Math.round(monthSpend) })
      }

      current = addMonths(current, 1)
    }

    ctx.ccPayments.set(card.id, ccPayments)
  }
}

// Generate investment-related bank transactions (SIP, FD, etc.)
export function generateInvestmentTransactions(
  ctx: GenerationContext,
  account: BankAccount
): Transaction[] {
  const transactions: Transaction[] = []
  const { country, scale, startDate, endDate } = ctx.config
  const salaryRange = getSalaryRange(country, scale)

  // SIP transactions (monthly) - 5% of salary total, split across 1-2 SIPs
  if (scale >= 2) {
    const sipCount = scale >= 4 ? 2 : 1
    const sipAmount = Math.round((salaryRange.min * 0.05) / sipCount)

    for (let i = 0; i < sipCount; i++) {
      const sipDay = randomBetween(1, 15)
      let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)

      while (isBefore(current, endDate) || current.getMonth() === endDate.getMonth()) {
        const sipDate = getDateInMonth(current.getFullYear(), current.getMonth(), sipDay)

        if (!isBefore(sipDate, startDate) && !isAfter(sipDate, endDate)) {
          transactions.push(
            createTransaction(sipDate, `SIP MUTUAL FUND ${generateId('').slice(0, 6)}`, sipAmount, 'debit', 'investment')
          )
        }

        current = addMonths(current, 1)
      }
    }
  }

  // PPF contribution (India only, scale 3+) - 5% of salary monthly
  if (country === 'IN' && scale >= 3) {
    const ppfAmount = Math.round(salaryRange.min * 0.05)
    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)

    while (isBefore(current, endDate) || current.getMonth() === endDate.getMonth()) {
      const ppfDate = getDateInMonth(current.getFullYear(), current.getMonth(), randomBetween(1, 10))

      if (!isBefore(ppfDate, startDate) && !isAfter(ppfDate, endDate)) {
        transactions.push(createTransaction(ppfDate, 'PPF CONTRIBUTION', ppfAmount, 'debit', 'investment'))
      }

      current = addMonths(current, 1)
    }
  }

  // Dividend income (quarterly) - small amounts
  if (scale >= 3) {
    const dividendAmount = Math.round(salaryRange.min * 0.01)
    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)

    while (isBefore(current, endDate) || current.getMonth() === endDate.getMonth()) {
      if (current.getMonth() % 3 === 0) {
        // Quarterly
        const divDate = getDateInMonth(current.getFullYear(), current.getMonth(), randomBetween(15, 25))

        if (!isBefore(divDate, startDate) && !isAfter(divDate, endDate)) {
          transactions.push(createTransaction(divDate, 'DIVIDEND RECEIVED', dividendAmount, 'credit', 'dividend'))
        }
      }

      current = addMonths(current, 1)
    }
  }

  // Interest income (quarterly) - small amounts
  if (scale >= 2) {
    const interestAmount = Math.round(salaryRange.min * 0.005)
    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)

    while (isBefore(current, endDate) || current.getMonth() === endDate.getMonth()) {
      if (current.getMonth() % 3 === 2) {
        // End of quarter
        const intDate = getDateInMonth(current.getFullYear(), current.getMonth(), randomBetween(25, 28))

        if (!isBefore(intDate, startDate) && !isAfter(intDate, endDate)) {
          transactions.push(createTransaction(intDate, 'INTEREST CREDIT', interestAmount, 'credit', 'interest'))
        }
      }

      current = addMonths(current, 1)
    }
  }

  return transactions.sort((a, b) => a.date.getTime() - b.date.getTime())
}

// Generate all bank transactions for an account
export function generateBankTransactions(ctx: GenerationContext, account: BankAccount): Transaction[] {
  const allTransactions: Transaction[] = []

  // Check if this is the primary account (first one)
  const isPrimaryAccount = ctx.bankAccounts[0]?.id === account.id

  // Generate transaction types based on account type
  allTransactions.push(...generateSalaryTransactions(ctx, account, isPrimaryAccount))

  // Primary account gets rent payments, utilities, EMI, insurance, investments
  if (isPrimaryAccount) {
    allTransactions.push(...generateRentTransactions(ctx, account))
    allTransactions.push(...generateUtilityTransactions(ctx, account))
    allTransactions.push(...generateEMITransactions(ctx, account))
    allTransactions.push(...generateInsuranceTransactions(ctx, account))
    allTransactions.push(...generateInvestmentTransactions(ctx, account))
    allTransactions.push(...generateP2PTransfers(ctx, account))
  } else {
    // Secondary accounts get other income sources (more credits than debits)
    allTransactions.push(...generateSecondaryAccountIncome(ctx, account))
  }

  // Sort by date
  allTransactions.sort((a, b) => a.date.getTime() - b.date.getTime())

  // Calculate running balance
  const salaryRange = getSalaryRange(ctx.config.country, ctx.config.scale)
  let balance = Math.round(salaryRange.min * randomDecimal(1, 3)) // Opening balance

  for (const tx of allTransactions) {
    if (tx.type === 'credit') {
      balance += tx.amount
    } else {
      balance -= tx.amount
    }
    tx.balance = Math.round(balance * 100) / 100
  }

  return allTransactions
}

// Generate all credit card transactions for all cards at once
export function generateAllCCTransactions(ctx: GenerationContext): void {
  // Generate spending once and distribute
  const spendingByCard = generateAllCCSpending(ctx)

  // Generate subscriptions (all go to first card)
  const subscriptions = generateAllSubscriptions(ctx)
  const firstCardId = ctx.creditCards[0]?.id

  // Combine for each card
  for (const card of ctx.creditCards) {
    const cardSpending = spendingByCard.get(card.id) || []
    let allTransactions: Transaction[]

    if (card.id === firstCardId) {
      // First card gets subscriptions
      allTransactions = [...cardSpending, ...subscriptions]
    } else {
      allTransactions = [...cardSpending]
    }

    // Sort by date
    allTransactions.sort((a, b) => a.date.getTime() - b.date.getTime())

    ctx.ccTransactions.set(card.id, allTransactions)
  }
}
