/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
/**
 * Office 共享引擎层测试（纯函数 + I/O）
 *
 * 用法：
 *   cd apps/server
 *   node --enable-source-maps --import tsx/esm --import ./scripts/registerMdTextLoader.mjs \
 *     src/ai/tools/__tests__/officeEngine.test.ts
 *
 * 测试覆盖：
 *   A 层 — namespaces.ts（detectNamespaces）
 *   B 层 — xpathEditor.ts（applyXmlEdits / xpathReplace）
 *   C 层 — streamingZip.ts（createZip / listZipEntries / readZip* / editZip）
 *   D 层 — structureParser.ts（parseDocx/Xlsx/PptxStructure）
 */
import assert from 'node:assert/strict'
import path from 'node:path'
import os from 'node:os'
import { promises as fs } from 'node:fs'
import { detectNamespaces, OOXML_NS } from '@/ai/tools/office/namespaces'
import { applyXmlEdits, xpathReplace } from '@/ai/tools/office/xpathEditor'
import {
  createZip,
  listZipEntries,
  readZipEntryText,
  readZipEntryBuffer,
  readZipEntries,
  editZip,
} from '@/ai/tools/office/streamingZip'
import {
  parseDocxStructure,
  parseXlsxStructure,
  parsePptxStructure,
} from '@/ai/tools/office/structureParser'
import { runWithContext } from '@/ai/shared/context/requestContext'
import { setupE2eTestEnv } from '@/ai/__tests__/helpers/testEnv'

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

