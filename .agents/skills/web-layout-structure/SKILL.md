---
name: web-layout-structure
description: Use when working on or debugging the web app layout in apps/web/src/components/layout, including header, sidebar, tab split, left dock stack panels, right chat panel, or layout gates.
---

# Web Layout Structure（apps/web/src/components/layout）

> **术语映射**：代码 `workspace` = 产品「工作空间」（顶层容器），代码 `project` = 产品「项目」（项目文件夹）。

## Overview
这个 skill 用来快速理解 Web 端整体布局的结构、渲染顺序和关键状态来源，避免在 Header / Sidebar / TabLayout / LeftDock / Chat 面板之间迷路。

## When to Use
- 需要调整全局布局（Header / Sidebar / 主内容区）
- 需要改动 Tab 左右分栏、拖拽宽度、聊天面板折叠/展开
- 需要理解 LeftDock 的 base + stack 叠加逻辑
- 需要定位 Loading / Gate / Providers 导致的渲染阻塞
- **维护规则**：只要修改了上述布局相关文件或逻辑，必须第一时间同步更新本 skill（保持结构与路径一致）。

## Layout Entry Points
- `apps/web/src/app/layout.tsx`：RootLayout，加载 Providers + 全局 Gate
- `apps/web/src/app/page.tsx`：页面骨架（Header + Sidebar + MainContent）
- `apps/web/src/components/layout/*`：具体布局与面板容器

### Header
- 文件：`apps/web/src/components/layout/header/Header.tsx`
- 结构：
  - 左侧：侧边栏开关 + 设置入口（`openSettingsTab`）
  - 中间：`PageTitle` + `HeaderTabs` 相关区域；Header 左侧标题保持纯文本，不在标题文案前渲染静态 icon，避免与可点击图标混淆
  - 项目壳场景下，`PageTitle` 可回退到 `activeTab.projectShell.title`，避免项目数据尚未加载时出现空标题或 `Untitled`
  - 设置按钮的选中态也要跟随当前前景页面：设置页可见时高亮设置按钮，不按底层 base 残留状态判断
  - `openSettingsTab()` 在项目模式下必须进入 `project-settings-page`，不能回退到全局 `settings-page`
  - 旧的顶部“历史记录”按钮/弹层已废弃，不再作为 Header 入口保留
  - 右侧：`StackDockMenuButton`、`ModeToggle`、聊天面板开关
  - 全局设置页（前景 component = `settings-page`）必须隐藏并禁用右侧 chat 开关，避免在设置场景暴露聊天能力
- Electron / macOS：使用 `--macos-traffic-lights-width` 调整标题栏空间

### Sidebar
- 文件：`apps/web/src/components/layout/sidebar/Sidebar.tsx`
- 逻辑：
  - 使用 `@openloaf/ui/sidebar`，`SidebarProvider` 控制展开状态
  - 窄屏（<900px）直接隐藏侧边栏（`useIsNarrowScreen`）
  - 项目模式判断不要只依赖 `activeTab.projectShell`；统一通过 `apps/web/src/lib/project-mode.ts` 中的 `resolveProjectModeProjectShell()` / `isProjectMode()` 解析（优先 tab.projectShell，其次回退到独立项目窗口 URL bootstrap）
  - 只要当前 renderer 处于项目模式，主 Sidebar 就应切换为 `ProjectSidebar`，避免项目独立窗口里新开的聊天、画布、设置页掉回主 Sidebar
  - 普通 Sidebar 与 `ProjectSidebar` 的切换动画必须保留同一个外层 `Sidebar` 壳，只切换内部 header/content/footer；不要在外层额外包裹节点，否则会破坏 `SidebarInset` 依赖的 `peer` 布局关系
  - `SidebarHeader` 放入口菜单（搜索、日历、AI、邮箱、技能等）
  - `SidebarContent` 主要承载侧边栏历史列表（当前实现为 `SidebarHistory`）；历史列表不再按日期分组，而是直接平铺，列表项单行显示“图标 + 标题 + 行尾时间”，不显示项目名和类型；项目类型记录不在历史列表中展示
  - `SidebarHistory` 顶部保留“历史记录”标题和右侧排序按钮；默认按首次访问时间排序，点击后切到按最近访问时间排序，列表行尾时间同步切换到对应时间字段
  - `ProjectSidebar` 负责项目内导航：返回项目空间、AI管理员、画布、看板、文件、设置、历史；底部历史列表会按 `projectId` 过滤，只显示当前项目访问记录
  - `SidebarHistory` 需要全局隐藏 `entityType === "project"` 的“项目打开记录”；项目本体信息由项目页入口或 footer 项目卡片承载，不在历史列表里重复出现
  - `ProjectSidebar` 需要把项目摘要卡片（项目 icon + 名称）放在 `SidebarFooter`，与“设置”一起构成底部区域；不要在 header 中重复渲染
  - `ProjectSidebar` footer 中的项目摘要卡片支持副标题，当前用于显示项目类型
  - `ProjectSidebar` 顶部不显示 `SidebarUserAccount`；返回按钮需要沿用账号项的高度（`h-12`）以保持节奏一致
  - 返回“项目空间”按钮保留在 header 顶部；项目名称和设置都放到底部 footer
  - 当设置按钮需要显示在项目名称右侧时，footer 应改成单行布局：左侧项目卡片，右侧纯图标设置按钮
  - `ProjectSidebar` 的激活 section 需要结合前景组件推断：`board-viewer` / `canvas-list-page` 归到 `canvas`，文件预览类组件归到 `files`，`project-settings-page` 归到 `settings`
  - `SidebarFooter` 为反馈入口
  - “智能画布 / 项目空间”等主页面入口的高亮，需要以前景页面为准：有 stack 时看 `activeStackItemId` 对应的 component，没有 stack 才看 base；只有在前景页面缺失时才回退到 `activeViewType`

