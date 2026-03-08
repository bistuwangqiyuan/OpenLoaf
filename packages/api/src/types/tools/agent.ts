/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import { z } from 'zod'

export const spawnAgentToolDef = {
  id: 'spawn-agent',
  name: '启动子代理',
  description:
    '启动一个新的子代理来处理复杂的多步骤任务。\n'
    + '\n'
    + '子代理在独立的 LLM 会话中运行，保护主对话的上下文窗口不被大量中间结果淹没。\n'
    + '\n'
    + '可用子代理类型：\n'
    + '- general-purpose: 通用子代理（默认值，不传 subagent_type 时使用）。用于执行复杂多步骤任务，包括文件操作、Shell 命令、Web 浏览、代码开发等。拥有完整工具发现能力（tool-search）。当你需要搜索代码或执行多步操作且不确定能在几次尝试内完成时，使用此类型。（工具：全部）\n'
    + '- explore: 代码库探索专用（只读）。用于快速按模式查找文件、搜索关键词或回答关于代码库的问题。（工具：read-file, list-dir, grep-files, project-query）\n'
    + '- plan: 架构方案设计专用（只读）。用于设计实现策略、识别关键文件、评估架构权衡。（工具：read-file, list-dir, grep-files, project-query）\n'
    + '\n'
    + '你也可以传入项目中定义的自定义 Agent 名称作为 subagent_type。\n'
    + '\n'
    + '使用注意：\n'
    + '- 尽可能并行启动多个独立的子代理以提高效率；要做到这一点，在一次回复中同时调用多个 spawn-agent\n'
    + '- 启动后调用 wait-agent 等待结果\n'
    + '- 简单任务不需要子代理 — 1-2 个工具调用能完成的事情直接做\n'
    + '- 子代理不能再创建子代理（嵌套深度上限为 1），最大并发为 4\n'
    + '- 不要启动和自己同类型的子代理\n'
    + '- 返回：{agent_id: string}',
  parameters: z.object({
    description: z
      .string()
      .min(1)
      .describe('简短描述（3-5 个词），概括子代理将做什么。'),
    prompt: z
      .string()
      .min(1)
      .describe('子代理要执行的任务描述。提供清晰、详细的提示以便子代理能自主工作并返回你所需的信息。'),
    subagent_type: z
      .string()
      .optional()
      .describe('子代理类型。不指定时默认为 general-purpose。'),
  }),
  component: null,
} as const

export const sendInputToolDef = {
  id: 'send-input',
  name: '发送输入',
  description:
    '触发：当你需要向已有子代理发送消息或指令时调用。用途：向子代理发送消息，返回 submission_id。返回：{submission_id: string}。不适用：子代理不存在或已关闭时不要调用。',
  parameters: z.object({
    id: z.string().min(1).describe('子代理 ID。'),
    message: z.string().optional().describe('要发送的消息。'),
    interrupt: z
      .boolean()
      .optional()
      .describe('是否中断当前任务。'),
  }),
  component: null,
} as const

export const waitAgentToolDef = {
  id: 'wait-agent',
  name: '等待子代理',
  description:
    '触发：当你需要等待一个或多个子代理完成时调用。用途：阻塞等待子代理完成或超时。返回：{status: Record<string, string>, timed_out: boolean}。不适用：不需要等待结果时不要调用。常见错误：1) 不要在 spawn 后立即 wait — 给子代理时间执行。2) 不要无限等待 — 始终设置合理的 timeoutMs。3) 子代理返回空结果时不要假装成功 — 检查 status 是否为 completed。',
  parameters: z.object({
    ids: z
      .array(z.string().min(1))
      .min(1)
      .describe('要等待的子代理 ID 列表。'),
    timeoutMs: z
      .number()
      .int()
      .min(10000)
      .max(300000)
      .optional()
      .describe('超时毫秒数，默认 300000（5 分钟）。'),
  }),
  component: null,
} as const

export const abortAgentToolDef = {
  id: 'abort-agent',
  name: '中止子代理',
  description:
    '触发：当你不再需要某个子代理时调用。用途：中止正在运行的子代理，返回已产生的输出。返回：{status: string, output: string}。不适用：子代理不存在时不要调用。',
  parameters: z.object({
    id: z.string().min(1).describe('要中止的子代理 ID。'),
  }),
  component: null,
} as const
