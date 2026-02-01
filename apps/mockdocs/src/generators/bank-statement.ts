import { format, startOfYear, endOfYear, isBefore, isAfter, eachYearOfInterval } from 'date-fns'
import type { BankAccount, BankStatement, Transaction, GenerationContext, GeneratedDocument } from '../types'
import { getBanks, getRandomInstitutions } from '../config/institutions'
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
import { generateBankStatementXLSX } from '../lib/xlsx'
import {
  generateId,
  generateAccountNumber,
  generateIFSC,
  generateRoutingNumber,
  randomPick,
  formatCurrency,
  getSalaryRange,
  randomDecimal,
} from '../lib/utils'
import { generateBankTransactions, generateCCPaymentTransactions } from '../lib/data'

// Generate bank accounts
export function generateBankAccounts(ctx: GenerationContext): BankAccount[] {
  const { country, bankAccountCount } = ctx.config
  const banks = getBanks(country)
  const selectedBanks = getRandomInstitutions(banks, bankAccountCount)

  const accounts: BankAccount[] = []

  for (let i = 0; i < bankAccountCount; i++) {
    const bank = selectedBanks[i] || banks[i % banks.length]
    const accountType = country === 'IN' ? 'savings' : (i === 0 ? 'checking' : 'savings')

    accounts.push({
      id: generateId('ACC'),
      institution: bank,
      accountNumber: generateAccountNumber(country),
      accountType,
      ...(country === 'IN'
        ? { ifsc: generateIFSC(bank.id) }
        : { routingNumber: generateRoutingNumber() }),
      holder: ctx.holder,
    })
  }

  return accounts
}

// Prepare all transactions for an account with proper running balances
function prepareAccountTransactions(
  account: BankAccount,
  ctx: GenerationContext
): { transactions: Transaction[]; openingBalance: number } {
  const { country, scale } = ctx.config

  // Get all transactions for this account
  let transactions = ctx.bankTransactions.get(account.id) || []

  // Add CC payments (these depend on CC transactions being generated first)
  const ccPayments = generateCCPaymentTransactions(ctx, account)
  transactions = [...transactions, ...ccPayments]

  // Sort by date
  transactions.sort((a, b) => a.date.getTime() - b.date.getTime())

  // Opening balance: 1-2x monthly salary (reasonable savings)
  const salaryRange = getSalaryRange(country, scale)
  let openingBalance = Math.round(salaryRange.min * randomDecimal(1, 2))

  // Calculate running balances
  let balance = openingBalance
  let minBalance = openingBalance
  for (const tx of transactions) {
    if (tx.type === 'credit') {
      balance += tx.amount
    } else {
      balance -= tx.amount
    }
    tx.balance = Math.round(balance * 100) / 100
    if (balance < minBalance) {
      minBalance = balance
    }
  }

  // If balance would go negative, adjust opening balance to prevent it
  // Add a small buffer (10% of monthly salary)
  if (minBalance < 0) {
    const adjustment = Math.abs(minBalance) + Math.round(salaryRange.min * 0.1)
    openingBalance += adjustment

    // Recalculate balances with adjusted opening
    balance = openingBalance
    for (const tx of transactions) {
      if (tx.type === 'credit') {
        balance += tx.amount
      } else {
        balance -= tx.amount
      }
      tx.balance = Math.round(balance * 100) / 100
    }
  }

  return { transactions, openingBalance }
}

// Generate yearly bank statement data
function generateYearlyStatements(
  account: BankAccount,
  allTransactions: Transaction[],
  initialOpeningBalance: number,
  ctx: GenerationContext
): BankStatement[] {
  const { startDate, endDate } = ctx.config
  const statements: BankStatement[] = []

  // Get all years in the range
  const years = eachYearOfInterval({ start: startDate, end: endDate })

  let carryOverBalance = initialOpeningBalance

  for (const yearStart of years) {
    const year = yearStart.getFullYear()
    const periodStart = new Date(Math.max(startOfYear(yearStart).getTime(), startDate.getTime()))
    const periodEnd = new Date(Math.min(endOfYear(yearStart).getTime(), endDate.getTime()))

    // Filter transactions for this year
    const yearTransactions = allTransactions.filter(
      (t) => !isBefore(t.date, periodStart) && !isAfter(t.date, periodEnd)
    )

    // Calculate totals for this year
    const totalCredits = yearTransactions
      .filter((t) => t.type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0)
    const totalDebits = yearTransactions
      .filter((t) => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0)
    const closingBalance = carryOverBalance + totalCredits - totalDebits

    statements.push({
      account,
      periodStart,
      periodEnd,
      openingBalance: Math.round(carryOverBalance * 100) / 100,
      closingBalance: Math.round(closingBalance * 100) / 100,
      totalCredits: Math.round(totalCredits * 100) / 100,
      totalDebits: Math.round(totalDebits * 100) / 100,
      transactions: yearTransactions,
    })

    // Carry over closing balance to next year
    carryOverBalance = closingBalance
  }

  return statements
}

