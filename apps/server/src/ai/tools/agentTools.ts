/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import { tool, zodSchema } from 'ai'
import {
  spawnAgentToolDef,
  sendInputToolDef,
  waitAgentToolDef,
  abortAgentToolDef,
} from '@openloaf/api/types/tools/agent'
import { agentManager, type SpawnContext } from '@/ai/services/agentManager'
import {
  getChatModel,
  getUiWriter,
  getSessionId,
  getAssistantParentMessageId,
  getRequestContext,
} from '@/ai/shared/context/requestContext'
import { resolveEffectiveAgentName } from '@/ai/services/agentFactory'

/** Spawn a new sub-agent. */
export const spawnAgentTool = tool({
  description: spawnAgentToolDef.description,
  inputSchema: zodSchema(spawnAgentToolDef.parameters),
  inputExamples: [
    {
      input: {
        description: '分析代码库结构',
        prompt: '分析 src/utils 目录下的所有 TypeScript 文件，总结主要的工具函数及其用途。',
        subagent_type: 'explore',
      },
    },
    {
      input: {
        description: '设计重构方案',
        prompt: '阅读 src/components/Dashboard.tsx 及其依赖文件，设计组件拆分的重构方案。',
        subagent_type: 'plan',
      },
    },
  ],
  execute: async ({ description: _desc, prompt, subagent_type }): Promise<string> => {
    const requestContext = getRequestContext()
    if (!requestContext) throw new Error('request context is not available.')

    const model = getChatModel()
    if (!model) throw new Error('chat model is not available.')

    const context: SpawnContext = {
      model,
      writer: getUiWriter(),
      sessionId: getSessionId(),
      parentMessageId: getAssistantParentMessageId() ?? null,
      requestContext,
    }

    const effectiveName = resolveEffectiveAgentName(subagent_type)

    // 禁止 spawn master agent 作为子 agent
    if (effectiveName === 'master') {
      throw new Error('Cannot spawn master agent as a sub-agent.')
    }

    // 禁止 agent 创建和自己同类型的子 agent
    const stack = requestContext.agentStack ?? []
    if (stack.length > 0 && subagent_type) {
      const parentName = resolveEffectiveAgentName(stack[stack.length - 1]!.name)
      if (parentName === effectiveName) {
        throw new Error(
          `Agent "${subagent_type}" cannot spawn a sub-agent of the same type. Try a different approach or use available tools directly.`,
        )
      }
    }

    // Derive current depth from agentStack
    const currentDepth = requestContext.agentStack?.length ?? 0

    const agentId = agentManager.spawn({
      task: prompt,
      name: effectiveName,
      subagentType: subagent_type,
      context,
      depth: currentDepth,
    })
    return JSON.stringify({ agent_id: agentId })
  },
})

/** Send input to an existing sub-agent (auto-recovers from JSONL if not in memory). */
export const sendInputTool = tool({
  description: sendInputToolDef.description,
  inputSchema: zodSchema(sendInputToolDef.parameters),
  execute: async ({ id, message, interrupt }): Promise<string> => {
    const model = getChatModel()
    const requestContext = getRequestContext()

    // 构建 SpawnContext 供 JSONL 恢复使用
    const context: SpawnContext | undefined =
      model && requestContext
        ? {
            model,
            writer: getUiWriter(),
            sessionId: getSessionId(),
            parentMessageId: getAssistantParentMessageId() ?? null,
            requestContext,
          }
        : undefined

    const submissionId = await agentManager.sendInput(id, message, interrupt, context)
    return JSON.stringify({ submission_id: submissionId })
  },
})

/** Wait for sub-agents to complete (ANY semantics). */
export const waitAgentTool = tool({
  description: waitAgentToolDef.description,
  inputSchema: zodSchema(waitAgentToolDef.parameters),
  execute: async ({ ids, timeoutMs }): Promise<string> => {
    const result = await agentManager.wait(ids, timeoutMs)
    const outputs: Record<string, string | null> = {}
    const errors: Record<string, string | null> = {}
    for (const id of ids) {
      const agent = agentManager.getAgent(id)
      outputs[id] = agent?.outputText || null
      errors[id] = agent?.error || null
    }
    return JSON.stringify({
      completed_id: result.completedId,
      status: result.status,
      outputs,
      errors,
      timed_out: result.timedOut,
    })
  },
})

/** Abort a sub-agent and return its output. */
export const abortAgentTool = tool({
  description: abortAgentToolDef.description,
  inputSchema: zodSchema(abortAgentToolDef.parameters),
  execute: async ({ id }): Promise<string> => {
    const result = agentManager.abort(id)
    return JSON.stringify({ status: result.status, output: result.output })
  },
})
