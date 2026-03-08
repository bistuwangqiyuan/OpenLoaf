/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
/**
 * 统一 Agent 工厂 — Master Agent + 行为驱动子 Agent。
 *
 * 子 Agent 类型：
 * - general-purpose: 通用（tool-search + 全量工具）
 * - explore: 只读代码库探索（固定工具集）
 * - plan: 只读架构方案设计（固定工具集）
 * - dynamic: 从文件系统 AGENT.md 加载
 */

import {
  ToolLoopAgent,
  stepCountIs,
  wrapLanguageModel,
  addToolInputExamplesMiddleware,
} from 'ai'
import type {
  LanguageModelV3,
} from '@ai-sdk/provider'
import type { PrepareStepFunction, StopCondition } from 'ai'
import type { AgentFrame } from '@/ai/shared/context/requestContext'
import { buildToolset } from '@/ai/tools/toolRegistry'
import { createToolCallRepair } from '@/ai/shared/repairToolCall'
import { ActivatedToolSet } from '@/ai/tools/toolSearchState'
import { createToolSearchTool } from '@/ai/tools/toolSearchTool'
import {
  getPrimaryTemplate,
  getMasterPrompt,
} from '@/ai/agent-templates'
import type { AgentTemplate } from '@/ai/agent-templates'
import { logger } from '@/common/logger'
import {
  readAgentConfigFromPath,
  type AgentConfig,
} from '@/ai/services/agentConfigService'
import { resolveAgentByName } from '@/ai/tools/AgentSelector'
import { buildHardRules } from '@/ai/shared/hardRules'

// ---------------------------------------------------------------------------
// 子 Agent 行为类型
// ---------------------------------------------------------------------------

/** 内置子 Agent 类型 ID。 */
export type BuiltinSubAgentType = 'general-purpose' | 'explore' | 'plan'

/** explore / plan 共用的只读工具集。 */
const READ_ONLY_TOOL_IDS = ['read-file', 'list-dir', 'grep-files', 'project-query'] as const

/** 判断是否为内置子 Agent 类型。 */
export function isBuiltinSubAgentType(type: string): type is BuiltinSubAgentType {
  return type === 'general-purpose' || type === 'explore' || type === 'plan'
}

// ---------------------------------------------------------------------------
// Master Agent
// ---------------------------------------------------------------------------

/** Master agent display name. */
const MASTER_AGENT_NAME = 'MasterAgent'
/** Master agent id. */
const MASTER_AGENT_ID = 'master-agent'

export type MasterAgentModelInfo = {
  provider: string
  modelId: string
}

/** Read base system prompt markdown content. */
export function readMasterAgentBasePrompt(lang?: string): string {
  return getMasterPrompt(lang)
}

type CreateMasterAgentInput = {
  model: LanguageModelV3
  instructions?: string
}

// ---------------------------------------------------------------------------
// Step limits — prevent infinite tool loops (MAST FM-1.3)
// ---------------------------------------------------------------------------
const MASTER_HARD_MAX_STEPS = 30
const SUB_AGENT_MAX_STEPS = 15

// ---------------------------------------------------------------------------
// ToolSearch Pull 模式 — prepareStep + ActivatedToolSet
// ---------------------------------------------------------------------------

/** Core tool IDs that are always visible (never deferred). */
const CORE_TOOL_IDS = ['tool-search'] as const

/**
 * Creates a prepareStep that only exposes tool-search + dynamically activated tools.
 */
function createToolSearchPrepareStep(
  allToolIds: readonly string[],
  activatedSet: ActivatedToolSet,
): PrepareStepFunction {
  return () => {
    const activeToolIds = activatedSet.getActiveToolIds()
    const activeTools = allToolIds.filter((id) => activeToolIds.includes(id))
    // Ensure tool-search is always visible
    if (!activeTools.includes('tool-search')) activeTools.push('tool-search')
    return { activeTools }
  }
}

// ---------------------------------------------------------------------------
// ToolSearch 引导 — 运行时注入 <tool-search-guidance>
// ---------------------------------------------------------------------------

/**
 * Build ToolSearch guidance text appended to instructions at runtime.
 * Model discovers tools dynamically via tool-search; no pre-populated list needed.
 */
