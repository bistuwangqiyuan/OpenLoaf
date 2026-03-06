# 架构重构计划：从 Tab 模式迁移到简化导航模式

## 目标

简化 OpenLoaf 的导航架构，移除用户可见的 Tab 概念，改为直接的 Sidebar 导航。核心改动：

1. **移除 HeaderTabs UI**：删除顶部标签栏组件，用户通过 Sidebar 导航
2. **保留 Tab 系统**：Tab ID、状态管理、数据结构完全保留，作为后台状态管理
3. **Chat 文件重构**：统一文件存储到 `root/` 目录
4. **对话转项目**：允许 Workspace Chat 转为正式项目
5. **智能卸载**：自动清理无内容的空白 tab

## 核心原则

- **用户视角**：通过 Sidebar 切换"页面"，无 Tab 概念
- **技术实现**：Tab 系统在后台管理状态，不在 UI 显示
- **向后兼容**：现有 Tab 数据结构和逻辑完全保留

---

## Phase 1: 基础设施准备

### 1.1 创建 tRPC 路由：convertChatToProject

**文件**: `packages/api/src/routers/project.ts`

**功能**:
```typescript
convertChatToProject: shieldedProcedure
  .input(z.object({
    chatSessionId: z.string(),
    projectTitle: z.string().optional(),
    projectParentId: z.string().optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    // 1. 验证 ChatSession 存在且 projectId IS NULL
    // 2. 生成项目 ID 和目录
    // 3. 复制 chat-history/{sessionId}/root/ → {projectRoot}/
    // 4. 创建 Project 记录
    // 5. 更新 ChatSession.projectId
    // 6. 返回新项目 ID
  })
```

**实现步骤**:
1. 查询 `ChatSession`，验证 `projectId IS NULL`
2. 使用对话标题或用户输入生成项目名称
3. 在 Workspace 默认项目目录下创建项目文件夹
4. 使用 `fs.cp` 复制 `chat-history/{sessionId}/root/` → `{projectRoot}/`
5. 创建 `Project` 数据库记录
6. 更新 `ChatSession.projectId = newProjectId`
7. 调用 `clearSessionDirCache(sessionId)` 清理缓存

### 1.2 修改 chatFileStore.ts 支持 root/ 目录

**文件**: `apps/server/src/ai/services/chat/repositories/chatFileStore.ts`

**改动**:
1. 修改 `resolveSessionFilesDir` 返回 `{sessionDir}/root/`
2. 添加兼容逻辑：如果 `root/` 不存在，回退到 `files/`
3. 新建会话自动使用 `root/` 目录

**实现**:
```typescript
export async function resolveSessionFilesDir(sessionId: string): Promise<string> {
  const sessionDir = await resolveSessionDir(sessionId);
  const rootDir = path.join(sessionDir, 'root');
  const filesDir = path.join(sessionDir, 'files');

  // 优先使用 root/，不存在则回退到 files/（兼容旧数据）
  try {
    await fs.access(rootDir);
    return rootDir;
  } catch {
    try {
      await fs.access(filesDir);
      return filesDir;
    } catch {
      // 都不存在，创建 root/
      await fs.mkdir(rootDir, { recursive: true });
      return rootDir;
    }
  }
}
```

### 1.3 完善 use-navigation.ts 状态管理

**文件**: `apps/web/src/hooks/use-navigation.ts`（新建）

**功能**: 提供导航状态管理，作为 `useTabs` 的补充（不是替代）

**数据结构**:
```typescript
type NavigationState = {
  // 当前激活的视图类型（用于 Sidebar 高亮）
  activeViewType:
    | 'workbench'
    | 'calendar'
    | 'email'
    | 'scheduled-tasks'
    | 'project'
    | 'workspace-chat'
    | 'ai-assistant'
    | null;

  // 当前激活的项目 ID（用于项目导航）
  activeProjectId: string | null;

  // 当前激活的 Workspace Chat Session ID
  activeWorkspaceChatSessionId: string | null;
}
```

**方法**:
```typescript
- setActiveView(type, options?)
- setActiveProject(projectId)
- setActiveWorkspaceChat(sessionId)
- getActiveView()
```

**与 useTabs 的关系**:
- `use-navigation` 管理"用户看到的导航状态"
- `useTabs` 管理"后台的 Tab 状态"
- 导航切换时，`use-navigation` 调用 `useTabs` 的方法创建/切换 tab

---

## Phase 2: UI 组件实现

### 2.1 创建 WorkspaceChatList 组件

**文件**: `apps/web/src/components/layout/sidebar/WorkspaceChatList.tsx`

**功能**:
- 显示当前 Workspace 下的所有对话（`projectId IS NULL`）
- 按 `updatedAt DESC` 排序
- 默认显示 10 条，点击"查看更多"展开全部
- 右键菜单：重命名、删除、转为项目

