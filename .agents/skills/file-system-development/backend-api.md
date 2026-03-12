# Backend API

## tRPC fs 路由速查

位置：`packages/api/src/routers/fs.ts`

当前 `fs` 路由已经切到**项目中心**语义：

- 大多数接口只接收 `projectId?` + `uri`
- **不再要求** `workspaceId`
- 未传 `projectId` 时，服务端回退到全局根目录 `~/.openloaf`
- `searchWorkspace` 这个路由名仍是 legacy 命名，但当前语义是“跨所有已注册项目搜索”

---

## 输入模型

### 基础 scope

```typescript
{ projectId?: string }
```

### 文件/目录定位

```typescript
{ projectId?: string; uri: string }
```

### 目录搜索

```typescript
{
  projectId?: string;
  rootUri: string;
  query: string;
  includeHidden?: boolean;
  limit?: number;     // 默认 500，最大 2000
  maxDepth?: number;  // 默认 12，最大 50
}
```

### 跨项目搜索

```typescript
{
  query: string;
  includeHidden?: boolean;
  limit?: number;
  maxDepth?: number;
}
```

---

## 查询操作

### `stat`

获取文件/目录元数据。

```typescript
trpc.fs.stat.queryOptions({ projectId, uri })
// → { name, kind, uri, ext, size, createdAt, updatedAt, isEmpty? }
```

### `list`

列出目录内容。

```typescript
trpc.fs.list.queryOptions({
  projectId,
  uri,
  includeHidden?: boolean,
  sort?: { field: "name" | "mtime"; order: "asc" | "desc" },
})
// → { entries: FileNode[] }
```

排序规则：

- `name`：普通文件夹 → Board 文件夹 → 文件
- `mtime`：按修改时间排序

### `readFile`

读取文本文件。

```typescript
trpc.fs.readFile.queryOptions({ projectId, uri })
// → { content: string, tooLarge?: boolean }
```

- 文本预览上限：`50 MB`
- 文件不存在时返回空内容

### `readBinary`

读取二进制文件（Base64）。

```typescript
trpc.fs.readBinary.queryOptions({ projectId, uri })
// → { contentBase64: string, mime: string }
```

### `search`

在指定目录下递归搜索。

```typescript
trpc.fs.search.queryOptions({
  projectId,
  rootUri,
  query,
  includeHidden?: boolean,
  limit?: number,
  maxDepth?: number,
})
// → { results: FileNode[] }
```

- `rootUri` 是当前 scope 下的相对路径或可解析 URI
- 命中后返回的 `entry.uri` 始终相对当前 scope 根目录

### `searchWorkspace`

跨所有已注册项目搜索。

```typescript
trpc.fs.searchWorkspace.queryOptions({
  query,
  includeHidden?: boolean,
  limit?: number,
  maxDepth?: number,
})
// → {
//   results: [{
//     projectId,
//     projectTitle,
//     entry,
//     relativePath,
//   }]
// }
```

说明：

- 路由名是 legacy；当前实际语义是“搜索所有 top-level project 及其子项目”
- 项目来源由 `readProjectTrees()` 决定

### `thumbnails`

批量获取缩略图。

```typescript
trpc.fs.thumbnails.queryOptions({
  projectId,
  uris: string[], // 最多 50 个
})
// → { items: [{ uri, dataUrl }] }
```

### `folderThumbnails`

获取目录下条目的缩略图。

```typescript
trpc.fs.folderThumbnails.queryOptions({
  projectId,
  uri,
  includeHidden?: boolean,
})
// → { items: [{ uri, dataUrl }] }
```

### `videoMetadata`

获取视频尺寸信息。

```typescript
trpc.fs.videoMetadata.queryOptions({ projectId, uri })
// → { width: number | null, height: number | null }
```

---

## 变更操作

### `writeFile`

```typescript
trpc.fs.writeFile.mutate({ projectId, uri, content })
// → { ok: true }
```

### `writeBinary`

```typescript
trpc.fs.writeBinary.mutate({ projectId, uri, contentBase64 })
// → { ok: true }
```

### `appendBinary`

```typescript
trpc.fs.appendBinary.mutate({ projectId, uri, contentBase64 })
// → { ok: true }
```

### `mkdir`

```typescript
trpc.fs.mkdir.mutate({ projectId, uri, recursive?: boolean })
// → { ok: true }
```

### `rename`

```typescript
trpc.fs.rename.mutate({ projectId, from, to })
// → { ok: true }
```

### `copy`

```typescript
trpc.fs.copy.mutate({ projectId, from, to })
// → { ok: true }
```

### `delete`

```typescript
trpc.fs.delete.mutate({ projectId, uri, recursive?: boolean })
// → { ok: true }
```

### `importLocalFile`

Electron 环境下把本地文件导入当前 scope。

```typescript
trpc.fs.importLocalFile.mutate({
  projectId,
  uri,
  sourcePath,
})
// → { ok: true }
```

---

## 路径解析链路

```typescript
resolveScopedRootPath({ projectId? }) // project 根或 ~/.openloaf
resolveScopedPath({ projectId?, target })
toRelativePath(rootPath, fullPath)
```

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