export function buildToolSearchGuidance(): string {
  return `<tool-search-guidance>
你启动时只有 tool-search 一个工具可用。当用户请求需要执行操作时，必须先用 tool-search 加载所需工具。

使用方式：
- 关键词搜索：tool-search(query: "file read") — 返回最匹配的工具并立即加载
- 直接选择：tool-search(query: "select:read-file,list-dir") — 按 ID 精确加载
- 搜索到的工具立即可用，无需额外步骤
- 可一次加载多个：用逗号分隔 ID

必须使用工具的场景（不可纯文本回答）：
- 查询时间/日期 → select:time-now
- 用户提及未来时间+事件（"明天开会"、"3小时后提醒"、"记一下周三拜访"、"设闹钟"）→ 先 time-now 获取当前时间，再 task-manage 创建定时任务（必须包含 schedule 参数），不可仅文字确认
- 多个事件 → 每个事件各调用一次 task-manage
- 查询待办/任务列表 → select:task-status
- 创建/修改/取消任务 → select:task-manage（取消前先 task-status 查询）
- 查询日程安排 → select:calendar-query
- 查询/操作邮件 → select:email-query
- 文件/目录操作 → read-file, list-dir, grep-files, apply-patch
- 打开链接/URL → select:open-url
- 渲染组件/诗歌/UI 展示 → select:jsx-create
- 画图表/折线图/柱状图 → select:chart-render
- Word/docx 文档（读取、创建、编辑）→ select:word-query,word-mutate
- Excel/xlsx 电子表格（读取、创建、编辑）→ select:excel-query,excel-mutate
- PPT/pptx 演示文稿（读取、创建、编辑）→ select:pptx-query,pptx-mutate
- PDF 文档（读取文本、查看结构、表单、创建、合并、填表）→ select:pdf-query,pdf-mutate
- 图片处理（"把图片缩小到800x600"、"PNG转WebP"、"旋转90度"、"裁剪图片"、"加模糊效果"、"转成JPG"）→ select:image-process
- 视频/音频转换（"MP4转WebM"、"提取音频"、"查看视频信息"、"AVI转MP4"、"WAV转MP3"、"视频转720p"）→ select:video-convert
- 文档格式转换（"Word转PDF"、"PDF转文本"、"Excel导出CSV"、"Markdown转HTML"、"HTML转MD"、"CSV转Excel"）→ select:doc-convert

重要：简单对话直接回答，不需要加载任何工具。
</tool-search-guidance>`
}


// ---------------------------------------------------------------------------
// 动态步数预算 — 自适应 StopCondition (Anthropic Best Practice)
// ---------------------------------------------------------------------------

/**
 * 根据前几步的工具调用模式动态判断任务复杂度，收紧步数上限。
 *
 * - 无工具调用（纯文本对话）→ 5 步上限
 * - 1-3 个工具调用（中等任务）→ 15 步上限
 * - 4+ 个工具调用或含 spawn-agent（复杂任务）→ 不额外限制（由硬上限控制）
 */
function dynamicStepLimit(): StopCondition<Record<string, never>> {
  return ({ steps }: { steps: ReadonlyArray<{ toolCalls: ReadonlyArray<{ toolName: string }> }> }) => {
    const totalToolCalls = steps.reduce(
      (sum: number, s: { toolCalls: ReadonlyArray<{ toolName: string }> }) => sum + s.toolCalls.length,
      0,
    )
    const hasAgentSpawn = steps.some(
      (s: { toolCalls: ReadonlyArray<{ toolName: string }> }) =>
        s.toolCalls.some((tc: { toolName: string }) => tc.toolName === 'spawn-agent'),
    )
    const currentStep = steps.length

    // 复杂任务：不额外限制
    if (totalToolCalls >= 4 || hasAgentSpawn) return false
    // 中等任务
    if (totalToolCalls >= 1) return currentStep >= 15
    // 纯文本对话
    return currentStep >= 5
  }
}

// ---------------------------------------------------------------------------
// Model wrapping — inputExamples middleware (Anthropic Best Practice)
// ---------------------------------------------------------------------------

/** 包装模型以启用工具输入示例中间件。 */
function wrapModelWithExamples(model: LanguageModelV3): LanguageModelV3 {
  return wrapLanguageModel({
    model,
    middleware: addToolInputExamplesMiddleware(),
  }) as unknown as LanguageModelV3
}

