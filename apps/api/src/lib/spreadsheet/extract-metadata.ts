/**
 * Metadata extraction for Excel and CSV files
 * Analyzes file structure, column types, and statistics
 */

import { format } from 'date-fns'
import * as XLSX from 'xlsx'
import type {
  Column,
  ColumnStats,
  DateColumnStats,
  FileMetadata,
  NumberColumnStats,
  SheetMetadata,
  StringColumnStats,
  SheetData,
} from './types'

/**
 * Extract metadata from a file buffer
 */
export function extractMetadata(buffer: Buffer, fileName: string): FileMetadata {
  const extension = fileName.split('.').pop()?.toLowerCase()
  const workbook = XLSX.read(buffer, { type: 'buffer' })

  const fileType = extension === 'csv' ? 'csv' : extension === 'xls' ? 'xls' : 'xlsx'

  const metadata: FileMetadata = {
    fileName,
    fileType,
    fileSize: buffer.length,
    sheetsNumber: workbook.SheetNames.length,
    sheets: {},
  }

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName]
    if (worksheet) {
      metadata.sheets[sheetName] = processSheet(worksheet)
    }
  }

  return metadata
}

/**
 * Extract sheet data for processing
 */
export function extractSheetData(buffer: Buffer, sheetName?: string): SheetData {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const targetSheet = sheetName || workbook.SheetNames[0]
  const worksheet = workbook.Sheets[targetSheet]

  if (!worksheet) {
    throw new Error(`Sheet "${targetSheet}" not found`)
  }

  const data = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: null,
    blankrows: false,
    raw: false,
  })

  if (!data || data.length === 0) {
    return { headers: [], data: [], totalRows: 0 }
  }

  const headers = (data[0] as unknown[]).map((h, i) =>
    h === null || h === undefined || h === '' ? `Column ${i + 1}` : String(h)
  )

  const rows = data.slice(1) as (string | number | null | boolean)[][]

  return {
    headers,
    data: rows,
    totalRows: rows.length,
  }
}

/**
 * Process a worksheet to extract sheet metadata
 */
function processSheet(worksheet: XLSX.WorkSheet): SheetMetadata {
  const data = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: null,
    blankrows: true,
    raw: false,
  })

  if (!data || data.length === 0) {
    return { columns: [], rowCount: 0, emptyColumnNameCount: 0 }
  }

  const headers = data[0] as unknown[]
  const dataRows = data.slice(1) as unknown[][]

  let emptyColumnNameCount = 0
  const columns: Column[] = []

  for (let colIndex = 0; colIndex < headers.length; colIndex++) {
    let columnName = headers[colIndex] as string

    if (columnName === null || columnName === undefined || columnName === '') {
      columnName = `Column ${colIndex + 1}`
      emptyColumnNameCount++
    }

    const columnValues = dataRows.map((row) => row[colIndex])
    const { dataType, stats } = analyzeColumn(columnValues)

    columns.push({
      name: columnName.toString(),
      index: colIndex,
      dataType,
      stats,
    })
  }

  return {
    columns,
    rowCount: data.length - 1,
    emptyColumnNameCount,
  }
}

/**
 * Analyze a column to determine its data type and statistics
 */
function analyzeColumn(values: unknown[]): {
  dataType: 'string' | 'number' | 'datestring'
  stats: ColumnStats
} {
  const nonNullValues = values.filter((v) => v !== null && v !== undefined)
  const nullCount = values.length - nonNullValues.length
  const uniqueValues = new Set(
    nonNullValues.map((v) => (typeof v === 'object' ? JSON.stringify(v) : v))
  )

  const dataType = detectDataType(nonNullValues)

  const baseStats: ColumnStats = {
    count: values.length,
    nullCount,
    uniqueCount: uniqueValues.size,
  }

  switch (dataType) {
    case 'number':
      return { dataType, stats: calculateNumberStats(nonNullValues, baseStats) }
    case 'datestring':
      return { dataType, stats: calculateDateStats(nonNullValues, baseStats) }
    default:
      return { dataType: 'string', stats: calculateStringStats(nonNullValues, baseStats) }
  }
}

/**
 * Detect the most likely data type for a column
 */
function detectDataType(values: unknown[]): 'string' | 'number' | 'datestring' {
  if (values.length === 0) return 'string'

  const sampleSize = Math.min(values.length, 100)
  const sample =
    values.length <= 100 ? Array.from(new Set(values)) : reservoirSample(values, sampleSize)

  let numberCount = 0
  let dateCount = 0

  for (const value of sample) {
    const dateResult = isDate(value)
    if (dateResult && typeof dateResult !== 'boolean' && dateResult.isDate) {
      dateCount++
    } else if (isNumber(value)) {
      numberCount++
    }
  }

  const numberPercentage = numberCount / sample.length
  const datePercentage = dateCount / sample.length

  if (datePercentage >= 0.9) return 'datestring'
  if (numberPercentage >= 0.9) return 'number'
  return 'string'
}

