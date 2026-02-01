import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import type { CountryCode, Transaction, BankStatement, CreditCardStatement } from '../types'

// Create a new workbook
export function createWorkbook(): XLSX.WorkBook {
  return XLSX.utils.book_new()
}

// Add a worksheet to workbook
export function addWorksheet(workbook: XLSX.WorkBook, data: unknown[][], sheetName: string): void {
  const worksheet = XLSX.utils.aoa_to_sheet(data)

  // Set column widths
  const colWidths = data[0]?.map((_, i) => {
    const maxLen = Math.max(...data.map((row) => String(row[i] || '').length))
    return { wch: Math.min(Math.max(maxLen + 2, 10), 50) }
  })
  worksheet['!cols'] = colWidths

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
}

// Save workbook to file
export function saveWorkbook(workbook: XLSX.WorkBook, filepath: string): void {
  XLSX.writeFile(workbook, filepath)
}

// Generate bank statement XLSX
export function generateBankStatementXLSX(
  statement: BankStatement,
  country: CountryCode,
  filepath: string
): void {
  const workbook = createWorkbook()

  // Summary sheet
  const summaryData = [
    ['Bank Statement'],
    [],
    ['Account Holder', statement.account.holder.name],
    ['Account Number', statement.account.accountNumber],
    ['Account Type', statement.account.accountType.toUpperCase()],
    ['Bank', statement.account.institution.name],
    ...(country === 'IN' ? [['IFSC Code', statement.account.ifsc || '']] : [['Routing Number', statement.account.routingNumber || '']]),
    [],
    ['Statement Period', `${format(statement.periodStart, 'dd/MM/yyyy')} to ${format(statement.periodEnd, 'dd/MM/yyyy')}`],
    [],
    ['Opening Balance', statement.openingBalance],
    ['Total Credits', statement.totalCredits],
    ['Total Debits', statement.totalDebits],
    ['Closing Balance', statement.closingBalance],
  ]

  addWorksheet(workbook, summaryData, 'Summary')

  // Transactions sheet
  const txHeaders = ['Date', 'Description', 'Reference', 'Debit', 'Credit', 'Balance']
  const txRows = statement.transactions.map((tx) => [
    format(tx.date, 'dd/MM/yyyy'),
    tx.description,
    tx.reference || '',
    tx.type === 'debit' ? tx.amount : '',
    tx.type === 'credit' ? tx.amount : '',
    tx.balance || '',
  ])

  addWorksheet(workbook, [txHeaders, ...txRows], 'Transactions')

  saveWorkbook(workbook, filepath)
}

// Generate credit card statement XLSX
export function generateCreditCardXLSX(
  statement: CreditCardStatement,
  country: CountryCode,
  filepath: string
): void {
  const workbook = createWorkbook()

  // Summary sheet
  const summaryData = [
    ['Credit Card Statement'],
    [],
    ['Card Holder', statement.card.holder.name],
    ['Card Number', statement.card.cardNumber],
    ['Card Type', `${statement.card.institution.name} ${statement.card.cardVariant}`],
    [],
    ['Statement Date', format(statement.statementDate, 'dd/MM/yyyy')],
    ['Payment Due Date', format(statement.dueDate, 'dd/MM/yyyy')],
    ['Statement Period', `${format(statement.periodStart, 'dd/MM/yyyy')} to ${format(statement.periodEnd, 'dd/MM/yyyy')}`],
    [],
    ['Previous Balance', statement.previousBalance],
    ['Payments Received', statement.paymentsReceived],
    ['New Charges', statement.newCharges],
    ['Total Amount Due', statement.totalDue],
    ['Minimum Amount Due', statement.minimumDue],
  ]

  addWorksheet(workbook, summaryData, 'Summary')

  // Transactions sheet
  const txHeaders = ['Date', 'Description', 'Category', 'Amount']
  const txRows = statement.transactions.map((tx) => [
    format(tx.date, 'dd/MM/yyyy'),
    tx.description,
    tx.category,
    tx.type === 'debit' ? -tx.amount : tx.amount,
  ])

  addWorksheet(workbook, [txHeaders, ...txRows], 'Transactions')

  saveWorkbook(workbook, filepath)
}

// Generate generic data XLSX (for investments, etc.)
export function generateDataXLSX(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filepath: string,
  summaryData?: (string | number)[][]
): void {
  const workbook = createWorkbook()

  if (summaryData) {
    addWorksheet(workbook, [[title], [], ...summaryData], 'Summary')
  }

  addWorksheet(workbook, [headers, ...rows], summaryData ? 'Data' : 'Sheet1')

  saveWorkbook(workbook, filepath)
}
