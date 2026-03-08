---
name: ai-test-development
description: Use when creating, extending, or debugging automated tests for server modules or web utilities — covers test environment setup, test runner selection, layer-based test organization, pure function extraction, environment isolation, and concurrent test patterns
---

# AI Test Development

## Overview

项目维护两套独立测试体系：

| 体系 | 运行器 | 断言库 | 文件约定 | 运行方式 |
|------|--------|--------|----------|----------|
| 服务端 | `node:test`（自定义 runner） | `node:assert/strict` | `*.test.ts` | `node --import tsx/esm` 直接执行 |
| Web 端 | Vitest | `vitest`（expect） | `*.vitest.ts` | `pnpm vitest --run` |

两套体系共享同一套环境隔离原则：临时目录 + `setOpenLoafRootOverride` + DB session 隔离。

## When to Use

- 为服务端模块（`apps/server/`）编写新测试
- 为 Web 端纯函数/工具（`apps/web/src/lib/`）编写新测试
- 从 React 组件或复杂模块中提取可测试逻辑
- 调试现有测试失败
- 设计测试分层策略（纯函数 → I/O → 集成）

## Quick Reference

### 测试运行器选择

```
需要测试的代码在哪里？
├── apps/server/  → 服务端测试（node:assert + 自定义 runner）
│   文件：src/**/__tests__/*.test.ts
│   运行：cd apps/server && node --enable-source-maps --import tsx/esm \
│         --import ./scripts/registerMdTextLoader.mjs src/path/__tests__/xxx.test.ts
│
└── apps/web/     → Web 端测试（Vitest）
    文件：src/**/__tests__/*.vitest.ts
    运行：cd apps/web && pnpm vitest --run src/path/__tests__/xxx.vitest.ts
```

### 文件命名约定

- 服务端：`apps/server/src/<module>/__tests__/<name>.test.ts`
- Web 端：`apps/web/src/lib/<module>/__tests__/<name>.vitest.ts`
- 测试辅助：`__tests__/helpers/` 目录下

## Core Patterns

### 1. 分层测试组织（A → B → C）

每个测试文件按三层组织，从纯到重：

- **A 层（纯函数）**：无 I/O、无副作用，手动构造输入数据
- **B 层（I/O 操作）**：文件读写、DB 操作，需要环境隔离
- **C 层（集成）**：端到端流程，组合多个模块

参考：`apps/server/src/ai/__tests__/chatFileStore.test.ts`

### 2. 服务端测试模板

```typescript
import assert from 'node:assert/strict'
// ... 业务导入

// ---- Test runner ----
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

// ---- Main ----
async function main() {
  // Setup: 临时目录 + root override + DB session
  // Tests: A → B → C 分层
  // Teardown: 清理 DB + 重置 override + 删除临时目录
  // Summary: 输出统计
}

main().catch((err) => { console.error(err); process.exit(1) })
```

### 3. Web 端测试模板

```typescript
import { describe, expect, it } from 'vitest'
import { myFunction } from '../my-module'

describe('myFunction', () => {
  it('描述行为', () => {
    expect(myFunction(input)).toBe(expected)
  })
})
```

Vitest 配置：`apps/web/vitest.config.ts`（jsdom 环境，`@/` 别名已配置）。

### 4. 环境隔离模式

```typescript
import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { setOpenLoafRootOverride } from '@openloaf/config'

// Setup
const tempDir = path.join(os.tmpdir(), `mytest_${Date.now()}`)
await fs.mkdir(tempDir, { recursive: true })
setOpenLoafRootOverride(tempDir)

// ... 测试代码 ...

// Teardown（放在 finally 块中）
setOpenLoafRootOverride(null)
await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
```

需要 DB 隔离时，额外创建 Prisma session 并在 teardown 中删除。

### 5. 纯函数提取策略

从 React 组件或复杂模块中提取可测试逻辑：

1. 识别无副作用的计算逻辑（条件判断、数据变换、查找算法）
2. 提取到独立 `.ts` 文件（非 `.tsx`），参数用 `input` 对象模式
3. 在原组件中调用提取后的函数
4. 为提取的函数编写 Vitest 测试

范例：
- 提取前：`apps/web/src/components/chat/ChatCoreProvider.tsx`（800+ 行组件）
- 提取后：`apps/web/src/lib/chat/branch-utils.ts`（7 个纯函数）
- 测试：`apps/web/src/lib/chat/__tests__/branch-utils.vitest.ts`（20 个用例）

## Common Mistakes

