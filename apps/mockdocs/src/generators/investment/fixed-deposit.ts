import { addMonths, addYears } from 'date-fns'
import type { FixedDeposit, GenerationContext, GeneratedDocument } from '../../types'
import { getBanks } from '../../config/institutions'
import {
  createPDF,
  savePDF,
  addHeader,
  addSectionHeading,
  addKeyValue,
  addFooter,
  formatDocDate,
} from '../../lib/pdf'
import { generateId, randomBetween, randomPick, randomDecimal, formatCurrency, getSalaryRange } from '../../lib/utils'

// Generate fixed deposits
export function generateFixedDeposits(ctx: GenerationContext): FixedDeposit[] {
  const { country, scale, startDate } = ctx.config
  const banks = getBanks(country)
  const salaryRange = getSalaryRange(country, scale)

  // Number of FDs based on scale
  const fdCount = Math.min(scale - 1, 3)
  if (fdCount <= 0) return []

  const deposits: FixedDeposit[] = []

  for (let i = 0; i < fdCount; i++) {
    const bank = randomPick(banks)

    // FD amount based on scale
    const principal = Math.round((salaryRange.min * randomBetween(2, 6)) / 10000) * 10000

    // Interest rate (IN: 6-7.5%, US: 4-5.5%)
    const interestRate = country === 'IN' ? randomDecimal(6, 7.5) : randomDecimal(4, 5.5)

    // Tenure (12-60 months)
    const tenure = randomPick([12, 24, 36, 48, 60])

    // Start date (sometime in the past year)
    const fdStartDate = new Date(
      startDate.getFullYear() - randomBetween(0, 1),
      randomBetween(0, 11),
      randomBetween(1, 28)
    )

    // Maturity calculation
    const maturityDate = addMonths(fdStartDate, tenure)
    const yearsToMaturity = tenure / 12
    const maturityAmount = Math.round(principal * Math.pow(1 + interestRate / 100, yearsToMaturity))

    deposits.push({
      fdNumber: `${bank.id.toUpperCase()}FD${generateId('')}`,
      bank,
      principal,
      interestRate,
      tenure,
      startDate: fdStartDate,
      maturityDate,
      maturityAmount,
      interestPayout: randomPick(['cumulative', 'quarterly']),
    })
  }

  return deposits
}

// Generate FD certificate PDF
export async function generateFDPDF(
  fd: FixedDeposit,
  ctx: GenerationContext,
  outputDir: string
): Promise<GeneratedDocument> {
  const { country } = ctx.config
  const doc = createPDF()

  const title = country === 'IN' ? 'Fixed Deposit Receipt' : 'Certificate of Deposit'

  // Header
  addHeader(doc, fd.bank.name, title)

  // FD details
  addSectionHeading(doc, country === 'IN' ? 'Fixed Deposit Details' : 'Certificate Details')
  addKeyValue(doc, country === 'IN' ? 'FD Account Number' : 'CD Number', fd.fdNumber)
  addKeyValue(doc, 'Deposit Date', formatDocDate(fd.startDate))
  addKeyValue(doc, 'Maturity Date', formatDocDate(fd.maturityDate))
  addKeyValue(doc, 'Tenure', `${fd.tenure} months`)
  doc.moveDown(0.5)

  // Amount details
  addSectionHeading(doc, 'Amount Details')
  addKeyValue(doc, 'Principal Amount', formatCurrency(fd.principal, country))
  addKeyValue(doc, 'Interest Rate', `${fd.interestRate}% p.a.`)
  addKeyValue(doc, 'Interest Payout', fd.interestPayout === 'cumulative' ? 'At Maturity (Cumulative)' : 'Quarterly')
  addKeyValue(doc, 'Maturity Amount', formatCurrency(fd.maturityAmount, country))
  addKeyValue(doc, 'Interest Earned', formatCurrency(fd.maturityAmount - fd.principal, country))
  doc.moveDown(0.5)

  // Depositor details
  addSectionHeading(doc, 'Depositor Details')
  addKeyValue(doc, 'Name', ctx.holder.name)
  addKeyValue(doc, 'Address', ctx.holder.address)
  if (country === 'IN' && ctx.holder.pan) {
    addKeyValue(doc, 'PAN', ctx.holder.pan)
  }
  doc.moveDown(1)

  // Terms
  doc.fontSize(9).font('Helvetica-Bold').text('Terms and Conditions:')
  doc.fontSize(8).font('Helvetica').text(
    `1. Premature withdrawal is subject to penalty as per bank rules.
2. ${country === 'IN' ? 'TDS will be deducted if interest exceeds INR 40,000 in a financial year.' : 'Interest income is subject to federal and state taxes.'}
3. This certificate should be preserved safely. In case of loss, please contact the branch.
4. Renewal can be done before or on the maturity date.
5. The deposit is covered under ${country === 'IN' ? 'DICGC' : 'FDIC'} insurance up to the applicable limit.`,
    { align: 'left' }
  )

  // Footer
  addFooter(doc, `${fd.bank.name} | FD No: ${fd.fdNumber}`)

  // Save
  const filename = `${fd.bank.id}-fd-certificate-${fd.startDate.getFullYear()}.pdf`
  const filepath = `${outputDir}/${filename}`

  await savePDF(doc, filepath)

  return {
    type: 'investment',
    subtype: 'fixed_deposit',
    filename,
    format: 'pdf',
    path: filepath,
  }
}
