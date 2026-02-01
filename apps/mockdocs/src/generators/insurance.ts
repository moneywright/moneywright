import { addYears } from 'date-fns'
import type { InsurancePolicy, InsuranceType, GenerationContext, GeneratedDocument } from '../types'
import { getInsuranceProviders, getRandomInstitutions } from '../config/institutions'
import { INSURANCE_TERMS, INSURANCE_TERMS_US } from '../config/templates'
import {
  createPDF,
  savePDF,
  addHeader,
  addSectionHeading,
  addKeyValue,
  addTermsSection,
  addFooter,
  addSignatureBlock,
  formatDocDate,
} from '../lib/pdf'
import { generateId, randomBetween, randomPick, formatCurrency, getSalaryRange, shouldInclude } from '../lib/utils'

// Get insurance types based on scale
function getInsuranceTypes(scale: number, country: string): InsuranceType[] {
  const types: InsuranceType[] = []

  // Term life - scale 2+
  if (scale >= 2) types.push('term_life')

  // Health - scale 1+ (basic at all scales)
  types.push('health')

  // Car - scale 3+ (assuming they have a car)
  if (scale >= 3) types.push('car')

  // Endowment - scale 4+ (investment-linked)
  if (scale >= 4 && country === 'IN') types.push('endowment')

  return types
}

// Calculate sum assured based on scale and type
function calculateSumAssured(type: InsuranceType, scale: number, country: string): number {
  const salaryRange = getSalaryRange(country as 'IN' | 'US', scale as 1 | 2 | 3 | 4 | 5)
  const annualSalary = salaryRange.min * 12

  switch (type) {
    case 'term_life':
      // 10-20x annual salary
      return Math.round((annualSalary * randomBetween(10, 20)) / 100000) * 100000
    case 'health':
      // 3-10 lakhs (IN) or 100k-500k (US)
      if (country === 'IN') {
        return randomPick([300000, 500000, 1000000, 1500000, 2000000].slice(0, scale + 1))
      }
      return randomPick([100000, 250000, 500000, 750000, 1000000].slice(0, scale + 1))
    case 'car':
      // IDV based on car value
      if (country === 'IN') {
        return randomPick([500000, 800000, 1200000, 1500000, 2500000].slice(scale - 2, scale + 1))
      }
      return randomPick([20000, 30000, 40000, 50000, 75000].slice(scale - 2, scale + 1))
    case 'endowment':
      // 5-10x annual salary
      return Math.round((annualSalary * randomBetween(5, 10)) / 100000) * 100000
    default:
      return 0
  }
}

// Calculate realistic premium based on type and country
function calculatePremium(type: InsuranceType, sumAssured: number, country: string, scale: number): number {
  // Realistic annual premiums (not percentage based)
  if (country === 'IN') {
    switch (type) {
      case 'term_life':
        // Term life: 8-25K per year for 50L-1Cr cover
        return randomBetween(8000, 15000) + (scale - 1) * 3000
      case 'health':
        // Health: 10-40K per year based on cover and scale
        return randomBetween(10000, 20000) + (scale - 1) * 5000
      case 'car':
        // Car: 8-25K per year based on IDV
        return randomBetween(8000, 15000) + (scale - 1) * 3000
      case 'endowment':
        // Endowment: 30-80K per year (scaled)
        return randomBetween(30000, 50000) + (scale - 1) * 10000
      default:
        return 10000
    }
  } else {
    // US premiums
    switch (type) {
      case 'term_life':
        return randomBetween(300, 600) + (scale - 1) * 100
      case 'health':
        return randomBetween(200, 400) * 12 // Monthly to yearly
      case 'car':
        return randomBetween(800, 1500) + (scale - 1) * 200
      case 'endowment':
        return randomBetween(2000, 4000) + (scale - 1) * 500
      default:
        return 500
    }
  }
}

