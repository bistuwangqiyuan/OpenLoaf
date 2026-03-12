
## tRPC fs 路由速查

位置：`packages/api/src/routers/fs.ts`

当前 `fs` 路由已经切到**项目中心**语义：

- 大多数接口只接收 `projectId?` + `uri`
- **不再要求** `workspaceId`
- 未传 `projectId` 时，服务端回退到全局根目录 `~/.openloaf`
- `searchWorkspace` 这个路由名仍是 legacy 命名，但当前语义是“跨所有已注册项目搜索”

---

### 跨项目搜索

---

### `stat`

获取文件/目录元数据。

### `list`

列出目录内容。

排序规则：

- `name`：普通文件夹 → Board 文件夹 → 文件
- `mtime`：按修改时间排序

### `readFile`

读取文本文件。

- 文本预览上限：`50 MB`
- 文件不存在时返回空内容

### `readBinary`

读取二进制文件（Base64）。

### `search`

在指定目录下递归搜索。

- `rootUri` 是当前 scope 下的相对路径或可解析 URI
- 命中后返回的 `entry.uri` 始终相对当前 scope 根目录

### `searchWorkspace`

跨所有已注册项目搜索。

说明：

- 路由名是 legacy；当前实际语义是“搜索所有 top-level project 及其子项目”
- 项目来源由 `readProjectTrees()` 决定

### `thumbnails`

批量获取缩略图。

### `folderThumbnails`

获取目录下条目的缩略图。

### `videoMetadata`

获取视频尺寸信息。

---

### `importLocalFile`

Electron 环境下把本地文件导入当前 scope。

---

## 路径解析链路

补充：

- `getProjectStorageRootPath()` 表示“默认项目存储根”
- 这与 `resolveScopedRootPath()` 的默认回退不同
- `fs` 路由未传 `projectId` 时，默认 scope 是 `getGlobalRootPath()`，也就是 `~/.openloaf`

---

## 常见错误

| 错误 | 正确做法 |
|------|----------|
| 继续传 `workspaceId` | 新代码统一只传 `projectId?` |
| 把 `rootPath` 传给前端/HTTP | 前端只传 `uri` / `rootUri` / `projectId` |
| 误以为未传 `projectId` 就是项目存储根 | 实际回退到全局根 `~/.openloaf` |
| `searchWorkspace` 当成单工作空间搜索 | 当前语义是跨所有已注册项目搜索 |
| 直接读取大文本文件 | 先检查 `tooLarge` |

---

## 相关文件

- `packages/api/src/routers/fs.ts`
- `packages/api/src/services/vfsService.ts`
- `packages/api/src/services/projectTreeService.ts`
- `packages/api/src/services/workspaceProjectConfig.ts`
