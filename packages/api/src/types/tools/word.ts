/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import { z } from 'zod'

export const wordQueryToolDef = {
  id: 'word-query',
  name: 'Word 查询',
  description:
    '触发：当用户提到 Word、docx、文档，或询问"读取文档"、"查看 Word 内容"时调用。用途：读取 Word 文件的文本内容、HTML 或 Markdown。返回：{ ok: true, data: { mode, ... } }。不适用：需要创建、修改 Word 时不要使用，改用 word-mutate。',
  parameters: z.object({
    actionName: z
      .string()
      .min(1)
      .describe('由调用的 LLM 传入，用于说明本次工具调用目的，例如：读取合同文档。'),
    mode: z
      .enum(['get-info', 'read-text', 'read-html', 'read-markdown'])
      .describe(
        '查询模式：get-info 获取文档元信息（文件名、大小），read-text 提取纯文本内容，read-html 转换为 HTML，read-markdown 转换为 Markdown',
      ),
    filePath: z
      .string()
      .min(1)
      .describe('Word 文件路径（相对于项目/工作空间根目录或绝对路径，支持 .docx）'),
  }),
  component: null,
} as const

const contentItemSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('heading'),
    text: z.string().describe('标题文本'),
    level: z.number().int().min(1).max(6).optional().describe('标题级别（1-6，默认 1）'),
  }),
  z.object({
    type: z.literal('paragraph'),
    text: z.string().describe('段落文本'),
    bold: z.boolean().optional().describe('是否加粗'),
    italic: z.boolean().optional().describe('是否斜体'),
  }),
  z.object({
    type: z.literal('table'),
    headers: z.array(z.string()).describe('表头列名数组'),
    rows: z.array(z.array(z.string())).describe('表格数据行（二维字符串数组）'),
  }),
  z.object({
    type: z.literal('bullet-list'),
    items: z.array(z.string()).describe('无序列表项'),
  }),
  z.object({
    type: z.literal('numbered-list'),
    items: z.array(z.string()).describe('有序列表项'),
  }),
])

export const wordMutateToolDef = {
  id: 'word-mutate',
  name: 'Word 操作',
  description:
    '触发：当你需要创建 Word 文件、修改已有 Word 文件（模板替换）时调用。用途：创建新的 .docx 文件或使用 patch 方式修改已有文件中的占位符。返回：{ ok: true, data: { action, ... } }。不适用：仅需读取 Word 时不要使用，改用 word-query。',
  parameters: z.object({
    actionName: z
      .string()
      .min(1)
      .describe('由调用的 LLM 传入，用于说明本次工具调用目的，例如：创建项目报告。'),
    action: z
      .enum(['create', 'patch'])
      .describe(
        '操作类型：create 使用结构化内容创建新 .docx 文件，patch 替换已有 .docx 文件中的 {占位符} 文本',
      ),
    filePath: z
      .string()
      .min(1)
      .describe('Word 文件路径（create 时为新文件路径，patch 时为已有文件路径）'),
    outputPath: z
      .string()
      .optional()
      .describe('输出文件路径（patch 时可选，不填则覆盖原文件）'),
    content: z
      .array(contentItemSchema)
      .optional()
      .describe(
        'create 时必填：结构化文档内容数组，每项为 heading/paragraph/table/bullet-list/numbered-list',
      ),
    patches: z
      .record(z.string(), z.string())
      .optional()
      .describe(
        'patch 时必填：占位符替换映射，如 { "name": "张三", "date": "2026-03-08" } 会替换文档中的 {name} 和 {date}',
      ),
  }),
  needsApproval: true,
  component: null,
} as const
