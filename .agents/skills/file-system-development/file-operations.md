# File Operations

## 核心入口

| 代码 | 职责 |
|------|------|
| [file-system-model.ts](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/apps/web/src/components/project/filesystem/models/file-system-model.ts) | 文件系统主模型，统一封装导航、列表、搜索、排序、创建、删除、复制、拖拽、历史记录 |
| [use-file-rename.ts](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/apps/web/src/hooks/use-file-rename.ts) | 重命名状态、显示名转换、同名校验、提交防重 |
| [use-file-system-context-menu.ts](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/apps/web/src/hooks/use-file-system-context-menu.ts) | 右键菜单目标快照与误触防护 |
| [use-file-system-selection.ts](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/apps/web/src/components/project/filesystem/hooks/use-file-system-selection.ts) | 框选、全选、点击空白清空选择 |

## 操作原则

- 文件系统组件优先通过 `useProjectFileSystemModel` 暴露的动作完成增删改移动，不要在视图层绕过它散落调用底层 `trpc.fs.*`
- 这样可以同时拿到刷新列表、选择态更新、toast、拖拽状态和历史栈的一致行为
- 当前文件链路已经不再依赖旧的工作空间兼容字段；新逻辑统一围绕 `projectId`、`rootUri`、相对 `uri` 工作

## 历史与撤销

当前模型会把可撤销操作统一写入 `historyStore`，按 `historyKey` 在重渲染间保留：

| 操作 | 撤销方式 |
|------|----------|
| `rename` | 反向重命名 |
| `copy` | 删除复制出的目标条目 |
| `mkdir` | 删除新建目录 |
| `create` | 删除新建文件 |
| `delete` | 从隐藏回收站路径恢复 |
| `batch` | 逆序撤销每个子操作 |

边界：

- 普通删除会先移动到项目内隐藏回收站，再进入可撤销历史
- “彻底删除”不会写入历史栈，执行前应明确提示不可撤回
- 历史栈只保存在内存，不落到 `localStorage`

## 重命名规则

- 重命名输入展示的是用户可读名称，不一定等于磁盘最终文件名
- Board 文件夹会走 `ensureBoardFolderName()`，文稿文件夹会走 `ensureDocFolderName()`，避免丢失系统前缀
- `useFileRename` 已内置同名检查和 `blur` / `Enter` 重复提交防护
- 新建后立即重命名时，应走 `requestRenameByInfo()`，不要手写一套临时状态

## 右键菜单与选择态

- 右键菜单打开前会先缓存目标条目快照，避免目录刷新或关闭动画期间菜单内容闪烁
- 菜单项有约 200ms 的选择防护，避免右键抬起直接误触首个菜单项
- 框选需要跨过 4px 阈值才会生效，避免把普通点击误判为框选
- 当处于重命名态时，点击空白区域优先提交重命名，而不是开始框选
- Grid 聚焦后支持 `Ctrl/Cmd+A` 全选；输入框与可编辑区域保持浏览器默认行为

## 拖拽与剪贴板

- 多选拖拽会生成堆叠预览，图片区分缩略图与普通文件预览
- Electron 与 Web 的拖拽载荷不同：Electron 走本地文件路径，Web 走 `DataTransfer`
- Electron 侧会在 `dragend`、窗口失焦、页面隐藏、`Escape` 等事件里清理拖拽会话，避免残留
- 文件剪贴板是内存级状态，刷新页面后会丢失，不要把它当作持久能力

## Working Rules

- 只写规则和代码链接，不放示例代码
- 涉及文件操作行为变更时，优先回看 `file-system-model.ts`，再决定是否扩散到单独 hook
- 任何可撤销操作都要先确认是否已经接入历史栈，不要只做视觉层刷新

## Common Mistakes

| 错误 | 正确做法 |
|------|----------|
| 直接在组件里调用底层删除接口，绕过 model | 统一走 `useProjectFileSystemModel` 暴露的动作，保持历史和刷新逻辑一致 |
| 重命名 Board 或文稿文件夹时直接写用户输入 | 让重命名流程自动补齐系统前缀 |
| 把“彻底删除”当成可撤销操作 | 只有普通删除会进入隐藏回收站并写入历史 |
| 右键菜单渲染时实时读当前选中项 | 使用 `menuContextEntry` 快照，避免闪烁 |
| 忽略 Electron/Web 拖拽差异 | 先判断运行环境，再决定拖拽载荷与清理逻辑 |
