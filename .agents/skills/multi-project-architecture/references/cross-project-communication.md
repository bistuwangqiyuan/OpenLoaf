# 跨项目通信设计

## 概览

三种通信模式，分别对应已有或新增的产品概念：

| 模式 | 载体 | 方向 | 触发方式 |
|------|------|------|---------|
| 引用/查询 | 主 Agent 对话 | A → B（只读） | 对话中 @ 项目 |
| 请求/委托 | 任务模块 | A → B（执行） | 对话中 @ 项目 / 手动创建任务 |
| 订阅/通知 | 群组消息 | 事件 → 群组（广播） | 自动触发 |

## 模式一：引用/查询

### 流程

```
用户在项目A对话中输入：
"帮我查一下 @产品知识库 里关于定价策略的文档"

项目A主Agent:
  1. 解析 @ 引用 → 识别目标项目 "产品知识库"
  2. 检查协作权限 → 是否已建立连接
  3. 向项目B主Agent发起查询请求
  4. 项目B主Agent在内部资料中检索
  5. 返回结果给项目A
  6. 项目A主Agent整合结果回答用户
```

### 关键约束

- 只读操作，不修改目标项目数据
- 目标项目主 Agent 控制返回的信息粒度
- 查询记录留痕（双方都可追溯）

## 模式二：请求/委托

### 流程

```
用户在项目A对话中输入：
"帮我让 @数据分析 出一份上个月的销售报告"

项目A主Agent:
  1. 解析 @ 引用 → 识别目标项目 "数据分析"
  2. 在目标项目中创建一个任务（Task）
  3. 任务携带 sourceProjectId = A.id
  4. 目标项目的 Agent 团队接收并执行任务
  5. 任务完成 → 结果自动回传给项目A
  6. 项目A收到通知，展示结果
```

### 数据模型扩展

复用现有 Task 模型，新增字段：

```typescript
// 新增字段
sourceProjectId?: string    // 发起方项目 ID
sourceSessionId?: string    // 发起方对话 ID（用于结果回传）
crossProjectStatus?: 'pending' | 'accepted' | 'rejected' | 'completed'
```

### 关键约束

- 目标项目主 Agent 有权拒绝任务（容量/优先级）
- 任务完成后结果自动回传到发起方
- 双方任务面板都可见该任务

## 模式三：订阅/通知（群组广播）

### 流程

```
代码仓库完成版本发布 → 触发事件 "version.released"
↓
"产品发布群" 订阅了该事件类型
↓
群组内自动发送通知消息：
"[代码仓库] 已发布 v2.1.0，包含 3 个新功能、5 个 bug 修复"
↓
群组内的营销项目主Agent看到通知，自动或等待用户指令后开始更新宣传材料
```

### 群组数据模型

```typescript
interface Group {
  id: string
  name: string
  workspaceId: string
  memberProjectIds: string[]    // 关联的项目列表
  createdAt: Date
  updatedAt: Date
}

interface GroupMessage {
  id: string
  groupId: string
  type: 'notification' | 'chat' | 'task-result'
  sourceProjectId?: string      // 消息来源项目
  content: string
  createdAt: Date
}
```

### 事件类型（初期）

| 事件 | 触发场景 |
|------|---------|
| `task.completed` | 任务完成 |
| `task.failed` | 任务失败 |
| `version.released` | 版本发布（代码仓库） |
| `document.updated` | 重要文档更新（知识库） |
| `report.generated` | 报告生成完成（数据分析） |
| `content.published` | 内容发布（内容创作） |

## 主 Agent 网关模式

每个项目的主 Agent 是对外唯一接口：

```
外部请求 → 目标项目主Agent（网关）→ 内部分发
                ↓
          权限检查（协作关系是否建立）
                ↓
          请求分类（查询 / 委托 / 通知）
                ↓
          执行或拒绝
                ↓
          结果返回（控制信息边界）
```

### 协作关系

```typescript
interface ProjectCollaboration {
  id: string
  projectAId: string
  projectBId: string
  permissions: {
    queryAllowed: boolean       // 允许查询
    taskDelegation: boolean     // 允许委托任务
  }
  createdAt: Date
}
```

- 默认不互通，需要用户手动建立
- 管理层（AI小助理）默认可访问所有项目
- 同一群组内的项目自动建立查询权限

## @ 引用解析

### 前端

- 输入框支持 `@` 触发项目选择器（类似现有 @ 人的交互）
- 选中后插入 `@项目名` 标记
- 发送时携带 `mentionedProjectIds` 字段

### 后端

```
AiExecuteService.execute(request)
  1. 解析消息中的 @项目引用
  2. 校验协作权限
  3. 对每个引用的项目，通过主Agent网关发起请求
  4. 收集结果，注入到当前Agent的上下文中
  5. 继续正常的Agent执行流程
```

## 实施优先级

| 阶段 | 内容 | 依赖 |
|------|------|------|
| P0 | Sidebar 重构（单列视图 + hover 浮层） | 无 |
| P1 | 项目类型模板（创建时选类型） | P0 |
| P2 | 引用/查询（@ 项目 + 主Agent网关） | P1 |
| P3 | 请求/委托（跨项目任务） | P2 |
| P4 | 群组（创建群组 + 消息 + 通知） | P2 |
| P5 | 订阅/通知（事件驱动广播） | P4 |