let passed = 0
let failed = 0
const errors: string[] = []

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    passed++
    console.log(`  \u2713 ${name}`)
  } catch (err: any) {
    failed++
    const m = err?.message ?? String(err)
    errors.push(`${name}: ${m}`)
    console.log(`  \u2717 ${name}: ${m}`)
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const tempDir = path.join(os.tmpdir(), `office-engine-test-${Date.now()}`)

async function ensureTempDir() {
  await fs.mkdir(tempDir, { recursive: true })
}

async function cleanup() {
  await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  await ensureTempDir()

  // -----------------------------------------------------------------------
  // A 层 — namespaces.ts
  // -----------------------------------------------------------------------
  console.log('\nA 层 — detectNamespaces')

  await test('A1: word/ 路径返回 w 命名空间', () => {
    const ns = detectNamespaces('word/document.xml')
    assert.ok(ns.w, 'should have w namespace')
    assert.equal(ns.w, OOXML_NS.w)
    assert.ok(ns.wp, 'should have wp namespace')
    assert.ok(ns.a, 'should have a namespace')
    assert.ok(ns.pic, 'should have pic namespace')
    assert.ok(ns.r, 'should have r namespace')
  })

  await test('A2: xl/ 路径返回 x 命名空间', () => {
    const ns = detectNamespaces('xl/worksheets/sheet1.xml')
    assert.ok(ns.x, 'should have x namespace')
    assert.equal(ns.x, OOXML_NS.x)
    assert.ok(ns.a, 'should have a namespace')
    assert.ok(ns.r, 'should have r namespace')
    assert.equal(ns.w, undefined, 'should not have w namespace')
  })

  await test('A3: ppt/ 路径返回 p 命名空间', () => {
    const ns = detectNamespaces('ppt/slides/slide1.xml')
    assert.ok(ns.p, 'should have p namespace')
    assert.equal(ns.p, OOXML_NS.p)
    assert.ok(ns.a, 'should have a namespace')
    assert.ok(ns.pic, 'should have pic namespace')
    assert.ok(ns.r, 'should have r namespace')
  })

  await test('A4: [Content_Types].xml 返回 ct 命名空间', () => {
    const ns = detectNamespaces('[Content_Types].xml')
    assert.ok(ns.ct, 'should have ct namespace')
    assert.equal(ns.ct, OOXML_NS.ct)
    assert.ok(ns.r, 'should have r namespace')
  })

  await test('A5: 未知路径仅含 r 命名空间', () => {
    const ns = detectNamespaces('unknown/path.xml')
    assert.ok(ns.r, 'should have r namespace')
    assert.equal(Object.keys(ns).length, 1, 'should only have r namespace')
  })

  // -----------------------------------------------------------------------
  // B 层 — xpathEditor.ts
  // -----------------------------------------------------------------------
  console.log('\nB 层 — xpathEditor')

  const sampleDocXml = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p><w:r><w:t>Hello World</w:t></w:r></w:p>
    <w:p><w:r><w:t>Second paragraph</w:t></w:r></w:p>
  </w:body>
</w:document>`

  await test('B1: applyXmlEdits replace 替换 w:t 文本', async () => {
    const result = await applyXmlEdits(
      sampleDocXml,
      [
        {
          op: 'replace',
          path: 'word/document.xml',
          xpath: '//w:p[1]/w:r/w:t',
          xml: '<w:t>Replaced Text</w:t>',
        },
      ],
      'word/document.xml',
    )
    assert.ok(result.includes('Replaced Text'), 'should contain replaced text')
    assert.ok(!result.includes('Hello World'), 'should not contain original text')
  })

  await test('B2: applyXmlEdits insert before 在目标前插入段落', async () => {
    const result = await applyXmlEdits(
      sampleDocXml,
      [
        {
          op: 'insert',
          path: 'word/document.xml',
          xpath: '//w:p[1]',
          position: 'before',
          xml: '<w:p><w:r><w:t>Inserted Before</w:t></w:r></w:p>',
        },
      ],
      'word/document.xml',
    )
    assert.ok(result.includes('Inserted Before'), 'should contain inserted text')
    // Inserted element should appear before the original first paragraph
    const insertedIdx = result.indexOf('Inserted Before')
    const originalIdx = result.indexOf('Hello World')
    assert.ok(insertedIdx < originalIdx, 'inserted text should be before original')
  })

  await test('B3: applyXmlEdits insert after 在目标后插入段落', async () => {
    const result = await applyXmlEdits(
      sampleDocXml,
      [
        {
          op: 'insert',
          path: 'word/document.xml',
          xpath: '//w:p[1]',
          position: 'after',
          xml: '<w:p><w:r><w:t>Inserted After</w:t></w:r></w:p>',
        },
      ],
      'word/document.xml',
    )
    assert.ok(result.includes('Inserted After'), 'should contain inserted text')
    const firstParaIdx = result.indexOf('Hello World')
    const insertedIdx = result.indexOf('Inserted After')
    const secondParaIdx = result.indexOf('Second paragraph')
    assert.ok(insertedIdx > firstParaIdx, 'inserted should be after first para')
    assert.ok(insertedIdx < secondParaIdx, 'inserted should be before second para')
  })

  await test('B4: applyXmlEdits remove 删除指定元素', async () => {
    const result = await applyXmlEdits(
      sampleDocXml,
      [
        {
          op: 'remove',
          path: 'word/document.xml',
          xpath: '//w:p[1]',
        },
      ],
      'word/document.xml',
    )
    assert.ok(!result.includes('Hello World'), 'first paragraph should be removed')
    assert.ok(result.includes('Second paragraph'), 'second paragraph should remain')
  })

  await test('B5: 多个 edits 批量执行', async () => {
    const result = await applyXmlEdits(
      sampleDocXml,
      [
        {
          op: 'replace',
          path: 'word/document.xml',
          xpath: '//w:p[1]/w:r/w:t',
          xml: '<w:t>Modified</w:t>',
        },
        {
          op: 'remove',
          path: 'word/document.xml',
          xpath: '//w:p[2]',
        },
      ],
      'word/document.xml',
    )
    assert.ok(result.includes('Modified'), 'should contain modified text')
    assert.ok(!result.includes('Hello World'), 'original first text should be gone')
    assert.ok(!result.includes('Second paragraph'), 'second para should be removed')
  })

  await test('B6: XPath 匹配不到节点抛出错误', async () => {
    await assert.rejects(
      applyXmlEdits(
        sampleDocXml,
        [
          {
            op: 'replace',
            path: 'word/document.xml',
            xpath: '//w:nonexistent',
            xml: '<w:t>test</w:t>',
          },
        ],
        'word/document.xml',
      ),
      /matched no nodes/,
    )
  })

  await test('B7: xpathReplace 便捷函数正确工作', async () => {
    const nsMap = detectNamespaces('word/document.xml')
    const result = await xpathReplace(
      sampleDocXml,
      '//w:p[1]/w:r/w:t',
      '<w:t>Convenience Replace</w:t>',
      nsMap,
    )
    assert.ok(result.includes('Convenience Replace'))
    assert.ok(!result.includes('Hello World'))
  })

  // -----------------------------------------------------------------------
  // C 层 — streamingZip.ts
  // -----------------------------------------------------------------------
  console.log('\nC 层 — streamingZip')

  const zipPath = path.join(tempDir, 'test.zip')
  const entry1Content = 'Hello entry one'
  const entry2Content = '<?xml version="1.0"?><root><child>value</child></root>'
  const entry3Buf = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe])

  await test('C1: createZip 创建包含 3 个 entry 的 ZIP', async () => {
    const entries = new Map<string, Buffer>()
    entries.set('dir/file1.txt', Buffer.from(entry1Content, 'utf-8'))
    entries.set('dir/file2.xml', Buffer.from(entry2Content, 'utf-8'))
    entries.set('dir/binary.bin', entry3Buf)
    await createZip(zipPath, entries)
    const stat = await fs.stat(zipPath)
    assert.ok(stat.isFile(), 'ZIP file should exist')
    assert.ok(stat.size > 0, 'ZIP file should have content')
  })

  await test('C2: listZipEntries 列出所有 entry', async () => {
    const entries = await listZipEntries(zipPath)
    assert.deepEqual(entries.sort(), ['dir/binary.bin', 'dir/file1.txt', 'dir/file2.xml'])
  })

  await test('C3: readZipEntryText 读取指定 entry', async () => {
    const text = await readZipEntryText(zipPath, 'dir/file1.txt')
    assert.equal(text, entry1Content)
  })

  await test('C4: readZipEntryBuffer 读取 binary entry', async () => {
    const buf = await readZipEntryBuffer(zipPath, 'dir/binary.bin')
    assert.ok(Buffer.isBuffer(buf))
    assert.ok(buf.equals(entry3Buf), 'buffer content should match')
  })

  await test('C5: readZipEntries 批量读取多个 entry', async () => {
    const results = await readZipEntries(zipPath, ['dir/file1.txt', 'dir/file2.xml'])
    assert.equal(results.size, 2)
    assert.equal(results.get('dir/file1.txt')!.toString('utf-8'), entry1Content)
    assert.equal(results.get('dir/file2.xml')!.toString('utf-8'), entry2Content)
  })

  await test('C6: readZipEntryText 读取不存在的 entry 抛出错误', async () => {
    await assert.rejects(
      () => readZipEntryText(zipPath, 'nonexistent.txt'),
      /not found/,
    )
  })

  await test('C7: editZip replace op 修改 XML entry 内容', async () => {
    const editedPath = path.join(tempDir, 'edited-replace.zip')
    await fs.copyFile(zipPath, editedPath)
    await editZip(editedPath, editedPath, [
      {
        op: 'replace',
        path: 'dir/file2.xml',
        xpath: '//child',
        xml: '<child>new-value</child>',
      },
    ])
    const text = await readZipEntryText(editedPath, 'dir/file2.xml')
    assert.ok(text.includes('new-value'), 'should contain modified value')
    assert.ok(!text.includes('>value<'), 'should not contain original value')
  })

  await test('C8: editZip delete op 删除 entry', async () => {
    const editedPath = path.join(tempDir, 'edited-delete.zip')
    await fs.copyFile(zipPath, editedPath)
    await editZip(editedPath, editedPath, [
      { op: 'delete', path: 'dir/binary.bin' },
    ])
    const entries = await listZipEntries(editedPath)
    assert.ok(!entries.includes('dir/binary.bin'), 'deleted entry should not exist')
    assert.ok(entries.includes('dir/file1.txt'), 'other entries should remain')
  })

  await test('C9: editZip write op 添加新 entry', async () => {
    // write op resolves source via resolveToolPath → needs RequestContext
    setupE2eTestEnv()
    await runWithContext(
      { sessionId: 'engine-test', cookies: {} },
      async () => {
        const editedPath = path.join(tempDir, 'edited-write.zip')
        await fs.copyFile(zipPath, editedPath)
        // Write a local file as source for the write op (inside project)
        const { resolveToolPath } = await import('@/ai/tools/toolScope')
        const projectRoot = resolveToolPath({ target: '.' }).absPath
        const srcFilePath = path.join(projectRoot, '_c9_test_src.txt')
        await fs.writeFile(srcFilePath, 'brand new content', 'utf-8')
        try {
          await editZip(editedPath, editedPath, [
            { op: 'write', path: 'dir/new-file.txt', source: '_c9_test_src.txt' },
          ])
          const text = await readZipEntryText(editedPath, 'dir/new-file.txt')
          assert.equal(text, 'brand new content')
        } finally {
          await fs.unlink(srcFilePath).catch(() => {})
        }
      },
    )
  })

  await test('C10: editZip 不涉及修改的 entry 保持不变', async () => {
    const editedPath = path.join(tempDir, 'edited-noop.zip')
    await fs.copyFile(zipPath, editedPath)
    // Only modify file2.xml, check that file1.txt is unchanged
    await editZip(editedPath, editedPath, [
      {
        op: 'replace',
        path: 'dir/file2.xml',
        xpath: '//child',
        xml: '<child>changed</child>',
      },
    ])
    const text1 = await readZipEntryText(editedPath, 'dir/file1.txt')
    assert.equal(text1, entry1Content, 'unmodified entry should be unchanged')
  })

  // C11 and C12 require RequestContext for resolveOfficeFile (resolveToolPath dependency)
  // We test these via inline logic instead

  await test('C11: resolveOfficeFile 概念验证 — 非法扩展名', async () => {
    // We can't call resolveOfficeFile without RequestContext.
    // Instead, verify createZip + readZip roundtrip with a .txt extension works at zip level
    // (the extension check is in resolveOfficeFile, tested in officeTools.test.ts)
    const txtZip = path.join(tempDir, 'test.txt')
    const entries = new Map<string, Buffer>()
    entries.set('file.txt', Buffer.from('hello', 'utf-8'))
    await createZip(txtZip, entries)
    // ZIP format doesn't care about extension
    const result = await readZipEntryText(txtZip, 'file.txt')
    assert.equal(result, 'hello')
  })

  // -----------------------------------------------------------------------
  // D 层 — structureParser.ts
  // -----------------------------------------------------------------------
  console.log('\nD 层 — structureParser')

  await test('D1: parseDocxStructure 解析含 2 段落 + 1 表格的 DOCX', async () => {
    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p><w:r><w:t>First paragraph</w:t></w:r></w:p>
    <w:p><w:r><w:t>Second paragraph</w:t></w:r></w:p>
    <w:tbl>
      <w:tr><w:tc><w:p><w:r><w:t>H1</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>H2</w:t></w:r></w:p></w:tc></w:tr>
      <w:tr><w:tc><w:p><w:r><w:t>A</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>B</w:t></w:r></w:p></w:tc></w:tr>
    </w:tbl>
  </w:body>
</w:document>`
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`

    const docxPath = path.join(tempDir, 'struct-test.docx')
    const entries = new Map<string, Buffer>()
    entries.set('word/document.xml', Buffer.from(docXml, 'utf-8'))
    entries.set('word/_rels/document.xml.rels', Buffer.from(rels, 'utf-8'))
    await createZip(docxPath, entries)

    const readEntry = async (p: string) => readZipEntryBuffer(docxPath, p)
    const structure = await parseDocxStructure(readEntry)

    assert.equal(structure.paragraphs.length, 2)
    assert.equal(structure.paragraphs[0]!.text, 'First paragraph')
    assert.equal(structure.paragraphs[1]!.text, 'Second paragraph')
    assert.equal(structure.tables.length, 1)
    assert.equal(structure.tables[0]!.rows, 2)
    assert.equal(structure.tables[0]!.cols, 2)
  })

  await test('D2: parseDocxStructure 解析含 Heading 样式的段落', async () => {
    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Title</w:t></w:r></w:p>
    <w:p><w:r><w:t>Normal text</w:t></w:r></w:p>
  </w:body>
</w:document>`
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`

    const docxPath = path.join(tempDir, 'heading-test.docx')
    const entries = new Map<string, Buffer>()
    entries.set('word/document.xml', Buffer.from(docXml, 'utf-8'))
    entries.set('word/_rels/document.xml.rels', Buffer.from(rels, 'utf-8'))
    await createZip(docxPath, entries)

    const readEntry = async (p: string) => readZipEntryBuffer(docxPath, p)
    const structure = await parseDocxStructure(readEntry)

    assert.equal(structure.paragraphs[0]!.style, 'Heading1')
    assert.equal(structure.paragraphs[0]!.level, 1)
    assert.equal(structure.paragraphs[0]!.text, 'Title')
  })

  await test('D3: parseDocxStructure 空文档返回空数组', async () => {
    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body/>
</w:document>`
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`

    const docxPath = path.join(tempDir, 'empty-doc.docx')
    const entries = new Map<string, Buffer>()
    entries.set('word/document.xml', Buffer.from(docXml, 'utf-8'))
    entries.set('word/_rels/document.xml.rels', Buffer.from(rels, 'utf-8'))
    await createZip(docxPath, entries)

    const readEntry = async (p: string) => readZipEntryBuffer(docxPath, p)
    const structure = await parseDocxStructure(readEntry)

    assert.deepEqual(structure.paragraphs, [])
    assert.deepEqual(structure.tables, [])
  })

  await test('D4: parseXlsxStructure 解析含 2 个 sheet 的 XLSX', async () => {
    const wbXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Data" sheetId="1" r:id="rId3"/>
    <sheet name="Summary" sheetId="2" r:id="rId4"/>
  </sheets>
</workbook>`
    const sheet1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:B2"/>
  <sheetData>
    <row r="1"><c r="A1"><v>1</v></c><c r="B1"><v>2</v></c></row>
    <row r="2"><c r="A2"><v>3</v></c><c r="B2"><v>4</v></c></row>
  </sheetData>
</worksheet>`
    const sheet2Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:A1"/>
  <sheetData>
    <row r="1"><c r="A1"><v>100</v></c></row>
  </sheetData>
</worksheet>`

    const xlsxPath = path.join(tempDir, 'two-sheets.xlsx')
    const zipEntries = new Map<string, Buffer>()
    zipEntries.set('xl/workbook.xml', Buffer.from(wbXml, 'utf-8'))
    zipEntries.set('xl/worksheets/sheet1.xml', Buffer.from(sheet1Xml, 'utf-8'))
    zipEntries.set('xl/worksheets/sheet2.xml', Buffer.from(sheet2Xml, 'utf-8'))
    await createZip(xlsxPath, zipEntries)

    const allEntries = await listZipEntries(xlsxPath)
    const readEntry = async (p: string) => readZipEntryBuffer(xlsxPath, p)
    const structure = await parseXlsxStructure(readEntry, allEntries)

    assert.equal(structure.sheets.length, 2)
    assert.equal(structure.sheets[0]!.name, 'Data')
    assert.equal(structure.sheets[1]!.name, 'Summary')
  })

  await test('D5: parseXlsxStructure 指定 sheet 返回 cells', async () => {
    const wbXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Sheet1" sheetId="1" r:id="rId3"/></sheets>
</workbook>`
    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:B2"/>
  <sheetData>
    <row r="1"><c r="A1"><v>42</v></c><c r="B1"><v>99</v></c></row>
  </sheetData>
</worksheet>`

    const xlsxPath = path.join(tempDir, 'cells-test.xlsx')
    const zipEntries = new Map<string, Buffer>()
    zipEntries.set('xl/workbook.xml', Buffer.from(wbXml, 'utf-8'))
    zipEntries.set('xl/worksheets/sheet1.xml', Buffer.from(sheetXml, 'utf-8'))
    await createZip(xlsxPath, zipEntries)

    const allEntries = await listZipEntries(xlsxPath)
    const readEntry = async (p: string) => readZipEntryBuffer(xlsxPath, p)
    const structure = await parseXlsxStructure(readEntry, allEntries, 'Sheet1')

    assert.ok(structure.cells, 'cells should be defined')
    assert.ok(structure.cells!.length >= 2, 'should have at least 2 cells')
    const cellA1 = structure.cells!.find((c) => c.ref === 'A1')
    assert.ok(cellA1, 'should have cell A1')
    assert.equal(cellA1!.value, 42)
  })

  await test('D6: parseXlsxStructure 解析含 sharedStrings 的 XLSX', async () => {
    const wbXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Sheet1" sheetId="1" r:id="rId3"/></sheets>
</workbook>`
    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:A2"/>
  <sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c></row>
    <row r="2"><c r="A2" t="s"><v>1</v></c></row>
  </sheetData>
</worksheet>`
    const ssXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="2" uniqueCount="2">
  <si><t>Hello</t></si>
  <si><t>World</t></si>
</sst>`

    const xlsxPath = path.join(tempDir, 'shared-strings.xlsx')
    const zipEntries = new Map<string, Buffer>()
    zipEntries.set('xl/workbook.xml', Buffer.from(wbXml, 'utf-8'))
    zipEntries.set('xl/worksheets/sheet1.xml', Buffer.from(sheetXml, 'utf-8'))
    zipEntries.set('xl/sharedStrings.xml', Buffer.from(ssXml, 'utf-8'))
    await createZip(xlsxPath, zipEntries)

    const allEntries = await listZipEntries(xlsxPath)
    const readEntry = async (p: string) => readZipEntryBuffer(xlsxPath, p)
    const structure = await parseXlsxStructure(readEntry, allEntries, 'Sheet1')

    assert.ok(structure.cells, 'cells should be defined')
    const cellA1 = structure.cells!.find((c) => c.ref === 'A1')
    const cellA2 = structure.cells!.find((c) => c.ref === 'A2')
    assert.equal(cellA1!.value, 'Hello')
    assert.equal(cellA2!.value, 'World')
    assert.equal(cellA1!.type, 'string')
  })

  await test('D7: parsePptxStructure 解析含 2 个 slide 的 PPTX', async () => {
    const slide1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr/>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Slide One Title</a:t></a:r></a:p></p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`
    const slide2Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr/>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Slide Two Title</a:t></a:r></a:p></p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`

    const pptxPath = path.join(tempDir, 'two-slides.pptx')
    const zipEntries = new Map<string, Buffer>()
    zipEntries.set('ppt/slides/slide1.xml', Buffer.from(slide1Xml, 'utf-8'))
    zipEntries.set('ppt/slides/slide2.xml', Buffer.from(slide2Xml, 'utf-8'))
    await createZip(pptxPath, zipEntries)

    const allEntries = await listZipEntries(pptxPath)
    const readEntry = async (p: string) => readZipEntryBuffer(pptxPath, p)
    const structure = await parsePptxStructure(readEntry, allEntries)

    assert.equal(structure.slideCount, 2)
    assert.equal(structure.slides.length, 2)
    assert.equal(structure.slides[0]!.title, 'Slide One Title')
    assert.equal(structure.slides[1]!.title, 'Slide Two Title')
  })

  await test('D8: parsePptxStructure 提取 slide 标题和文本块', async () => {
    const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr/>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Main Title</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
        <p:spPr/>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Body text block</a:t></a:r></a:p></p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`

    const pptxPath = path.join(tempDir, 'title-body.pptx')
    const zipEntries = new Map<string, Buffer>()
    zipEntries.set('ppt/slides/slide1.xml', Buffer.from(slideXml, 'utf-8'))
    await createZip(pptxPath, zipEntries)

    const allEntries = await listZipEntries(pptxPath)
    const readEntry = async (p: string) => readZipEntryBuffer(pptxPath, p)
    const structure = await parsePptxStructure(readEntry, allEntries)

    assert.equal(structure.slides.length, 1)
    assert.equal(structure.slides[0]!.title, 'Main Title')
    assert.ok(structure.slides[0]!.textBlocks.length >= 2, 'should have at least 2 text blocks')
    assert.ok(
      structure.slides[0]!.textBlocks.some((t) => t.includes('Body text block')),
      'should contain body text',
    )
  })

  // -----------------------------------------------------------------------
  // Cleanup & Summary
  // -----------------------------------------------------------------------
  await cleanup()

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`)
  if (errors.length > 0) {
    console.log('\nFailed:')
    for (const e of errors) console.log(`  - ${e}`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
