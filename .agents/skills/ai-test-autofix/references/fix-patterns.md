# Fix Patterns — AI Agent 行为测试修复代码模式

本文档提供具体的代码修复模式和 before/after 示例，供 `/ai-test-autofix` 命令在诊断和修复失败用例时参考。

---

## 1. 工具描述修复模式

**文件位置**：`packages/api/src/types/tools/*.ts`

工具描述是 LLM 判断是否调用该工具的核心依据。description 字段应遵循以下结构：

### Before/After 示例

**问题**：Agent 查询项目时使用了 `list-dir` 而非 `project-query`，因为 `project-query` 的描述没有明确和用户常用说法的对应。

**Before**（`packages/api/src/types/tools/db.ts`）：

**After**：

**关键点**：
- 在"触发"部分添加用户常见的自然语言说法
- 在"不适用"部分明确区分容易混淆的工具
- 不要改变返回值格式等其他部分

### 常见描述增强模式

| 混淆对 | 增强方向 |
|--------|---------|
| `project-query` vs `list-dir` | project-query 强调"应用层项目"，list-dir 强调"文件系统目录" |
| `email-query` vs `shell-command` | email-query 强调"邮件/收件箱/邮件列表" |
| `read-file` vs `shell-command` | read-file 强调"读取文件内容"，shell-command 不适合读文件 |
| `task-manage` vs 不调工具 | task-manage 强调"创建任务/提醒/待办" |

---

## 2. Prompt 修复模式

**文件位置**：`apps/server/src/ai/agent-templates/templates/master/prompt.zh.md`

### 修改位置选择

| 修复目标 | 添加位置 |
|----------|---------|
| 工具选择规则（A 而非 B） | `<tools>` → `## 选择策略` 下方 |
| 输出格式/内容要求 | `<output>` 部分 |
| 特定工具的使用细则 | `<tools>` → 对应工具的 `##` 小节 |
| 全局行为变化 | `<behavior>` 部分 |

### Before/After 示例

**问题**：Agent 被问"有哪些项目"时使用了 `list-dir` 而非 `project-query`。

**Before**（`<tools>` 的 `## 选择策略` 末尾）：

**After**：

**关键点**：
- 在 `## 选择策略` 末尾追加一行规则
- 使用简洁的"X 时用 A，不要用 B"格式
- 包含用户可能使用的自然语言说法

### 添加工具禁止规则

**问题**：Agent 查询时间时使用了 `shell-command`（运行 `date`）而非 `time-now`。

**添加到 `## 选择策略`**：

### 添加工具使用鼓励

**问题**：Agent 没有调用任何工具，直接文本回复。

**添加到 `## 核心原则`**：

---

## 3. 工具别名修复模式

**文件位置**：`apps/server/src/ai/tools/toolRegistry.ts`

### 添加新别名

**问题**：LLM 试图调用不存在的工具名 `query-projects`（而实际工具名是 `project-query`）。

**修复**：在 TOOL_ALIASES 中添加映射：

**判断依据**：
- 检查失败用例中 `metadata.toolCalls` 是否有调用了不存在工具的记录
- 或在 Agent 输出文本中搜索 "tool not found" 相关提示
- 别名应该只映射 LLM 可能猜测的合理名称变体

---

## 4. Master toolIds 修复模式

**文件位置**：`apps/server/src/ai/agent-templates/templates/master/index.ts`

### 添加缺失的工具

**问题**：测试期望 Agent 调用 `email-query`，但 Master 的 toolIds 中没有这个工具（说明测试预期 Agent 可以直接查邮件）。

**修复**：在合适的分类注释下添加工具 ID：

**注意**：
- 添加前先确认工具确实注册在 `TOOL_REGISTRY` 中
- 按分类注释放在合适位置
- 不要删除现有的 toolIds

### 何时修改 toolIds vs 何时不修改

| 场景 | 行动 |
|------|------|
| 测试期望的工具不在 toolIds 中 | 添加到 toolIds |
| 工具在 toolIds 中但 Agent 没调用 | 修改 prompt 或工具描述，不动 toolIds |
| Agent 调了不该调的工具 | 修改 prompt 添加禁止规则，不从 toolIds 移除 |

---

## 5. 多轮对话失败的特殊处理

多轮对话用例（`vars.turns` 存在）的失败通常不是工具选择问题，而是上下文保持问题。

### 诊断方式

1. 检查 `metadata.toolNames` — 第一轮调用的工具是否正确
2. 检查 `response.output` — 最后一轮回复是否引用了之前的信息
3. 通常是 LLM 能力问题，而非代码可修复的问题

### 修复策略

多轮对话失败优先检查：
1. E2E Provider 的 sessionId 是否在同一组 turns 中保持不变（应该是的）
2. 如果是第一轮就失败，按普通单轮用例处理
3. 如果第一轮成功但后续轮次失败，通常标记为**需要人工评估**

---

### 使用 --repeat 测试稳定性

