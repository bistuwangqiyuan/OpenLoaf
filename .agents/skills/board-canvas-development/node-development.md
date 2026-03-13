# Node Development

## 核心入口

| 代码 | 职责 |
|------|------|
| [types.ts](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/apps/web/src/components/board/engine/types.ts) | `CanvasNodeDefinition`、`CanvasNodeViewProps` 等核心类型定义 |
| [board-nodes.ts](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/apps/web/src/components/board/core/board-nodes.ts) | 默认节点注册表 `BOARD_NODE_DEFINITIONS` |
| [CanvasEngine.ts](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/apps/web/src/components/board/engine/CanvasEngine.ts) | 通过 `registerNodes()` 把定义交给 `NodeRegistry` |
| [NodeFrame.tsx](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/apps/web/src/components/board/nodes/NodeFrame.tsx) | 节点通用外框与基础交互壳 |
| [nodes/](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/apps/web/src/components/board/nodes/) | 各节点实现目录 |

## 开发流程

### 1. 先定义持久化模型

- 明确节点 `type`、持久化 `props`、默认尺寸以及是否需要运行时校验
- 需要校验时，在 `CanvasNodeDefinition` 上提供 `schema`
- 节点 `type` 必须全局唯一；冲突会在注册阶段直接抛错

### 2. 创建 View 组件

`CanvasNodeViewProps` 是节点视图的标准输入：

- `element`：节点完整数据，包含 `id`、`xywh`、`props`、旋转、透明度等持久化字段
- `selected`：当前是否被选中
- `editing`：是否处于编辑态
- `onSelect()`：请求选中当前节点
- `onUpdate(patch)`：更新节点 props，并自动写入 engine 与历史记录

实现要求：

- 视图层把 `element.props` 当作单一事实来源
- 需要改 props 时优先走 `onUpdate`，不要在视图里自己改写内部文档状态
- 大多数可交互节点都应包在 `NodeFrame` 内，复用选中边框、拖拽命中区、右键菜单等基础行为

### 3. 补齐 `CanvasNodeDefinition`

常用字段如下：

| 字段 | 用途 |
|------|------|
| `type` | 节点唯一标识 |
| `defaultProps` | 新建节点时的默认 props |
| `view` | 节点 React 视图组件 |
| `schema` | 可选的 props 运行时校验 |
| `getMinSize` / `measure` | 动态最小尺寸或自动测量 |
| `anchors` | 连线锚点，必须返回世界坐标 |
| `toolbar` | 选中节点后的工具栏项 |
| `connectorTemplates` | 从锚点拖出时的模板节点 |
| `capabilities` | 是否可缩放、旋转、连线等能力开关 |

### 4. 注册到默认节点表

- 把新定义加入 `BOARD_NODE_DEFINITIONS`
- `ProjectBoardCanvas` 与 `BoardFileViewer` 都依赖这份默认节点表，因此漏注册会导致画布无法识别该节点
- 如果节点只属于某个特殊 board 场景，仍应先确认是否真的需要做成全局默认节点，而不是直接塞进默认表

## 交互规则

- 节点坐标、锚点坐标和尺寸计算都以世界坐标为准，不要混用屏幕坐标
- 涉及自动布局、连线模板、工具栏动作时，优先使用 engine 已暴露的能力，而不是在节点内部发散实现一套旁路逻辑
- 节点的“展示名”和“持久化字段”要分清楚；可读 label 可以在视图层派生，不要污染存储结构

## 现有节点参考

| 节点 | `type` | 特点 |
|------|--------|------|
| TextNode | `text` | 富文本编辑、自动尺寸、复杂度最高 |
| ImageNode | `image` | 图片预览、board 资源路径、转码 |
| VideoNode | `video` | 视频播放与封面 |
| LinkNode | `link` | URL 卡片与外部打开 |
| GroupNode | `group` / `image_group` | 子节点分组与布局 |
| StrokeNode | `stroke` | 手写笔画数据 |
| LoadingNode | `loading` | 异步任务占位与轮询 |
| AI 生成节点 | `image_generate`、`video_generate`、`image_prompt_generate` | 生成流程与表单交互 |

## Working Rules

- 只写规则和代码链接，不放示例代码
- 新节点先对齐 `types.ts` 和注册表，再补业务 UI
- 任何涉及节点 schema、toolbar、anchors 的变更，都要回看对应定义是否仍完整

## Common Mistakes

| 错误 | 正确做法 |
|------|----------|
| 只写了节点组件，没有加入 `BOARD_NODE_DEFINITIONS` | 注册表是默认节点入口，漏掉就不会生效 |
| 在节点里直接改 engine 内部状态 | 节点 props 更新优先走 `onUpdate` 或明确的 engine API |
| 锚点返回屏幕坐标 | `anchors` 必须返回世界坐标 |
| 节点不包裹 `NodeFrame` | 会丢失通用交互能力与视觉边框 |
| 把临时 UI 状态写进持久化 props | 只把需要保存到 board 文件的状态写进 `props` |
