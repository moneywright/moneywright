import { select, input, number } from '@inquirer/prompts'
import { mkdirSync, existsSync, rmSync } from 'fs'
import { resolve } from 'path'
import type { CountryCode, MoneyScale, GenerationContext, GeneratedDocument } from './types'
import { parseDate, generateAccountHolder } from './lib/utils'
import { generateBankAccounts, generateBankStatementDocuments } from './generators/bank-statement'
import { generateCreditCards, generateCreditCardDocuments } from './generators/credit-card'
import { generateInsurancePolicies, generateInsuranceDocuments } from './generators/insurance'
import { generateLoans, generateLoanDocuments } from './generators/loan'
import { generateInvestmentData, generateInvestmentDocuments } from './generators/investment'

// ASCII banner
const BANNER = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Mockdocs - Test Document Generator for Moneywright
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`

// Main function
async function main() {
  console.log(BANNER)

  // Select country
  const country = await select<CountryCode>({
    message: 'Select country:',
    choices: [
      { name: 'India (IN)', value: 'IN' },
      { name: 'United States (US)', value: 'US' },
    ],
  })

  // Date inputs
  const startDateStr = await input({
    message: 'Enter start date (DD/MM/YYYY):',
    default: '01/01/2024',
    validate: (value) => {
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
        return 'Please enter date in DD/MM/YYYY format'
      }
      return true
    },
  })

  const endDateStr = await input({
    message: 'Enter end date (DD/MM/YYYY):',
    default: '31/12/2024',
    validate: (value) => {
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
        return 'Please enter date in DD/MM/YYYY format'
      }
      return true
    },
  })

  const startDate = parseDate(startDateStr)
  const endDate = parseDate(endDateStr)

  // Number of accounts
  const bankAccountCount = await number({
    message: 'Number of bank accounts (1-3):',
    default: 2,
    min: 1,
    max: 3,
  }) || 2

  const creditCardCount = await number({
    message: 'Number of credit cards (1-4):',
    default: 2,
    min: 1,
    max: 4,
  }) || 2

  // Money scale
  const scaleLabels = country === 'IN'
    ? [
        '1 - Entry level (INR 30-50K/month)',
        '2 - Early career (INR 50K-1L/month)',
        '3 - Mid-career (INR 1-2L/month)',
        '4 - Senior (INR 2-4L/month)',
        '5 - High earner (INR 4-8L/month)',
      ]
    : [
        '1 - Entry level ($3-5K/month)',
        '2 - Early career ($5-8K/month)',
        '3 - Mid-career ($8-12K/month)',
        '4 - Senior ($12-20K/month)',
        '5 - High earner ($20-35K/month)',
      ]

  const scale = await select<MoneyScale>({
    message: 'Select money scale:',
    choices: scaleLabels.map((label, i) => ({
      name: label,
      value: (i + 1) as MoneyScale,
    })),
    default: 3,
  })

  // Output directory - clean and recreate with subdirectories
  const outputDir = resolve(import.meta.dir, '..', 'output')
  if (existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true })
  }
  mkdirSync(outputDir, { recursive: true })
  mkdirSync(`${outputDir}/bank-statements`, { recursive: true })
  mkdirSync(`${outputDir}/credit-cards`, { recursive: true })
  mkdirSync(`${outputDir}/insurance`, { recursive: true })
  mkdirSync(`${outputDir}/loans`, { recursive: true })
  mkdirSync(`${outputDir}/investments`, { recursive: true })

  console.log('\n')
  console.log('━'.repeat(50))
  console.log('Generating documents...')
  console.log('━'.repeat(50))

  // Initialize context
  const ctx: GenerationContext = {
    config: {
      country,
      startDate,
      endDate,
      bankAccountCount,
      creditCardCount,
      scale,
      outputDir,
    },
    holder: generateAccountHolder(country),
    bankAccounts: [],
    creditCards: [],
    insurancePolicies: [],
    loans: [],
    subscriptions: [],
    bankTransactions: new Map(),
    ccTransactions: new Map(),
    ccPayments: new Map(),
  }

  console.log(`\nAccount Holder: ${ctx.holder.name}`)
  console.log(`Email: ${ctx.holder.email}`)
  console.log(`Phone: ${ctx.holder.phone}\n`)

  // Step 1: Generate bank accounts
  console.log('Creating bank accounts...')
  ctx.bankAccounts = generateBankAccounts(ctx)
  console.log(`  Banks: ${ctx.bankAccounts.map(a => a.institution.name).join(', ')}`)

  // Step 2: Generate credit cards (linked to bank accounts)
  console.log('Creating credit cards...')
  ctx.creditCards = generateCreditCards(ctx)
  console.log(`  Cards: ${ctx.creditCards.map(c => `${c.institution.name} ${c.cardVariant}`).join(', ')}`)

  // Step 3: Generate insurance policies
  console.log('Creating insurance policies...')
  ctx.insurancePolicies = generateInsurancePolicies(ctx)
  console.log(`  Policies: ${ctx.insurancePolicies.map(p => p.type.replace('_', ' ')).join(', ')}`)

  // Step 4: Generate loans
  console.log('Creating loans...')
  ctx.loans = generateLoans(ctx)
  if (ctx.loans.length > 0) {
    console.log(`  Loans: ${ctx.loans.map(l => l.type).join(', ')}`)
  } else {
    console.log('  No loans (based on scale)')
  }

  // Step 5: Generate investment data
  console.log('Creating investment portfolio...')
  generateInvestmentData(ctx)
  const investments: string[] = []
  if (ctx.epfAccount) investments.push('EPF')
  if (ctx.account401k) investments.push('401k')
  if (ctx.stockHoldings?.length) investments.push('Stocks')
  if (ctx.mfHoldings?.length) investments.push('Mutual Funds')
  if (ctx.fixedDeposits?.length) investments.push('FD')
  if (ctx.ppfAccount) investments.push('PPF')
  console.log(`  Investments: ${investments.join(', ')}`)

  console.log('\n')
  console.log('━'.repeat(50))
  console.log('Generating PDF and XLSX files...')
  console.log('━'.repeat(50))
  console.log('')

  const allDocuments: GeneratedDocument[] = []

  // Generate insurance documents first (premiums affect bank statements)
  console.log('Generating insurance policy documents...')
  const insuranceDocs = await generateInsuranceDocuments(ctx, `${outputDir}/insurance`)
  for (const doc of insuranceDocs) {
    console.log(`  ✓ ${doc.filename}`)
  }
  allDocuments.push(...insuranceDocs)

  // Generate loan documents (EMIs affect bank statements)
  if (ctx.loans.length > 0) {
    console.log('\nGenerating loan documents...')
    const loanDocs = await generateLoanDocuments(ctx, `${outputDir}/loans`)
    for (const doc of loanDocs) {
      console.log(`  ✓ ${doc.filename}`)
    }
    allDocuments.push(...loanDocs)
  }

  // Generate credit card documents (CC payments affect bank statements)
  console.log('\nGenerating credit card statements...')
  const ccDocs = await generateCreditCardDocuments(ctx, `${outputDir}/credit-cards`)
  console.log(`  ✓ ${ccDocs.length} PDF files`)
  allDocuments.push(...ccDocs)

  // Generate bank statements (includes all linked transactions)
  console.log('\nGenerating bank statements...')
  const bankDocs = await generateBankStatementDocuments(ctx, `${outputDir}/bank-statements`)
  for (const doc of bankDocs) {
    console.log(`  ✓ ${doc.filename}`)
  }
  allDocuments.push(...bankDocs)

  // Generate investment documents
  console.log('\nGenerating investment statements...')
  const investmentDocs = await generateInvestmentDocuments(ctx, `${outputDir}/investments`)
  for (const doc of investmentDocs) {
    console.log(`  ✓ ${doc.filename}`)
  }
  allDocuments.push(...investmentDocs)

  // Summary
  console.log('\n')
  console.log('━'.repeat(50))
  console.log(`Done! ${allDocuments.length} files generated in output/`)
  console.log('━'.repeat(50))

  // Breakdown by type
  const byType = allDocuments.reduce((acc, doc) => {
    const key = doc.type
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log('\nSummary by document type:')
  for (const [type, count] of Object.entries(byType)) {
    console.log(`  ${type.replace('_', ' ')}: ${count} files`)
  }

  const byFormat = allDocuments.reduce((acc, doc) => {
    acc[doc.format] = (acc[doc.format] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log('\nSummary by format:')
  for (const [format, count] of Object.entries(byFormat)) {
    console.log(`  ${format.toUpperCase()}: ${count} files`)
  }

  console.log(`\nFiles saved to: ${outputDir}`)
}

// Run
main().catch(console.error)
