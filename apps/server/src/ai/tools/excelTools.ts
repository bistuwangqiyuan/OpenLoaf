/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { tool, zodSchema } from 'ai'
import * as XLSX from 'xlsx'
import {
  excelQueryToolDef,
  excelMutateToolDef,
} from '@openloaf/api/types/tools/excel'
import { resolveToolPath } from '@/ai/tools/toolScope'
import {
  getSessionId,
  getWorkspaceId,
  getProjectId,
} from '@/ai/shared/context/requestContext'
import { saveChatBinaryAttachment } from '@/ai/services/image/attachmentResolver'

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100 MB
const DEFAULT_READ_LIMIT = 100
const MAX_READ_LIMIT = 500

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readWorkbook(filePath: string): Promise<XLSX.WorkBook> {
  const { absPath } = resolveToolPath({ target: filePath })
  const stat = await fs.stat(absPath)
  if (!stat.isFile()) throw new Error('Path is not a file.')
  if (stat.size > MAX_FILE_SIZE) {
    throw new Error(
      `File size (${(stat.size / 1024 / 1024).toFixed(1)} MB) exceeds 100 MB limit. Please use a smaller file.`,
    )
  }
  const buf = await fs.readFile(absPath)
  return XLSX.read(buf, { type: 'buffer' })
}

function resolveSheet(
  wb: XLSX.WorkBook,
  sheetName?: string,
  sheetIndex?: number,
): { ws: XLSX.WorkSheet; name: string } {
  let name: string
  if (sheetName) {
    if (!wb.SheetNames.includes(sheetName)) {
      throw new Error(`Sheet "${sheetName}" not found. Available: ${wb.SheetNames.join(', ')}`)
    }
    name = sheetName
  } else if (typeof sheetIndex === 'number') {
    if (sheetIndex < 0 || sheetIndex >= wb.SheetNames.length) {
      throw new Error(`Sheet index ${sheetIndex} out of range (0..${wb.SheetNames.length - 1}).`)
    }
    name = wb.SheetNames[sheetIndex]!
  } else {
    name = wb.SheetNames[0]!
  }
  const ws = wb.Sheets[name]
  if (!ws) throw new Error(`Sheet "${name}" not found.`)
  return { ws, name }
}

function getSheetDimensions(ws: XLSX.WorkSheet): { rows: number; cols: number; ref: string } {
  const ref = ws['!ref'] ?? ''
  if (!ref) return { rows: 0, cols: 0, ref: '' }
  const range = XLSX.utils.decode_range(ref)
  return {
    rows: range.e.r - range.s.r + 1,
    cols: range.e.c - range.s.c + 1,
    ref,
  }
}

async function writeWorkbook(wb: XLSX.WorkBook, filePath: string): Promise<string> {
  const { absPath } = resolveToolPath({ target: filePath })
  await fs.mkdir(path.dirname(absPath), { recursive: true })
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  await fs.writeFile(absPath, buf)
  return absPath
}

