# Test Patterns Reference

详细代码模板，供 AI 创建测试时直接复制使用。

## 服务端完整测试模板

```typescript
/**
 * <模块名> comprehensive tests.
 *
 * 用法：
 *   cd apps/server
 *   node --enable-source-maps --import tsx/esm --import ./scripts/registerMdTextLoader.mjs \
 *     src/<module>/__tests__/<name>.test.ts
 */
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { setOpenLoafRootOverride } from '@openloaf/config'
import { prisma } from '@openloaf/db'
// ... 业务模块导入

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

const testSessionId = `test_<prefix>_${crypto.randomUUID()}`
let tempDir: string

// 按需定义 helper 函数（构造测试数据等）

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // ---- Setup ----
  tempDir = path.join(os.tmpdir(), `<prefix>_test_${Date.now()}`)
  await fs.mkdir(tempDir, { recursive: true })
  setOpenLoafRootOverride(tempDir)

  // 如需 DB 隔离：
  // await prisma.chatSession.create({ data: { id: testSessionId } })

  try {
    // =================================================================
    // A layer: pure functions
    // =================================================================
    console.log('\n--- A layer: pure functions ---')

    await test('A1: 描述', () => {
      // 手动构造输入，调用纯函数，assert 结果
      assert.equal(actual, expected)
    })

    // =================================================================
    // B layer: file/DB operations
    // =================================================================
    console.log('\n--- B layer: file operations ---')

    await test('B1: 描述', async () => {
      // 涉及文件读写或 DB 操作
    })

    // =================================================================
    // C layer: integration
    // =================================================================
    console.log('\n--- C layer: integration ---')

    await test('C1: 描述', async () => {
      // 端到端流程测试
    })
  } finally {
    // ---- Teardown ----
    // await prisma.chatSession.delete({ where: { id: testSessionId } }).catch(() => {})
    setOpenLoafRootOverride(null)
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }

  // ---- Summary ----
  console.log(`\n${passed} passed, ${failed} failed`)
  if (errors.length > 0) {
    console.log('\nFailed tests:')
    for (const e of errors) console.log(`  - ${e}`)
  }
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

## Web 端完整测试模板

```typescript
import { describe, expect, it } from 'vitest'

import {
  functionA,
  functionB,
} from '../my-module'

// ---------------------------------------------------------------------------
// A: functionA
// ---------------------------------------------------------------------------
describe('functionA', () => {
  it('A1: 正常输入 -> 预期输出', () => {
    expect(functionA({ key: 'value' })).toBe('expected')
  })

  it('A2: 边界情况 -> 安全处理', () => {
    expect(functionA({ key: '' })).toBeNull()
  })

  it('A3: 空输入 -> 默认值', () => {
    expect(functionA({})).toBe('default')
  })
})

// ---------------------------------------------------------------------------
// B: functionB
// ---------------------------------------------------------------------------
describe('functionB', () => {
  const fixtures = [
    { id: 'u1', role: 'user' },
    { id: 'a1', role: 'assistant' },
  ]

  it('B1: 描述', () => {
    expect(functionB({ messages: fixtures })).toBe('u1')
  })
})
```

Vitest 配置要点（`apps/web/vitest.config.ts`）：
- 环境：`jsdom`
- 匹配：`src/**/*.vitest.ts`, `src/**/*.vitest.tsx`
- 别名：`@/` → `./src/`, `@openloaf/ui` → `packages/ui/src`

## 环境隔离代码片段

### 临时目录 + Root Override

```typescript
import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { setOpenLoafRootOverride } from '@openloaf/config'

// Setup
const tempDir = path.join(os.tmpdir(), `mytest_${Date.now()}`)
await fs.mkdir(tempDir, { recursive: true })
setOpenLoafRootOverride(tempDir)

// Teardown（必须在 finally 中）
setOpenLoafRootOverride(null)
await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
```

### DB Session 隔离

```typescript
import crypto from 'node:crypto'
import { prisma } from '@openloaf/db'

const testSessionId = `test_${crypto.randomUUID()}`

// Setup
await prisma.chatSession.create({ data: { id: testSessionId } })

// Teardown
await prisma.chatSession.delete({ where: { id: testSessionId } }).catch(() => {})
```

### 缓存清除

切换 `setOpenLoafRootOverride` 后，如果被测模块有内部缓存，需要手动清除：

```typescript
import { clearSessionDirCache } from '@/ai/services/chat/repositories/chatFileStore'