**查询**:
```typescript
const { data: chats } = trpc.chat.listByWorkspace.useQuery({
  workspaceId: workspace.id,
  projectId: null, // 只查询 Workspace 级别的对话
  limit: expanded ? undefined : 10,
  orderBy: 'updatedAt',
  order: 'desc',
});
```

**UI 结构**:
```tsx
<div className="workspace-chat-list">
  <div className="section-header">Workspace 对话</div>
  {chats.map(chat => (
    <ChatListItem
      key={chat.id}
      chat={chat}
      onClick={() => handleChatClick(chat.id)}
      onContextMenu={(e) => showContextMenu(e, chat)}
    />
  ))}
  {!expanded && hasMore && (
    <Button onClick={() => setExpanded(true)}>查看更多</Button>
  )}
</div>
```

### 2.2 创建 ConvertChatToProjectDialog 组件

**文件**: `apps/web/src/components/layout/sidebar/ConvertChatToProjectDialog.tsx`

**功能**:
- 输入项目名称（默认使用对话标题）
- 选择父项目（可选）
- 确认后调用 `convertChatToProject` mutation

**表单**:
```tsx
<Dialog>
  <DialogContent>
    <DialogHeader>转为项目</DialogHeader>
    <Form>
      <FormField name="projectTitle" label="项目名称" />
      <FormField name="projectParentId" label="父项目" type="select" />
      <DialogFooter>
        <Button onClick={handleSubmit}>确认</Button>
      </DialogFooter>
    </Form>
  </DialogContent>
</Dialog>
```

### 2.3 创建 PageTitle 组件

**文件**: `apps/web/src/components/layout/header/PageTitle.tsx`

**功能**: 在 Header 中显示当前页面标题

**逻辑**:
```typescript
const title = useMemo(() => {
  const viewType = useNavigation(s => s.activeViewType);
  const activeTab = useTabView(activeTabId);

  if (viewType === 'project') {
    return activeTab?.title ?? '项目';
  }
  if (viewType === 'workspace-chat') {
    return activeTab?.title ?? 'AI 助手';
  }
  if (viewType === 'workbench') return '工作台';
  if (viewType === 'calendar') return '日历';
  if (viewType === 'email') return '邮件';
  if (viewType === 'scheduled-tasks') return '定时任务';
  return '';
}, [viewType, activeTab]);
```

### 2.4 修改 Header.tsx

**文件**: `apps/web/src/components/layout/header/Header.tsx`

**改动**:
1. 删除 `<HeaderTabs />` 引用（第 148 行）
2. 添加 `<PageTitle />` 组件
3. 保持其他功能不变（Sidebar 切换、Settings、Chat 切换）

**修改后的结构**:
```tsx
<header>
  <div className="left-section">
    <Button onClick={toggleSidebar}>...</Button>
    <HeaderChatHistory />
    <Button onClick={openSettings}>...</Button>
  </div>
  <div className="center-section">
    <PageTitle /> {/* 替代 HeaderTabs */}
  </div>
  <div className="right-section">
    <ModeToggle />
    <Button onClick={toggleChat}>...</Button>
  </div>
</header>
```

### 2.5 修改 Sidebar.tsx

**文件**: `apps/web/src/components/layout/sidebar/Sidebar.tsx`

**改动**:
1. 在 `<SidebarContent>` 中添加 `<WorkspaceChatList />`
2. 修改"AI 助手"按钮点击逻辑：创建新 Workspace Chat
3. 保持项目树和其他导航项不变

**新增逻辑**:
```typescript
const handleAIAssistantClick = () => {
  if (!activeWorkspace) return;

  // 创建新的 Workspace Chat Session
  const newSessionId = createChatSessionId();

  // 创建新 tab（后台）
  addTab({
    workspaceId: activeWorkspace.id,
    createNew: true,
    title: '新对话',
    icon: '💬',
    chatSessionId: newSessionId,
    chatParams: { projectId: null }, // Workspace 级别
    leftWidthPercent: 0, // 无 LeftDock
    rightChatCollapsed: false, // 直接显示 Chat
  });

  // 更新导航状态
  setActiveView('workspace-chat');
  setActiveWorkspaceChatSessionId(newSessionId);
};
```

---

## Phase 3: 导航系统集成

### 3.1 实现 Tab 智能卸载

**文件**: `apps/web/src/hooks/use-tabs.ts`

**位置**: 在 `setActiveTab` 方法中添加卸载逻辑