### Search Overlay
- 文件：`apps/web/src/components/search/Search.tsx`
- 逻辑：
  - 搜索默认会读取当前活跃项目上下文；项目模式下必须强制收敛到当前项目，不允许退回“项目空间”全局搜索
  - 项目模式下要隐藏全局 `Quick Open` 和“最近打开（项目空间）”，只保留当前项目文件搜索与当前项目最近打开
  - 项目范围的输入前缀只在允许切回全局时才能被 Backspace/Delete 清空；项目模式下应保持锁定

### MainContent（Tab Keep-Alive）
- 文件：`apps/web/src/components/layout/MainContext.tsx`
- 逻辑：
  - 仅首次激活时挂载 tab scene
  - tab 关闭后释放对应 mounted 状态
  - 用于“像浏览器 Tab 一样”的状态保留

### TabLayout（左右分栏 + Panel Host）
- 文件：`apps/web/src/components/layout/TabLayout.tsx`
- 关键点：
  - 通过 `bindPanelHost("left"|"right")` 绑定左右容器
  - `renderPanel` / `setPanelActive` / `syncPanelTabs` 管理每个 tab 的面板挂载
  - 左右分栏的三种模式：
    - A：左+右都可见（默认）
    - B：仅左侧可见（右侧折叠）
    - C：仅右侧可见（左侧隐藏）
  - 最小宽度：`LEFT_DOCK_MIN_PX` / `RIGHT_CHAT_MIN_PX`
  - 拖拽分割条会写入 `leftWidthPercent`（`useTabRuntime`）
  - `rightChatCollapsed` 决定右侧是否显示
  - 前景页面为 `settings-page` / `project-settings-page` / `project-list-page` / `global-desktop` / `canvas-list-page` 时，右侧 chat panel 必须视为强制隐藏，且不要激活右侧 panel host
  - 项目壳 `plant-page` 的 `index` / `canvas` / `files` / `tasks(history)` 子页，以及文件预览前景（如 `file-viewer` / `markdown-viewer` / `code-viewer` 等）也必须强制隐藏右侧 chat
  - 若前景是项目上下文里的 `board-viewer`（`projectShell.section === "canvas"`），也必须隐藏右侧 chat；不要误伤普通临时画布
  - 项目壳 tab（`tab.projectShell` 存在）不能再走旧的“按会话 projectId 自动创建 / 更新 plant-page” fallback；否则项目 AI 管理员页会被错误改写成项目页

### LeftDock（Base + Stack）
- 文件：`apps/web/src/components/layout/LeftDock.tsx`
- 结构：
  - `base`：主面板，永远铺底
  - `stack`：叠加面板（只显示 active），可最小化
  - `stackHidden` 决定是否最小化；ESC 会触发 `requestStackMinimize`
  - `PanelFrame` 统一使用 `StackHeader`，支持 refresh / close / minimize
- 重要参数：
  - `__customHeader`：自定义 Header（不渲染 StackHeader）
  - `__refreshKey`：强制 remount 面板
  - `__opaque`：是否使用纯背景
  - 项目壳设置页通过 `project-settings-page` 作为 base component 挂进 LeftDock，不再走旧的 dialog 入口
  - `GlobalEntryDockTabs` 里的 workbench dock 上下文（`global-desktop` / `calendar-page` / `email-page` / `scheduled-tasks-page`）属于同一组切换：sidebar 仍高亮“全局看板”，且 dock tabs 中不显示“智能画布”

### RightChatPanel
- 文件：`apps/web/src/components/layout/TabLayout.tsx` 内 `RightChatPanel`
- 逻辑：
  - `Chat` 组件挂载在右侧
  - 支持多会话列表（`ChatSessionBarItem`）
  - 新建/删除/切换会话由 `useTabs` 驱动

