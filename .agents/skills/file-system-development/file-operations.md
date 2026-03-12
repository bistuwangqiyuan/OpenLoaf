
## useProjectFileSystemModel

核心文件系统 Model，封装导航、CRUD、拖拽、搜索、排序等所有操作。

### 撤销逻辑

| 操作 | 撤销方式 |
|------|----------|
| `rename` | 反向重命名 `to → from` |
| `copy` | 删除目标 `to` |
| `mkdir` | 删除目录 |
| `create` | 删除文件 |
| `delete` | 从 `trashUri` 恢复 |
| `trash` | 不可恢复，提示用户 |
| `batch` | 逆序撤销所有子操作 |

### 持久化

历史栈通过 `historyStore` (Map) 按 `historyKey` 保持跨重渲染一致性，但不持久化到 localStorage。

## 文件重命名 (useFileRename)

**Board 文件夹特殊处理**：重命名时自动添加 `tnboard_` 前缀（`ensureBoardFolderName`）。

## 右键菜单 (useFileSystemContextMenu)

**关键行为**：
- 右键按下时快照目标条目，避免菜单关闭动画期间内容闪烁
- 200ms 选择防护，防止右键抬起立即触发菜单项

### 拖拽预览

多选拖拽时构建堆叠预览（最多前 3 个缩略图），区分图片和文件的拖拽行为。

### Electron 特殊处理

Electron 环境下拖拽使用本地文件路径，Web 环境使用 DataTransfer 数据。

## 框选 (useFileSystemSelection)

**特点**：4px 阈值防止意外激活框选。

## 内存剪贴板

注意：剪贴板为内存级别，刷新页面后丢失。

## Common Mistakes

| 错误 | 正确做法 |
|------|----------|
| 重命名不检查同名 | `handleRenamingSubmit` 已包含同名检查 |
| 直接 `fs.delete` 不记录历史 | 通过 Model 操作自动推入历史栈 |
| Board 文件夹重命名丢失前缀 | 使用 `ensureBoardFolderName()` |
| 拖拽不区分 Electron/Web | 检查 `isElectronEnv()` 决定拖拽行为 |
| 右键菜单闪烁 | 使用 `menuContextEntry` 快照而非实时查询 |
| 撤销 trash 操作 | `trash` 类型操作不可 redo，需提示用户 |
| blur 和 Enter 重复提交重命名 | `isSubmittingRef` 已防护 |