// Generate insurance policy data
export function generateInsurancePolicies(ctx: GenerationContext): InsurancePolicy[] {
  const { country, scale, startDate } = ctx.config
  const types = getInsuranceTypes(scale, country)
  const providers = getRandomInstitutions(getInsuranceProviders(country), types.length)
  const policies: InsurancePolicy[] = []

  for (let i = 0; i < types.length; i++) {
    const type = types[i]
    const provider = providers[i] || providers[0]
    const sumAssured = calculateSumAssured(type, scale, country)
    const premium = calculatePremium(type, sumAssured, country, scale)

    const policy: InsurancePolicy = {
      id: generateId('POL'),
      type,
      provider,
      policyNumber: `${provider.id.toUpperCase()}${generateId('')}`,
      holder: ctx.holder,
      sumAssured,
      premium,
      premiumFrequency: type === 'endowment' ? randomPick(['yearly', 'quarterly']) : 'yearly',
      startDate: new Date(startDate.getFullYear(), randomBetween(0, 11), randomBetween(1, 28)),
      endDate: addYears(startDate, type === 'term_life' ? 20 : type === 'endowment' ? 15 : 1),
      nominees: type === 'term_life' || type === 'endowment' ? [randomPick(['Spouse', 'Father', 'Mother', 'Son', 'Daughter'])] : undefined,
    }

    policies.push(policy)
  }

  return policies
}

// Generate insurance policy PDF
export async function generateInsurancePDF(
  policy: InsurancePolicy,
  ctx: GenerationContext,
  outputDir: string
): Promise<GeneratedDocument> {
  const { country } = ctx.config
  const doc = createPDF()

  const terms = country === 'IN' ? INSURANCE_TERMS : INSURANCE_TERMS_US
  const template = terms[policy.type as keyof typeof terms] || INSURANCE_TERMS[policy.type]

  // Header
  addHeader(doc, policy.provider.name, template.title)

  // Policy details
  addSectionHeading(doc, 'Policy Details')
  addKeyValue(doc, 'Policy Number', policy.policyNumber)
  addKeyValue(doc, 'Policy Start Date', formatDocDate(policy.startDate))
  addKeyValue(doc, 'Policy End Date', formatDocDate(policy.endDate))
  doc.moveDown(0.5)

  // Policyholder details
  addSectionHeading(doc, 'Policyholder Details')
  addKeyValue(doc, 'Name', policy.holder.name)
  addKeyValue(doc, 'Address', policy.holder.address)
  addKeyValue(doc, 'Phone', policy.holder.phone)
  addKeyValue(doc, 'Email', policy.holder.email)
  if (country === 'IN' && policy.holder.pan) {
    addKeyValue(doc, 'PAN', policy.holder.pan)
  }
  doc.moveDown(0.5)

  // Coverage details
  addSectionHeading(doc, 'Coverage Details')
  if (policy.type === 'car') {
    addKeyValue(doc, 'Insured Declared Value (IDV)', formatCurrency(policy.sumAssured, country))
  } else {
    addKeyValue(doc, 'Sum Assured', formatCurrency(policy.sumAssured, country))
  }
  addKeyValue(doc, 'Premium Amount', formatCurrency(policy.premium, country))
  addKeyValue(doc, 'Premium Frequency', policy.premiumFrequency.charAt(0).toUpperCase() + policy.premiumFrequency.slice(1))

  if (policy.nominees && policy.nominees.length > 0) {
    addKeyValue(doc, 'Nominee(s)', policy.nominees.join(', '))
  }
  doc.moveDown(1)

  // Terms and conditions
  doc.addPage()
  addSectionHeading(doc, 'Terms and Conditions')
  addTermsSection(doc, template.sections)

  // Signature block
  doc.addPage()
  addSectionHeading(doc, 'Declaration and Signature')
  doc.fontSize(9).font('Helvetica').text(
    `I, ${policy.holder.name}, hereby declare that all the information provided above is true and correct to the best of my knowledge. I have read and understood the terms and conditions of this policy.`,
    { align: 'justify' }
  )
  doc.moveDown(2)
  addSignatureBlock(doc, ['Policyholder Signature', 'Authorized Signatory', 'Date'])

  // Footer
  addFooter(doc, `${policy.provider.name} | Policy No: ${policy.policyNumber}`)

  // Save
  const typeLabel = policy.type.replace('_', '-')
  const filename = `${policy.provider.id}-${typeLabel}-policy-${policy.startDate.getFullYear()}.pdf`
  const filepath = `${outputDir}/${filename}`

  await savePDF(doc, filepath)

  return {
    type: 'insurance',
    subtype: policy.type,
    filename,
    format: 'pdf',
    path: filepath,
  }
}

// Generate all insurance documents
export async function generateInsuranceDocuments(
  ctx: GenerationContext,
  outputDir: string
): Promise<GeneratedDocument[]> {
  const documents: GeneratedDocument[] = []

  for (const policy of ctx.insurancePolicies) {
    const doc = await generateInsurancePDF(policy, ctx, outputDir)
    documents.push(doc)
  }

  return documents
}