/** Save a new workbook to the chat session directory (for create / save-as). */
async function writeWorkbookToSession(wb: XLSX.WorkBook, fileName: string): Promise<string> {
  const sessionId = getSessionId()
  if (!sessionId) {
    // fallback: 无 session 上下文时使用 resolveToolPath
    return writeWorkbook(wb, fileName)
  }
  const buf = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
  const saved = await saveChatBinaryAttachment({
    workspaceId: getWorkspaceId(),
    projectId: getProjectId(),
    sessionId,
    fileName: path.basename(fileName),
    buffer: buf,
    mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  return saved.relativePath
}

// ---------------------------------------------------------------------------
// Excel Query Tool
// ---------------------------------------------------------------------------

export const excelQueryTool = tool({
  description: excelQueryToolDef.description,
  inputSchema: zodSchema(excelQueryToolDef.parameters),
  execute: async (input) => {
    const { mode, filePath, sheetName, sheetIndex, range, offset, limit, outputPath, includeHeaders } = input as {
      mode: string
      filePath: string
      sheetName?: string
      sheetIndex?: number
      range?: string
      offset?: number
      limit?: number
      outputPath?: string
      includeHeaders?: boolean
    }

    const wb = await readWorkbook(filePath)

    switch (mode) {
      case 'get-info': {
        const sheets = wb.SheetNames.map((name) => {
          const ws = wb.Sheets[name]!
          const dims = getSheetDimensions(ws)
          return { name, rows: dims.rows, cols: dims.cols, ref: dims.ref }
        })
        return { ok: true, data: { mode, fileName: path.basename(filePath), sheetCount: sheets.length, sheets } }
      }

      case 'list-sheets': {
        return { ok: true, data: { mode, sheets: wb.SheetNames } }
      }

      case 'read-sheet': {
        const { ws, name } = resolveSheet(wb, sheetName, sheetIndex)
        const useHeaders = includeHeaders !== false
        const allRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { header: useHeaders ? undefined : 1 })
        const rowOffset = typeof offset === 'number' ? offset : 0
        const rowLimit = Math.min(typeof limit === 'number' ? limit : DEFAULT_READ_LIMIT, MAX_READ_LIMIT)
        const slice = allRows.slice(rowOffset, rowOffset + rowLimit)
        const dims = getSheetDimensions(ws)
        return {
          ok: true,
          data: {
            mode,
            sheetName: name,
            totalRows: dims.rows,
            returnedRows: slice.length,
            offset: rowOffset,
            hasMore: rowOffset + rowLimit < allRows.length,
            rows: slice,
          },
        }
      }

      case 'read-cells': {
        if (!range) throw new Error('range is required for read-cells mode (e.g. "A1:C10").')
        const { ws, name } = resolveSheet(wb, sheetName, sheetIndex)
        const parsedRange = XLSX.utils.decode_range(range)
        const cells: (string | number | boolean | null)[][] = []
        for (let r = parsedRange.s.r; r <= parsedRange.e.r; r++) {
          const row: (string | number | boolean | null)[] = []
          for (let c = parsedRange.s.c; c <= parsedRange.e.c; c++) {
            const addr = XLSX.utils.encode_cell({ r, c })
            const cell = ws[addr]
            row.push(cell ? (cell.v as string | number | boolean | null) ?? null : null)
          }
          cells.push(row)
        }
        return { ok: true, data: { mode, sheetName: name, range, cells } }
      }

      case 'export-csv': {
        const { ws, name } = resolveSheet(wb, sheetName, sheetIndex)
        const csv = XLSX.utils.sheet_to_csv(ws)
        if (outputPath) {
          const { absPath: outAbs } = resolveToolPath({ target: outputPath })
          await fs.mkdir(path.dirname(outAbs), { recursive: true })
          await fs.writeFile(outAbs, csv, 'utf-8')
          return { ok: true, data: { mode, sheetName: name, outputPath: outAbs } }
        }
        return { ok: true, data: { mode, sheetName: name, csv } }
      }

      default:
        throw new Error(`Unknown mode: ${mode}`)
    }
  },
})

// ---------------------------------------------------------------------------
// Excel Mutate Tool
// ---------------------------------------------------------------------------

export const excelMutateTool = tool({
  description: excelMutateToolDef.description,
  inputSchema: zodSchema(excelMutateToolDef.parameters),
  needsApproval: true,
  execute: async (input) => {
    const {
      action, filePath, sheetName, range, data, newSheetName,
      formula, csvContent, csvFilePath, outputPath, delimiter,
    } = input as {
      action: string
      filePath?: string
      sheetName?: string
      range?: string
      data?: (string | number | boolean | null)[][]
      newSheetName?: string
      formula?: string
      csvContent?: string
      csvFilePath?: string
      outputPath?: string
      delimiter?: string
    }

    switch (action) {
      case 'create': {
        if (!filePath) throw new Error('filePath is required for create action.')
        const wb = XLSX.utils.book_new()
        const wsName = sheetName || 'Sheet1'
        const ws = data ? XLSX.utils.aoa_to_sheet(data) : XLSX.utils.aoa_to_sheet([[]])
        XLSX.utils.book_append_sheet(wb, ws, wsName)
        const savedPath = await writeWorkbookToSession(wb, filePath)
        return { ok: true, data: { action, filePath: savedPath, sheetName: wsName } }
      }

      case 'write-cells': {
        if (!filePath) throw new Error('filePath is required for write-cells action.')
        if (!data || data.length === 0) throw new Error('data is required for write-cells action.')
        const wb = await readWorkbook(filePath)
        const { ws, name } = resolveSheet(wb, sheetName)
        const startCell = range || 'A1'
        const origin = XLSX.utils.decode_cell(startCell)
        for (let r = 0; r < data.length; r++) {
          const row = data[r]!
          for (let c = 0; c < row.length; c++) {
            const addr = XLSX.utils.encode_cell({ r: origin.r + r, c: origin.c + c })
            const val = row[c]
            if (val === null || val === undefined) {
              delete ws[addr]
            } else if (typeof val === 'string' && val.startsWith('=')) {
              ws[addr] = { t: 'n', f: val.slice(1) }
            } else {
              ws[addr] = { t: typeof val === 'number' ? 'n' : typeof val === 'boolean' ? 'b' : 's', v: val }
            }
          }
        }
        // Update sheet range
        const dims = getSheetDimensions(ws)
        const maxR = Math.max(dims.rows - 1, origin.r + data.length - 1)
        const maxC = Math.max(dims.cols - 1, origin.c + (data[0]?.length ?? 1) - 1)
        ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } })
        const absPath = await writeWorkbook(wb, filePath)
        return { ok: true, data: { action, filePath: absPath, sheetName: name, cellsWritten: data.length * (data[0]?.length ?? 0) } }
      }

      case 'add-sheet': {
        if (!filePath) throw new Error('filePath is required for add-sheet action.')
        const wsName = newSheetName || sheetName || 'NewSheet'
        const wb = await readWorkbook(filePath)
        if (wb.SheetNames.includes(wsName)) {
          throw new Error(`Sheet "${wsName}" already exists.`)
        }
        const ws = data ? XLSX.utils.aoa_to_sheet(data) : XLSX.utils.aoa_to_sheet([[]])
        XLSX.utils.book_append_sheet(wb, ws, wsName)
        const absPath = await writeWorkbook(wb, filePath)
        return { ok: true, data: { action, filePath: absPath, sheetName: wsName } }
      }

      case 'rename-sheet': {
        if (!filePath) throw new Error('filePath is required for rename-sheet action.')
        if (!sheetName) throw new Error('sheetName (current name) is required for rename-sheet.')
        if (!newSheetName) throw new Error('newSheetName is required for rename-sheet.')
        const wb = await readWorkbook(filePath)
        const idx = wb.SheetNames.indexOf(sheetName)
        if (idx === -1) throw new Error(`Sheet "${sheetName}" not found.`)
        if (wb.SheetNames.includes(newSheetName)) {
          throw new Error(`Sheet "${newSheetName}" already exists.`)
        }
        wb.SheetNames[idx] = newSheetName
        wb.Sheets[newSheetName] = wb.Sheets[sheetName]!
        delete wb.Sheets[sheetName]
        const absPath = await writeWorkbook(wb, filePath)
        return { ok: true, data: { action, filePath: absPath, oldName: sheetName, newName: newSheetName } }
      }

      case 'delete-sheet': {
        if (!filePath) throw new Error('filePath is required for delete-sheet action.')
        if (!sheetName) throw new Error('sheetName is required for delete-sheet.')
        const wb = await readWorkbook(filePath)
        const idx = wb.SheetNames.indexOf(sheetName)
        if (idx === -1) throw new Error(`Sheet "${sheetName}" not found.`)
        if (wb.SheetNames.length <= 1) throw new Error('Cannot delete the last sheet.')
        wb.SheetNames.splice(idx, 1)
        delete wb.Sheets[sheetName]
        const absPath = await writeWorkbook(wb, filePath)
        return { ok: true, data: { action, filePath: absPath, deletedSheet: sheetName } }
      }

      case 'set-formula': {
        if (!filePath) throw new Error('filePath is required for set-formula action.')
        if (!range) throw new Error('range (cell address) is required for set-formula.')
        if (!formula) throw new Error('formula is required for set-formula.')
        const wb = await readWorkbook(filePath)
        const { ws, name } = resolveSheet(wb, sheetName)
        ws[range] = { t: 'n', f: formula }
        const absPath = await writeWorkbook(wb, filePath)
        return { ok: true, data: { action, filePath: absPath, sheetName: name, cell: range, formula } }
      }

      case 'import-csv': {
        if (!filePath) throw new Error('filePath is required for import-csv action.')
        let csv: string
        if (csvContent) {
          csv = csvContent
        } else if (csvFilePath) {
          const { absPath: csvAbs } = resolveToolPath({ target: csvFilePath })
          csv = await fs.readFile(csvAbs, 'utf-8')
        } else {
          throw new Error('csvContent or csvFilePath is required for import-csv.')
        }
        const sep = delimiter || ','
        const wb = await readWorkbook(filePath).catch(() => XLSX.utils.book_new())
        const wsName = sheetName || 'Imported'
        const ws = XLSX.utils.aoa_to_sheet(
          csv.split('\n').filter(Boolean).map((line) => line.split(sep)),
        )
        if (wb.SheetNames.includes(wsName)) {
          wb.Sheets[wsName] = ws
        } else {
          XLSX.utils.book_append_sheet(wb, ws, wsName)
        }
        const absPath = await writeWorkbook(wb, filePath)
        return { ok: true, data: { action, filePath: absPath, sheetName: wsName } }
      }

      case 'save-as': {
        if (!filePath) throw new Error('filePath is required for save-as action.')
        if (!outputPath) throw new Error('outputPath is required for save-as action.')
        const wb = await readWorkbook(filePath)
        const savedPath = await writeWorkbookToSession(wb, outputPath)
        return { ok: true, data: { action, outputPath: savedPath } }
      }

      default:
        throw new Error(`Unknown action: ${action}`)
    }
  },
})