/** Creates the master agent instance. */
export function createMasterAgent(input: CreateMasterAgentInput) {
  const template = getPrimaryTemplate()
  const instructions = input.instructions || template.systemPrompt
  const wrappedModel = wrapModelWithExamples(input.model)

  // ToolSearch Pull mode
  const coreToolIds = [...CORE_TOOL_IDS] as string[]
  const deferredToolIds = template.deferredToolIds ?? []
  const allToolIds = [...new Set([...coreToolIds, ...deferredToolIds])]

  // Build full toolset (all tools registered, but only core visible via activeTools)
  const tools = buildToolset(allToolIds)

  // Create per-session ActivatedToolSet
  const activatedSet = new ActivatedToolSet(coreToolIds)

  // Inject tool-search (dynamically created, closes over activatedSet)
  tools['tool-search'] = createToolSearchTool(activatedSet, new Set(allToolIds))

  // ★ Append Hard Rules + ToolSearch guidance to instructions (Layer 2)
  const hardRules = buildHardRules()
  const toolSearchGuidance = buildToolSearchGuidance()
  const finalInstructions = `${instructions}\n\n${hardRules}\n\n${toolSearchGuidance}`

  const baseSettings = {
    model: wrappedModel,
    instructions: finalInstructions,
    tools,
    stopWhen: [stepCountIs(MASTER_HARD_MAX_STEPS), dynamicStepLimit()] as StopCondition<any>[],
    experimental_repairToolCall: createToolCallRepair(),
  }
  // Inject prepareStep — ToolSearch pull mode
  Object.assign(baseSettings, {
    prepareStep: createToolSearchPrepareStep(allToolIds, activatedSet),
  })

  return new ToolLoopAgent(baseSettings)
}

/** Creates the frame metadata for the master agent. */
export function createMasterAgentFrame(input: {
  model: MasterAgentModelInfo
}): AgentFrame {
  return {
    kind: 'master',
    name: MASTER_AGENT_NAME,
    agentId: MASTER_AGENT_ID,
    path: [MASTER_AGENT_NAME],
    model: input.model,
  }
}

// ---------------------------------------------------------------------------
// Sub-Agent Creation
// ---------------------------------------------------------------------------

export type CreateSubAgentInput = {
  /** 子 Agent 类型字符串（general-purpose / explore / plan / 自定义名称）。 */
  subagentType?: string
  model: LanguageModelV3
  skillRoots?: {
    projectRoot?: string
    parentRoots?: string[]
    workspaceRoot?: string
  }
}

/** Create a ToolLoopAgent instance by subagent_type. */
export function createSubAgent(input: CreateSubAgentInput): ToolLoopAgent {
  const wrappedModel = wrapModelWithExamples(input.model)
  const effectiveType = (input.subagentType || 'general-purpose').toLowerCase().trim()

  // 内置类型
  if (effectiveType === 'general-purpose') {
    return createGeneralPurposeSubAgent(wrappedModel)
  }
  if (effectiveType === 'explore') {
    return createExploreSubAgent(wrappedModel)
  }
  if (effectiveType === 'plan') {
    return createPlanSubAgent(wrappedModel)
  }

  // 动态 Agent — 从文件系统查找 AGENT.md
  const dynamicAgent = tryCreateDynamicAgent(effectiveType, input.skillRoots, wrappedModel)
  if (dynamicAgent) return dynamicAgent

  // Fallback → general-purpose
  logger.warn(
    { subagentType: input.subagentType },
    '[agent-factory] No matching agent type found, falling back to general-purpose',
  )
  return createGeneralPurposeSubAgent(wrappedModel)
}

/** Create a general-purpose sub-agent with tool-search + full deferred toolset (excluding agent collaboration tools). */
function createGeneralPurposeSubAgent(model: LanguageModelV3): ToolLoopAgent {
  const masterTpl = getPrimaryTemplate()
  const coreToolIds = ['tool-search'] as string[]
  const deferredToolIds = (masterTpl.deferredToolIds ?? [])
    .filter((id) => !AGENT_TOOL_IDS_TO_EXCLUDE.has(id))
  const allToolIds = [...new Set([...coreToolIds, ...deferredToolIds])]

  const tools = buildToolset(allToolIds)
  const activatedSet = new ActivatedToolSet(coreToolIds)
  tools['tool-search'] = createToolSearchTool(activatedSet, new Set(allToolIds))

  // 使用与主 Agent 相同的完整 instructions
  const basePrompt = masterTpl.systemPrompt
  const finalInstructions = `${basePrompt}\n\n${buildHardRules()}\n\n${buildToolSearchGuidance()}`

  return new ToolLoopAgent({
    id: `sub-agent-general-${Date.now()}`,
    model,
    instructions: finalInstructions,
    tools,
    stopWhen: stepCountIs(SUB_AGENT_MAX_STEPS),
    experimental_repairToolCall: createToolCallRepair(),
    prepareStep: createToolSearchPrepareStep(allToolIds, activatedSet),
  })
}