// Generate bank statement PDF
async function generateBankStatementPDF(
  statement: BankStatement,
  ctx: GenerationContext,
  outputDir: string
): Promise<string> {
  const { country } = ctx.config
  const doc = createPDF()
  const { account } = statement

  // Header
  addHeader(doc, account.institution.name, 'Account Statement')

  // Account details
  addSectionHeading(doc, 'Account Details')
  addKeyValue(doc, 'Account Holder', account.holder.name)
  addKeyValue(doc, 'Account Number', account.accountNumber)
  addKeyValue(doc, 'Account Type', account.accountType.charAt(0).toUpperCase() + account.accountType.slice(1))
  if (country === 'IN' && account.ifsc) {
    addKeyValue(doc, 'IFSC Code', account.ifsc)
  } else if (country === 'US' && account.routingNumber) {
    addKeyValue(doc, 'Routing Number', account.routingNumber)
  }
  addKeyValue(doc, 'Address', account.holder.address)
  doc.moveDown(0.5)

  // Statement period
  addSectionHeading(doc, 'Statement Period')
  addKeyValue(doc, 'From', formatDocDate(statement.periodStart))
  addKeyValue(doc, 'To', formatDocDate(statement.periodEnd))
  doc.moveDown(0.5)

  // Account summary
  addSectionHeading(doc, 'Account Summary')
  addKeyValue(doc, 'Opening Balance', formatCurrency(statement.openingBalance, country))
  addKeyValue(doc, 'Total Credits', formatCurrency(statement.totalCredits, country))
  addKeyValue(doc, 'Total Debits', formatCurrency(statement.totalDebits, country))
  doc.moveDown(0.3)
  doc.fontSize(11).font('Helvetica-Bold').text(`Closing Balance: ${formatCurrency(statement.closingBalance, country)}`)
  doc.moveDown(1)

  // Transactions
  doc.addPage()
  addSectionHeading(doc, 'Transaction Details')
  addTransactionTable(doc, statement.transactions, country, true)

  // Footer
  addFooter(doc, `${account.institution.name} | A/C: ${account.accountNumber}`)

  // Save - use year for filename
  const year = statement.periodStart.getFullYear()
  const filename = `${account.institution.id}-bank-${account.accountType}-statement-${year}.pdf`
  const filepath = `${outputDir}/${filename}`

  await savePDF(doc, filepath)
  return filepath
}

// Generate all bank statement documents (yearly)
export async function generateBankStatementDocuments(
  ctx: GenerationContext,
  outputDir: string
): Promise<GeneratedDocument[]> {
  const documents: GeneratedDocument[] = []
  const { country } = ctx.config

  // First, generate all bank transactions (excluding CC payments)
  for (const account of ctx.bankAccounts) {
    const transactions = generateBankTransactions(ctx, account)
    ctx.bankTransactions.set(account.id, transactions)
  }

  // Then generate yearly statements for each account
  for (const account of ctx.bankAccounts) {
    // Prepare all transactions with proper running balances
    const { transactions, openingBalance } = prepareAccountTransactions(account, ctx)

    // Update transactions in context (now includes CC payments with proper balances)
    ctx.bankTransactions.set(account.id, transactions)

    // Generate yearly statements
    const yearlyStatements = generateYearlyStatements(account, transactions, openingBalance, ctx)

    for (const statement of yearlyStatements) {
      const year = statement.periodStart.getFullYear()

      // Generate PDF
      const pdfPath = await generateBankStatementPDF(statement, ctx, outputDir)

      documents.push({
        type: 'bank_statement',
        subtype: account.accountType,
        filename: pdfPath.split('/').pop() || '',
        format: 'pdf',
        path: pdfPath,
      })

      // Generate XLSX
      const xlsxFilename = `${account.institution.id}-bank-${account.accountType}-statement-${year}.xlsx`
      const xlsxPath = `${outputDir}/${xlsxFilename}`
      generateBankStatementXLSX(statement, country, xlsxPath)

      documents.push({
        type: 'bank_statement',
        subtype: account.accountType,
        filename: xlsxFilename,
        format: 'xlsx',
        path: xlsxPath,
      })
    }
  }

  return documents
}
