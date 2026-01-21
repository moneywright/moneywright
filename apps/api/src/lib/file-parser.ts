/**
 * File parsing utilities for PDF, CSV, and XLSX files
 */

import { PDFParse, PasswordException } from 'pdf-parse'
import * as XLSX from 'xlsx'
import XlsxPopulate from 'xlsx-populate'

/**
 * Extract text from a PDF file, page by page
 * @param buffer - PDF file buffer
 * @param password - Optional password for protected PDFs
 */
export async function extractPdfText(
  buffer: Buffer<ArrayBufferLike>,
  password?: string
): Promise<string[]> {
  const parser = new PDFParse({
    data: buffer,
    password: password,
  })

  try {
    // First get info to know total pages
    const info = await parser.getInfo()
    const totalPages = info.total || 1

    const pages: string[] = []

    // Extract text page by page
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        const result = await parser.getText({ partial: [pageNum] })
        if (result.text && result.text.trim().length > 0) {
          pages.push(result.text.trim())
        }
      } catch (pageError) {
        console.warn(`[PDF] Could not extract page ${pageNum}:`, pageError)
      }
    }

    return pages
  } catch (error) {
    // Check for password-related errors
    if (error instanceof PasswordException) {
      throw new Error('PASSWORD_REQUIRED')
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message.includes('password') || message.includes('encrypted')) {
      throw new Error('PASSWORD_REQUIRED')
    }
    throw new Error(`Failed to parse PDF: ${message}`)
  } finally {
    // Always destroy to free memory
    await parser.destroy()
  }
}

/**
 * Extract text from a CSV file
 */
export async function extractCsvText(buffer: Buffer<ArrayBufferLike>): Promise<string> {
  try {
    const text = buffer.toString('utf-8')
    return text
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to parse CSV: ${message}`)
  }
}

/**
 * Extract text from an XLSX file
 * Converts each sheet to CSV format for LLM processing
 * Returns an array with one CSV string per sheet
 * @param buffer - XLSX file buffer
 * @param password - Optional password for protected Excel files
 */
export async function extractXlsxText(
  buffer: Buffer<ArrayBufferLike>,
  password?: string
): Promise<string[]> {
  // If password is provided, use xlsx-populate which has proper encryption support
  if (password) {
    try {
      const workbook = await XlsxPopulate.fromDataAsync(buffer, { password })
      const sheets: string[] = []

      for (const sheet of workbook.sheets()) {
        const sheetName = sheet.name()
        const usedRange = sheet.usedRange()

        if (!usedRange) continue

        // Get all values as 2D array
        const values = usedRange.value() as unknown[][]
        if (!values || values.length === 0) continue

        // Convert to CSV format
        const csvRows = values.map((row) =>
          (row || [])
            .map((cell) => {
              if (cell === null || cell === undefined) return ''
              const str = String(cell)
              // Escape quotes and wrap in quotes if contains comma, quote, or newline
              if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`
              }
              return str
            })
            .join(',')
        )

        const csv = csvRows.join('\n')
        if (csv.trim()) {
          sheets.push(`=== SHEET: ${sheetName} ===\n${csv}`)
        }
      }

      if (sheets.length === 0) {
        throw new Error('No data found in XLSX file')
      }

      return sheets
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      // Check for password-related errors
      if (
        message.includes('password') ||
        message.includes('encrypted') ||
        message.includes('Password') ||
        message.includes('decrypt')
      ) {
        throw new Error('PASSWORD_REQUIRED')
      }
      throw new Error(`Failed to parse XLSX: ${message}`)
    }
  }

  // For non-password files, use the faster xlsx library
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheets: string[] = []

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      if (!sheet) continue

      // Convert sheet to CSV
      const csv = XLSX.utils.sheet_to_csv(sheet, {
        blankrows: false, // Skip empty rows
        strip: true, // Strip whitespace
      })

      if (csv.trim()) {
        // Add sheet name as header for context
        sheets.push(`=== SHEET: ${sheetName} ===\n${csv}`)
      }
    }

    if (sheets.length === 0) {
      throw new Error('No data found in XLSX file')
    }

    return sheets
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    // Check for password-related errors
    if (
      message.includes('password') ||
      message.includes('encrypted') ||
      message.includes('Password')
    ) {
      throw new Error('PASSWORD_REQUIRED')
    }
    throw new Error(`Failed to parse XLSX: ${message}`)
  }
}

/**
 * Convert spreadsheet data (CSV or XLSX) to a normalized CSV string
 * This is used to pass structured data to the LLM
 */
export function normalizeSpreadsheetToCsv(pages: string[]): string {
  // Join all pages/sheets with a separator
  return pages.join('\n\n')
}
