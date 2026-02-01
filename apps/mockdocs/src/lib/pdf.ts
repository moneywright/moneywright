import PDFDocument from 'pdfkit'
import { createWriteStream } from 'fs'
import { format } from 'date-fns'
import type { CountryCode, Transaction } from '../types'
import { formatCurrency } from './utils'

// Create a new PDF document
export function createPDF(): PDFKit.PDFDocument {
  return new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    bufferPages: true, // Required for adding footers to all pages
  })
}

// Save PDF to file
export function savePDF(doc: PDFKit.PDFDocument, filepath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = createWriteStream(filepath)
    doc.pipe(stream)
    doc.end()
    stream.on('finish', resolve)
    stream.on('error', reject)
  })
}

// Add header with institution name and logo placeholder
export function addHeader(doc: PDFKit.PDFDocument, institutionName: string, title: string): void {
  doc.fontSize(18).font('Helvetica-Bold').text(institutionName, { align: 'center' })
  doc.moveDown(0.5)
  doc.fontSize(14).font('Helvetica').text(title, { align: 'center' })
  doc.moveDown(1)
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
  doc.moveDown(1)
}

// Add section heading
export function addSectionHeading(doc: PDFKit.PDFDocument, heading: string): void {
  doc.fontSize(12).font('Helvetica-Bold').text(heading)
  doc.moveDown(0.5)
}

// Add key-value pair
export function addKeyValue(doc: PDFKit.PDFDocument, key: string, value: string, indent: number = 0): void {
  const x = 50 + indent
  doc.fontSize(10).font('Helvetica-Bold').text(`${key}: `, x, doc.y, { continued: true })
  doc.font('Helvetica').text(value)
}

// Add a simple table
export function addTable(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: string[][],
  columnWidths: number[]
): void {
  const startX = 50
  const startY = doc.y
  const rowHeight = 20
  const pageHeight = doc.page.height - doc.page.margins.bottom

  // Draw header
  doc.fontSize(9).font('Helvetica-Bold')
  let x = startX
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], x, startY, { width: columnWidths[i], align: i === 0 ? 'left' : 'right' })
    x += columnWidths[i]
  }

  doc.moveTo(startX, startY + rowHeight - 5).lineTo(startX + columnWidths.reduce((a, b) => a + b, 0), startY + rowHeight - 5).stroke()

  // Draw rows
  doc.font('Helvetica').fontSize(8)
  let y = startY + rowHeight

  for (const row of rows) {
    // Check if we need a new page
    if (y + rowHeight > pageHeight) {
      doc.addPage()
      y = doc.page.margins.top

      // Redraw header on new page
      doc.fontSize(9).font('Helvetica-Bold')
      x = startX
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], x, y, { width: columnWidths[i], align: i === 0 ? 'left' : 'right' })
        x += columnWidths[i]
      }
      doc.moveTo(startX, y + rowHeight - 5).lineTo(startX + columnWidths.reduce((a, b) => a + b, 0), y + rowHeight - 5).stroke()
      y += rowHeight
      doc.font('Helvetica').fontSize(8)
    }

    x = startX
    for (let i = 0; i < row.length; i++) {
      doc.text(row[i], x, y, { width: columnWidths[i], align: i === 0 ? 'left' : 'right' })
      x += columnWidths[i]
    }
    y += rowHeight
  }

  doc.y = y + 10
}

// Add transaction table for bank/CC statements
export function addTransactionTable(
  doc: PDFKit.PDFDocument,
  transactions: Transaction[],
  country: CountryCode,
  showBalance: boolean = true
): void {
  const headers = showBalance
    ? ['Date', 'Description', 'Debit', 'Credit', 'Balance']
    : ['Date', 'Description', 'Amount']

  const columnWidths = showBalance ? [60, 200, 70, 70, 80] : [70, 300, 100]

  const rows = transactions.map((tx) => {
    const dateStr = format(tx.date, 'dd/MM/yyyy')
    const amount = formatCurrency(tx.amount, country)

    if (showBalance) {
      return [
        dateStr,
        tx.description,
        tx.type === 'debit' ? amount : '',
        tx.type === 'credit' ? amount : '',
        tx.balance ? formatCurrency(tx.balance, country) : '',
      ]
    }
    return [dateStr, tx.description, `${tx.type === 'debit' ? '-' : '+'}${amount}`]
  })

  addTable(doc, headers, rows, columnWidths)
}

// Add terms and conditions section
export function addTermsSection(
  doc: PDFKit.PDFDocument,
  sections: { heading: string; content: string }[]
): void {
  for (const section of sections) {
    // Check if we need a new page
    if (doc.y > doc.page.height - 150) {
      doc.addPage()
    }

    doc.fontSize(11).font('Helvetica-Bold').text(section.heading)
    doc.moveDown(0.3)
    doc.fontSize(9).font('Helvetica').text(section.content, { align: 'justify' })
    doc.moveDown(1)
  }
}

// Add footer with page numbers
export function addFooter(doc: PDFKit.PDFDocument, text: string): void {
  const range = doc.bufferedPageRange()
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i)
    doc.fontSize(8).font('Helvetica').text(`Page ${i - range.start + 1} of ${range.count} | ${text}`, 50, doc.page.height - 40, {
      align: 'center',
      width: doc.page.width - 100,
    })
  }
}

// Add signature block
export function addSignatureBlock(doc: PDFKit.PDFDocument, signatories: string[]): void {
  doc.moveDown(2)
  const startY = doc.y
  const colWidth = (doc.page.width - 100) / signatories.length

  for (let i = 0; i < signatories.length; i++) {
    const x = 50 + i * colWidth

    doc.moveTo(x + 10, startY).lineTo(x + colWidth - 20, startY).stroke()
    doc.fontSize(9).font('Helvetica').text(signatories[i], x, startY + 5, { width: colWidth, align: 'center' })
  }
}

// Format date for display in documents
export function formatDocDate(date: Date, formatStr: string = 'dd MMM yyyy'): string {
  return format(date, formatStr)
}