修复后建议用 `--repeat 2` 验证稳定性（LLM 有非确定性）：

如果 2 次中有 1 次失败，说明修复还不够稳定，需要进一步加强。

### 快速验证单个修复

底层命令为 `node --no-warnings --env-file=.env --import tsx/esm scripts/run-behavior-test.mjs`，封装了 `promptfoo eval` 调用。

---

## 7. 修复顺序建议

当一轮中有多个失败用例时，按以下顺序修复：

1. **NO_TOOL** — 最可能是 toolIds 缺失，一行修复
2. **WRONG_TOOL** — 工具描述或 prompt 选择策略问题
3. **FORBIDDEN_TOOL** — prompt 添加禁止规则
4. **OUTPUT_QUALITY** — prompt 调整输出要求（最不确定，放最后）

如果多个用例的失败根因相同（如都因为 prompt 缺少某条规则），一次修复可以解决多个。

---

## 8. prompt.en.md 同步

当修改了 `prompt.zh.md` 后，如果项目中存在 `prompt.en.md`，应当同步修改。

同步原则：
- 规则语义保持一致
- 工具名保持不变（英文）
- 用户说法的示例翻译为英文等价表达

---

## 9. Rubric 写作指南

`llm-rubric` 断言由评分模型（Qwen3-235B via DashScope）判断 Agent 输出是否满足语义要求。写好 rubric 是提高测试稳定性的关键。

### 核心原则

1. **并列同义词**：用"X/Y"写法覆盖同义表述
   - Bad: `"回复应说明文件不存在"`
   - Good: `"回复应指出文件未找到/不存在"`

2. **容错括号**：添加 `（...也可接受）` 处理合理的替代行为
   - Bad: `"回复应列出 3 个日程"`
   - Good: `"回复应列出日程信息（提示当前没有日程也可接受）"`

3. **描述范围而非精确值**：避免绝对化要求
   - Bad: `"回复必须包含'图片尺寸为 1920x1080'字样"`
   - Good: `"回复应展示图片的基本信息（如尺寸、格式等）"`

4. **避免格式要求**：LLM 输出格式不确定
   - Bad: `"回复应以 Markdown 表格展示"`
   - Good: `"回复应以结构化方式展示数据"`

### Before/After 示例

**Before**（过于严格，容易误判）：

**After**（有容错，覆盖合理变体）：

---

## 10. 工具描述消歧义模式

当 WRONG_TOOL 失败且根因是两个工具功能有交叉时，在**被错误调用**的工具 description 末尾添加排他说明。

### 完整 Before/After 示例（excel-mutate 案例）

**问题**：用户要求"将 CSV 转为 Excel"，Agent 错误调用了 `excel-mutate`（用于修改 Excel 内容），应使用 `doc-convert`（格式转换工具）。

**Before**（`packages/api/src/types/tools/office.ts`）：

**After**：

### 适用场景

- 两个工具名称或描述有语义重叠（如 `excel-mutate` vs `doc-convert`）
- 同一用户意图可能匹配多个工具
- 修改 prompt 选择策略不如直接在工具 description 中消歧义更精准

### 注意事项

- 只在**被错误调用**的工具上添加排他说明，不要修改正确工具
- 排他说明放在 description **末尾**，以"不适用："开头
- 保持原有描述不变，仅追加

---

## 11. 测试 Fixture 文件依赖

Fixture 文件按领域拆分，与对应的测试定义关联放置。测试运行时由 `setupE2eTestEnv()`（`helpers/testEnv.ts`）两步复制到临时目录 `/tmp/openloaf-e2e-{timestamp}/workspace/`：先复制共享基础 `fixtures/workspace/`，再扫描 `tests/*/workspace/` 逐域 overlay。

### 依赖映射

| 测试用例前缀 | 依赖的 Fixture 文件 | Fixture 位置 |
|-------------|-------------------|----|
| `tools-imgproc-*` | 图片文件 | `tests/tools/workspace/` |
| `tools-docconv-*` | `budget.xlsx`, `invoice.pdf`, `notes.docx`, `meeting-notes.docx`, `presentation.pptx` | `tests/tools/workspace/` |
| `tools-fileinfo-*` | `invoice.pdf`, `budget.xlsx` | `tests/tools/workspace/` |
| `tools-vidconv-*` | 视频文件（如有） | `tests/tools/workspace/` |
| `master-*`（项目/任务相关） | `web-app/`, `data-analysis/`, `docs/`, `.openloaf/tasks/` | `tests/master/workspace/` + `fixtures/workspace/` |
| `email-*` | `email.json` | `tests/email/workspace/` |

### 新增测试文件

1. 将文件放入对应域的 `tests/<domain>/workspace/` 目录（共享文件放 `fixtures/workspace/`）
2. `setupE2eTestEnv()` 会自动合并，无需额外配置
3. 测试用例中引用路径使用相对于 workspace 根的路径（如 `docs/xxx.pdf`）
