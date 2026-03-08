/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import { XMLParser } from 'fast-xml-parser'
import type { DocxStructure, XlsxStructure, PptxStructure } from './types'

const MAX_PARAGRAPHS = 500
const MAX_TABLE_PREVIEW_ROWS = 5
const MAX_CELLS = 5000

type EntryReader = (entryPath: string) => Promise<Buffer>

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => {
    // Force arrays for common repeating elements
    const arrayTags = new Set([
      'w:p', 'w:r', 'w:t', 'w:tbl', 'w:tr', 'w:tc',
      'x:row', 'x:c',
      'p:sp', 'a:r', 'a:t', 'a:p',
      'Relationship',
    ])
    return arrayTags.has(name)
  },
})

// ---------------------------------------------------------------------------
// DOCX Structure Parser
// ---------------------------------------------------------------------------

export async function parseDocxStructure(readEntry: EntryReader): Promise<DocxStructure> {
  const docBuf = await readEntry('word/document.xml')
  const doc = xmlParser.parse(docBuf.toString('utf-8'))

  const body = doc?.['w:document']?.['w:body']
  if (!body) {
    return {
      paragraphs: [],
      tables: [],
      images: [],
      headers: [],
      footers: [],
      totalParagraphs: 0,
      truncated: false,
    }
  }

  const paragraphs: DocxStructure['paragraphs'] = []
  const tables: DocxStructure['tables'] = []
  const images: DocxStructure['images'] = []
  let truncated = false

  // Parse paragraphs
  const pElements = ensureArray(body['w:p'])
  const totalParagraphs = pElements.length

  for (let i = 0; i < pElements.length; i++) {
    if (paragraphs.length >= MAX_PARAGRAPHS) {
      truncated = true
      break
    }
    const p = pElements[i]
    const text = extractParagraphText(p)
    const pPr = p?.['w:pPr']
    const style = pPr?.['w:pStyle']?.['@_w:val']
    const rPr = pPr?.['w:rPr'] ?? p?.['w:r']?.[0]?.['w:rPr']
    const bold = !!(rPr?.['w:b'] !== undefined)
    const italic = !!(rPr?.['w:i'] !== undefined)
    const hasImage = hasDrawingContent(p)

    // Detect heading level
    let level: number | undefined
    if (style && /^Heading(\d)$/i.test(style)) {
      level = Number.parseInt(style.replace(/\D/g, ''), 10)
    }

    paragraphs.push({ index: i, text, style, level, bold, italic, hasImage })

    if (hasImage) {
      const drawings = extractDrawings(p)
      for (const d of drawings) {
        images.push({ paragraphIndex: i, fileName: d.fileName, altText: d.altText })
      }
    }
  }

  // Parse tables
  const tblElements = ensureArray(body['w:tbl'])
  for (let i = 0; i < tblElements.length; i++) {
    const tbl = tblElements[i]
    const rows = ensureArray(tbl?.['w:tr'])
    const preview: string[][] = []
    for (let ri = 0; ri < Math.min(rows.length, MAX_TABLE_PREVIEW_ROWS); ri++) {
      const cells = ensureArray(rows[ri]?.['w:tc'])
      preview.push(cells.map((c: any) => extractCellText(c)))
    }
    tables.push({
      index: i,
      rows: rows.length,
      cols: preview[0]?.length ?? 0,
      preview,
    })
  }

  // Parse headers/footers (simplified)
  const headers: string[] = []
  const footers: string[] = []
  try {
    const relsBuf = await readEntry('word/_rels/document.xml.rels')
    const rels = xmlParser.parse(relsBuf.toString('utf-8'))
    const relationships = ensureArray(rels?.Relationships?.Relationship)
    for (const rel of relationships) {
      const type = rel?.['@_Type'] ?? ''
      const target = rel?.['@_Target'] ?? ''
      if (type.includes('header') || type.includes('footer')) {
        try {
          const partBuf = await readEntry(`word/${target}`)
          const part = xmlParser.parse(partBuf.toString('utf-8'))
          const text = extractBodyText(part)
          if (type.includes('header')) headers.push(text)
          else footers.push(text)
        } catch {
          // Skip missing header/footer parts
        }
      }
    }
  } catch {
    // No rels file
  }

  return { paragraphs, tables, images, headers, footers, totalParagraphs, truncated }
}

// ---------------------------------------------------------------------------
// XLSX Structure Parser
// ---------------------------------------------------------------------------

