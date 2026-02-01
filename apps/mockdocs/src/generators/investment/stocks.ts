import type { StockHolding, GenerationContext, GeneratedDocument } from '../../types'
import { STOCKS_IN, STOCKS_US } from '../../config/templates'
import { BROKERS_IN, BROKERS_US } from '../../config/institutions'
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
import { format } from 'date-fns'

// Generate stock holdings based on scale
export function generateStockHoldings(ctx: GenerationContext): StockHolding[] {
  const { country, scale } = ctx.config
  const stocks = country === 'IN' ? STOCKS_IN : STOCKS_US
  const salaryRange = getSalaryRange(country, scale)

  // Number of stocks based on scale
  const stockCount = Math.min(scale + 2, stocks.length)
  const selectedStocks = randomPickMultiple(stocks, stockCount)

  const holdings: StockHolding[] = []

  for (const stock of selectedStocks) {
    // Investment amount based on scale
    const investmentAmount = Math.round(salaryRange.min * randomDecimal(0.5, 2) * (scale / 3))

    // Calculate quantity based on average price
    const avgPriceVariance = stock.price * randomDecimal(-0.15, 0.1)
    const avgPrice = Math.round((stock.price + avgPriceVariance) * 100) / 100
    const quantity = Math.max(1, Math.floor(investmentAmount / avgPrice))

    // Current price with some gain/loss
    const priceChange = stock.price * randomDecimal(-0.1, 0.25)
    const currentPrice = Math.round((stock.price + priceChange) * 100) / 100

    const value = Math.round(quantity * currentPrice * 100) / 100
    const investedValue = Math.round(quantity * avgPrice * 100) / 100
    const gainLoss = Math.round((value - investedValue) * 100) / 100
    const gainLossPercent = Math.round((gainLoss / investedValue) * 10000) / 100

    holdings.push({
      symbol: stock.symbol,
      name: stock.name,
      quantity,
      avgPrice,
      currentPrice,
      value,
      gainLoss,
      gainLossPercent,
    })
  }

  return holdings
}

// Generate stocks holdings PDF
export async function generateStocksPDF(
  holdings: StockHolding[],
  ctx: GenerationContext,
  outputDir: string
): Promise<GeneratedDocument> {
  const { country, startDate, endDate } = ctx.config
  const doc = createPDF()
  const brokers = country === 'IN' ? BROKERS_IN : BROKERS_US
  const broker = randomPick(brokers)

  // Header
  addHeader(doc, broker.name, 'Demat Account Holdings Statement')

  // Account details
  addSectionHeading(doc, 'Account Details')
  addKeyValue(doc, 'Account Holder', ctx.holder.name)
  addKeyValue(doc, 'Demat Account', generateId('DP'))
  addKeyValue(doc, 'Client ID', generateId(''))
  addKeyValue(doc, 'Statement Date', formatDocDate(endDate))
  if (country === 'IN' && ctx.holder.pan) {
    addKeyValue(doc, 'PAN', ctx.holder.pan)
  }
  doc.moveDown(1)

  // Holdings summary
  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0)
  const totalInvested = holdings.reduce((sum, h) => sum + h.quantity * h.avgPrice, 0)
  const totalGainLoss = totalValue - totalInvested
  const totalGainLossPercent = (totalGainLoss / totalInvested) * 100

  addSectionHeading(doc, 'Portfolio Summary')
  addKeyValue(doc, 'Total Investment', formatCurrency(totalInvested, country))
  addKeyValue(doc, 'Current Value', formatCurrency(totalValue, country))
  addKeyValue(doc, 'Total Gain/Loss', `${formatCurrency(totalGainLoss, country)} (${totalGainLossPercent.toFixed(2)}%)`)
  addKeyValue(doc, 'Number of Stocks', String(holdings.length))
  doc.moveDown(1)

  // Holdings table
  addSectionHeading(doc, 'Stock Holdings')
  const headers = ['Symbol', 'Name', 'Qty', 'Avg Price', 'CMP', 'Value', 'P&L %']
  const rows = holdings.map((h) => [
    h.symbol,
    h.name.length > 20 ? h.name.slice(0, 20) + '...' : h.name,
    String(h.quantity),
    formatCurrency(h.avgPrice, country),
    formatCurrency(h.currentPrice, country),
    formatCurrency(h.value, country),
    `${h.gainLossPercent >= 0 ? '+' : ''}${h.gainLossPercent.toFixed(2)}%`,
  ])
  addTable(doc, headers, rows, [50, 120, 40, 65, 65, 70, 60])

  // Footer
  addFooter(doc, `${broker.name} | Generated on ${formatDocDate(new Date())}`)

  // Save
  const filename = `${broker.id}-stocks-holdings-${endDate.getFullYear()}.pdf`
  const filepath = `${outputDir}/${filename}`

  await savePDF(doc, filepath)

  return {
    type: 'investment',
    subtype: 'stocks',
    filename,
    format: 'pdf',
    path: filepath,
  }
}
