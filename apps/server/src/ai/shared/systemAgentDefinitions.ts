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
 * 系统 Agent 定义 — 从 agent-templates 派生。
 *
 * 子 Agent 已改为行为驱动类型（general-purpose / explore / plan），
 * 此模块仅保留 master 的元数据供脚手架和配置服务使用。
 */

import {
  getScaffoldableTemplates,
  type AgentTemplate,
} from '@/ai/agent-templates'

/** 系统 Agent ID 联合类型（仅 master）。 */
export type SystemAgentId = 'master'

/** 系统 Agent 定义。 */
export type SystemAgentDefinition = {
  id: SystemAgentId
  name: string
  description: string
  icon: string
  toolIds: readonly string[]
  allowSubAgents: boolean
  maxDepth: number
  isPrimary: boolean
}

/** 从模版派生系统 Agent 定义。 */
function deriveFromTemplate(template: AgentTemplate): SystemAgentDefinition {
  return {
    id: template.id as SystemAgentId,
    name: template.name,
    description: template.description,
    icon: template.icon,
    toolIds: template.toolIds,
    allowSubAgents: template.allowSubAgents,
    maxDepth: template.maxDepth,
    isPrimary: template.isPrimary,
  }
}

/** 系统 Agent 定义（从模版派生）。 */
export const SYSTEM_AGENT_DEFINITIONS: readonly SystemAgentDefinition[] =
  getScaffoldableTemplates().map(deriveFromTemplate)

/** 系统 Agent ID → 定义映射。 */
export const SYSTEM_AGENT_MAP = new Map<string, SystemAgentDefinition>(
  SYSTEM_AGENT_DEFINITIONS.map((def) => [def.id, def]),
)

/** 判断 folderName 是否为系统 Agent（仅 master）。 */
export function isSystemAgentId(folderName: string): boolean {
  return SYSTEM_AGENT_MAP.has(folderName)
}

/** 获取主 Agent 定义。 */
export function getPrimaryAgentDefinition(): SystemAgentDefinition {
  const primary = SYSTEM_AGENT_DEFINITIONS.find((d) => d.isPrimary)
  return primary!
}
