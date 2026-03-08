/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */

/** A single edit operation for Office documents (DOCX/XLSX/PPTX). */
export type OfficeEdit =
  | { op: 'replace'; path: string; xpath: string; xml: string }
  | { op: 'insert'; path: string; xpath: string; position: 'before' | 'after'; xml: string }
  | { op: 'remove'; path: string; xpath: string }
  | { op: 'write'; path: string; source: string }
  | { op: 'delete'; path: string }

/** DOCX read-structure result. */
export type DocxStructure = {
  paragraphs: {
    index: number
    text: string
    style?: string
    level?: number
    bold?: boolean
    italic?: boolean
    hasImage?: boolean
  }[]
  tables: {
    index: number
    rows: number
    cols: number
    preview: string[][]
  }[]
  images: {
    paragraphIndex: number
    fileName: string
    altText?: string
  }[]
  headers: string[]
  footers: string[]
  totalParagraphs: number
  truncated: boolean
}

/** XLSX read-structure result. */
export type XlsxStructure = {
  sheets: {
    name: string
    index: number
    rowCount: number
    colCount: number
    range: string
  }[]
  cells?: {
    ref: string
    value: string | number | null
    type: string
    formula?: string
  }[]
  charts: number
  pivotTables: number
}

/** PPTX read-structure result. */
export type PptxStructure = {
  slides: {
    index: number
    layout?: string
    title?: string
    textBlocks: string[]
    images: string[]
  }[]
  slideCount: number
  masters: number
}

/** PDF read-structure result. */
export type PdfStructure = {
  pageCount: number
  fileSize: number
  hasForm: boolean
  formFieldCount: number
  metadata: {
    title?: string
    author?: string
    subject?: string
    creator?: string
    producer?: string
    creationDate?: string
    modificationDate?: string
  }
}

/** PDF text extraction result. */
export type PdfTextResult = {
  text: string
  pageCount: number
  truncated: boolean
  characterCount: number
}

/** PDF form field descriptor. */
export type PdfFormField = {
  name: string
  type: 'text' | 'checkbox' | 'radio' | 'dropdown' | 'option-list' | 'button' | 'unknown'
  value?: string
  options?: string[]
}

/** PDF content item for creating PDFs. */
export type PdfContentItem =
  | { type: 'heading'; text: string; level?: number }
  | { type: 'paragraph'; text: string; bold?: boolean; italic?: boolean; fontSize?: number }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'bullet-list'; items: string[] }
  | { type: 'numbered-list'; items: string[] }
  | { type: 'page-break' }

/** PDF text overlay for add-text action. */
export type PdfTextOverlay = {
  page: number
  x: number
  y: number
  text: string
  fontSize?: number
  color?: string
}
