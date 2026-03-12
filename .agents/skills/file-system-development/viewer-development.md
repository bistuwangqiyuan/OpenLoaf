# Viewer Development

## 添加新 Viewer：3 步流程

### Step 1: 创建 Viewer 组件

**必须使用 `ViewerGuard` 统一处理兜底状态（空/加载/错误/不支持/文件过大）。** 禁止自定义这些 UI。

- **ViewerGuard 组件**：`apps/web/src/components/file/lib/viewer-guard.tsx` — 查看 Props 和优先级逻辑
- **底层 fallback**：`apps/web/src/components/file/lib/read-file-error.tsx` — ViewerGuard 内部调用，Viewer 不应直接使用
- **参考实现（有 StackHeader）**：`apps/web/src/components/file/DocViewer.tsx` — ViewerGuard 包裹内容区
- **参考实现（无 StackHeader）**：`apps/web/src/components/file/FileViewer.tsx` — ViewerGuard 包裹整个返回值

### Step 2: 注册类型映射

修改两个文件：

- **类型映射**：`apps/web/src/components/file/lib/file-viewer-target.ts` — `resolveFileViewerTarget()` 中添加扩展名分支
- **类型定义**：`apps/web/src/components/file/lib/file-preview-types.ts` — 扩展 `FilePreviewViewer` 联合类型

### Step 3: 添加渲染路由

需要在 **三个位置** 添加渲染分支：

1. `apps/web/src/components/file/lib/open-file-preview.tsx` — `renderFilePreviewContent()` switch（嵌入式渲染）
2. `apps/web/src/components/file/lib/open-file.ts` — `buildStackItemForEntry()` switch（Stack 面板）
3. `apps/web/src/components/file/FilePreviewDialog.tsx` — 条件渲染分支（Modal 弹窗）

## 现有 Viewer 参考

| Viewer | type | 核心库 | 文件 |
|--------|------|--------|------|
| ImageViewer | `image` | react-zoom-pan-pinch | `apps/web/src/components/file/ImageViewer.tsx` |
| SheetViewer | `sheet` | Univer | `apps/web/src/components/file/SheetViewer.tsx` |
| CodeViewer | `code` | Monaco | `apps/web/src/components/file/CodeViewer.tsx` |
| TerminalViewer | — | xterm | `apps/web/src/components/file/TerminalViewer.tsx` |
| MarkdownViewer | `markdown` | Streamdown + Shiki | `apps/web/src/components/file/MarkdownViewer.tsx` |
| ExcelViewer | `sheet` | SheetJS (xlsx) | `apps/web/src/components/file/ExcelViewer.tsx` |
| DocViewer | `doc` | Plate.js | `apps/web/src/components/file/DocViewer.tsx` |
| VideoViewer | `video` | HLS.js | `apps/web/src/components/file/VideoViewer.tsx` |
| PdfViewer | `pdf` | react-pdf + pdfjs | `apps/web/src/components/file/PdfViewer.tsx` |
| FileViewer | `file` | — | `apps/web/src/components/file/FileViewer.tsx` |

## 统一 Props 模式

所有 Viewer 的 Props 接口参见任意现有 Viewer 文件顶部的 `interface`。通用字段：`uri`, `name`, `ext`, `projectId`, `rootUri`, `readOnly`, `openUri`, `panelKey`, `tabId`；新代码不再透传 `workspaceId`。

## 文件类型映射

扩展名→Viewer 类型的完整映射定义在 `apps/web/src/components/file/lib/file-viewer-target.ts`。

## 错误处理规范

**所有 Viewer 必须使用 `ViewerGuard` 处理兜底状态。** ViewerGuard 按优先级依次检查：`!uri` → `notSupported` → `tooLarge` → `error` → `loading` → 渲染 children。

- **ViewerGuard 源码**：`apps/web/src/components/file/lib/viewer-guard.tsx`
- **ReadFileErrorFallback 源码**：`apps/web/src/components/file/lib/read-file-error.tsx`

## Common Mistakes

| 错误 | 正确做法 |
|------|----------|
| 只在一个位置添加渲染分支 | 必须同时更新 3 个位置（见 Step 3） |
| 忘记扩展 `FilePreviewViewer` 类型 | 见 `file-preview-types.ts` |
| 自定义错误/空/加载 UI | **禁止** — 必须使用 `ViewerGuard` |
| 直接调用 `ReadFileErrorFallback` | 使用 `ViewerGuard`（内部已封装） |
| PDF 使用绝对路径 | PDF 需要相对路径（见 `file-system-utils.ts` 的 `getRelativePathFromUri`）|
| Video 不传 width/height | 弹窗尺寸计算依赖这两个值 |
| 忘记 `__customHeader` 参数 | Markdown/PDF/Doc/Sheet/Video 在 Stack 中需要 `__customHeader: true` |
