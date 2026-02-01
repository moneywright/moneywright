/**
 * LLM-based parser configuration generator
 * Analyzes spreadsheet metadata and generates parsing configuration
 */

import { generateObject } from 'ai'
import { z } from 'zod/v4'
import { createLLMClientFromSettings } from '../../llm'
import type { FileMetadata, ParserConfig } from './types'
import { logger } from '../logger'

/**
 * Schema for parser configuration from LLM
 */
const parserConfigSchema = z.object({
  dateColumn: z
    .union([z.string(), z.number()])
    .describe('Column name or index (0-based) containing transaction dates'),
  amountColumn: z
    .union([z.string(), z.number()])
    .nullable()
    .describe('Column for single amount (null if split columns)'),
  creditColumn: z
    .union([z.string(), z.number()])
    .nullable()
    .describe('Column for credit amounts (deposits)'),
  debitColumn: z
    .union([z.string(), z.number()])
    .nullable()
    .describe('Column for debit amounts (withdrawals)'),
  descriptionColumn: z
    .union([z.string(), z.number()])
    .describe('Column containing transaction description/narration'),
  typeColumn: z
    .union([z.string(), z.number()])
    .nullable()
    .describe('Column indicating transaction type (if exists)'),
  balanceColumn: z
    .union([z.string(), z.number()])
    .nullable()
    .describe('Column for running balance (if exists)'),
  headerRow: z.number().describe('Row number (0-based) containing column headers'),
  dataStartRow: z.number().describe('Row number (0-based) where transaction data starts'),
  dateFormat: z
    .string()
    .describe('Date format string (e.g., "DD-MM-YYYY", "YYYY-MM-DD", "DD/MM/YY")'),
  amountFormat: z
    .enum(['single', 'split'])
    .describe('Whether amounts are in single column or split credit/debit'),
  typeDetection: z
    .enum(['column', 'sign', 'split'])
    .describe('How to detect credit/debit: column value, amount sign, or split columns'),
})

/**
 * Generate parser configuration from file metadata
 */
export async function generateParserConfig(
  metadata: FileMetadata,
  sampleRows: (string | number | null | boolean)[][],
  headers: string[],
  modelOverride?: string
): Promise<ParserConfig> {
  logger.debug(`[ParserGen] Generating parser config for ${metadata.fileName}`)

  const { model, providerOptions } = await createLLMClientFromSettings(modelOverride)

  // Get the first sheet's metadata
  const sheetName = Object.keys(metadata.sheets)[0]

  if (!sheetName) {
    throw new Error('No sheets found in metadata')
  }

  const sheetMeta = metadata.sheets[sheetName]

  if (!sheetMeta) {
    throw new Error('No sheet metadata found')
  }

  // Build column summary for LLM
  const columnSummary = sheetMeta.columns
    .map(
      (col: {
        index: number
        name: string
        dataType: string
        stats: {
          nullCount: number
          count: number
          min?: number | string | null
          max?: number | string | null
          format?: string | null
          sampleValues?: string[]
        }
      }) => {
        let statsSummary = ''
        if (col.dataType === 'number') {
          const stats = col.stats as { min: number | null; max: number | null }
          statsSummary = `min=${stats.min}, max=${stats.max}`
        } else if (col.dataType === 'datestring') {
          const stats = col.stats as {
            min: string | null
            max: string | null
            format: string | null
          }
          statsSummary = `range=${stats.min} to ${stats.max}, format=${stats.format}`
        } else if (col.dataType === 'string') {
          const stats = col.stats as { sampleValues: string[] }
          statsSummary = `samples=${stats.sampleValues.slice(0, 3).join(', ')}`
        }

        return `  ${col.index}: "${col.name}" (${col.dataType}) - ${statsSummary}, nulls=${col.stats.nullCount}/${col.stats.count}`
      }
    )
    .join('\n')

  // Format sample rows for LLM
  const sampleRowsFormatted = sampleRows
    .slice(0, 5)
    .map((row, i) => {
      return `  Row ${i}: ${row.map((v) => (v === null ? 'null' : `"${v}"`)).join(', ')}`
    })
    .join('\n')

  const prompt = `Analyze this bank/credit card statement spreadsheet and generate a parser configuration.

FILE: ${metadata.fileName} (${metadata.fileType})
ROWS: ${sheetMeta.rowCount}

COLUMNS:
${columnSummary}

HEADERS: ${headers.map((h, i) => `${i}:"${h}"`).join(', ')}

SAMPLE DATA ROWS:
${sampleRowsFormatted}

INSTRUCTIONS:
1. Identify the date column (look for date patterns, column names like "Date", "Transaction Date", "Txn Date")
2. Identify amount column(s):
   - If single column with positive/negative values: use amountColumn, set amountFormat="single", typeDetection="sign"
   - If separate Credit/Debit columns: use creditColumn+debitColumn, set amountColumn=null, amountFormat="split", typeDetection="split"
   - If amount column + type indicator column: use amountColumn+typeColumn, amountFormat="single", typeDetection="column"
3. Identify description column (narration, particulars, description, remarks)
4. Identify balance column if present
5. headerRow should be where column names are (usually 0)
6. dataStartRow should be where actual transaction data begins (usually 1, after headers)
7. dateFormat should match the detected format in the date column

Common patterns:
- Indian bank statements often have: Date, Narration/Description, Chq No, Debit, Credit, Balance
- Credit card statements often have: Date, Description, Amount (negative=charge, positive=payment)
- Some have: Date, Description, Withdrawal, Deposit, Balance`

  try {
    const { object } = await generateObject({
      model,
      schema: parserConfigSchema,
      prompt,
      providerOptions,
    })

    logger.debug(
      `[ParserGen] Generated config: dateCol=${object.dateColumn}, amountFormat=${object.amountFormat}`
    )
    logger.debug(`[ParserGen] Full config:`, JSON.stringify(object, null, 2))

    return {
      dateColumn: object.dateColumn,
      amountColumn: object.amountColumn ?? undefined,
      descriptionColumn: object.descriptionColumn,
      typeColumn: object.typeColumn ?? undefined,
      balanceColumn: object.balanceColumn ?? undefined,
      creditColumn: object.creditColumn ?? undefined,
      debitColumn: object.debitColumn ?? undefined,
      headerRow: object.headerRow,
      dataStartRow: object.dataStartRow,
      dateFormat: object.dateFormat,
      amountFormat: object.amountFormat,
      typeDetection: object.typeDetection,
    }
  } catch (error) {
    logger.error(`[ParserGen] Failed to generate parser config:`, error)
    throw new Error(
      `Failed to generate parser configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