export async function parseXlsxStructure(
  readEntry: EntryReader,
  entries: string[],
  targetSheet?: string,
): Promise<XlsxStructure> {
  // Parse workbook.xml for sheet names
  const wbBuf = await readEntry('xl/workbook.xml')
  const wb = xmlParser.parse(wbBuf.toString('utf-8'))
  const sheetDefs = ensureArray(wb?.workbook?.sheets?.sheet ?? wb?.['x:workbook']?.['x:sheets']?.['x:sheet'])

  const sheets: XlsxStructure['sheets'] = []
  let cells: XlsxStructure['cells'] | undefined

  // Parse shared strings (for cell value resolution)
  let sharedStrings: string[] = []
  try {
    const ssBuf = await readEntry('xl/sharedStrings.xml')
    const ss = xmlParser.parse(ssBuf.toString('utf-8'))
    const siList = ensureArray(ss?.sst?.si ?? ss?.['x:sst']?.['x:si'])
    sharedStrings = siList.map((si: any) => extractSharedString(si))
  } catch {
    // No shared strings
  }

  // Parse each sheet
  for (let i = 0; i < sheetDefs.length; i++) {
    const sheetDef = sheetDefs[i]
    const name = sheetDef?.['@_name'] ?? `Sheet${i + 1}`
    const sheetPath = `xl/worksheets/sheet${i + 1}.xml`

    if (!entries.includes(sheetPath)) {
      sheets.push({ name, index: i, rowCount: 0, colCount: 0, range: '' })
      continue
    }

    const sheetBuf = await readEntry(sheetPath)
    const sheetXml = xmlParser.parse(sheetBuf.toString('utf-8'))
    const worksheet = sheetXml?.worksheet ?? sheetXml?.['x:worksheet']
    const dimension = worksheet?.dimension ?? worksheet?.['x:dimension']
    const ref = dimension?.['@_ref'] ?? ''
    const { rowCount, colCount } = parseDimension(ref)

    sheets.push({ name, index: i, rowCount, colCount, range: ref })

    // If this is the target sheet, extract cells
    if (targetSheet && name === targetSheet) {
      cells = extractSheetCells(worksheet, sharedStrings)
    }
  }

  // If target sheet specified by index
  if (targetSheet && !cells) {
    const idx = sheets.findIndex((s) => s.name === targetSheet)
    if (idx >= 0) {
      const sheetPath = `xl/worksheets/sheet${idx + 1}.xml`
      if (entries.includes(sheetPath)) {
        const sheetBuf = await readEntry(sheetPath)
        const sheetXml = xmlParser.parse(sheetBuf.toString('utf-8'))
        const worksheet = sheetXml?.worksheet ?? sheetXml?.['x:worksheet']
        cells = extractSheetCells(worksheet, sharedStrings)
      }
    }
  }

  // Count charts and pivot tables
  const charts = entries.filter((e) => e.startsWith('xl/charts/')).length
  const pivotTables = entries.filter((e) => e.startsWith('xl/pivotTables/')).length

  return { sheets, cells, charts, pivotTables }
}

function extractSheetCells(
  worksheet: any,
  sharedStrings: string[],
): XlsxStructure['cells'] {
  const cells: NonNullable<XlsxStructure['cells']> = []
  const sheetData = worksheet?.sheetData ?? worksheet?.['x:sheetData']
  const rows = ensureArray(sheetData?.row ?? sheetData?.['x:row'])

  for (const row of rows) {
    const rowCells = ensureArray(row?.c ?? row?.['x:c'])
    for (const c of rowCells) {
      if (cells.length >= MAX_CELLS) return cells
      const ref = c?.['@_r'] ?? ''
      const type = c?.['@_t'] ?? 'n'
      const formula = c?.f ?? c?.['x:f']
      let value: string | number | null = null
      const v = c?.v ?? c?.['x:v']

      if (type === 's' && v !== undefined) {
        // Shared string
        value = sharedStrings[Number(v)] ?? null
      } else if (v !== undefined) {
        value = isNaN(Number(v)) ? String(v) : Number(v)
      }

      cells.push({
        ref,
        value,
        type: type === 's' ? 'string' : type === 'b' ? 'boolean' : 'number',
        formula: typeof formula === 'string' ? formula : typeof formula === 'object' ? formula?.['#text'] : undefined,
      })
    }
  }

  return cells
}

// ---------------------------------------------------------------------------
// PPTX Structure Parser
// ---------------------------------------------------------------------------

