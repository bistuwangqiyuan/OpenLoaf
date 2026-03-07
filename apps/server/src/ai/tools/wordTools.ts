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
import mammoth from 'mammoth'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  patchDocument,
  PatchType,
} from 'docx'
import {
  wordQueryToolDef,
  wordMutateToolDef,
} from '@openloaf/api/types/tools/word'
import { resolveToolPath } from '@/ai/tools/toolScope'

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100 MB
const MAX_TEXT_LENGTH = 200_000 // 200K characters

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readDocxBuffer(filePath: string): Promise<Buffer> {
  const { absPath } = resolveToolPath({ target: filePath })
  const stat = await fs.stat(absPath)
  if (!stat.isFile()) throw new Error('Path is not a file.')
  if (stat.size > MAX_FILE_SIZE) {
    throw new Error(
      `File size (${(stat.size / 1024 / 1024).toFixed(1)} MB) exceeds 100 MB limit.`,
    )
  }
  const ext = path.extname(absPath).toLowerCase()
  if (ext !== '.docx') {
    throw new Error(`Unsupported file format "${ext}". Only .docx files are supported.`)
  }
  return fs.readFile(absPath)
}

function truncateText(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_TEXT_LENGTH) return { text, truncated: false }
  return {
    text: text.slice(0, MAX_TEXT_LENGTH),
    truncated: true,
  }
}

const HEADING_LEVEL_MAP: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
}

type ContentItem =
  | { type: 'heading'; text: string; level?: number }
  | { type: 'paragraph'; text: string; bold?: boolean; italic?: boolean }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'bullet-list'; items: string[] }
  | { type: 'numbered-list'; items: string[] }

function buildDocxChildren(content: ContentItem[]): (Paragraph | Table)[] {
  const children: (Paragraph | Table)[] = []

  for (const item of content) {
    switch (item.type) {
      case 'heading': {
        children.push(
          new Paragraph({
            text: item.text,
            heading: HEADING_LEVEL_MAP[item.level ?? 1] ?? HeadingLevel.HEADING_1,
          }),
        )
        break
      }

      case 'paragraph': {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: item.text,
                bold: item.bold,
                italics: item.italic,
              }),
            ],
          }),
        )
        break
      }

      case 'table': {
        const headerRow = new TableRow({
          children: item.headers.map(
            (h) =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
                width: { size: Math.floor(9000 / item.headers.length), type: WidthType.DXA },
              }),
          ),
        })
        const dataRows = item.rows.map(
          (row) =>
            new TableRow({
              children: row.map(
                (cell) =>
                  new TableCell({
                    children: [new Paragraph(cell)],
                    width: { size: Math.floor(9000 / item.headers.length), type: WidthType.DXA },
                  }),
              ),
            }),
        )
        children.push(
          new Table({
            rows: [headerRow, ...dataRows],
          }),
        )
        break
      }

      case 'bullet-list': {
        for (const text of item.items) {
          children.push(
            new Paragraph({
              text,
              bullet: { level: 0 },
            }),
          )
        }
        break
      }

      case 'numbered-list': {
        for (const text of item.items) {
          children.push(
            new Paragraph({
              text,
              numbering: { reference: 'default-numbering', level: 0 },
            }),
          )
        }
        break
      }
    }
  }

  return children
}

// ---------------------------------------------------------------------------
// Word Query Tool
// ---------------------------------------------------------------------------

