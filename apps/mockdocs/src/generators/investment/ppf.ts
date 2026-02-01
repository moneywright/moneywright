import { subYears } from 'date-fns'
import type { PPFAccount, GenerationContext, GeneratedDocument } from '../../types'
import { getBanks } from '../../config/institutions'
import {
  createPDF,
  savePDF,
  addHeader,
  addSectionHeading,
  addKeyValue,
  addTable,
  addFooter,
  formatDocDate,
} from '../../lib/pdf'
import { generateId, randomBetween, randomPick, formatCurrency, getSalaryRange } from '../../lib/utils'

// Generate PPF account data
export function generatePPFAccount(ctx: GenerationContext): PPFAccount {
  const { scale, startDate, endDate } = ctx.config
  const banks = getBanks('IN')
  const bank = randomPick(banks)
  const salaryRange = getSalaryRange('IN', scale)

  // PPF opened some years ago
  const yearsActive = randomBetween(3, 10)
  const openingDate = subYears(startDate, yearsActive)

  // Yearly contributions (max 1.5L allowed)
  const yearlyContribution = Math.min(
    Math.round((salaryRange.min * 12 * 0.1) / 10000) * 10000,
    150000
  )

  const contributions: { year: string; amount: number }[] = []
  let totalContributions = 0
  let interestEarned = 0
  const ppfRate = 7.1 // Current PPF rate

  for (let i = 0; i < yearsActive; i++) {
    const year = openingDate.getFullYear() + i
    const yearStr = `${year}-${(year + 1).toString().slice(2)}`
    const contribution = i < yearsActive - 1 ? yearlyContribution : yearlyContribution * (randomBetween(8, 12) / 12)

    contributions.push({ year: yearStr, amount: Math.round(contribution) })
    totalContributions += contribution

    // Simple interest calculation for the year
    interestEarned += Math.round(totalContributions * (ppfRate / 100))
  }

  return {
    accountNumber: `PPF${generateId('')}`,
    bank,
    openingDate,
    balance: totalContributions + interestEarned,
    yearlyContributions: contributions,
    interestEarned,
  }
}

// Generate PPF statement PDF
export async function generatePPFPDF(
  account: PPFAccount,
  ctx: GenerationContext,
  outputDir: string
): Promise<GeneratedDocument> {
  const { endDate } = ctx.config
  const doc = createPDF()

  // Header
  addHeader(doc, account.bank.name, 'Public Provident Fund (PPF) Statement')

  // Account details
  addSectionHeading(doc, 'Account Details')
  addKeyValue(doc, 'PPF Account Number', account.accountNumber)
  addKeyValue(doc, 'Account Holder', ctx.holder.name)
  addKeyValue(doc, 'Account Opening Date', formatDocDate(account.openingDate))
  if (ctx.holder.pan) {
    addKeyValue(doc, 'PAN', ctx.holder.pan)
  }
  addKeyValue(doc, 'Statement Date', formatDocDate(endDate))
  doc.moveDown(1)

  // Balance summary
  addSectionHeading(doc, 'Balance Summary')
  const totalContributions = account.yearlyContributions.reduce((sum, c) => sum + c.amount, 0)
  addKeyValue(doc, 'Total Contributions', formatCurrency(totalContributions, 'IN'))
  addKeyValue(doc, 'Interest Earned', formatCurrency(account.interestEarned, 'IN'))
  addKeyValue(doc, 'Current Balance', formatCurrency(account.balance, 'IN'))
  doc.moveDown(1)

  // Yearly contributions table
  addSectionHeading(doc, 'Year-wise Contributions')
  const headers = ['Financial Year', 'Contribution Amount']
  const rows = account.yearlyContributions.map((c) => [c.year, formatCurrency(c.amount, 'IN')])
  addTable(doc, headers, rows, [200, 200])

  // Terms
  doc.moveDown(2)
  doc.fontSize(9).font('Helvetica-Bold').text('Important Information:')
  doc.fontSize(8).font('Helvetica').text(
    `1. PPF has a 15-year lock-in period from the date of account opening.
2. Maximum contribution allowed is INR 1,50,000 per financial year.
3. Current interest rate: 7.1% p.a. (subject to quarterly revision).
4. Contributions qualify for tax deduction under Section 80C.
5. Interest earned and maturity amount are tax-free under Section 10.
6. Partial withdrawal is allowed from 7th year onwards.
7. Loan facility available from 3rd to 6th year.`,
    { align: 'left' }
  )

  // Footer
  addFooter(doc, `${account.bank.name} | PPF A/C: ${account.accountNumber}`)

  // Save
  const filename = `${account.bank.id}-ppf-statement-${endDate.getFullYear()}.pdf`
  const filepath = `${outputDir}/${filename}`

  await savePDF(doc, filepath)

  return {
    type: 'investment',
    subtype: 'ppf',
    filename,
    format: 'pdf',
    path: filepath,
  }
}
