# Capability Development Guide

新增辅助模型能力的完整开发指南，包含每一步的代码模板和示例。

---

## Step 1: Define Schema

在 `apps/server/src/ai/services/auxiliaryCapabilities.ts` 的 `CAPABILITY_SCHEMAS` 对象中添加 Zod schema。

### text 模式

text 模式无需定义 Zod schema，跳过此步。`outputSchema` 字段在注册时设为 `{}`。

### 命名规范

- Key 格式：`domain.camelCase`（如 `project.classify`、`chat.title`、`git.commitMessage`）
- domain 表示功能域：`project`、`chat`、`git`、`text`、`code`、`doc` 等
- camelCase 表示具体能力

### Schema 编写要点

- 每个字段必须有 `.describe()` 注解 — 小模型依赖这些描述理解输出格式
- 字符串字段指明最大长度（如 `不超过 20 字`）
- 数值字段用 `.min()` / `.max()` 约束范围
- 可选字段用 `.optional()` 标记
- 枚举字段用 `z.enum()` 显式列出可选值

---

## Step 2: Register Capability

在同一文件的 `AUXILIARY_CAPABILITIES` 对象中添加完整能力定义。

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `key` | `string` | 是 | 唯一标识，与对象 key 一致 |
| `label` | `string` | 是 | 中文显示名称（≤ 8 字） |
| `description` | `string` | 是 | 能力描述（显示在设置 UI） |
| `outputMode` | `AuxiliaryOutputMode` | 是 | `'structured'` \| `'text'` \| `'tool-call'` \| `'skill'` |
| `triggers` | `string[]` | 是 | 触发场景列表（显示在设置 UI） |
| `defaultPrompt` | `string` | 是 | 默认系统提示词（用户可覆盖） |
| `outputSchema` | `Record<string, unknown>` | 是 | JSON Schema（structured 用 `.toJSONSchema()`，text 用 `{}`） |

---

## Step 3: Update CAPABILITY_KEYS

将新的 key 追加到 `CAPABILITY_KEYS` 数组末尾：

此数组控制 UI 中能力的显示顺序，同时生成 `CapabilityKey` 类型。

---

## Step 4: Add Frontend Icon

在 `apps/web/src/components/setting/menus/AuxiliaryModelSettings.tsx` 中添加图标映射。

### 颜色选择参考

已使用的颜色：
- `sky` — project.classify
- `violet` — chat.suggestions
- `amber` — chat.title
- `emerald` — project.ephemeralName
- `orange` — git.commitMessage
- `teal` — text.translate

可用颜色：`pink`、`rose`、`indigo`、`cyan`、`lime`、`fuchsia`

---

### 调用要点

- **fallback 必须有意义** — 它是推理失败时用户看到的实际值，不能为 `null` 或空对象
- **context 要精练** — 辅助模型通常是小模型（如 GPT-4o-mini），context 过长效果差
- **不要 await 阻塞 UI** — 如果结果不紧急，用 `void auxiliaryInfer(...)` 异步执行，结果写入缓存或 DB
- **noCache 慎用** — 仅在用户主动触发（如"重新生成"）时设为 `true`

---

## Step 6: Add tRPC Mutation (如需前端触发)

如果新能力由用户手动触发（非自动），需要添加 tRPC mutation。

### 6.2 在 `apps/server/src/routers/settings.ts` 实现 mutation

> **注意**：`auxiliaryInfer` 位于 `apps/server/` 中，只能从 `apps/server/src/routers/` 调用，不能从 `packages/api/` 调用。

### 6.3 前端调用 mutation

> **重要**：本项目使用 `useMutation(trpc.xxx.mutationOptions())` 模式（来自 `@tanstack/react-query`），而非 `trpc.xxx.useMutation()`。

---

## Checklist

新增一个辅助模型能力后，按以下清单验证：

### 后端

- [ ] `CAPABILITY_SCHEMAS` 中有对应的 Zod schema（structured 模式）
- [ ] `AUXILIARY_CAPABILITIES` 中有完整的能力定义
- [ ] `CAPABILITY_KEYS` 数组中包含新 key
- [ ] `defaultPrompt` 遵循 prompt 编写规则（角色 + 规则列表 + ≤ 300 字）
- [ ] TypeScript 类型检查通过：`pnpm run check-types`

### 前端

- [ ] `CAP_ICON_MAP` 中有图标和颜色映射
- [ ] 颜色不与现有能力重复
- [ ] 启动 dev server → 设置 → 辅助模型 → 能力列表中显示新能力
- [ ] 能力详情页显示正确（label、description、triggers、outputMode badge、prompt）

### 集成

- [ ] 至少一处业务代码调用了 `auxiliaryInfer()` 或 `auxiliaryInferText()`
- [ ] fallback 值有意义（非空、非 null）
- [ ] 断网 / 模型不可用时，功能不崩溃，静默使用 fallback

### 日志验证

- [ ] 触发能力后，服务端终端输出 `[AuxiliaryInfer] [domain.capabilityName] 调用开始` 日志
- [ ] 推理成功后，终端输出 `推理完成 | 输出: { ... }` 日志
- [ ] 推理失败时（断网/超时），终端输出 `推理失败，返回 fallback | 错误: ...` warn 日志
- [ ] 重复调用同一 context 时，终端输出 `命中缓存` 日志（noCache=true 时除外）

### tRPC（手动触发的能力需要）

如果能力由用户手动触发（如按钮点击），需要：

- [ ] `absSetting.ts` 中添加 base schema（input + output）
- [ ] `settings.ts` 中实现 mutation（调用 `auxiliaryInfer`）
- [ ] 前端使用 `useMutation(trpc.settings.xxx.mutationOptions())` 模式调用
- [ ] **不要**在 `packages/api/` 中直接 import `auxiliaryInfer`（它在 `apps/server/` 中）

自动触发的能力（如 `chat.title`、`project.classify`）无需新增 tRPC mutation，直接在现有路由中调用即可。

`getAuxiliaryCapabilities` 路由直接遍历 `AUXILIARY_CAPABILITIES` 对象并返回，新增能力后无需修改该路由。

---

## Example: Adding a Code Review Capability

以下是一个完整示例——添加「代码审查建议」能力：