| 错误 | 修复 |
|------|------|
| 服务端测试用 Vitest | 服务端用 `node:assert` + 自定义 runner，直接 `node` 执行 |
| 忘记 `setOpenLoafRootOverride(null)` | 放在 `finally` 块中，确保异常时也能重置 |
| 测试间共享可变状态 | 每个测试用独立 session ID（`crypto.randomUUID()`） |
| 忘记 `clearSessionDirCache()` | 切换 root override 后必须清除缓存 |
| Web 测试文件命名为 `.test.ts` | 必须用 `.vitest.ts`，否则 Vitest 不会匹配 |
| 在测试中直接 import React 组件 | 提取纯函数到独立文件，测试纯函数 |

## Key Files

| 文件 | 用途 |
|------|------|
| `apps/server/src/ai/__tests__/chatFileStore.test.ts` | 服务端测试范例（33 用例，三层组织） |
| `apps/web/src/lib/chat/__tests__/branch-utils.vitest.ts` | Web 端测试范例（20 用例） |
| `apps/web/src/lib/chat/branch-utils.ts` | 纯函数提取范例 |
| `apps/server/src/ai/__tests__/helpers/testEnv.ts` | 测试环境辅助（模型解析、RequestContext） |
| `apps/server/src/ai/__tests__/helpers/printUtils.ts` | 输出格式化辅助 |
| `packages/config/src/openloaf-paths.ts` | `setOpenLoafRootOverride` 定义 |
| `apps/web/vitest.config.ts` | Vitest 配置 |
| `apps/server/scripts/registerMdTextLoader.mjs` | MD 文本加载器（服务端测试需 import） |

详细代码模板见 [references/test-patterns.md](references/test-patterns.md)。

## AI Agent 行为测试（Promptfoo）

### 概述

