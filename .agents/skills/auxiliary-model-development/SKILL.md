---
name: auxiliary-model-development
description: >
  Use when developing, extending, or debugging the OpenLoaf auxiliary model
  system — adding new capabilities, modifying inference logic, customizing
  prompts, or updating the auxiliary model settings UI.
---

## Overview

辅助模型（Auxiliary Model）是 OpenLoaf 中独立于主 Chat Agent 的轻量级推理层。它在后台静默运行，为项目分类、对话标题生成、输入建议等场景提供快速推理，失败时自动兜底，**绝不阻塞主流程**。

核心设计原则：
- **静默兜底**：所有调用均 try-catch 包裹，异常时返回 fallback 值
- **3 秒超时**：每次推理 hard timeout 3s，防止慢模型拖垮体验
- **5 分钟缓存**：相同 capability + context 的结果在内存中缓存 5 分钟
- **与主 Agent 分离**：使用独立的模型配置（`auxiliary-model.json`），不影响聊天模型

### 核心层

| 文件 | 职责 |
|------|------|
| `apps/server/src/ai/services/auxiliaryCapabilities.ts` | 能力注册表：Zod schema + 能力定义 + 默认 prompt |
| `apps/server/src/ai/services/auxiliaryInferenceService.ts` | 推理引擎：`auxiliaryInfer()` + `auxiliaryInferText()` + 缓存 + 日志 |
| `apps/server/src/modules/settings/auxiliaryModelConfStore.ts` | 配置读写：`~/.openloaf/auxiliary-model.json` |

### tRPC 层

| 文件 | 职责 |
|------|------|
| `packages/api/src/routers/absSetting.ts` | tRPC base schema：辅助能力相关 mutation/query 定义 |
| `apps/server/src/routers/settings.ts` | tRPC 实现：`inferProjectName` / `generateChatSuggestions` / `generateCommitMessage` |
| `apps/server/src/routers/chat.ts` | `generateTitleFromHistory()` — `chat.title` 调用入口 |
| `packages/api/src/routers/project.ts` | Git 操作路由：`getGitStatus` / `getGitDiff` / `gitCommit` |
| `packages/api/src/services/projectGitService.ts` | Git 服务层：status / diff / commit 实现 |

### 前端层

| 文件 | 职责 |
|------|------|
| `apps/web/src/components/setting/menus/AuxiliaryModelSettings.tsx` | 辅助模型设置 UI：模型选择 + 能力配置 + prompt 编辑器 |
| `apps/web/src/components/project/ProjectTitle.tsx` | 项目标题旁 ✨ AI 重命名按钮（`project.ephemeralName`） |
| `apps/web/src/components/ai/message/MessageHelper.tsx` | 动态输入建议（`chat.suggestions`） |
| `apps/web/src/components/project/settings/menus/GitCommitDialog.tsx` | Git 提交模态框 + AI 生成 commit message（`git.commitMessage`） |
| `apps/web/src/components/project/settings/menus/ProjectGitSettings.tsx` | Git 面板提交按钮入口 |
| `packages/ui/src/ai-menu.tsx` | 编辑器 AI 菜单 Translate 项（`text.translate` — 走主模型） |

## Capability Registry

当前 6 个内置能力（全部已落地）：

| Key | Label | Output Mode | 触发方式 | 调用入口 |
|-----|-------|-------------|----------|----------|
| `project.classify` | 项目分类 | `structured` | 自动 — 创建项目时 | `settings.ts` → `inferProjectType` |
| `chat.title` | 摘要标题 | `structured` | 自动 — 每 5 次 assistant 回复 | `chat.ts` → `generateTitleFromHistory()` |
| `text.translate` | 文本翻译 | `text` | 手动 — 编辑器选中文本 → AI 菜单 | `ai-menu.tsx`（走主模型 AIChatPlugin，不走辅助模型） |
| `project.ephemeralName` | 项目重命名 | `structured` | 手动 — 项目标题旁 ✨ 按钮 | `settings.ts` → `inferProjectName` |
| `chat.suggestions` | 输入推荐 | `structured` | 自动 — 空会话时 mount 触发 | `settings.ts` → `generateChatSuggestions` |
| `git.commitMessage` | Commit 信息 | `structured` | 手动 — Git 面板 → 提交 → AI 生成 | `settings.ts` → `generateCommitMessage` |

