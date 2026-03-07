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

export const excelQueryToolDef = {
  id: 'excel-query',
  name: 'Excel 查询',
  description:
    '触发：当用户提到 Excel、电子表格、xlsx、csv、工作表，或询问"读取表格"、"查看数据"时调用。用途：读取 Excel 文件的元数据、sheet 数据、单元格范围，导出 CSV。返回：{ ok: true, data: { mode, ... } }。不适用：需要创建、修改 Excel 时不要使用，改用 excel-mutate。',
  parameters: z.object({
    actionName: z
      .string()
      .min(1)
      .describe('由调用的 LLM 传入，用于说明本次工具调用目的，例如：读取销售数据表。'),
    mode: z
      .enum(['get-info', 'read-sheet', 'read-cells', 'list-sheets', 'export-csv'])
      .describe(
        '查询模式：get-info 获取工作簿元数据，read-sheet 读取 sheet 数据（JSON），read-cells 读取指定单元格范围，list-sheets 列出所有 sheet 名称，export-csv 导出 sheet 为 CSV',
      ),
    filePath: z
      .string()
      .min(1)
      .describe('Excel 文件路径（相对于项目/工作空间根目录或绝对路径）'),
    sheetName: z
      .string()
      .optional()
      .describe('目标 sheet 名称（与 sheetIndex 二选一，默认第一个 sheet）'),
    sheetIndex: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('目标 sheet 索引（0-based，与 sheetName 二选一）'),
    range: z
      .string()
      .optional()
      .describe('单元格范围，A1 表示法（如 "A1:Z100"，read-cells 时必填）'),
    offset: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('行偏移量（read-sheet 时可选，默认 0）'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(500)
      .optional()
      .describe('读取行数上限（read-sheet 时可选，默认 100，最大 500）'),
    outputPath: z
      .string()
      .optional()
      .describe('输出文件路径（export-csv 时可选，不填则返回 CSV 内容）'),
    includeHeaders: z
      .boolean()
      .optional()
      .describe('是否包含表头行（read-sheet 时可选，默认 true）'),
  }),
  component: null,
} as const

export const excelMutateToolDef = {
  id: 'excel-mutate',
  name: 'Excel 操作',
  description:
    '触发：当你需要创建 Excel 文件、写入数据、添加/重命名/删除 sheet、设置公式、导入 CSV 时调用。用途：执行 Excel 文件变更操作。返回：{ ok: true, data: { action, ... } }。不适用：仅需读取 Excel 时不要使用，改用 excel-query。',
  parameters: z.object({
    actionName: z
      .string()
      .min(1)
      .describe('由调用的 LLM 传入，用于说明本次工具调用目的，例如：创建销售报表。'),
    action: z
      .enum([
        'create',
        'write-cells',
        'add-sheet',
        'rename-sheet',
        'delete-sheet',
        'set-formula',
        'import-csv',
        'save-as',
      ])
      .describe(
        '操作类型：create 创建新工作簿，write-cells 写入单元格数据，add-sheet 添加新 sheet，rename-sheet 重命名 sheet，delete-sheet 删除 sheet，set-formula 设置单元格公式，import-csv 从 CSV 导入数据，save-as 另存为新路径',
      ),
    filePath: z
      .string()
      .optional()
      .describe('Excel 文件路径（create 时为新文件路径，其他操作时为已有文件路径）'),
    sheetName: z
      .string()
      .optional()
      .describe('目标 sheet 名称'),
    range: z
      .string()
      .optional()
      .describe('起始单元格位置，A1 表示法（如 "A1"，write-cells/set-formula 时使用）'),
    data: z
      .array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])))
      .optional()
      .describe('二维数组数据（write-cells/create 时使用，如 [["Name","Age"],["Alice",30]]）'),
    newSheetName: z
      .string()
      .optional()
      .describe('新 sheet 名称（add-sheet/rename-sheet 时使用）'),
    formula: z
      .string()
      .optional()
      .describe('Excel 公式（set-formula 时使用，如 "SUM(A1:A10)"，不含前导 =）'),
    csvContent: z
      .string()
      .optional()
      .describe('CSV 文本内容（import-csv 时使用，与 csvFilePath 二选一）'),
    csvFilePath: z
      .string()
      .optional()
      .describe('CSV 文件路径（import-csv 时使用，与 csvContent 二选一）'),
    outputPath: z
      .string()
      .optional()
      .describe('输出文件路径（save-as 时必填）'),
    delimiter: z
      .string()
      .optional()
      .describe('CSV 分隔符（import-csv 时可选，默认逗号）'),
  }),
  needsApproval: true,
  component: null,
} as const
