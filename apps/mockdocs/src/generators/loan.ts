import { addMonths, addYears } from 'date-fns'
import type { Loan, LoanType, GenerationContext, GeneratedDocument, BankAccount } from '../types'
import { getBanks, getRandomInstitutions } from '../config/institutions'
import { LOAN_TERMS, LOAN_TERMS_US } from '../config/templates'
import {
  createPDF,
  savePDF,
  addHeader,
  addSectionHeading,
  addKeyValue,
  addTermsSection,
  addFooter,
  addSignatureBlock,
  addTable,
  formatDocDate,
} from '../lib/pdf'
import { generateId, randomBetween, randomPick, randomDecimal, formatCurrency, getSalaryRange } from '../lib/utils'
import { format } from 'date-fns'

// Get loan types based on scale
function getLoanTypes(scale: number): LoanType[] {
  const types: LoanType[] = []

  // Personal loan - scale 2+
  if (scale >= 2 && Math.random() > 0.5) types.push('personal')

  // Car loan - scale 3+
  if (scale >= 3) types.push('car')

  // Home loan - scale 4+
  if (scale >= 4) types.push('home')

  return types
}

// Calculate loan amount based on scale and type
function calculateLoanAmount(type: LoanType, scale: number, country: string): number {
  const salaryRange = getSalaryRange(country as 'IN' | 'US', scale as 1 | 2 | 3 | 4 | 5)
  const annualSalary = salaryRange.min * 12

  switch (type) {
    case 'personal':
      // 1-3x monthly salary
      return Math.round((salaryRange.min * randomBetween(1, 3)) / 10000) * 10000
    case 'car':
      // Car value based on scale
      if (country === 'IN') {
        return randomPick([500000, 800000, 1200000, 2000000, 3500000].slice(scale - 2))
      }
      return randomPick([20000, 30000, 40000, 55000, 80000].slice(scale - 2))
    case 'home':
      // 4-6x annual salary
      if (country === 'IN') {
        return Math.round((annualSalary * randomBetween(4, 6)) / 100000) * 100000
      }
      return Math.round((annualSalary * randomBetween(4, 6)) / 10000) * 10000
    default:
      return 0
  }
}

// Get loan tenure in months
function getLoanTenure(type: LoanType): number {
  switch (type) {
    case 'personal':
      return randomPick([12, 24, 36, 48, 60])
    case 'car':
      return randomPick([36, 48, 60, 72, 84])
    case 'home':
      return randomPick([120, 180, 240, 300, 360])
    default:
      return 36
  }
}

// Get interest rate based on loan type and country
function getInterestRate(type: LoanType, country: string): number {
  const rates = {
    IN: {
      personal: { min: 10.5, max: 16 },
      car: { min: 7.5, max: 11 },
      home: { min: 8.5, max: 10.5 },
    },
    US: {
      personal: { min: 8, max: 15 },
      car: { min: 4, max: 8 },
      home: { min: 6, max: 8 },
    },
  }

  const range = rates[country as 'IN' | 'US'][type]
  return randomDecimal(range.min, range.max, 2)
}

// Calculate EMI
function calculateEMI(principal: number, rate: number, tenureMonths: number): number {
  const monthlyRate = rate / 100 / 12
  const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) / (Math.pow(1 + monthlyRate, tenureMonths) - 1)
  return Math.round(emi)
}

// Generate loan data
export function generateLoans(ctx: GenerationContext): Loan[] {
  const { country, scale, startDate } = ctx.config
  const types = getLoanTypes(scale)
  const lenders = getRandomInstitutions(getBanks(country), types.length)
  const loans: Loan[] = []

  for (let i = 0; i < types.length; i++) {
    const type = types[i]
    const lender = lenders[i] || lenders[0]
    const principal = calculateLoanAmount(type, scale, country)
    const rate = getInterestRate(type, country)
    const tenure = getLoanTenure(type)
    const emi = calculateEMI(principal, rate, tenure)

    // Link to a random bank account
    const linkedAccount = ctx.bankAccounts[i % ctx.bankAccounts.length]

    const disbursementDate = new Date(
      startDate.getFullYear() - randomBetween(1, 3),
      randomBetween(0, 11),
      randomBetween(1, 28)
    )

    const loan: Loan = {
      id: generateId('LN'),
      type,
      lender,
      loanNumber: `${lender.id.toUpperCase()}LN${generateId('')}`,
      holder: ctx.holder,
      principalAmount: principal,
      interestRate: rate,
      tenure,
      emi,
      startDate: disbursementDate,
      disbursementDate,
      linkedBankAccount: linkedAccount,
    }

    loans.push(loan)
  }

  return loans
}

// Generate amortization schedule (first 12 months only for brevity)
function generateAmortizationSchedule(
  principal: number,
  rate: number,
  tenure: number,
  emi: number,
  startDate: Date,
  country: string
): string[][] {
  const rows: string[][] = []
  const monthlyRate = rate / 100 / 12
  let balance = principal
  let currentDate = new Date(startDate)

  const monthsToShow = Math.min(12, tenure)

  for (let i = 1; i <= monthsToShow; i++) {
    currentDate = addMonths(currentDate, 1)
    const interest = Math.round(balance * monthlyRate)
    const principalPaid = emi - interest
    balance = Math.max(0, balance - principalPaid)

    rows.push([
      String(i),
      format(currentDate, 'MMM yyyy'),
      formatCurrency(emi, country as 'IN' | 'US'),
      formatCurrency(principalPaid, country as 'IN' | 'US'),
      formatCurrency(interest, country as 'IN' | 'US'),
      formatCurrency(balance, country as 'IN' | 'US'),
    ])
  }

  if (tenure > 12) {
    rows.push(['...', '...', '...', '...', '...', '...'])
  }

  return rows
}