**实现**:
```typescript
const setActiveTab = (newTabId: string) => {
  const oldTabId = get().activeTabId;

  // 检查旧 tab 是否应该卸载
  if (oldTabId && oldTabId !== newTabId) {
    const oldTab = get().tabs.find(t => t.id === oldTabId);
    const oldRuntime = useTabRuntime.getState().runtimeByTabId[oldTabId];

    if (oldTab && oldRuntime && shouldUnmountTab(oldTab, oldRuntime)) {
      // 延迟卸载，避免切换动画卡顿
      setTimeout(() => {
        const state = get();
        if (state.tabs.find(t => t.id === oldTabId)) {
          state.closeTab(oldTabId);
        }
      }, 300);
    }
  }

  // 切换到新 tab
  set((state) => {
    const existing = state.tabs.find(t => t.id === newTabId);
    if (!existing) return state;
    const now = Date.now();
    const nextTabs = updateTabById(state.tabs, newTabId, (tab) => ({
      ...tab,
      lastActiveAt: now,
    }));
    return { tabs: nextTabs, activeTabId: newTabId };
  });
};

function shouldUnmountTab(tab: TabMeta, runtime: TabRuntime): boolean {
  // 1. 只有一个会话
  const sessionCount = tab.chatSessionIds?.length ?? 1;
  if (sessionCount !== 1) return false;

  // 2. 该会话是空的（无消息）
  // 注意：这里需要查询 messageCount，可以通过 tRPC 或缓存
  // 简化实现：如果 chatLoadHistory === false，认为是新会话
  const isEmpty = tab.chatLoadHistory === false;
  if (!isEmpty) return false;

  // 3. LeftDock 未打开
  const hasLeftDock = runtime.base !== undefined;
  if (hasLeftDock) return false;

  return true;
}
```

### 3.2 修改 Sidebar 导航逻辑

**文件**: `apps/web/src/components/layout/sidebar/Sidebar.tsx`

**改动**: 所有导航按钮点击时，同时更新 `use-navigation` 和 `useTabs`

**示例（工作台按钮）**:
```typescript
const handleWorkbenchClick = () => {
  if (!activeWorkspace) return;

  // 1. 更新导航状态
  setActiveView('workbench');

  // 2. 调用现有的 openWorkspacePageTab 逻辑
  openWorkspacePageTab(WORKBENCH_TAB_INPUT);
};
```

### 3.3 修改项目点击逻辑

**文件**: `apps/web/src/components/layout/sidebar/SidebarProject.tsx`

**改动**: 点击项目时，更新导航状态

```typescript
const handleProjectClick = (projectId: string) => {
  // 1. 更新导航状态
  setActiveView('project');
  setActiveProject(projectId);

  // 2. 调用现有的 openProjectTab 逻辑
  openProjectTab(projectId);
};
```

---

## Phase 4: 测试与验证

### 4.1 功能测试清单

**创建新对话**:
- [ ] 点击"AI 助手"，创建新对话
- [ ] 发送消息，验证对话出现在 WorkspaceChatList
- [ ] 验证文件保存在 `chat-history/{sessionId}/root/`

**对话转项目**:
- [ ] 右键对话，选择"转为项目"
- [ ] 输入项目名称，确认
- [ ] 验证项目出现在项目树
- [ ] 验证文件复制到项目目录
- [ ] 验证 `ChatSession.projectId` 更新

**Tab 智能卸载**:
- [ ] 打开多个空白项目（无消息、无 LeftDock）
- [ ] 切换到其他 tab
- [ ] 验证空白 tab 被自动卸载
- [ ] 重新打开该项目，验证正常创建新 tab

**导航切换**:
- [ ] 点击工作台、日历、邮件、定时任务
- [ ] 验证 Header 标题正确显示
- [ ] 验证 Sidebar 高亮正确
- [ ] 验证 LeftDock 和 RightChat 正常工作

**项目 Chat**:
- [ ] 打开项目，创建多个 Session
- [ ] 验证历史列表显示
- [ ] 验证 Session 切换正常

### 4.2 数据完整性验证

- [ ] 验证 `ChatSession.projectId` 正确更新
- [ ] 验证文件复制完整性（对比源目录和目标目录）
- [ ] 验证 `sessionDirCache` 缓存正确更新
- [ ] 验证旧对话的文件迁移（`files/` → `root/`）

### 4.3 性能验证

- [ ] Workspace Chat 列表加载性能（大量对话时）
- [ ] 文件复制性能（大文件或大量文件时）
- [ ] 导航切换流畅度
- [ ] Tab 卸载性能（验证延迟卸载不影响切换动画）
- [ ] 内存使用（打开大量项目后，验证空白 tab 被正确卸载）

---

## Phase 5: 清理与优化

### 5.1 删除未使用的文件

**确认删除**:
- `apps/web/src/components/layout/header/HeaderTabs.tsx`
- `apps/web/src/components/layout/header/HeaderTabMenu.tsx`