export async function parsePptxStructure(
  readEntry: EntryReader,
  entries: string[],
): Promise<PptxStructure> {
  const slideEntries = entries
    .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e))
    .sort((a, b) => {
      const numA = Number.parseInt(a.match(/slide(\d+)/)?.[1] ?? '0', 10)
      const numB = Number.parseInt(b.match(/slide(\d+)/)?.[1] ?? '0', 10)
      return numA - numB
    })

  const slides: PptxStructure['slides'] = []

  for (let i = 0; i < slideEntries.length; i++) {
    const slideBuf = await readEntry(slideEntries[i]!)
    const slideXml = xmlParser.parse(slideBuf.toString('utf-8'))
    const sld = slideXml?.['p:sld']

    const textBlocks: string[] = []
    let title: string | undefined
    const images: string[] = []

    // Extract shape tree
    const spTree = sld?.['p:cSld']?.['p:spTree']
    if (spTree) {
      const shapes = ensureArray(spTree['p:sp'])
      for (const sp of shapes) {
        const txBody = sp?.['p:txBody']
        if (txBody) {
          const text = extractPptxText(txBody)
          if (text) {
            textBlocks.push(text)
            // First non-empty text block as title
            if (!title) title = text
          }
        }
      }

      // Extract images (picture shapes)
      const pics = ensureArray(spTree['p:pic'])
      for (const pic of pics) {
        const blipFill = pic?.['p:blipFill']
        const blip = blipFill?.['a:blip']
        const embed = blip?.['@_r:embed']
        if (embed) images.push(embed)
      }
    }

    // Try to get layout name from rels
    let layout: string | undefined
    const relsPath = `ppt/slides/_rels/slide${i + 1}.xml.rels`
    if (entries.includes(relsPath)) {
      try {
        const relsBuf = await readEntry(relsPath)
        const rels = xmlParser.parse(relsBuf.toString('utf-8'))
        const relationships = ensureArray(rels?.Relationships?.Relationship)
        for (const rel of relationships) {
          if ((rel?.['@_Type'] ?? '').includes('slideLayout')) {
            layout = rel?.['@_Target']?.replace(/.*\//, '').replace('.xml', '')
          }
        }
      } catch {
        // Skip
      }
    }

    slides.push({ index: i, layout, title, textBlocks, images })
  }

  const masters = entries.filter((e) => /^ppt\/slideMasters\//.test(e)).length

  return { slides, slideCount: slides.length, masters }
}

// ---------------------------------------------------------------------------
// Text extraction helpers
// ---------------------------------------------------------------------------

function ensureArray(val: any): any[] {
  if (val === undefined || val === null) return []
  return Array.isArray(val) ? val : [val]
}

function extractParagraphText(p: any): string {
  const runs = ensureArray(p?.['w:r'])
  return runs
    .map((r: any) => {
      const texts = ensureArray(r?.['w:t'])
      return texts.map((t: any) => (typeof t === 'string' ? t : t?.['#text'] ?? '')).join('')
    })
    .join('')
}

function extractCellText(tc: any): string {
  const paras = ensureArray(tc?.['w:p'])
  return paras.map((p: any) => extractParagraphText(p)).join('\n')
}

function extractBodyText(part: any): string {
  // Works for headers/footers
  const root = Object.values(part)?.[0] as any
  if (!root) return ''
  const paras = ensureArray(root?.['w:p'])
  return paras.map((p: any) => extractParagraphText(p)).join('\n')
}

function hasDrawingContent(p: any): boolean {
  const runs = ensureArray(p?.['w:r'])
  for (const r of runs) {
    if (r?.['w:drawing'] || r?.['w:pict']) return true
  }
  return false
}

function extractDrawings(p: any): { fileName: string; altText?: string }[] {
  const results: { fileName: string; altText?: string }[] = []
  const runs = ensureArray(p?.['w:r'])
  for (const r of runs) {
    const drawing = r?.['w:drawing']
    if (drawing) {
      // Look for blip with embed reference
      const inline = drawing?.['wp:inline'] ?? drawing?.['wp:anchor']
      const graphic = inline?.['a:graphic']?.['a:graphicData']
      const pic = graphic?.['pic:pic']
      const blipFill = pic?.['pic:blipFill']
      const blip = blipFill?.['a:blip']
      const embed = blip?.['@_r:embed'] ?? ''
      const altText = inline?.['wp:docPr']?.['@_descr']
      results.push({ fileName: embed, altText })
    }
  }
  return results
}

function extractPptxText(txBody: any): string {
  const paragraphs = ensureArray(txBody?.['a:p'])
  return paragraphs
    .map((p: any) => {
      const runs = ensureArray(p?.['a:r'])
      return runs
        .map((r: any) => {
          const texts = ensureArray(r?.['a:t'])
          return texts.map((t: any) => (typeof t === 'string' ? t : t?.['#text'] ?? '')).join('')
        })
        .join('')
    })
    .filter(Boolean)
    .join('\n')
}

function extractSharedString(si: any): string {
  // Shared string can be simple <t> or complex <r><t>
  const t = si?.t ?? si?.['x:t']
  if (typeof t === 'string') return t
  if (t?.['#text']) return t['#text']
  // Complex: concatenate runs
  const runs = ensureArray(si?.r ?? si?.['x:r'])
  return runs
    .map((r: any) => {
      const rt = r?.t ?? r?.['x:t']
      return typeof rt === 'string' ? rt : rt?.['#text'] ?? ''
    })
    .join('')
}

function parseDimension(ref: string): { rowCount: number; colCount: number } {
  if (!ref) return { rowCount: 0, colCount: 0 }
  const parts = ref.split(':')
  if (parts.length !== 2) return { rowCount: 0, colCount: 0 }
  const start = parseCellRef(parts[0]!)
  const end = parseCellRef(parts[1]!)
  return {
    rowCount: end.row - start.row + 1,
    colCount: end.col - start.col + 1,
  }
}

function parseCellRef(ref: string): { row: number; col: number } {
  const match = ref.match(/^([A-Z]+)(\d+)$/)
  if (!match) return { row: 0, col: 0 }
  const col = match[1]!.split('').reduce((acc, c) => acc * 26 + c.charCodeAt(0) - 64, 0)
  return { row: Number.parseInt(match[2]!, 10), col }
}
