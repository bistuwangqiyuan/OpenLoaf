declare module 'pdf-parse' {
  interface PdfParsePage {
    text: string
    num: number
  }
  interface PdfParseTextResult {
    pages: PdfParsePage[]
    text: string
    total: number
  }
  class PDFParse {
    constructor(data: Uint8Array)
    getText(): Promise<PdfParseTextResult>
    getInfo(): Promise<Record<string, any>>
    destroy(): void
  }
  export { PDFParse }
}