**保留文件**:
- `apps/web/src/hooks/use-tabs.ts`（增强，不删除）
- `apps/web/src/hooks/tab-types.ts`（保留）
- `apps/web/src/hooks/tab-utils.ts`（保留）

### 5.2 更新 i18n 翻译

**文件**: `apps/web/src/i18n/locales/*/nav.json`

**新增 key**:
```json
{
  "workspaceChatList": {
    "title": "Workspace 对话",
    "viewMore": "查看更多",
    "empty": "暂无对话",
    "contextMenu": {
      "rename": "重命名",
      "delete": "删除",
      "convertToProject": "转为项目"
    }
  },
  "convertToProject": {
    "title": "转为项目",
    "projectName": "项目名称",
    "parentProject": "父项目",
    "confirm": "确认",
    "cancel": "取消"
  }
}
```

### 5.3 更新类型定义

**文件**: `packages/api/src/common/tab-types.ts`

**确认**: 所有类型定义保持不变，无需修改

---

## Phase 6: 文档更新

### 6.1 更新 CLAUDE.md

**文件**: `CLAUDE.md`

**新增章节**:
```markdown
## 导航系统

OpenLoaf 使用简化的导航架构：

- **用户视角**：通过 Sidebar 直接切换页面，无 Tab 概念
- **技术实现**：Tab 系统在后台管理状态，不在 UI 显示
- **状态管理**：
  - `use-navigation.ts`：管理用户可见的导航状态
  - `use-tabs.ts`：管理后台的 Tab 状态
  - `use-tab-runtime.ts`：管理 Tab 的运行时状态（LeftDock、RightChat）

### Workspace Chat

- Workspace 级别的对话（`projectId IS NULL`）显示在 Sidebar 底部
- 点击"AI 助手"创建新对话
- 右键对话可转为正式项目

### Tab 智能卸载

- 切换离开空白 tab 时自动卸载（无消息、无 LeftDock）
- 避免内存中积累大量无用 tab
```

### 6.2 更新 Skills 文档

**文件**: `.agents/skills/web-layout-structure/SKILL.md`

**修改章节**:
```markdown
## Header 结构

- 左侧：Sidebar 切换、Chat 历史、Settings
- 中间：PageTitle（显示当前页面标题）
- 右侧：主题切换、Chat 切换

**注意**：不再有 HeaderTabs 组件，用户通过 Sidebar 导航
```

**文件**: `.agents/skills/chat-ai-development/SKILL.md`

**新增章节**:
```markdown
## Workspace Chat

- Workspace 级别的对话不属于任何项目
- 查询条件：`workspaceId = X AND projectId IS NULL`
- 文件存储：`~/.openloaf/chat-history/{sessionId}/root/`
- 可通过右键菜单转为项目
```

---

## 实施顺序

1. **Phase 1**: 基础设施准备（1-2 天）
   - 1.1 → 1.2 → 1.3

2. **Phase 2**: UI 组件实现（2-3 天）
   - 2.1 → 2.2 → 2.3 → 2.4 → 2.5

3. **Phase 3**: 导航系统集成（1-2 天）
   - 3.1 → 3.2 → 3.3

4. **Phase 4**: 测试与验证（1-2 天）
   - 4.1 → 4.2 → 4.3

5. **Phase 5**: 清理与优化（1 天）
   - 5.1 → 5.2 → 5.3

6. **Phase 6**: 文档更新（1 天）
   - 6.1 → 6.2

---

## 风险与注意事项

### 高风险点

1. **文件迁移失败**：需要完善的错误处理和回滚机制
2. **状态同步问题**：导航状态与 URL、数据库状态的同步
3. **现有用户数据兼容**：需要平滑迁移现有 Tab 数据

### 兼容性处理

1. **旧版本数据**：检测 `files/` 目录，自动迁移到 `root/`
2. **Tab 数据迁移**：读取 localStorage 中的 Tab 数据，转换为导航历史
3. **URL 路由兼容**：保持现有 URL 结构，避免书签失效

### 回滚方案

1. 保留文件迁移前的备份（可选）
2. 数据库操作使用事务
3. 提供降级开关（通过环境变量）

---

## 成功标准

- [ ] 用户可以通过 Sidebar 导航所有页面
- [ ] Header 不再显示 Tab 栏
- [ ] Workspace Chat 正常显示和管理
- [ ] 对话可以转为项目
- [ ] 空白 tab 自动卸载
- [ ] 所有现有功能正常工作
- [ ] 性能无明显下降
- [ ] 类型检查通过（`pnpm run check-types`）
- [ ] 所有测试通过

---

## 后续优化方向

1. **对话模板**：将常用对话保存为模板
2. **对话标签**：为对话添加标签分类
3. **对话搜索**：全文搜索对话内容
4. **批量操作**：批量删除、归档对话
5. **对话分享**：导出对话为 Markdown 或 PDF
