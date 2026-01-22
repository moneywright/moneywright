/**
 * Core interfaces for spreadsheet metadata extraction
 */

export interface FileMetadata {
  fileName: string
  fileType: 'xlsx' | 'xls' | 'csv'
  fileSize: number
  sheetsNumber: number
  sheets: {
    [sheetName: string]: SheetMetadata
  }
}

export interface SheetMetadata {
  columns: Column[]
  rowCount: number
  emptyColumnNameCount: number
}

export interface Column {
  name: string
  index: number
  dataType: 'string' | 'number' | 'datestring'
  stats: ColumnStats
}

export interface ColumnStats {
  count: number
  nullCount: number
  uniqueCount: number
}

export interface NumberColumnStats extends ColumnStats {
  min: number | null
  max: number | null
}

export interface StringColumnStats extends ColumnStats {
  sampleValues: string[]
}

export interface DateColumnStats extends ColumnStats {
  min: string | null
  max: string | null
  format: string | null
}

export type NumberColumn = Column & { dataType: 'number'; stats: NumberColumnStats }
export type StringColumn = Column & { dataType: 'string'; stats: StringColumnStats }
export type DateColumn = Column & { dataType: 'datestring'; stats: DateColumnStats }

/**
 * Sheet data for processing
 */
export interface SheetData {
  headers: string[]
  data: (string | number | null | boolean)[][]
  totalRows: number
}

/**
 * Raw transaction extracted from spreadsheet
 */
export interface RawTransaction {
  id: string
  date: string
  amount: number
  type: 'credit' | 'debit'
  description: string
  balance?: number | null
}

/**
 * Categorized transaction from LLM
 */
export interface CategorizedTransaction {
  id: string
  category: string
  confidence: number
  summary: string
}

/**
 * Generated parser configuration
 */
export interface ParserConfig {
  dateColumn: string | number
  amountColumn?: string | number // optional when using split columns
  descriptionColumn: string | number
  typeColumn?: string | number
  balanceColumn?: string | number
  creditColumn?: string | number
  debitColumn?: string | number
  headerRow: number
  dataStartRow: number
  dateFormat: string
  amountFormat: 'single' | 'split' // single column or split credit/debit
  typeDetection: 'column' | 'sign' | 'split' // how to detect credit/debit
}
