---
name: ai-test-regression
description: 从真实聊天故障历史生成回归测试用例。由 /ai-test-regression 命令消费。
---

## Overview

本 Skill 将真实用户的故障聊天记录转化为 Promptfoo 回归测试用例，防止已知问题复发。

## When to Use

- 用户报告 AI 对话故障（工具选错、未调工具、输出质量差）
- 需要从真实 session 中提取可复现的测试用例
- 需要建立回归测试基线

### 1. 验证输入

检查用户提供的路径是否包含有效的聊天记录：

如果路径不包含 `messages.jsonl`，提示用户提供正确路径。

聊天记录通常位于：`~/.openloaf/chat-sessions/<sessionId>/messages.jsonl`

### 2. 读取解析

使用 Read 工具直接读取 `messages.jsonl`。每行是一个 JSON 对象：

按 `parentMessageId` 构建对话树，识别主对话线。

### 3. 提取时间线

将消息分组为 **turns**（轮次）：

每个 turn 提取：
- 用户输入文本
- 助手回复文本
- 工具调用列表（工具名 + 参数 + 结果摘要）
- 命令事件（如有）

### 4. 确认故障（不可跳过）

向用户展示时间线摘要，**必须**请用户明确：
1. 哪个 turn 有问题
2. 期望的正确行为是什么
3. 实际的错误行为是什么

### 5. 分类故障

按决策树分类：

### 6. 生成测试

根据故障类型和涉及的轮次，使用对应模板生成 YAML 测试用例。

**命名规范**：`regression-NNN`（三位数字编号，从 001 开始递增）

**单轮模板**：

**多轮模板**：

详细断言模板见 [references/assertion-patterns.md](references/assertion-patterns.md)。

### 7. 放置测试

按主要信号路由到对应文件：

| 主要信号 | 目标文件 |
|----------|---------|
| 涉及 calendar-query / calendar-mutate | `tests/calendar/calendar.yaml` |
| 涉及 email-query / email-mutate | `tests/email/email.yaml` |
| 涉及文件/图片/视频/文档工具 | `tests/tools/tools.yaml` |
| 涉及斜杠命令 | `tests/commands/commands.yaml` |
| Master 路由/选择问题 | `tests/master/master.yaml` |
| 跨域或不明确 | `tests/regression/regression.yaml` |

**注意**：即使放入域专属文件，命名仍保持 `regression-NNN` 前缀，以标记其来源是真实故障。

### 8. 处理 Fixture

检查测试用例引用的文件是否已存在于对应的 `workspace/` 目录：

1. 如果引用的文件已存在 → 无需操作
2. 如果引用的文件缺失 → 询问用户提供文件，或调整测试用例避免依赖该文件
3. 如果需要创建 fixture → 放入对应域的 `tests/<domain>/workspace/` 目录

### 9. 根因修复

参照 `ai-test-autofix` Skill 的修复策略矩阵调查并修复 bug：

1. 读取 `.agents/skills/ai-test-autofix/SKILL.md` 了解修复策略
2. 根据故障类型确定修复目标（prompt / 工具描述 / toolIds / 别名）
3. 执行修复
4. 运行 `/ai-test -- --filter-pattern "regression-"` 验证修复

## 故障分类速查

| 类型 | 特征 | 修复方向 |
|------|------|---------|
| TOOL_ERROR | 工具被调用但返回错误 | 检查工具实现逻辑 |
| WRONG_TOOL | 调了错误的工具 | 工具描述消歧义 / prompt 选择策略 |
| NO_TOOL | 应调工具但未调 | toolIds 列表 / prompt 鼓励使用工具 |
| OUTPUT_QUALITY | 工具选对但输出差 | prompt 输出指引 |
| SYSTEM_ERROR | 超时/崩溃 | 环境或代码 bug |

## Key Files

| 文件 | 用途 |
|------|------|
| `apps/server/src/ai/__tests__/agent-behavior/tests/regression/regression.yaml` | 跨域回归测试用例 |
| `apps/server/src/ai/__tests__/agent-behavior/tests/<domain>/<domain>.yaml` | 域内回归测试（regression-NNN 前缀） |
| `.agents/skills/ai-test-autofix/SKILL.md` | 修复策略矩阵参考 |
| `.agents/skills/ai-test-autofix/references/fix-patterns.md` | 修复代码模式参考 |

## Common Mistakes

| 错误 | 修复 |
|------|------|
| 跳过用户确认步骤 | 用户确认不可跳过 — JSONL 中无法判断什么是"错误" |
| 用 regression- 前缀编号冲突 | 检查现有所有 YAML 文件中的 regression-NNN，从最大值 +1 开始 |
| 忘记检查 fixture 依赖 | 测试用例引用的文件必须存在于 workspace |
| 将跨域问题放入单域文件 | 跨域或不明确的故障放 `tests/regression/regression.yaml` |
