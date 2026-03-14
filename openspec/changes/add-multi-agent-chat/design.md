## Context

OpenLoaf 已有完整的 Task 系统（`taskConfigService.ts`, `taskExecutor.ts`, `taskOrchestrator.ts`, `taskScheduler.ts`），支持任务创建、调度、执行、审批、归档等完整生命周期。Task 存储在 `~/.openloaf/tasks/{taskId}/task.json`。

现有 Task 系统缺少的是：**任务完成后往来源对话汇报** 和 **项目绑定规则**。

### 约束

- 复用现有 TaskConfig、TaskExecutor、TaskOrchestrator 基础设施
- 不引入新的数据库表（TaskConfig 已用文件存储）
- 必须向后兼容现有 ChatSession 和消息存储
- 桌面端和 Web 端行为一致

## Goals / Non-Goals

**Goals:**
- Task 完成后主动往来源对话追加汇报消息
- 产出文件的任务必须绑定项目
- Secretary prompt 升级，能判断何时直接回答、何时创建任务
- 用户可 @mention Agent 继续交互（后续阶段）

**Non-Goals:**
- 不做外部 Channel 接入（Telegram/Discord 等）
- 不做跨 session 的 Agent 协作
- 不做 Agent 市场或自定义 Agent 编辑器（第一期）

## Decisions

### 1. 复用现有 Task 系统，扩展 sourceSessionId

**决定**：不新建数据模型，在现有 `TaskConfig` 上新增 `sourceSessionId` 字段。

**理由**：
- TaskConfig 已有 `projectId`、`sessionId`、`agentName`、`scope` 等字段
- TaskExecutor 已通过 `runChatStream` 执行 Agent
- TaskOrchestrator 已处理生命周期、冲突检测、超时
- 只需补充"完成后汇报"能力

**改动**：
- `taskConfigService.ts`: TaskConfig + CreateTaskInput 新增 `sourceSessionId`
- `taskTools.ts`: 创建任务时从 RequestContext 获取当前 sessionId 作为 sourceSessionId
- `taskExecutor.ts`: 任务完成/失败后调用 `reportToSourceSession()`

### 2. 汇报机制：appendMessage + TaskEventBus

**决定**：任务完成后直接往来源 ChatSession 的 messages.jsonl 追加 `task-report` 消息，通过 TaskEventBus 通知前端。

**消息格式**：
```jsonl
{
  "id": "msg_xxx",
  "role": "task-report",
  "parentMessageId": "<rightmost-leaf>",
  "messageKind": "normal",
  "parts": [
    {"type": "text", "text": "任务「审查代码质量」已完成。"},
    {"type": "task-ref", "taskId": "xxx", "title": "审查代码质量", "agentType": "code-reviewer", "status": "completed"}
  ],
  "metadata": {
    "taskId": "xxx",
    "agentType": "code-reviewer",
    "displayName": "代码审查员",
    "projectId": "proj_xxx"
  }
}
```

### 3. TaskExecutor 传递 projectId

**决定**：修改 `runAgentPhase()` 从 TaskConfig 读取 `projectId` 并传递给 `runChatStream`。

**理由**：之前 `projectId: undefined`，导致 Agent 缺少项目上下文。修正后 Agent 能感知项目根目录和配置。

### 4. Secretary Prompt 升级

**决定**：在 Master prompt 追加第六章「任务委派」，描述：
- 何时直接回答（子 Agent 辅助）vs 创建任务
- 产出文件的任务必须绑定项目
- 如何使用 `task-manage` 创建任务

**理由**：LLM 自然语言理解判断轻重缓急，不需要硬编码规则。

## Risks / Trade-offs

### Risk 1：汇报消息的 parentMessageId 指向

- **问题**：Agent 异步完成时，用户可能已经发了新消息
- **缓解**：汇报消息的 parentMessageId 指向 `resolveRightmostLeaf()`，确保在时间线末尾

### Risk 2：并发 Task 数量

- **缓解**：TaskOrchestrator 已有冲突检测逻辑，同项目 scope 的任务不会并发

## Migration Plan

所有改动向后兼容，旧的 TaskConfig 缺少 `sourceSessionId` 字段时不会汇报（静默跳过）。

## Open Questions

- Task 的 @mention 交互如何实现？（需要将用户消息路由到 Task Agent 的 session）
- 前端 task-report 消息的渲染样式？（需要新增 MessageTaskReport 组件）
- 是否需要在 task-report 消息中内嵌"查看工作详情"链接？
