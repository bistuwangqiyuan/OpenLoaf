# Preview System

## 核心入口

| 代码 | 职责 |
|------|------|
| [open-file.ts](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/apps/web/src/components/file/lib/open-file.ts) | 统一入口，决定是 stack、modal 还是 embed，并处理 board / doc 特判 |
| [open-file-preview.tsx](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/apps/web/src/components/file/lib/open-file-preview.tsx) | embed 渲染入口，返回具体 Viewer 的 ReactNode |
| [file-preview-store.ts](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/apps/web/src/components/file/lib/file-preview-store.ts) | modal 预览的 Zustand store，统一 open / close 行为 |

## 打开链路

`openFilePreview()` 是当前统一入口，默认模式是 `stack`。主要分支如下：

1. 先处理 board / doc 的索引文件与目录特判
2. 目录在 `embed` 模式下走嵌入式内容渲染；普通目录可回退到导航回调
3. 文件通过 `resolveFileViewerTarget()` 决定 viewer 类型
4. 不支持内置预览的 Office 扩展会先确认，再走系统默认程序
5. 成功打开后会调用 `recordRecentOpen()`，更新最近打开列表

## 三种模式

### Stack

- 默认模式，向当前 Tab 的 stack 压入 viewer item
- 依赖 `tabId`；缺失时会直接报错并中止
- board 文件夹、文稿文件夹以及普通 viewer 都在这一层统一调度
- 常见 viewer 包括图片、Markdown、代码、PDF、文档、表格、视频和通用文件查看器

### Modal

- 通过 `file-preview-store` 打开全屏预览弹窗
- 关闭时 `closePreview()` 会先触发 `payload.onClose?.()`，再清空 store
- 图像和视频会按媒体尺寸计算更合适的弹窗大小，其余类型使用统一的大尺寸弹窗
- 多图预览场景可以通过 `activeIndex` 与切换回调维护当前项

### Embed

- 直接返回 ReactNode，适合文件面板内嵌预览
- `renderFilePreviewContent()` 会 lazy load 重型 viewer，避免初始 bundle 过大
- board 文件夹会渲染 `BoardFileViewer`；普通文件按 viewer 类型切换到对应组件
- PDF 在 embed 模式下也必须先把绝对路径转换成相对路径，才能匹配后端读取逻辑

## 特殊规则

- `index.tnboard` 对应的 board 文件会自动映射回 board 文件夹并在 stack 中打开
- 文稿索引文件会自动映射到文稿目录，并交给 `plate-doc-viewer`
- `isBoardFolderName()` 与 `isDocFolderName()` 都是当前预览入口里的一级分支，不要在各个调用点重复手写判断
- `shouldOpenOfficeWithSystem()` 只对内置未覆盖的 Office 扩展生效；被内置 viewer 覆盖的扩展应继续走应用内预览

## 最近打开通知

- `recordRecentOpen()` 会统一派发 `openloaf:recent-open` 事件
- 依赖最近打开列表的界面应该监听这个事件，而不是自己复制一份文件打开逻辑

## Working Rules

- 只写规则和代码链接，不放示例代码
- 新增预览类型时，先补统一入口和 viewer 判定，再考虑 UI 表现
- 任何 board / doc 特判都应收敛在统一入口，不要分散到各个调用点

## Common Mistakes

| 错误 | 正确做法 |
|------|----------|
| stack 打开时不传 `tabId` | 任何需要压入 stack 的预览都必须提供当前标签页 id |
| PDF 直接使用绝对 `uri` | 先转换为相对路径，再传给 PDF viewer |
| modal 关闭后忘记清理调用方状态 | 通过 `payload.onClose` 接入清理，store 会在关闭时自动调用 |
| Office 文件一律强行内置预览 | 先走 `shouldOpenOfficeWithSystem()` 判断是否需要交给系统默认程序 |
| 在各处重复实现 board / doc 特判 | 统一调用 `openFilePreview()`，不要分散复制打开逻辑 |
