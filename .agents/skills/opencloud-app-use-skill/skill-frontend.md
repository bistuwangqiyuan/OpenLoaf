# Skill Frontend

## SkillsSettingsPanel.tsx

**路径**: `apps/web/src/components/setting/skills/SkillsSettingsPanel.tsx`

## 面板职责

- 负责展示可用 skill 列表。
- 负责搜索、按 scope 过滤、按启用状态过滤。
- 负责启用/禁用、查看目录、插入 `/skill/<name>` 到聊天输入框。
- 只在 `skill.isDeletable === true` 时提供删除入口。

## Scope 现实语义

- 前端对外只认两种 scope：
  - `project`
  - `global`
- `type SkillScope = "project" | "global"` 已经是当前实现。
- 旧的 `workspace` 视图语义不再是现行规则；相关翻译 key 或历史命名不代表接口仍支持该 scope。

## 数据来源

- 面板通过 `trpc.settings.getSkills` 读取 skill 列表。
- 传入 `projectId` 时，展示当前项目上下文中的 skills。
- 不传 `projectId` 时，展示全局技能目录视图。
- 列表项里的 `scope`、`ignoreKey`、`isEnabled`、`isDeletable` 都由服务端计算，前端只负责消费。

## 打开技能目录

### handleOpenSkillsRoot

- 先调用 `trpc.fs.mkdir` 确保 `.agents/skills` 目录存在。
- 然后通过 `window.openloafElectron.openPath()` 打开目录。
- Electron 之外的环境不支持此操作。
- 项目面板打开的是 `<project>/.agents/skills`。
- 全局面板打开的是全局 skills 根目录。

### handleOpenSkill

- `global` skill 直接按绝对路径解析目录。
- `project` skill 基于 `project.rootUri` 解析目录与当前文件 URI。
- 打开方式是把 skill 目录压入当前 Tab 的 `folder-tree-preview` stack。
- 标题前缀当前只区分：
  - 全局技能
  - 项目技能

## 启用/禁用

### handleToggleSkill

- 项目面板固定传 `scope: "project"`。
- 全局面板固定传 `scope: "global"`。
- 前端只会传 `project` / `global` 两种 scope。
- 实际写入哪一层配置由服务端根据 scope 决定。

## 删除

### handleDeleteSkill

- 只有当前项目拥有的 skill 才可能 `isDeletable === true`。
- 全局 skill 不允许从设置面板删除。
- 父项目继承的 skill 也不允许在当前项目面板删除。
- 删除前会弹出确认框，删除后刷新 `getSkills` 查询结果。

## 插入聊天命令

- 点击“使用 skill”按钮只负责向窗口派发：
  - `openloaf:chat-insert-skill`
  - `openloaf:chat-focus-input`
- 实际命令文本仍由聊天输入工具链生成 `/skill/<name>`。

## 过滤与展示

- 搜索仅匹配 `name` 与 `description`。
- scope 过滤只显示：
  - 项目面板中的 `project` / `global`
  - 全局面板中的 `global`
- 状态过滤只基于 `isEnabled`。
- 卡片样式当前按 `project` / `global` 两类区分。

## 关联点

- 服务端规则见 `opencloud-app-use-skill/skill-backend.md`。
- `/skill/<name>` 的聊天侧行为见 system agent / chat skill 文档。
- 如果调整 scope、删除权限或 ignoreKey 规则，前后端文档必须同步更新。