// Generate loan document PDF
export async function generateLoanPDF(
  loan: Loan,
  ctx: GenerationContext,
  outputDir: string
): Promise<GeneratedDocument> {
  const { country } = ctx.config
  const doc = createPDF()

  const terms = country === 'IN' ? LOAN_TERMS : LOAN_TERMS_US
  const template = terms[loan.type]

  // Header
  addHeader(doc, loan.lender.name, template.title)

  // Loan details
  addSectionHeading(doc, 'Loan Details')
  addKeyValue(doc, 'Loan Account Number', loan.loanNumber)
  addKeyValue(doc, 'Loan Type', loan.type.charAt(0).toUpperCase() + loan.type.slice(1) + ' Loan')
  addKeyValue(doc, 'Disbursement Date', formatDocDate(loan.disbursementDate))
  addKeyValue(doc, 'Loan Amount', formatCurrency(loan.principalAmount, country))
  addKeyValue(doc, 'Interest Rate', `${loan.interestRate}% p.a.`)
  addKeyValue(doc, 'Tenure', `${loan.tenure} months (${Math.round(loan.tenure / 12)} years)`)
  addKeyValue(doc, 'EMI Amount', formatCurrency(loan.emi, country))
  addKeyValue(doc, 'EMI Debit Account', `${loan.linkedBankAccount.institution.name} - ${loan.linkedBankAccount.accountNumber}`)
  doc.moveDown(0.5)

  // Borrower details
  addSectionHeading(doc, 'Borrower Details')
  addKeyValue(doc, 'Name', loan.holder.name)
  addKeyValue(doc, 'Address', loan.holder.address)
  addKeyValue(doc, 'Phone', loan.holder.phone)
  addKeyValue(doc, 'Email', loan.holder.email)
  if (country === 'IN' && loan.holder.pan) {
    addKeyValue(doc, 'PAN', loan.holder.pan)
  }
  doc.moveDown(1)

  // Property/Vehicle details for secured loans
  if (loan.type === 'home') {
    addSectionHeading(doc, 'Property Details')
    addKeyValue(doc, 'Property Address', loan.holder.address)
    addKeyValue(doc, 'Property Type', 'Residential Apartment')
    addKeyValue(doc, 'Property Value', formatCurrency(loan.principalAmount * 1.2, country))
    doc.moveDown(0.5)
  } else if (loan.type === 'car') {
    addSectionHeading(doc, 'Vehicle Details')
    const carMakes = country === 'IN' ? ['Maruti Suzuki', 'Hyundai', 'Tata', 'Honda', 'Toyota'] : ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'BMW']
    const carModels = country === 'IN' ? ['Swift', 'Creta', 'Nexon', 'City', 'Fortuner'] : ['Camry', 'Accord', 'F-150', 'Equinox', 'X5']
    addKeyValue(doc, 'Make', randomPick(carMakes))
    addKeyValue(doc, 'Model', randomPick(carModels))
    addKeyValue(doc, 'Year', String(loan.startDate.getFullYear()))
    addKeyValue(doc, 'Vehicle Value', formatCurrency(loan.principalAmount, country))
    doc.moveDown(0.5)
  }

  // Repayment schedule
  doc.addPage()
  addSectionHeading(doc, 'Repayment Schedule (First 12 Months)')
  const scheduleHeaders = ['#', 'Month', 'EMI', 'Principal', 'Interest', 'Balance']
  const scheduleRows = generateAmortizationSchedule(
    loan.principalAmount,
    loan.interestRate,
    loan.tenure,
    loan.emi,
    loan.startDate,
    country
  )
  addTable(doc, scheduleHeaders, scheduleRows, [30, 70, 80, 80, 80, 100])
  doc.moveDown(1)

  // Total payable
  const totalInterest = loan.emi * loan.tenure - loan.principalAmount
  const totalPayable = loan.principalAmount + totalInterest
  addKeyValue(doc, 'Total Interest Payable', formatCurrency(totalInterest, country))
  addKeyValue(doc, 'Total Amount Payable', formatCurrency(totalPayable, country))
  doc.moveDown(1)

  // Terms and conditions
  doc.addPage()
  addSectionHeading(doc, 'Terms and Conditions')
  addTermsSection(doc, template.sections)

  // Signature block
  doc.addPage()
  addSectionHeading(doc, 'Agreement and Signature')
  doc.fontSize(9).font('Helvetica').text(
    `I, ${loan.holder.name}, hereby agree to the terms and conditions of this loan agreement. I authorize ${loan.lender.name} to debit the EMI amount from my account ${loan.linkedBankAccount.accountNumber} on the due date each month.`,
    { align: 'justify' }
  )
  doc.moveDown(2)
  addSignatureBlock(doc, ['Borrower Signature', 'Bank Representative', 'Date'])

  // Footer
  addFooter(doc, `${loan.lender.name} | Loan A/C: ${loan.loanNumber}`)

  // Save
  const filename = `${loan.lender.id}-${loan.type}-loan-agreement-${loan.startDate.getFullYear()}.pdf`
  const filepath = `${outputDir}/${filename}`

  await savePDF(doc, filepath)

  return {
    type: 'loan',
    subtype: loan.type,
    filename,
    format: 'pdf',
    path: filepath,
  }
}

// Generate all loan documents
export async function generateLoanDocuments(
  ctx: GenerationContext,
  outputDir: string
): Promise<GeneratedDocument[]> {
  const documents: GeneratedDocument[] = []

  for (const loan of ctx.loans) {
    const doc = await generateLoanPDF(loan, ctx, outputDir)
    documents.push(doc)
  }

  return documents
}
