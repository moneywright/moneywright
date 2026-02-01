import { subYears } from 'date-fns'
import type { EPFAccount, GenerationContext, GeneratedDocument } from '../../types'
import { getEmployers } from '../../config/merchants'
import {
  createPDF,
  savePDF,
  addHeader,
  addSectionHeading,
  addKeyValue,
  addFooter,
  formatDocDate,
} from '../../lib/pdf'
import { generateId, randomBetween, randomPick, formatCurrency, getSalaryRange } from '../../lib/utils'

// Generate EPF account data
export function generateEPFAccount(ctx: GenerationContext): EPFAccount {
  const { scale, startDate } = ctx.config
  const salaryRange = getSalaryRange('IN', scale)
  const employer = randomPick(getEmployers('IN'))

  // Years of service
  const yearsWorked = randomBetween(2, 10)

  // Monthly basic salary (typically 40-50% of CTC)
  const monthlyBasic = Math.round(salaryRange.min * 0.45)

  // EPF contribution (12% each from employee and employer on basic, max 15000 basic for employer)
  const epfBasic = Math.min(monthlyBasic, 15000)
  const monthlyEmployeeContribution = Math.round(epfBasic * 0.12)
  const monthlyEmployerContribution = Math.round(epfBasic * 0.12) // 8.33% goes to EPS, rest to EPF

  const totalMonths = yearsWorked * 12
  const employeeContribution = monthlyEmployeeContribution * totalMonths
  const employerContribution = monthlyEmployerContribution * totalMonths

  // Interest earned (approx 8.1% p.a.)
  const avgBalance = (employeeContribution + employerContribution) / 2
  const interestEarned = Math.round(avgBalance * 0.081 * yearsWorked)

  return {
    uan: `1001${randomBetween(10000000, 99999999)}`,
    memberId: `${employer.slice(0, 4).toUpperCase()}/${generateId('')}`,
    employer,
    balance: employeeContribution + employerContribution + interestEarned,
    employeeContribution,
    employerContribution,
    interestEarned,
  }
}

// Generate EPF passbook PDF
export async function generateEPFPDF(
  account: EPFAccount,
  ctx: GenerationContext,
  outputDir: string
): Promise<GeneratedDocument> {
  const { endDate } = ctx.config
  const doc = createPDF()

  // Header
  addHeader(doc, 'Employees\' Provident Fund Organisation', 'EPF Passbook Statement')

  // Member details
  addSectionHeading(doc, 'Member Details')
  addKeyValue(doc, 'Universal Account Number (UAN)', account.uan)
  addKeyValue(doc, 'Member ID', account.memberId)
  addKeyValue(doc, 'Member Name', ctx.holder.name)
  addKeyValue(doc, 'Employer', account.employer)
  if (ctx.holder.pan) {
    addKeyValue(doc, 'PAN', ctx.holder.pan)
  }
  addKeyValue(doc, 'Statement Date', formatDocDate(endDate))
  doc.moveDown(1)

  // Balance summary
  addSectionHeading(doc, 'Account Balance')
  addKeyValue(doc, 'Employee Contribution', formatCurrency(account.employeeContribution, 'IN'))
  addKeyValue(doc, 'Employer Contribution (EPF)', formatCurrency(account.employerContribution, 'IN'))
  addKeyValue(doc, 'Interest Earned', formatCurrency(account.interestEarned, 'IN'))
  doc.moveDown(0.5)
  doc.fontSize(11).font('Helvetica-Bold').text(`Total Balance: ${formatCurrency(account.balance, 'IN')}`)
  doc.moveDown(1)

  // Current year contributions
  const salaryRange = getSalaryRange('IN', ctx.config.scale)
  const monthlyBasic = Math.round(salaryRange.min * 0.45)
  const epfBasic = Math.min(monthlyBasic, 15000)
  const monthlyContribution = Math.round(epfBasic * 0.12)

  addSectionHeading(doc, 'Current Year Details')
  addKeyValue(doc, 'Monthly Basic Salary', formatCurrency(monthlyBasic, 'IN'))
  addKeyValue(doc, 'Monthly Employee Contribution (12%)', formatCurrency(monthlyContribution, 'IN'))
  addKeyValue(doc, 'Monthly Employer Contribution (12%)', formatCurrency(monthlyContribution, 'IN'))
  addKeyValue(doc, 'Current Interest Rate', '8.10% p.a.')
  doc.moveDown(1)

  // Important notes
  doc.fontSize(9).font('Helvetica-Bold').text('Important Information:')
  doc.fontSize(8).font('Helvetica').text(
    `1. Employee contribution of 12% of basic salary is mandatory.
2. Employer contributes 12% (3.67% to EPF + 8.33% to EPS).
3. Interest is calculated monthly and credited annually.
4. Withdrawal allowed after 2 months of leaving employment.
5. Partial withdrawal allowed for specific purposes (home, medical, education).
6. PF balance can be transferred when changing jobs via UAN.
7. EPF is exempt-exempt-exempt (EEE) for tax purposes.`,
    { align: 'left' }
  )

  // Footer
  addFooter(doc, `EPFO | UAN: ${account.uan}`)

  // Save
  const filename = `epfo-passbook-${endDate.getFullYear()}.pdf`
  const filepath = `${outputDir}/${filename}`

  await savePDF(doc, filepath)

  return {
    type: 'investment',
    subtype: 'epf',
    filename,
    format: 'pdf',
    path: filepath,
  }
}
