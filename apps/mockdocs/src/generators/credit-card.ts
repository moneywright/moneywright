import { addDays, addMonths, startOfMonth, endOfMonth, isBefore, isAfter, format } from 'date-fns'
import type { CreditCard, CreditCardStatement, Transaction, GenerationContext, GeneratedDocument } from '../types'
import { getCCIssuers, getRandomInstitutions, getCardVariants } from '../config/institutions'
import {
  createPDF,
  savePDF,
  addHeader,
  addSectionHeading,
  addKeyValue,
  addTransactionTable,
  addFooter,
  formatDocDate,
} from '../lib/pdf'
import {
  generateId,
  generateCardNumber,
  randomBetween,
  randomPick,
  formatCurrency,
  getSalaryRange,
} from '../lib/utils'
import { generateAllCCTransactions, createTransaction, calculateCCPayments } from '../lib/data'

// Generate credit cards
export function generateCreditCards(ctx: GenerationContext): CreditCard[] {
  const { country, scale, bankAccountCount, creditCardCount } = ctx.config
  const ccIssuers = getCCIssuers(country)
  const selectedIssuers = getRandomInstitutions(ccIssuers, creditCardCount)
  const variants = getCardVariants(country)
  const salaryRange = getSalaryRange(country, scale)

  const cards: CreditCard[] = []

  for (let i = 0; i < creditCardCount; i++) {
    const issuer = selectedIssuers[i] || ccIssuers[i % ccIssuers.length]
    const variant = variants[Math.min(scale + i - 1, variants.length - 1)]

    // Credit limit based on scale (3-10x monthly salary)
    const creditLimit = Math.round((salaryRange.min * randomBetween(3, 5 + scale)) / 10000) * 10000

    // Link to a bank account for payment tracking
    const linkedAccount = ctx.bankAccounts[i % ctx.bankAccounts.length]

    cards.push({
      id: generateId('CC'),
      institution: issuer,
      cardNumber: generateCardNumber(),
      cardType: randomPick(['visa', 'mastercard', country === 'IN' ? 'rupay' : 'amex']),
      cardVariant: variant,
      creditLimit,
      holder: ctx.holder,
      linkedBankAccount: linkedAccount,
    })
  }

  return cards
}

// Generate monthly credit card statement data
function generateMonthlyStatement(
  card: CreditCard,
  ctx: GenerationContext,
  monthDate: Date
): CreditCardStatement {
  const { country } = ctx.config
  const monthStart = startOfMonth(monthDate)
  const monthEnd = endOfMonth(monthDate)

  // Get transactions for this month
  const allCardTxns = ctx.ccTransactions.get(card.id) || []
  const monthTxns = allCardTxns.filter(
    (t) => !isBefore(t.date, monthStart) && !isAfter(t.date, monthEnd)
  )

  // Calculate totals
  const newCharges = monthTxns
    .filter((t) => t.type === 'debit')
    .reduce((sum, t) => sum + t.amount, 0)

  // Get payment received (from previous month's CC payment in bank)
  const ccPayments = ctx.ccPayments.get(card.id) || []
  const thisMonthPayment = ccPayments.find(
    (p) => p.date.getMonth() === monthDate.getMonth() && p.date.getFullYear() === monthDate.getFullYear()
  )
  const paymentsReceived = thisMonthPayment?.amount || 0

  // Add payment received as a credit transaction
  if (paymentsReceived > 0 && thisMonthPayment) {
    monthTxns.unshift(
      createTransaction(
        thisMonthPayment.date,
        'PAYMENT RECEIVED - THANK YOU',
        paymentsReceived,
        'credit',
        'credit_card_payment'
      )
    )
  }

  // Previous balance (simplified - just use new charges from last statement)
  const prevMonth = addMonths(monthDate, -1)
  const prevMonthTxns = allCardTxns.filter(
    (t) =>
      !isBefore(t.date, startOfMonth(prevMonth)) &&
      !isAfter(t.date, endOfMonth(prevMonth)) &&
      t.type === 'debit'
  )
  const previousBalance = prevMonthTxns.reduce((sum, t) => sum + t.amount, 0)

  const totalDue = Math.max(0, previousBalance - paymentsReceived + newCharges)
  const minimumDue = Math.max(Math.round(totalDue * 0.05), country === 'IN' ? 200 : 25)

  // Statement and due dates
  const statementDate = endOfMonth(monthDate)
  const dueDate = addDays(statementDate, 20)

  // Sort transactions by date
  monthTxns.sort((a, b) => a.date.getTime() - b.date.getTime())

  return {
    card,
    statementDate,
    dueDate,
    periodStart: monthStart,
    periodEnd: monthEnd,
    previousBalance: Math.round(previousBalance * 100) / 100,
    paymentsReceived: Math.round(paymentsReceived * 100) / 100,
    newCharges: Math.round(newCharges * 100) / 100,
    totalDue: Math.round(totalDue * 100) / 100,
    minimumDue: Math.round(minimumDue * 100) / 100,
    transactions: monthTxns,
  }
}