export const wordQueryTool = tool({
  description: wordQueryToolDef.description,
  inputSchema: zodSchema(wordQueryToolDef.parameters),
  execute: async (input) => {
    const { mode, filePath } = input as {
      mode: string
      filePath: string
    }

    const buffer = await readDocxBuffer(filePath)
    const { absPath } = resolveToolPath({ target: filePath })

    switch (mode) {
      case 'get-info': {
        const stat = await fs.stat(absPath)
        const textResult = await mammoth.extractRawText({ buffer })
        const wordCount = textResult.value.split(/\s+/).filter(Boolean).length
        const paragraphCount = textResult.value.split(/\n\n/).filter(Boolean).length
        return {
          ok: true,
          data: {
            mode,
            fileName: path.basename(filePath),
            fileSizeMB: +(stat.size / 1024 / 1024).toFixed(2),
            wordCount,
            paragraphCount,
            messages: textResult.messages.map((m) => m.message),
          },
        }
      }

      case 'read-text': {
        const result = await mammoth.extractRawText({ buffer })
        const { text, truncated } = truncateText(result.value)
        return {
          ok: true,
          data: {
            mode,
            fileName: path.basename(filePath),
            text,
            truncated,
            characterCount: result.value.length,
          },
        }
      }

      case 'read-html': {
        const result = await mammoth.convertToHtml({ buffer })
        const { text: html, truncated } = truncateText(result.value)
        return {
          ok: true,
          data: {
            mode,
            fileName: path.basename(filePath),
            html,
            truncated,
            messages: result.messages.map((m) => m.message),
          },
        }
      }

      case 'read-markdown': {
        // mammoth types don't expose convertToMarkdown, but the runtime supports it
        const result = await (mammoth as any).convertToMarkdown({ buffer })
        const { text: markdown, truncated } = truncateText(result.value)
        return {
          ok: true,
          data: {
            mode,
            fileName: path.basename(filePath),
            markdown,
            truncated,
            messages: result.messages.map((m: { message: string }) => m.message),
          },
        }
      }

      default:
        throw new Error(`Unknown mode: ${mode}`)
    }
  },
})

// ---------------------------------------------------------------------------
// Word Mutate Tool
// ---------------------------------------------------------------------------

export const wordMutateTool = tool({
  description: wordMutateToolDef.description,
  inputSchema: zodSchema(wordMutateToolDef.parameters),
  needsApproval: true,
  execute: async (input) => {
    const { action, filePath, outputPath, content, patches } = input as {
      action: string
      filePath: string
      outputPath?: string
      content?: ContentItem[]
      patches?: Record<string, string>
    }

    const { absPath } = resolveToolPath({ target: filePath })

    switch (action) {
      case 'create': {
        if (!content || content.length === 0) {
          throw new Error('content is required for create action.')
        }

        const hasNumberedList = content.some((c) => c.type === 'numbered-list')
        const docOptions: any = {
          sections: [{ children: buildDocxChildren(content) }],
        }
        if (hasNumberedList) {
          docOptions.numbering = {
            config: [
              {
                reference: 'default-numbering',
                levels: [
                  {
                    level: 0,
                    format: 'decimal',
                    text: '%1.',
                    alignment: AlignmentType.START,
                  },
                ],
              },
            ],
          }
        }

        const doc = new Document(docOptions)
        const buffer = await Packer.toBuffer(doc)
        await fs.mkdir(path.dirname(absPath), { recursive: true })
        await fs.writeFile(absPath, buffer)
        return {
          ok: true,
          data: {
            action,
            filePath: absPath,
            elementCount: content.length,
          },
        }
      }

      case 'patch': {
        if (!patches || Object.keys(patches).length === 0) {
          throw new Error('patches is required for patch action.')
        }

        const sourceBuffer = await readDocxBuffer(filePath)
        const patchEntries: Record<string, any> = {}
        for (const [key, value] of Object.entries(patches)) {
          patchEntries[key] = {
            type: PatchType.PARAGRAPH,
            children: [new TextRun(value)],
          }
        }

        const patchedBuffer = await patchDocument({
          outputType: 'nodebuffer',
          data: sourceBuffer,
          patches: patchEntries,
        })
        const outPath = outputPath
          ? resolveToolPath({ target: outputPath }).absPath
          : absPath
        await fs.mkdir(path.dirname(outPath), { recursive: true })
        await fs.writeFile(outPath, patchedBuffer)
        return {
          ok: true,
          data: {
            action,
            filePath: outPath,
            patchedKeys: Object.keys(patches),
          },
        }
      }

      default:
        throw new Error(`Unknown action: ${action}`)
    }
  },
})