除了上述分层测试体系外，项目还使用 [Promptfoo](https://github.com/promptfoo/promptfoo) 进行 **AI Agent 行为质量测试**。这类测试关注的不是代码逻辑正确性，而是 Agent 在面对自然语言指令时的行为质量：

- **工具选择正确性**：Agent 是否选了正确的工具（如"有哪些项目"应用 `project-query` 而非 `list-dir`）
- **输出语义质量**：Agent 回复是否语义合理、对用户有帮助
- **多轮对话上下文保持**：同一会话连续交互时上下文是否正确延续
- **斜杠命令触发**：`/summary-title` 等命令是否正确触发对应事件

### 测试域划分与触发条件

测试用例按领域（域）组织，每个域有明确的职责边界和生命周期规则：

- **tools/** — 单个工具的行为验证。新增工具时添加测试，删除工具时清理测试。
- **master/** — Master Agent 路由决策、多工具编排、通用对话。prompt 或工具选择策略变更时添加/更新测试。
- **calendar/** / **email/** — 子 Agent 行为。对应领域工具变更时同步更新。
- **commands/** — 斜杠命令触发与事件。新增或废弃命令时同步。
- **regression/** — 真实用户故障场景回归（由 `/ai-test-regression` 生成）。故障根因被其他域覆盖后可合并。

**豁免规则**：内部编排工具（路由、委派、规划状态管理等）和已废弃别名不需要显式行为测试。具体豁免列表维护在覆盖率脚本的 `INTERNAL_TOOLS` 常量中。

**覆盖率验证**：`pnpm run check:tool-coverage` 对比已注册工具与已测试工具，报告缺失和孤立。新增或删除工具后应运行此命令确认一致性。

### 架构

#### 统一 Provider（openloaf-universal-provider.ts）

项目使用**单一统一 Provider**，通过 `vars.agentType` 路由到不同的执行路径：

| agentType 值 | 入口函数 | 工具集 | 会话管理 | 多轮对话 | 用途 |
|---------------|----------|--------|----------|----------|------|
| 未设置（默认） | `AiExecuteService.execute()` | 完整 pipeline 自动组装 | 完整 | 支持 | 端到端行为验证 |
| `calendar`/`email`/... | `createSubAgent()` | 手动 `toolIds` | 无 | 不支持 | 直接调用子 Agent 调试 |

**默认路径（完整 pipeline）**：

```
AiExecuteService.execute()
  ├─ initRequestContext()           — 完整请求上下文
  ├─ Command 解析                   — 识别 /summary-title 等斜杠命令
  ├─ Skill 注入                     — 注入已启用的 Skill
  ├─ resolveChatModel()             — 从 agent config 自动解析模型
  ├─ assembleDefaultAgentInstructions() — 动态组装系统提示
  ├─ createMasterAgentRunner()      — 创建 Master Agent（含 ToolSearch）
  └─ createChatStreamResponse()     — 返回 SSE Response
```

**子 Agent 路径**：通过 `vars.agentType` + `vars.toolIds` 直接调用 `createSubAgent()`，跳过会话管理，用于快速工具选择调试。

#### 关键机制

- **`autoApproveTools: true`**：标记了 `needsApproval` 的工具在测试中自动批准，无需模拟用户确认
- **SSE 响应解析**：通过 `consumeSseResponse()`（`helpers/sseParser.ts`）解析 SSE Response，提取文本、工具调用、子 Agent 事件、命令事件

### 测试文件组织

测试用例按领域拆分到独立 YAML 文件：

```
apps/server/src/ai/__tests__/agent-behavior/
├── promptfooconfig.yaml            # 主配置（评分模型、Provider 引用）
├── openloaf-universal-provider.ts  # 统一 Provider
├── fixtures/                       # 共享基础（环境配置 + 跨域文件）
│   ├── .gitignore                  # 忽略运行时生成文件
│   ├── settings.json               # 模型设置
│   ├── providers.json.template     # Provider 模板
│   ├── workspaces.json             # 工作区定义
│   └── workspace/                  # 共享 workspace 基础
│       ├── .openloaf/tasks/        # 任务元数据
│       └── README.md               # 多域共用
│
└── tests/
    ├── master/
    │   ├── master.yaml    (39 tests) — 通用对话、工具选择、项目/任务/时间查询
    │   └── workspace/              # master 专属 fixtures（web-app/、data-analysis/、docs/）
    ├── tools/
    │   ├── tools.yaml     (36 tests) — 文件/图片/视频/文档工具
    │   └── workspace/              # tools 专属 fixtures（xlsx、pdf、docx、pptx、ts）
    ├── calendar/
    │   └── calendar.yaml  (10 tests) — 日历场景（无 fixtures，纯 DB）
    ├── email/
    │   ├── email.yaml     (10 tests) — 邮件场景（子 Agent 调用）
    │   └── workspace/              # email fixtures（email.json）
    ├── commands/
    │   └── commands.yaml  (3 tests)  — 斜杠命令（/summary-title 等）
    └── regression/
        └── regression.yaml          — 真实用户故障回归（跨域，由 /ai-test-regression 生成）
```

命名规范：`<domain>-NNN` 或 `<domain>-<sub>-NNN`（如 `master-001`、`tools-imgproc-001`、`cmd-summarytitle-001`、`regression-001`）。

新测试用例添加到对应领域的 `tests/<domain>/<domain>.yaml` 文件中，不要修改 `promptfooconfig.yaml`。

### 评分模型配置

`promptfooconfig.yaml` 的 `defaultTest.options.provider` 配置了 llm-rubric 断言的评分模型：

```yaml
defaultTest:
  options:
    timeout: 90000
    provider:
      id: openai:chat:qwen3-235b-a22b
      config:
        apiBaseUrl: https://dashscope.aliyuncs.com/compatible-mode/v1
        apiKeyEnvar: PROMPTFOO_GRADING_API_KEY
```

评分模型使用阿里云 DashScope 的 Qwen3-235B，需设置 `PROMPTFOO_GRADING_API_KEY` 环境变量。

### 运行方式

```bash
cd apps/server

# 运行全部测试（默认启用缓存加速迭代）
pnpm run test:ai:behavior

# 禁用缓存（修改了 prompt/工具代码后需要刷新）
pnpm run test:ai:behavior -- --no-cache

# 按前缀过滤（支持正则）
pnpm run test:ai:behavior -- --filter-pattern "master-001"

# 指定模型（用于模型对比，运行多次后在 UI 中对比结果）
pnpm run test:ai:behavior -- --model "profileId:modelId"

# 每个用例运行 2 次（测试稳定性）
pnpm run test:ai:behavior -- --filter-pattern "master-001" --repeat 2

# 打开 Web UI 查看结果矩阵
pnpm run test:ai:behavior:view

# Red Teaming 安全测试
pnpm run test:ai:redteam:generate   # 首次：生成对抗性测试用例
pnpm run test:ai:redteam            # 运行安全测试
```

也可通过 Claude Code 的 `/ai-test` 命令运行。

### 断言分层标准

每个测试用例**必须**同时具备两种断言，并标注 weight 和 metric：

| 断言类型 | 用途 | 确定性 | weight | metric |
|----------|------|--------|--------|--------|
| `javascript` | 检查 `metadata.toolNames` / `commandEvents` | 确定性 | 2 | `tool_selection` |
| `llm-rubric` | LLM 判断输出语义质量 | 非确定性 | 1 | `output_quality` |
| `latency` | 响应时间门槛（由 defaultTest 自动注入） | 确定性 | 0.5 | `response_time` |

**加权规则**：工具选择（weight=2）比输出质量（weight=1）更重要，延迟（weight=0.5）为辅助指标。promptfoo 的 `derivedMetrics` 会自动从 metric 名称计算 `tool_accuracy` 和 `quality_rate` 聚合指标。

**简化断言**：当只需要检查输出文本（而非 metadata）时，优先使用 `contains` / `not-icontains` 等简单断言替代冗长的 javascript：

```yaml
# 检查输出不包含错误提示（比 javascript 更简洁）
- type: not-icontains
  value: "无法完成"
```

### llm-rubric 写作规范

**核心原则**：

- 使用"指出文件未找到/不存在"而非"说明文件不存在"（评分模型会区分措辞，并列写法覆盖同义表述）
- 添加容错表述 `（...也可接受）` 处理合理的替代行为
- 避免要求精确数值匹配（LLM 输出格式不确定）
- Rubric 应描述"可接受的结果范围"而非"唯一正确答案"
- 避免绝对化要求（"必须包含 XX 字样" → "应提及 XX"）

**模板**：

```yaml
- type: llm-rubric
  value: "回复应<核心期望>，或指出<合理替代情况>（<容错补充>也可接受）"
```

**示例**：

```yaml
# Good：覆盖多种合理表述，有容错
- type: llm-rubric
  value: "回复应展示图片的基本信息（如尺寸、格式），或指出文件未找到/不存在（提示检查路径也可接受）"

# Bad：要求过于精确，容易误判
- type: llm-rubric
  value: "回复必须包含'图片尺寸为 1920x1080'字样"
```

### 测试 Fixture 文件管理

Fixture 文件按领域拆分，与对应的测试定义关联放置：

- **共享基础**（`fixtures/workspace/`）：`.openloaf/tasks/`、`README.md` — 跨域共用
- **master 域**（`tests/master/workspace/`）：`web-app/`、`data-analysis/`、`docs/` — 项目结构
- **tools 域**（`tests/tools/workspace/`）：`budget.xlsx`、`invoice.pdf`、`notes.docx`、`meeting-notes.docx`、`presentation.pptx`、`quick-sort.ts`
- **email 域**（`tests/email/workspace/`）：`email.json` — 邮件种子数据
- **calendar/commands**：无 fixtures（纯 DB/API 调用）
- **regression 域**（`tests/regression/workspace/`）：按需创建，存放回归测试专属文件

**运行时合并机制**：`setupE2eTestEnv()`（`helpers/testEnv.ts`）在测试启动时执行两步复制：
1. 复制 `fixtures/workspace/` 到临时目录（共享基础）
2. 扫描 `tests/*/workspace/` 并逐域 overlay 到同一临时目录

合并后的 workspace 结构完整，测试行为不受影响。

新增测试文件时，放入对应域的 `tests/<domain>/workspace/` 目录，`setupE2eTestEnv()` 会自动合并。

### 添加新测试用例

在对应领域的 `tests/<domain>.yaml` 文件中添加。详细 YAML 模板见 [references/test-patterns.md](references/test-patterns.md) 的"Promptfoo YAML 测试用例模板"一节。

### 失败排查

| 原因 | 修改目标 |
|------|----------|
| 工具描述不够明确 | `packages/api/src/types/tools/*.ts` |
| 系统提示词引导不足 | `apps/server/src/ai/agent-templates/templates/master/prompt.zh.md` |
| 工具别名缺失 | `apps/server/src/ai/tools/toolRegistry.ts` TOOL_ALIASES |
| 两个工具功能交叉导致误选 | 在被误选工具的 description 末尾添加 `不适用：...改用 X` |

### 关键文件

| 文件 | 用途 |
|------|------|
| `apps/server/src/ai/__tests__/agent-behavior/promptfooconfig.yaml` | 主配置（评分模型、Provider 引用、测试文件列表） |
| `apps/server/src/ai/__tests__/agent-behavior/openloaf-universal-provider.ts` | 统一 Provider（通过 `vars.agentType` 路由） |
| `apps/server/src/ai/__tests__/agent-behavior/tests/<domain>/<domain>.yaml` | 按领域拆分的测试用例 |
| `apps/server/src/ai/__tests__/helpers/sseParser.ts` | SSE 解析工具（含 `consumeSseResponse`） |
| `apps/server/src/ai/__tests__/helpers/testEnv.ts` | 测试环境辅助（`setupE2eTestEnv`、模型解析） |
| `apps/server/src/ai/__tests__/agent-behavior/fixtures/` | 共享 Fixture（配置 + 基础 workspace） |
| `apps/server/src/ai/__tests__/agent-behavior/tests/<domain>/workspace/` | 域专属 Fixture 文件 |
| `apps/server/scripts/run-behavior-test.mjs` | 测试运行脚本 |
| `.claude/commands/ai-test.md` | Claude Code `/ai-test` Skill |