// Generate credit card statement PDF
async function generateCCStatementPDF(
  statement: CreditCardStatement,
  ctx: GenerationContext,
  outputDir: string
): Promise<string> {
  const { country } = ctx.config
  const doc = createPDF()
  const { card } = statement

  // Header
  addHeader(doc, card.institution.name, 'Credit Card Statement')

  // Card details
  addSectionHeading(doc, 'Card Details')
  addKeyValue(doc, 'Card Number', card.cardNumber)
  addKeyValue(doc, 'Card Type', `${card.institution.name} ${card.cardVariant}`)
  addKeyValue(doc, 'Card Holder', card.holder.name)
  addKeyValue(doc, 'Credit Limit', formatCurrency(card.creditLimit, country))
  doc.moveDown(0.5)

  // Statement summary
  addSectionHeading(doc, 'Statement Summary')
  addKeyValue(doc, 'Statement Date', formatDocDate(statement.statementDate))
  addKeyValue(doc, 'Payment Due Date', formatDocDate(statement.dueDate))
  addKeyValue(
    doc,
    'Statement Period',
    `${formatDocDate(statement.periodStart)} to ${formatDocDate(statement.periodEnd)}`
  )
  doc.moveDown(0.5)

  // Amount summary
  addSectionHeading(doc, 'Amount Summary')
  addKeyValue(doc, 'Previous Balance', formatCurrency(statement.previousBalance, country))
  addKeyValue(doc, 'Payments Received', formatCurrency(statement.paymentsReceived, country))
  addKeyValue(doc, 'New Charges', formatCurrency(statement.newCharges, country))
  doc.moveDown(0.3)
  doc.fontSize(11).font('Helvetica-Bold').text(`Total Amount Due: ${formatCurrency(statement.totalDue, country)}`)
  doc.fontSize(10).font('Helvetica').text(`Minimum Amount Due: ${formatCurrency(statement.minimumDue, country)}`)
  doc.moveDown(1)

  // Transactions
  addSectionHeading(doc, 'Transaction Details')
  addTransactionTable(doc, statement.transactions, country, false)

  // Footer
  addFooter(doc, `${card.institution.name} | Card: ${card.cardNumber}`)

  // Save
  const monthStr = format(statement.periodStart, 'MMM-yyyy').toLowerCase()
  const filename = `${card.institution.id}-credit-card-${card.cardVariant.toLowerCase().replace(/\s+/g, '-')}-statement-${monthStr}.pdf`
  const filepath = `${outputDir}/${filename}`

  await savePDF(doc, filepath)
  return filepath
}

// Generate all credit card documents for the period
export async function generateCreditCardDocuments(
  ctx: GenerationContext,
  outputDir: string
): Promise<GeneratedDocument[]> {
  const documents: GeneratedDocument[] = []
  const { startDate, endDate } = ctx.config

  // Generate all CC transactions (spending distributed across cards, subscriptions on first card)
  generateAllCCTransactions(ctx)

  // Calculate CC payments (so statements show payment received)
  calculateCCPayments(ctx)

  // Then generate monthly statements for each card
  for (const card of ctx.creditCards) {
    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)

    while (isBefore(current, endDate) || current.getMonth() === endDate.getMonth()) {
      const statement = generateMonthlyStatement(card, ctx, current)

      // Generate PDF only (no XLSX for credit cards)
      const pdfPath = await generateCCStatementPDF(statement, ctx, outputDir)

      documents.push({
        type: 'credit_card',
        subtype: card.cardVariant,
        filename: pdfPath.split('/').pop() || '',
        format: 'pdf',
        path: pdfPath,
      })

      current = addMonths(current, 1)
    }
  }

  return documents
}
