import { subYears } from 'date-fns'
import type { Account401k, GenerationContext, GeneratedDocument } from '../../types'
import { getEmployers } from '../../config/merchants'
import { BROKERS_US } from '../../config/institutions'
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
import { generateId, randomBetween, randomPick, randomDecimal, formatCurrency, getSalaryRange } from '../../lib/utils'

// Generate 401k account data
export function generate401kAccount(ctx: GenerationContext): Account401k {
  const { scale, startDate } = ctx.config
  const salaryRange = getSalaryRange('US', scale)
  const employer = randomPick(getEmployers('US'))
  const provider = randomPick(BROKERS_US)

  // Years of service
  const yearsWorked = randomBetween(2, 10)

  // Annual salary
  const annualSalary = salaryRange.min * 12

  // Employee contribution (percentage of salary, higher scales contribute more)
  const contributionPercent = Math.min(6 + scale * 2, 22.5) // Max IRS limit ~22.5k or percentage
  const yearlyEmployeeContribution = Math.min(Math.round(annualSalary * (contributionPercent / 100)), 22500)

  // Employer match (typically 50% up to 6% of salary)
  const matchPercent = 3 // 50% of 6%
  const yearlyEmployerMatch = Math.round(annualSalary * (matchPercent / 100))

  const totalYearlyContribution = yearlyEmployeeContribution + yearlyEmployerMatch
  const totalContributions = totalYearlyContribution * yearsWorked

  // Investment growth (assuming 7% average annual return)
  const growthRate = 0.07
  let balance = 0
  for (let i = 0; i < yearsWorked; i++) {
    balance = (balance + totalYearlyContribution) * (1 + growthRate)
  }
  balance = Math.round(balance)

  // Vesting (typically 3-6 year cliff or graded vesting)
  const vestingYears = 4
  const vestedPercent = Math.min((yearsWorked / vestingYears) * 100, 100)
  const employerTotal = yearlyEmployerMatch * yearsWorked
  const vestedEmployerAmount = Math.round(employerTotal * (vestedPercent / 100))
  const employeeTotal = yearlyEmployeeContribution * yearsWorked
  const vestedBalance = employeeTotal + vestedEmployerAmount + Math.round((balance - totalContributions) * (vestedPercent / 100 + (100 - vestedPercent) / 200))

  // Fund allocation
  const funds = [
    { fundName: 'S&P 500 Index Fund', allocation: randomBetween(30, 50), value: 0 },
    { fundName: 'Total Bond Market Fund', allocation: randomBetween(10, 25), value: 0 },
    { fundName: 'International Stock Fund', allocation: randomBetween(10, 20), value: 0 },
    { fundName: 'Target Date Fund 2050', allocation: 0, value: 0 },
  ]

  // Adjust last fund to make 100%
  const allocated = funds.slice(0, 3).reduce((sum, f) => sum + f.allocation, 0)
  funds[3].allocation = 100 - allocated

  // Calculate values
  for (const fund of funds) {
    fund.value = Math.round(balance * (fund.allocation / 100))
  }

  return {
    accountNumber: generateId('401K'),
    provider: provider.name,
    employer,
    balance,
    employeeContribution: employeeTotal,
    employerMatch: employerTotal,
    vestedBalance,
    holdings: funds,
  }
}

// Generate 401k statement PDF
export async function generate401kPDF(
  account: Account401k,
  ctx: GenerationContext,
  outputDir: string
): Promise<GeneratedDocument> {
  const { endDate } = ctx.config
  const doc = createPDF()

  // Header
  addHeader(doc, account.provider, '401(k) Retirement Plan Statement')

  // Account details
  addSectionHeading(doc, 'Account Information')
  addKeyValue(doc, 'Account Number', account.accountNumber)
  addKeyValue(doc, 'Participant', ctx.holder.name)
  addKeyValue(doc, 'Employer', account.employer)
  addKeyValue(doc, 'Statement Period', `Year Ending ${formatDocDate(endDate, 'MMMM dd, yyyy')}`)
  doc.moveDown(1)

  // Balance summary
  addSectionHeading(doc, 'Account Balance Summary')
  addKeyValue(doc, 'Total Account Balance', formatCurrency(account.balance, 'US'))
  addKeyValue(doc, 'Vested Balance', formatCurrency(account.vestedBalance, 'US'))
  doc.moveDown(0.5)

  // Contribution summary
  addSectionHeading(doc, 'Contribution Summary')
  addKeyValue(doc, 'Your Contributions (YTD)', formatCurrency(account.employeeContribution, 'US'))
  addKeyValue(doc, 'Employer Match (YTD)', formatCurrency(account.employerMatch, 'US'))
  addKeyValue(doc, 'Total Contributions', formatCurrency(account.employeeContribution + account.employerMatch, 'US'))
  doc.moveDown(1)

  // Investment allocation
  addSectionHeading(doc, 'Investment Allocation')
  const headers = ['Fund Name', 'Allocation', 'Value']
  const rows = account.holdings.map((h) => [
    h.fundName,
    `${h.allocation}%`,
    formatCurrency(h.value, 'US'),
  ])
  addTable(doc, headers, rows, [250, 80, 100])
  doc.moveDown(1)

  // Important notes
  doc.fontSize(9).font('Helvetica-Bold').text('Important Information:')
  doc.fontSize(8).font('Helvetica').text(
    `1. 2024 Contribution Limits: $23,000 (under 50), $30,500 (50 and older with catch-up).
2. Employer match is subject to vesting schedule. Check plan documents for details.
3. Early withdrawal (before age 59½) may be subject to 10% penalty plus income tax.
4. Required Minimum Distributions (RMDs) begin at age 73.
5. Loans and hardship withdrawals may be available - check plan rules.
6. You can change your investment allocation at any time through the plan website.
7. Contact your plan administrator for beneficiary designation updates.`,
    { align: 'left' }
  )

  // Footer
  addFooter(doc, `${account.provider} | Account: ${account.accountNumber}`)

  // Save
  const filename = `401k-statement-${endDate.getFullYear()}.pdf`
  const filepath = `${outputDir}/${filename}`

  await savePDF(doc, filepath)

  return {
    type: 'investment',
    subtype: '401k',
    filename,
    format: 'pdf',
    path: filepath,
  }
}
