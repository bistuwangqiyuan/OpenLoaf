## 1. 后端核心（P0）— ✅ 已完成

- [x] 1.1 TaskConfig 新增 `sourceSessionId` 字段（`taskConfigService.ts`）
- [x] 1.2 CreateTaskInput 新增 `sourceSessionId` 字段
- [x] 1.3 createTask() 持久化 sourceSessionId
- [x] 1.4 taskTools.ts 创建任务时从 RequestContext 注入 sourceSessionId
- [x] 1.5 TaskExecutor 完成/失败后调用 `reportToSourceSession()`
- [x] 1.6 TaskExecutor.runAgentPhase() 传递 projectId 给 runChatStream
- [x] 1.7 TaskEventBus 新增 `TaskReportEvent` + `emitTaskReport/onTaskReport`

## 2. 消息类型扩展（P0）— ✅ 已完成

- [x] 2.1 UIMessage.role 新增 `task-report`（`packages/api/src/types/message.ts`）
- [x] 2.2 新增 `TaskRefPart` 和 `TaskReportMetadata` 类型
- [x] 2.3 StoredMessage.role 新增 `task-report`（`chatFileStore.ts`）
- [x] 2.4 normalizeRole() 支持 `task-report`（`messageStore.ts`）
- [x] 2.5 ChatImageMessageInput.role 新增 `task-report`（`image/types.ts`）
- [x] 2.6 TypeScript 类型检查全部通过（7/7 包）

## 3. Secretary Prompt 升级（P0）— ✅ 已完成

- [x] 3.1 prompt-v3.zh.md 新增第六章「任务委派」
- [x] 3.2 prompt-v3.en.md 新增第六章「Task Delegation」

## 4. 前端渲染（P1）— 待实施

- [ ] 4.1 MessageTaskReport 组件：渲染 `task-report` 消息（Agent 身份 + 汇报内容）
- [ ] 4.2 TaskRefPart 组件：渲染 `task-ref`（任务卡片，状态指示器）
- [ ] 4.3 MessageItem.tsx 分发逻辑：`role === 'task-report'` → MessageTaskReport
- [ ] 4.4 TaskEventBus → tRPC subscription 推送到前端

## 5. @mention 与消息路由（P2）— 待实施

- [ ] 5.1 前端 ChatInput @mention 解析和自动补全
- [ ] 5.2 消息 metadata.mentions 字段
- [ ] 5.3 服务端消息路由：根据 mentions 转发到 Task Agent session
- [ ] 5.4 Task Agent 接收追加消息后继续执行

## 6. Project Agent（P2）— ✅ 已完成

- [x] 6.1 agentFactory.ts 新增 `createProjectAgent()` — 复用 Master 思维框架（章节 1-5）+ 项目上下文
- [x] 6.2 按项目类型选择工具集（PROJECT_AGENT_TOOL_IDS — 排除 task-manage、calendar、email）
- [x] 6.3 TaskExecutor 集成 Project Agent 创建逻辑（agentType='project' 通过 runChatStream params 传递）
