import type { MutualFundHolding, GenerationContext, GeneratedDocument } from '../../types'
import { MUTUAL_FUNDS_IN, MUTUAL_FUNDS_US } from '../../config/templates'
import { MF_RTA_IN, BROKERS_US } from '../../config/institutions'
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
import { generateId, randomBetween, randomPick, randomPickMultiple, randomDecimal, formatCurrency, getSalaryRange } from '../../lib/utils'

// Fund type for both countries
type FundInfo = { name: string; nav: number }

// Generate mutual fund holdings
export function generateMFHoldings(ctx: GenerationContext): MutualFundHolding[] {
  const { country, scale } = ctx.config
  const fundsRaw = country === 'IN' ? MUTUAL_FUNDS_IN : MUTUAL_FUNDS_US
  const funds: FundInfo[] = fundsRaw.map(f => ({ name: f.name, nav: f.nav }))
  const salaryRange = getSalaryRange(country, scale)

  // Number of funds based on scale
  const fundCount = Math.min(scale + 1, funds.length)
  const selectedFunds = randomPickMultiple(funds, fundCount)

  const holdings: MutualFundHolding[] = []

  for (const fund of selectedFunds) {
    // Monthly SIP amount based on scale
    const sipAmount = Math.round((salaryRange.min * 0.1) / fundCount)
    const monthsInvested = randomBetween(12, 36)
    const investedAmount = sipAmount * monthsInvested

    // Calculate units based on average NAV
    const avgNav = fund.nav * randomDecimal(0.85, 0.95)
    const units = Math.round((investedAmount / avgNav) * 1000) / 1000

    // Current value with some gain
    const currentNav = fund.nav * randomDecimal(0.95, 1.15)
    const value = Math.round(units * currentNav * 100) / 100
    const gainLoss = Math.round((value - investedAmount) * 100) / 100

    // XIRR (annualized return)
    const xirr = randomDecimal(8, 18)

    holdings.push({
      folioNumber: generateId('FOLIO'),
      schemeName: fund.name,
      schemeCode: generateId('SCH'),
      units,
      nav: currentNav,
      value,
      investedAmount,
      gainLoss,
      xirr,
    })
  }

  return holdings
}

// Generate MF CAS (Consolidated Account Statement) PDF
export async function generateMutualFundsPDF(
  holdings: MutualFundHolding[],
  ctx: GenerationContext,
  outputDir: string
): Promise<GeneratedDocument> {
  const { country, endDate } = ctx.config
  const doc = createPDF()

  const rta = country === 'IN' ? randomPick(MF_RTA_IN) : randomPick(BROKERS_US)
  const title = country === 'IN' ? 'Consolidated Account Statement (CAS)' : 'Mutual Fund Holdings Statement'

  // Header
  addHeader(doc, rta.name, title)

  // Investor details
  addSectionHeading(doc, 'Investor Details')
  addKeyValue(doc, 'Name', ctx.holder.name)
  addKeyValue(doc, 'Email', ctx.holder.email)
  addKeyValue(doc, 'Mobile', ctx.holder.phone)
  if (country === 'IN' && ctx.holder.pan) {
    addKeyValue(doc, 'PAN', ctx.holder.pan)
  }
  addKeyValue(doc, 'Statement Date', formatDocDate(endDate))
  doc.moveDown(1)

  // Portfolio summary
  const totalInvested = holdings.reduce((sum, h) => sum + h.investedAmount, 0)
  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0)
  const totalGainLoss = totalValue - totalInvested

  addSectionHeading(doc, 'Portfolio Summary')
  addKeyValue(doc, 'Total Investment', formatCurrency(totalInvested, country))
  addKeyValue(doc, 'Current Value', formatCurrency(totalValue, country))
  addKeyValue(doc, 'Total Gain/Loss', formatCurrency(totalGainLoss, country))
  addKeyValue(doc, 'Number of Schemes', String(holdings.length))
  doc.moveDown(1)

  // Holdings table
  addSectionHeading(doc, 'Scheme-wise Holdings')
  const headers = ['Folio', 'Scheme', 'Units', 'NAV', 'Value', 'XIRR']
  const rows = holdings.map((h) => [
    h.folioNumber,
    h.schemeName.length > 25 ? h.schemeName.slice(0, 25) + '...' : h.schemeName,
    h.units.toFixed(3),
    formatCurrency(h.nav, country),
    formatCurrency(h.value, country),
    `${h.xirr?.toFixed(2)}%`,
  ])
  addTable(doc, headers, rows, [70, 150, 50, 60, 70, 50])

  // Disclaimer
  doc.moveDown(2)
  doc.fontSize(8).font('Helvetica').text(
    'This statement is computer generated and does not require signature. The NAV shown is as of the statement date. Past performance does not guarantee future results.',
    { align: 'center' }
  )

  // Footer
  addFooter(doc, `${rta.name} | Statement as of ${formatDocDate(endDate)}`)

  // Save
  const filename = `${rta.id}-mutual-funds-cas-${endDate.getFullYear()}.pdf`
  const filepath = `${outputDir}/${filename}`

  await savePDF(doc, filepath)

  return {
    type: 'investment',
    subtype: 'mutual_funds',
    filename,
    format: 'pdf',
    path: filepath,
  }
}