function reservoirSample<T>(arr: T[], k: number): T[] {
  const reservoir: T[] = arr.slice(0, k)
  for (let i = k; i < arr.length; i++) {
    const j = Math.floor(Math.random() * (i + 1))
    if (j < k) reservoir[j] = arr[i]
  }
  return Array.from(new Set(reservoir)) as T[]
}

function isNumber(value: unknown): boolean {
  if (typeof value === 'number') return !isNaN(value)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return false
    // Handle currency and negative formats
    const cleaned = trimmed.replace(/[,$₹€£\s()]/g, '').replace(/^-/, '')
    if (/^\d+(\.\d+)?$/.test(cleaned)) {
      return !isNaN(parseFloat(cleaned))
    }
  }
  return false
}

function isDate(value: unknown): boolean | { isDate: boolean; format: string } {
  if (value instanceof Date) return { isDate: !isNaN(value.getTime()), format: 'ISO' }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return false

    // Skip time-only formats
    if (/^\d{1,2}:\d{2}(?::\d{2})?\s?(?:[AP]M)?$/i.test(trimmed)) return false

    const datePatterns = [
      { pattern: /^\d{4}-\d{2}-\d{2}$/, format: 'YYYY-MM-DD' },
      { pattern: /^\d{1,2}\/\d{1,2}\/\d{4}$/, format: 'MM/DD/YYYY' },
      { pattern: /^\d{1,2}\/\d{1,2}\/\d{2}$/, format: 'MM/DD/YY' },
      { pattern: /^\d{1,2}\.\d{1,2}\.\d{4}$/, format: 'DD.MM.YYYY' },
      { pattern: /^\d{1,2}-\d{1,2}-\d{4}$/, format: 'DD-MM-YYYY' },
      { pattern: /^\d{1,2}\s[A-Za-z]{3}\s\d{4}$/, format: 'DD MMM YYYY' },
      { pattern: /^\d{1,2}\s[A-Za-z]{3}\s\d{2}$/, format: 'DD MMM YY' },
      { pattern: /^[A-Za-z]{3}\s\d{1,2},?\s\d{4}$/, format: 'MMM DD, YYYY' },
      { pattern: /^\d{1,2}-[A-Za-z]{3}-\d{4}$/, format: 'DD-MMM-YYYY' },
      { pattern: /^\d{1,2}-[A-Za-z]{3}-\d{2}$/, format: 'DD-MMM-YY' },
    ]

    for (const { pattern, format } of datePatterns) {
      if (pattern.test(trimmed)) {
        const date = new Date(trimmed)
        if (!isNaN(date.getTime())) {
          return { isDate: true, format }
        }
      }
    }
  }

  return false
}

function calculateStringStats(values: unknown[], baseStats: ColumnStats): StringColumnStats {
  const validStrings = values
    .filter((v) => v !== null && v !== undefined)
    .map(String)
    .filter((s) => s.trim() !== '')
  const sampleValues =
    validStrings.length <= 5 ? Array.from(new Set(validStrings)) : reservoirSample(validStrings, 5)

  return { ...baseStats, sampleValues }
}

function calculateNumberStats(values: unknown[], baseStats: ColumnStats): NumberColumnStats {
  const numbers: number[] = []

  for (const value of values) {
    if (isNumber(value)) {
      const num =
        typeof value === 'number' ? value : parseFloat(String(value).replace(/[,$₹€£\s()]/g, ''))
      if (!isNaN(num) && isFinite(num)) numbers.push(num)
    }
  }

  let min: number | null = null
  let max: number | null = null

  if (numbers.length > 0) {
    min = Math.min(...numbers)
    max = Math.max(...numbers)
  }

  return { ...baseStats, min, max }
}

function calculateDateStats(values: unknown[], baseStats: ColumnStats): DateColumnStats {
  const dates: Date[] = []
  const formatCounts: Record<string, number> = {}

  for (const value of values) {
    const result = isDate(value)
    if (result && typeof result !== 'boolean' && result.isDate) {
      const date = new Date(String(value))
      if (!isNaN(date.getTime())) {
        dates.push(date)
        formatCounts[result.format] = (formatCounts[result.format] || 0) + 1
      }
    }
  }

  let min: string | null = null
  let max: string | null = null
  let dominantFormat: string | null = null

  if (dates.length > 0) {
    const timestamps = dates.map((d) => d.getTime())
    const minDate = new Date(Math.min(...timestamps))
    const maxDate = new Date(Math.max(...timestamps))

    dominantFormat = Object.entries(formatCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null

    min = format(minDate, 'yyyy-MM-dd')
    max = format(maxDate, 'yyyy-MM-dd')
  }

  return { ...baseStats, min, max, format: dominantFormat }
}
