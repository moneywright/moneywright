/**
 * File parsing utilities for PDF, CSV, and XLSX files
 */

import { PDFParse, PasswordException } from 'pdf-parse'

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

    console.log(`[PDF] Document has ${totalPages} pages`)

    const pages: string[] = []

    // Extract text page by page
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        const result = await parser.getText({ partial: [pageNum] })
        if (result.text && result.text.trim().length > 0) {
          pages.push(result.text.trim())
          console.log(`[PDF] Page ${pageNum}: ${result.text.length} chars`)
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
 * TODO: Implement using xlsx or exceljs library
 */
export async function extractXlsxText(_buffer: Buffer<ArrayBufferLike>): Promise<string[]> {
  // TODO: Implement XLSX parsing
  throw new Error('XLSX parsing not yet implemented')
}