setOpenLoafRootOverride(tempDir)
clearSessionDirCache()  // 重要：否则缓存指向旧路径
```

## 并发测试模式

验证 mutex/锁机制是否正确工作：

```typescript
await test('concurrent writes via mutex', async () => {
  const sid = `test_conc_${crypto.randomUUID()}`
  await prisma.chatSession.create({ data: { id: sid } })
  registerSessionDir(sid)

  // 并发写入 10 条消息
  const promises = Array.from({ length: 10 }, (_, i) =>
    appendMessage({ sessionId: sid, message: msg(`conc${i}`, null) }),
  )
  await Promise.all(promises)

  // 验证全部写入成功
  const tree = await loadMessageTree(sid)
  assert.equal(tree.byId.size, 10)

  // 清理
  await deleteSessionFiles(sid)
  await prisma.chatSession.delete({ where: { id: sid } }).catch(() => {})
})
```

## 纯函数提取示例

### 提取前（组件内嵌逻辑）

```tsx
// ChatCoreProvider.tsx 第 792-810 行
const handleSend = (opts) => {
  let parentId: string | null
  if (opts.parentMessageId !== undefined) {
    parentId = opts.parentMessageId
  } else if (messages.length === 0) {
    parentId = null
  } else {
    const last = messages.at(-1)?.id ?? null
    const isLeafInCurrent = leafMessageId && messages.some(m => m.id === leafMessageId)
    parentId = (isLeafInCurrent ? leafMessageId : null) ?? last
  }
  // ...
}
```

### 提取后（独立纯函数）

```typescript
// branch-utils.ts
export function resolveParentMessageId(input: {
  explicitParentMessageId: string | null | undefined
  leafMessageId: string | null
  messages: Array<{ id: string }>
}): string | null {
  const { explicitParentMessageId, leafMessageId, messages } = input
  if (explicitParentMessageId !== undefined) return explicitParentMessageId
  if (messages.length === 0) return null
  const lastMessageId = String(messages.at(-1)?.id ?? '') || null
  const isLeafInCurrentMessages =
    typeof leafMessageId === 'string' &&
    leafMessageId.length > 0 &&
    messages.some((m) => String(m.id) === leafMessageId)
  return (isLeafInCurrentMessages ? leafMessageId : null) ?? lastMessageId
}
```

### 提取原则

1. **参数用对象模式**：`function fn(input: { ... })` 而非多个位置参数
2. **返回值明确**：避免 `void`，返回计算结果
3. **无副作用**：不修改外部状态、不做 I/O
4. **类型最小化**：参数类型只声明实际使用的字段（`Array<{ id: string }>` 而非完整 Message 类型）

---

## Promptfoo YAML 测试用例模板

以下模板用于在 `apps/server/src/ai/__tests__/agent-behavior/tests/<domain>/<domain>.yaml` 中添加新的 AI Agent 行为测试用例。

### 模板 A：单轮工具测试（默认路径）

最常见的模式。不设 `agentType`，走完整 `AiExecuteService.execute()` pipeline。

```yaml
- description: "domain-NNN: 描述"
  vars:
    prompt: "用户输入"
  assert:
    - type: javascript
      weight: 2
      metric: tool_selection
      value: |
        const tools = context.providerResponse?.metadata?.toolNames || [];
        return tools.includes('expected-tool')
          ? { pass: true, score: 1 }
          : { pass: false, score: 0, reason: `未调用 expected-tool，实际: [${tools}]` };
    - type: llm-rubric
      weight: 1
      metric: output_quality
      value: "回复应<核心期望>，或指出<合理替代情况>（<容错补充>也可接受）"
```

### 模板 B：子 Agent 直接调用

设置 `agentType` 和 `toolIds`，通过 `createSubAgent()` 直接运行子 Agent，跳过会话管理。

```yaml
- description: "domain-NNN: 描述"
  vars:
    agentType: "email"
    toolIds: '["email-query", "email-mutate"]'
    prompt: "用户输入"
  assert:
    - type: javascript
      weight: 2
      metric: tool_selection
      value: |
        const tools = context.providerResponse?.metadata?.toolNames || [];
        return tools.includes('email-query')
          ? { pass: true, score: 1 }
          : { pass: false, score: 0, reason: `未调用 email-query，实际: [${tools}]` };
    - type: llm-rubric
      weight: 1
      metric: output_quality
      value: "回复应<核心期望>"
```

### 模板 C：多轮对话 + 命令

使用 `vars.turns` 模拟多轮对话。常用于测试斜杠命令（如 `/summary-title`）。

```yaml
- description: "domain-NNN: 多轮描述"
  vars:
    prompt: "dummy"
    turns: '[{"text": "第一轮输入"}, {"text": "/summary-title"}]'
  assert:
    - type: javascript
      weight: 2
      metric: tool_selection
      value: |
        const cmds = context.providerResponse?.metadata?.commandEvents || [];
        return cmds.some(c => c.type === 'expected-event')
          ? { pass: true, score: 1 }
          : { pass: false, score: 0, reason: `未触发 expected-event，实际: ${JSON.stringify(cmds)}` };
    - type: llm-rubric
      weight: 1
      metric: output_quality
      value: "最终回复应保持上下文，且<命令相关期望>"
```

### 命名规范

- **前缀**：与所在 YAML 文件的领域对应
  - `master.yaml` → `master-NNN`
  - `calendar.yaml` → `cal-NNN`
  - `email.yaml` → `email-NNN`
  - `tools.yaml` → `tools-<sub>-NNN`（如 `tools-imgproc-001`、`tools-docconv-001`）
  - `commands.yaml` → `cmd-<name>-NNN`（如 `cmd-summarytitle-001`）
- **编号**：三位数字，从 001 开始
- **描述**：简洁说明测试意图（中文）

### 断言编写要点

1. **javascript 断言**必须从 `context.providerResponse?.metadata` 取数据（`toolNames`、`commandEvents` 等）
2. **llm-rubric 断言**遵循写作规范：并列同义词、容错括号、描述范围而非精确值
3. 每个用例**同时**具备 `javascript` + `llm-rubric` 两种断言
4. 失败 reason 应包含实际值，方便诊断（如 `实际: [${tools}]`）
