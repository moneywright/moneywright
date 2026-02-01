import type { GenerationContext, GeneratedDocument } from '../../types'
import { generateStocksPDF, generateStockHoldings } from './stocks'
import { generateMutualFundsPDF, generateMFHoldings } from './mutual-funds'
import { generateFDPDF, generateFixedDeposits } from './fixed-deposit'
import { generatePPFPDF, generatePPFAccount } from './ppf'
import { generateEPFPDF, generateEPFAccount } from './epf'
import { generate401kPDF, generate401kAccount } from './401k'

// Generate all investment data based on scale and country
export function generateInvestmentData(ctx: GenerationContext): void {
  const { country, scale } = ctx.config

  // EPF/401k for all scales (mandatory employer benefit)
  if (country === 'IN') {
    ctx.epfAccount = generateEPFAccount(ctx)
  } else {
    ctx.account401k = generate401kAccount(ctx)
  }

  // Stocks - scale 3+
  if (scale >= 3) {
    ctx.stockHoldings = generateStockHoldings(ctx)
  }

  // Mutual funds - scale 2+
  if (scale >= 2) {
    ctx.mfHoldings = generateMFHoldings(ctx)
  }

  // Fixed deposits - scale 2+
  if (scale >= 2) {
    ctx.fixedDeposits = generateFixedDeposits(ctx)
  }

  // PPF - scale 3+ (India only)
  if (country === 'IN' && scale >= 3) {
    ctx.ppfAccount = generatePPFAccount(ctx)
  }
}

// Generate all investment documents
export async function generateInvestmentDocuments(
  ctx: GenerationContext,
  outputDir: string
): Promise<GeneratedDocument[]> {
  const documents: GeneratedDocument[] = []
  const { country, scale } = ctx.config

  // EPF/401k statement (all scales)
  if (country === 'IN' && ctx.epfAccount) {
    documents.push(await generateEPFPDF(ctx.epfAccount, ctx, outputDir))
  } else if (country === 'US' && ctx.account401k) {
    documents.push(await generate401kPDF(ctx.account401k, ctx, outputDir))
  }

  // Stocks holdings
  if (ctx.stockHoldings && ctx.stockHoldings.length > 0) {
    documents.push(await generateStocksPDF(ctx.stockHoldings, ctx, outputDir))
  }

  // Mutual funds CAS
  if (ctx.mfHoldings && ctx.mfHoldings.length > 0) {
    documents.push(await generateMutualFundsPDF(ctx.mfHoldings, ctx, outputDir))
  }

  // Fixed deposits
  if (ctx.fixedDeposits && ctx.fixedDeposits.length > 0) {
    for (const fd of ctx.fixedDeposits) {
      documents.push(await generateFDPDF(fd, ctx, outputDir))
    }
  }

  // PPF statement (India only)
  if (country === 'IN' && ctx.ppfAccount) {
    documents.push(await generatePPFPDF(ctx.ppfAccount, ctx, outputDir))
  }

  return documents
}
