---
name: office-document-development
description: >
  Use when developing, extending, or debugging the Office document system —
  Word (DOCX), Excel (XLSX), PowerPoint (PPTX) tool implementations,
  shared engine (ZIP streaming, XPath XML editing, structure parsing, OOXML namespaces),
  or fixing document create/read/edit issues
---

## Overview

Office 文档系统基于**流式 ZIP + XPath + XML 编辑**的统一方案，支持 DOCX/XLSX/PPTX 三种格式的创建、读取和编辑。架构分为两层：

- **引擎层**（`office/`）— 格式无关的 ZIP I/O、XPath XML 编辑、OOXML 命名空间、文档结构解析
- **工具层**（`*Tools.ts`）— 格式特定的 AI 工具定义，封装创建模板和查询/变更逻辑

## When to Use

- 添加或修改 Word/Excel/PowerPoint AI 工具
- 修改 ZIP 文件的读写/编辑逻辑
- 修改 XPath XML 编辑器或命名空间映射
- 修改文档结构解析器（段落/表格/Sheet/Slide 提取）
- 添加新的 Office 格式支持
- 调试文档创建、读取、编辑中的问题
- 处理旧格式（.doc/.xls/.ppt）兼容性

### 1. OfficeEdit 操作类型

所有文档编辑通过 `OfficeEdit` 联合类型表达：

- `path` 是 ZIP 内部的 entry 路径（如 `word/document.xml`、`xl/worksheets/sheet1.xml`）
- `xpath` 必须使用**命名空间前缀**（见下方命名空间规则）
- `xml` 是替换/插入的 XML 片段（会被自动包裹命名空间声明后解析）

### 2. OOXML 命名空间规则

**这是最常见的错误来源。** XPath 查询必须使用命名空间前缀。

| 前缀 | 命名空间 | 用途 |
|------|---------|------|
| `w` | wordprocessingml/2006/main | Word 文档元素（`w:p`、`w:r`、`w:t`、`w:tbl`） |
| `x` | spreadsheetml/2006/main | Excel 元素（`x:row`、`x:c`、`x:v`） |
| `p` | presentationml/2006/main | PowerPoint 元素（`p:sld`、`p:sp`、`p:cSld`） |
| `a` | drawingml/2006/main | DrawingML 元素（`a:p`、`a:r`、`a:t`） |
| `r` | officeDocument/2006/relationships | 关系引用 |

**自动检测规则**（`detectNamespaces(entryPath)`）：
- `word/*` → w, wp, a, pic, r
- `xl/*` → x, a, r
- `ppt/*` → p, a, pic, r
- `[Content_Types].xml` → ct, r

**关键注意**：即使 XML 文档使用默认命名空间（无前缀），XPath 查询仍必须使用前缀。例如 XLSX 的 `<worksheet xmlns="..."><sheetData><row>` 在 XPath 中是 `//x:row`，不是 `//row`。

### 3. 文档创建模板

每种格式的 `create` action 生成最小有效的 OOXML ZIP 包：

| 格式 | 核心 entry | 必需 entry |
|------|-----------|-----------|
| DOCX | `word/document.xml` | `[Content_Types].xml`、`_rels/.rels`、`word/_rels/document.xml.rels`、`word/styles.xml`、`word/numbering.xml` |
| XLSX | `xl/worksheets/sheet1.xml` | `[Content_Types].xml`、`_rels/.rels`、`xl/_rels/workbook.xml.rels`、`xl/workbook.xml`、`xl/styles.xml`、`xl/sharedStrings.xml` |
| PPTX | `ppt/slides/slide{N}.xml` | `[Content_Types].xml`、`_rels/.rels`、`ppt/_rels/presentation.xml.rels`、`ppt/presentation.xml`、`ppt/theme/theme1.xml`、`ppt/slideMasters/slideMaster1.xml`、`ppt/slideLayouts/slideLayout1.xml` + 各 rels |

### 4. 旧格式处理

| 旧格式 | 处理方式 | read-structure | read-text | 编辑 |
|--------|---------|---------------|-----------|------|
| `.doc` | officeparser 提取文本 | ok=false（提示升级） | ok=true（纯文本） | 不支持 |
| `.xls` | SheetJS 自动转换为 .xlsx 临时文件 | ok=true（转换后解析） | ok=true | 不支持 |
| `.ppt` | officeparser 提取文本 | ok=false（提示升级） | ok=true（纯文本） | 不支持 |

### 2. 替换 XML 片段的命名空间不匹配

对于使用默认命名空间的文档（如 XLSX），替换整个元素（含 xmlns）比替换内部子元素更安全：

### 3. editZip 的 path 与 xpath 混淆

- `path` — ZIP entry 路径（如 `word/document.xml`）
- `xpath` — 在该 XML entry 内的 XPath 表达式

### 5. 忽略 read-xml 步骤直接写 XPath

**必须先 `read-xml` 查看实际 XML 结构**，再构造 XPath。文档的 XML 结构可能与预期不同（嵌套层级、命名空间、属性名）。

## Testing

测试脚本：

测试使用自定义 Node.js 原生测试运行器（`node:assert/strict`），无外部 fixture 文件——所有测试数据通过代码生成（`createZip` + XML 模板字符串 或 `tool.execute({ action: 'create' })`）。

## Skill Sync Policy

**当以下文件发生变更时，应检查并同步更新本 skill：**

| 变更范围 | 影响 |
|----------|------|
| `office/types.ts` OfficeEdit 类型变更 | 更新操作类型文档 |
| `office/namespaces.ts` 命名空间变更 | 更新命名空间规则表 |
| `office/streamingZip.ts` API 变更 | 更新架构图和 API 说明 |
| `office/structureParser.ts` 解析逻辑变更 | 更新结构输出说明 |
| `wordTools.ts` / `excelTools.ts` / `pptxTools.ts` 工具变更 | 更新工具参数和模板 |
| `packages/api/src/types/tools/word.ts` 等 schema 变更 | 更新参数验证说明 |
| 新增 Office 格式支持 | 添加对应章节 |