> **注意**：`text.translate` 在编辑器场景走 Plate.js AIChatPlugin（主模型），保持 AI 菜单行为一致。辅助模型的 `text.translate` 能力保留定义，供未来非编辑器场景使用。

## Output Mode Guide

选择 `outputMode` 的决策树：

**当前可用**：`structured` 和 `text`。`tool-call` / `skill` 为预留扩展。

### 关键参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `capabilityKey` | `CapabilityKey` | 能力注册表中的 key |
| `context` | `string` | 用户输入 / 业务上下文（作为 prompt） |
| `schema` | `z.ZodType` | 仅 structured 模式，Zod 验证 schema |
| `fallback` | `T \| string` | 推理失败时的兜底值 |
| `noCache` | `boolean?` | 跳过缓存（默认 false） |

## Logging

所有辅助推理调用自动输出日志（`console.log` / `console.warn`），前缀 `[AuxiliaryInfer]`：

| 时机 | 级别 | 格式 |
|------|------|------|
| 调用开始 | `log` | `[AuxiliaryInfer] [chat.title] 调用开始 \| 输入: <context 截断 200 字>` |
| 模型来源 | `log` | `[AuxiliaryInfer] [chat.title] 模型来源: saas` |
| 命中缓存 | `log` | `[AuxiliaryInfer] [chat.title] 命中缓存 \| 输出: { ... }` |
| 推理完成 | `log` | `[AuxiliaryInfer] [chat.title] SaaS/本地/云端推理完成 \| 输出: { ... }` |
| 推理失败 | `warn` | `[AuxiliaryInfer] [chat.title] 推理失败，返回 fallback \| 错误: <message>` |

text 模式日志格式相同，在 capabilityKey 后追加 `(text)` 标记。

开发调试时可在服务端终端搜索 `[AuxiliaryInfer]` 查看所有辅助推理调用。

## Frontend Mutation Pattern

前端调用辅助能力的 tRPC mutation 统一使用 `@tanstack/react-query` 的 `useMutation` + `trpc.xxx.mutationOptions()` 模式：

## Adding a New Capability (Quick)

> 完整代码模板和示例见 [references/capability-development.md](references/capability-development.md)

**5 步速查清单：**

1. **定义 Schema** — 在 `auxiliaryCapabilities.ts` 的 `CAPABILITY_SCHEMAS` 中添加 Zod schema
2. **注册能力** — 在 `AUXILIARY_CAPABILITIES` 中添加完整能力定义（key、label、description、triggers、defaultPrompt、outputMode、outputSchema）
3. **更新 CAPABILITY_KEYS** — 将新 key 追加到有序数组
4. **添加前端图标** — 在 `AuxiliaryModelSettings.tsx` 的 `CAP_ICON_MAP` 中添加图标和颜色映射
5. **业务代码调用** — 在需要的地方调用 `auxiliaryInfer()` 或 `auxiliaryInferText()`

> tRPC 层无需修改 — `getAuxiliaryCapabilities` 路由直接遍历 `AUXILIARY_CAPABILITIES` 对象。

## Prompt Writing Rules

为辅助模型能力编写 `defaultPrompt` 时遵循以下规则：

1. **角色开头** — 以「你是一个 XX 专家」开头，明确角色定位
2. **规则列表** — 使用 `规则：` + 无序列表格式，列出约束条件
3. **字数限制** — 涉及用户可见文本时，明确标注最大字数/字符数
4. **语言适配** — 如需多语言输出，在规则中说明语言选择逻辑
5. **避免过度描述** — prompt 应 ≤ 300 字，辅助模型使用小模型，过长 prompt 效果反而更差
6. **不包含 schema 说明** — Zod schema 会通过 `generateObject` 自动传递，prompt 中无需重复字段定义

## Skill Sync Policy

当以下源文件发生变更时，应同步更新此 Skill 文档：

- `auxiliaryCapabilities.ts` — 新增/修改能力 → 更新 Capability Registry 表
- `auxiliaryInferenceService.ts` — 推理逻辑变更 → 更新 Architecture、Calling Convention、Logging
- `AuxiliaryModelSettings.tsx` — UI 变更 → 更新 Key Files Map 和前端图标步骤
- `absSetting.ts` — tRPC schema 变更 → 更新 references 中的 tRPC 步骤
- `settings.ts` — 新增 mutation（如 `inferProjectName`）→ 更新 Key Files Map 和 Capability Registry 调用入口
- `chat.ts` — `generateTitleFromHistory()` 变更 → 更新 Capability Registry 调用入口