### StackHeader（统一面板标题栏）
- 文件：`apps/web/src/components/layout/StackHeader.tsx`
- 作用：
  - 统一 Header UI（标题 + 右侧操作）
  - 可选按钮：系统打开、刷新、最小化、关闭

### Loading / Gates
- `ServerConnectionGate`：等待后端健康检查成功
- `StepUpGate`：等待基础配置完成
- `LoadingScreen`：统一加载屏
- `AutoUpdateGate`：更新提示弹窗（在 `Providers` 内挂载）

## Key Data / State
- `useTabs`：tab 列表、activeTab、stack/base 元信息
  - `useTabs.addTab()` 在当前 renderer 可解析为项目模式时，会为项目内新开的 chat / board / project file / project settings tab 自动继承 `projectShell`；若调用侧未显式传 `chatParams.projectId`，还会补齐当前项目 id，避免新 tab 掉回普通 Sidebar 或丢失项目上下文
- `useTabRuntime`：运行时数据（leftWidthPercent、rightChatCollapsed、runtimeByTabId）
- `panel-runtime`：左右面板的 mount/unmount 与 keep-alive 管理
- 项目独立窗口会把 `useTabs` / `useTabRuntime` 的持久化切到 `sessionStorage`，主窗口仍使用 `localStorage`，避免两类窗口互相污染 tab 恢复状态

### 项目关联模型（Session 级别）

项目关联是 **Session 级别**而非 Tab 级别，同一 Tab 下不同会话可以绑定不同项目。

**核心机制**：`chatParams.projectId` 始终与活跃会话的 projectId 同步，所有下游消费者（Chat、ChatCoreProvider、use-chat-sessions、frontend-tool-executor 等）无需修改。

**自动同步触发点**：
- `setActiveTabSession(tabId, sessionId)` — 切换会话时从 `chatSessionProjectIds[sessionId]` 读取并写入 `chatParams.projectId`
- `setSessionProjectId(tabId, sessionId, projectId)` — 修改会话项目时，若是活跃会话则同步 chatParams
- `addTabSession` — 新建会话时继承当前活跃会话的 projectId
- `removeTabSession` — 删除活跃会话时，新活跃会话的 projectId 也同步

**Tab 标题多项目**（HeaderTabs）：从 `chatSessionProjectIds` 提取不重复 projectId，2+ 个项目时显示 `Layers` 图标 + 项目名拼接。

### LeftDock 按会话保存/恢复

`TabRuntime.dockSnapshotBySessionId: Record<sessionId, DockSnapshot>` 保存每个会话的完整 LeftDock 状态。

**`DockSnapshot`** 包含：`base`、`stack`、`leftWidthPercent`、`minLeftWidth`、`rightChatCollapsed`、`rightChatCollapsedSnapshot`、`stackHidden`、`activeStackItemId`

**切换会话流程**（`RightChatPanel` effect）：
1. `saveDockSnapshot(tabId, oldSessionId)` — 保存旧会话 dock
2. `restoreDockSnapshot(tabId, newSessionId)` — 恢复新会话 dock
3. 无快照 fallback：根据新会话 projectId 创建/更新 plant-page
4. 如果当前 tab 是项目壳（`projectShell` 存在），必须跳过上述 fallback，保持当前项目 section 不被会话切换覆盖

**同会话内切项目**（ChatInput 项目选择器）：
- 已有 plant-page → 更新项目，**保留 `projectTab` 子页签**（files/canvas/tasks 等）
- 无 base（Workspace 模式）→ 自动创建 plant-page + 设置默认宽度
- 其他类型 base → 不动

## Common Pitfalls
- 忘记 `bindPanelHost` 或 `syncPanelTabs`，导致面板挂载错位
- 直接改 DOM 结构，绕开 `panel-runtime`（会破坏 keep-alive）
- 修改 `TabLayout` 时忽略 `minLeftWidth` 动画保护，导致宽度抖动
- `stackHidden` 与 `stack` 状态不同步，导致面板”看不见但仍拦截点击”
- 修改项目关联时直接写 `setTabChatParams({ projectId })` 而不用 `setSessionProjectId` — 会导致映射不同步
- 删除会话时忘记调用 `clearDockSnapshot` — 会导致 dock snapshot 残留膨胀

## Quick File Map
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/components/layout/MainContext.tsx`
- `apps/web/src/components/layout/TabLayout.tsx`
- `apps/web/src/components/layout/LeftDock.tsx`
- `apps/web/src/components/layout/StackHeader.tsx`
- `apps/web/src/components/layout/header/*`
- `apps/web/src/components/layout/sidebar/*`
- `apps/web/src/components/layout/LoadingScreen.tsx`
- `apps/web/src/components/layout/ServerConnectionGate.tsx`
- `apps/web/src/components/layout/StepUpGate.tsx`
- `apps/web/src/components/layout/AutoUpdateGate.tsx`
