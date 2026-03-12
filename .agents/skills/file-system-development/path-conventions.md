# 文件路径规范

> **术语映射**：当前新代码以 **Project** 为主；文档里出现 `workspace` 基本都表示 legacy 兼容层、历史文件名或旧 UI 命名。

OpenLoaf 当前的文件路径系统遵循三条规则：

- 前端**不传绝对根路径**
- 服务端通过 `projectId` / `uri` 解析真实路径
- legacy `workspace*` 命名只保留在兼容层，不再作为新接口输入

---

### 1. 前端不传 `rootPath`

HTTP / tRPC 层统一传：

- `projectId?`
- `uri` / `rootUri`
- 需要时补 `boardId` / `sessionId`

禁止传：

- `rootPath`
- 本地绝对目录作为 scope 根
- 任意服务端拼接后的真实根路径

### 2. 服务端统一解析

核心函数位于 `packages/api/src/services/vfsService.ts`：

### 3. 新代码不再引入 `workspaceId`

当前仍可能看到 `workspaceId` 的地方：

- Board / media 的过渡兼容
- Desktop / dynamic widget 的旧上下文字段
- `WorkspaceBootstrap` / `WorkspaceDesktop` 兼容层
- legacy 本地缓存与历史文档

这些都不代表新接口仍应继续使用 `workspaceId`。

---

### 1. 全局配置目录

相关函数：

- `getOpenLoafRootDir()`
- `getGlobalRootPath()`

### 2. 默认项目存储根

说明：

- `workspace.json` 文件名仍保留，但语义已变为 **top-level project registry**
- 位置由 `getProjectStorageRootPath()` 决定
- 默认目录仍来自 `getDefaultWorkspaceRootDir()`，只是命名尚未完全清理

### 3. 项目目录

相关函数：

- `getProjectRootPath(projectId)`
- `getProjectRootUri(projectId)`

---

### 1. 默认 scope

`resolveScopedRootPath({})` 未传 `projectId` 时，默认回退到：

这与“默认项目存储根”不是同一个概念。

### 2. 项目 scope

传入 `projectId` 后，scope 根目录变为对应项目根目录：

### 3. Board scope

Board 文件仍是在当前 scope 根下追加：

Board 资源与聊天附件的存储规则仍以具体模块实现为准；新代码不要再为这条链路新增 `workspaceId` 依赖。

---

## 支持的路径输入格式

`resolveScopedPath()` 当前支持：

| 格式 | 示例 | 说明 |
|------|------|------|
| `file://` URI | `file:///Users/a/demo.txt` | 直接解析为本地路径 |
| 绝对路径 | `/Users/a/demo.txt` | 直接归一化 |
| `@{...}` 包裹 | `@{docs/a.md}` | 会先去掉包裹层 |
| `@relative` | `@docs/a.md` | 相对当前 scope 根 |
| `[projectId]/...` | `[proj_123]/docs/a.md` | 跨项目引用 |
| 普通相对路径 | `docs/a.md` | 相对当前 scope 根 |

限制：

- `@/` 和 `@\\` 形式会被拒绝
- 含 `..` 的相对路径必须经过边界校验

---

### 文件预览 / 最近打开

- 使用 `rootUri` + `projectId` 表达作用域
- 新代码不再透传 `workspaceId`
- `recent-open` 仅保留对旧 `openloaf:recent-open:${workspaceId}` key 的一次性 fallback

### Chat 附件

- 项目聊天附件：`.openloaf/chat-history/<sessionId>/...`
- board 内聊天附件：`.openloaf/boards/<boardId>/chat-history/<sessionId>/...`

### HLS / 媒体

- 新代码应优先传 `projectId`
- 当前 `apps/web/src/lib/image/uri.ts` 已改为通用兼容 options bag，仍兼容旧 board / media 调用链传入旧 preview scope 字段
- 不要在新模块复制这套 legacy 入参

---

## 常见场景

| 场景 | 推荐参数 |
|------|----------|
| 项目文件读写 | `projectId + uri` |
| 项目内搜索 | `projectId + rootUri + query` |
| 跨项目搜索 | `searchWorkspace({ query })` |
| 全局配置目录文件 | `uri`（不传 `projectId`） |
| Electron 本地导入 | `projectId + uri + sourcePath` |

---

## 兼容层说明

以下内容仍会保留 `workspace` 命名，但属于兼容层：

- `packages/api/src/services/workspaceProjectConfig.ts`
  - 实际语义：legacy project registry
- `packages/api/src/types/workspace.ts`
  - 实际语义：对旧消费者暴露的 synthetic workspace 形状
- `packages/api/src/services/appConfigService.ts`
  - `getActiveWorkspaceConfig()` / `getWorkspaces()` 等仅做兼容导出
- `apps/web/src/components/workspace/*`
  - 启动期 cookie / 旧桌面入口兼容

结论：

- **可以读取**
- **不要在新代码继续扩散**

---

### 新增后端文件接口

1. 输入优先使用 `projectId?` + `uri`
2. 路径解析统一走 `resolveScopedPath()`
3. 需要根目录时优先走 `resolveScopedRootPath()`
4. 不新增 `workspaceId` 新依赖

### 新增前端文件调用

1. 只传相对路径 / `file://` URI
2. 用 `projectId` 表达项目作用域
3. 仅在 legacy 兼容链路里保留 `workspaceId`

### 文档同步要求

如果这些文件发生变化，需要同步更新本页：

- `packages/api/src/services/vfsService.ts`
- `packages/api/src/services/workspaceProjectConfig.ts`
- `packages/api/src/routers/fs.ts`
- `apps/server/src/modules/media/hlsService.ts`
- `apps/server/src/ai/services/image/attachmentResolver.ts`

---

## 关键代码位置

- `packages/api/src/services/vfsService.ts`
- `packages/api/src/services/workspaceProjectConfig.ts`
- `packages/api/src/services/appConfigService.ts`
- `packages/api/src/routers/fs.ts`
- `apps/server/src/modules/media/hlsService.ts`
- `apps/server/src/ai/services/image/attachmentResolver.ts`
- `apps/web/src/components/file/lib/recent-open.ts`
- `apps/web/src/lib/image/uri.ts`
