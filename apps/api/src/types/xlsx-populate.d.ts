declare module 'xlsx-populate' {
  interface Cell {
    value(): unknown
    value(value: unknown): Cell
  }

  interface Range {
    value(): unknown[][]
  }

  interface Sheet {
    name(): string
    cell(address: string): Cell
    usedRange(): Range | undefined
  }

  interface Workbook {
    sheets(): Sheet[]
    sheet(name: string | number): Sheet
    outputAsync(options?: { password?: string }): Promise<Buffer>
  }

  interface XlsxPopulate {
    fromDataAsync(data: Buffer | ArrayBuffer, options?: { password?: string }): Promise<Workbook>
    fromFileAsync(path: string, options?: { password?: string }): Promise<Workbook>
  }

  const XlsxPopulate: XlsxPopulate
  export default XlsxPopulate
}
