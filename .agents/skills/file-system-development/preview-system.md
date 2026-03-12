

### Stack 模式（默认）

在 Tab 的 Stack 面板中打开文件：

每种 Viewer 对应一个 `component` 标识：`"image-viewer"`, `"markdown-viewer"`, `"code-viewer"`, `"pdf-viewer"`, `"doc-viewer"`, `"sheet-viewer"`, `"video-viewer"`, `"file-viewer"`。

### Modal 模式

全屏弹窗预览，通过 Zustand Store 驱动：

**弹窗尺寸**：
- 图像：`getImageDialogSize(meta)` — 根据图片实际尺寸和视窗计算
- 视频：`getVideoDialogSize({ width, height })` — 等比缩放适配视窗
- 其他：`90vw × 90vh` 固定尺寸

**图像导航**：多图预览时显示上/下一张按钮，通过 `onActiveIndexChange` 回调切换。

### Embed 模式

嵌入式渲染，返回 ReactNode：

### 通知

监听方可通过 `addEventListener("openloaf:recent-open", ...)` 实时更新最近打开列表。

## Common Mistakes

| 错误 | 正确做法 |
|------|----------|
| Modal 关闭不触发 `onClose` | `closePreview()` 已自动调用 `payload.onClose?.()` |
| Stack 模式不传 `tabId` | 没有 `tabId` 会 toast 错误 |
| PDF 使用绝对 URI | PDF 需要 `getRelativePathFromUri()` 转相对路径 |
| Office 文件直接预览 | 先检查 `shouldOpenOfficeWithSystem()` |
| 视频弹窗没有尺寸 | 必须传 `width`/`height` 给 FilePreviewItem |
| 最近打开不通知 | `recordRecentOpen` 已自动发 CustomEvent |
| Board 文件夹不特殊处理 | `openFilePreview` 已检测 `isBoardFolderName()` |