/** Create an explore sub-agent (read-only, fixed tools). */
function createExploreSubAgent(model: LanguageModelV3): ToolLoopAgent {
  const instructions = [
    '你是一个代码库探索专用子代理。你的任务是快速搜索和分析代码库。',
    '',
    '你可以使用以下工具：',
    '- read-file: 读取文件内容',
    '- list-dir: 列出目录内容',
    '- grep-files: 搜索文件内容',
    '- project-query: 查询项目数据',
    '',
    '注意：你是只读的，不能修改任何文件。专注于搜索、分析和回答问题。',
  ].join('\n')

  return new ToolLoopAgent({
    id: `sub-agent-explore-${Date.now()}`,
    model,
    instructions,
    tools: buildToolset([...READ_ONLY_TOOL_IDS]),
    stopWhen: stepCountIs(SUB_AGENT_MAX_STEPS),
    experimental_repairToolCall: createToolCallRepair(),
  })
}

/** Create a plan sub-agent (read-only, fixed tools, architecture focus). */
function createPlanSubAgent(model: LanguageModelV3): ToolLoopAgent {
  const instructions = [
    '你是一个架构方案设计专用子代理。你的任务是分析代码库并设计实现方案。',
    '',
    '你可以使用以下工具：',
    '- read-file: 读取文件内容',
    '- list-dir: 列出目录内容',
    '- grep-files: 搜索文件内容',
    '- project-query: 查询项目数据',
    '',
    '注意：你是只读的，不能修改任何文件。专注于分析架构、识别关键文件、评估权衡，输出分步实现计划。',
  ].join('\n')

  return new ToolLoopAgent({
    id: `sub-agent-plan-${Date.now()}`,
    model,
    instructions,
    tools: buildToolset([...READ_ONLY_TOOL_IDS]),
    stopWhen: stepCountIs(SUB_AGENT_MAX_STEPS),
    experimental_repairToolCall: createToolCallRepair(),
  })
}

/** Try to create a dynamic agent from AGENT.md. */
function tryCreateDynamicAgent(
  agentName: string,
  skillRoots: CreateSubAgentInput['skillRoots'],
  model: LanguageModelV3,
): ToolLoopAgent | null {
  const match = resolveAgentByName(agentName, skillRoots ?? {})
  if (!match) return null
  return createDynamicAgentFromConfig(match.config, model)
}

/** Agent 协作工具 ID（general-purpose 子 agent 不可用）。 */
const AGENT_TOOL_IDS_TO_EXCLUDE = new Set(['spawn-agent', 'send-input', 'wait-agent', 'abort-agent'])

/** Agent collaboration tool IDs that are auto-injected when allowSubAgents is true. */
const AGENT_COLLAB_TOOL_IDS = ['spawn-agent', 'send-input', 'wait-agent', 'abort-agent']

/** Ensure agent collaboration tools are included when allowSubAgents is enabled. */
function ensureAgentToolIds(toolIds: readonly string[], allowSubAgents?: boolean): string[] {
  if (!allowSubAgents) return [...toolIds]
  const effectiveToolIds = [...toolIds]
  for (const id of AGENT_COLLAB_TOOL_IDS) {
    if (!effectiveToolIds.includes(id)) effectiveToolIds.push(id)
  }
  return effectiveToolIds
}

/** Create a ToolLoopAgent from an AgentConfig. */
export function createDynamicAgentFromConfig(
  config: AgentConfig,
  model: LanguageModelV3,
): ToolLoopAgent {
  const toolIds = ensureAgentToolIds(config.toolIds, config.allowSubAgents)
  const systemPrompt =
    config.systemPrompt || `你是 ${config.name}。${config.description}`

  return new ToolLoopAgent({
    id: `dynamic-agent-${config.name}`,
    model: wrapModelWithExamples(model),
    instructions: systemPrompt,
    tools: buildToolset(toolIds),
    stopWhen: stepCountIs(SUB_AGENT_MAX_STEPS),
    experimental_repairToolCall: createToolCallRepair(),
  })
}

/** Resolve the effective sub-agent type for display/logging. */
export function resolveEffectiveAgentName(raw?: string): string {
  if (!raw) return 'general-purpose'
  return raw.toLowerCase().trim()
}
