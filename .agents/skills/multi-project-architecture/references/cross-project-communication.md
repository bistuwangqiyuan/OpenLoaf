# Cross-Project Communication

## 文档定位

这是多项目协作的规划参考，描述目标交互模型和约束边界，不把它当成已经落地的接口契约。

## Code Links

| 代码 | 作用 |
|------|------|
| [agentFactory.ts](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/apps/server/src/ai/services/agentFactory.ts) | 当前主 Agent 创建与基础 prompt 入口 |
| [masterAgentRunner.ts](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/apps/server/src/ai/services/masterAgentRunner.ts) | 主 Agent 运行时装配入口 |
| [project.prisma](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/packages/db/prisma/schema/project.prisma) | 当前项目模型里的类型字段 |
| [Sidebar.tsx](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/apps/web/src/components/layout/sidebar/Sidebar.tsx) | 当前 Sidebar 入口 |
| [ProjectSidebar.tsx](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/apps/web/src/components/layout/sidebar/ProjectSidebar.tsx) | 当前项目侧边栏主要实现 |

## 三种通信模式

| 模式 | 载体 | 方向 | 目标 |
|------|------|------|------|
| 引用 / 查询 | 主 Agent 对话 | A -> B | 从其他项目获取只读信息 |
| 请求 / 委托 | 任务模块 | A -> B | 把执行任务交给目标项目 |
| 订阅 / 通知 | 群组消息 | 事件 -> 群组 | 向多个项目广播重要事件 |

## 1. 引用 / 查询

适用场景：当前项目需要读取其他项目的知识、状态或结论，但不应直接修改对方数据。

约束：

- 默认只读，不直接改动目标项目数据
- 查询结果由目标项目主 Agent 裁剪，不能绕过其权限边界
- 查询过程需要留痕，便于发起方和目标方追溯来源

## 2. 请求 / 委托

适用场景：当前项目需要目标项目真正执行一项工作，并在完成后回传结果。

约束：

- 委托优先复用现有任务模型，不另起一套平行任务系统
- 目标项目主 Agent 可以基于容量、权限或优先级拒绝委托
- 结果完成后应回传给发起方，且双方都能看到任务记录

## 3. 订阅 / 通知

适用场景：多个项目共享同一类事件，例如版本发布、报告完成、文档更新。

初期可关注的事件类型：

- `task.completed`
- `task.failed`
- `version.released`
- `document.updated`
- `report.generated`
- `content.published`

## 主 Agent 网关模式

每个项目的主 Agent 是对外唯一入口，负责：

- 判断该项目愿意暴露哪些信息
- 决定是否接受跨项目任务
- 控制返回内容的粒度与安全边界

这意味着跨项目协作应优先经过“项目主 Agent -> 项目内部能力”的链路，而不是让外部项目直接调用目标项目内部细节。

## 协作关系与权限

- 项目之间默认不互通，需要显式建立协作关系
- 管理层入口默认拥有跨项目可见性，但仍应尊重每个项目的边界规则
- 同一群组内的项目可以天然获得更高的查询可达性，但是否允许执行委托仍应单独判断

## 前端触发语义

- 输入框支持 `@项目` 作为跨项目意图的显式触发器
- 发送消息时，前端应把提及到的项目信息结构化传给后端，而不是只保留纯文本标记
- 若后续引入任务创建器或群组广播面板，它们都应复用同一套项目选择与权限判断逻辑

## 分阶段落地建议

| 阶段 | 内容 |
|------|------|
| P0 | Sidebar 重构与项目导航模型稳定 |
| P1 | 项目类型模板稳定，明确主 Agent 角色 |
| P2 | 引用 / 查询链路 |
| P3 | 请求 / 委托链路 |
| P4 | 群组实体与群组消息 |
| P5 | 事件驱动通知 |

## Working Rules

- 只写规则和代码链接，不放示例代码
- 不要把“查询”“委托”“通知”混成同一条协议；三者的权限、状态和回执要求不同
- 不要让外部项目直接依赖目标项目内部子 Agent 或内部工具；统一经过主 Agent 网关
