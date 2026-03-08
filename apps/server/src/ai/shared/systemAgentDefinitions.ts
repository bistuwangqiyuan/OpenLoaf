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
 * 系统 Agent 定义 — 硬编码系统 Agent ID 列表。
 *
 * 仅用于 `isSystemAgentId` 判断，不再从模版派生完整定义。
 */

/** 系统 Agent ID 联合类型（仅 master）。 */
export type SystemAgentId = 'master'

/** 系统 Agent ID 集合（硬编码）。 */
const SYSTEM_AGENT_IDS: ReadonlySet<string> = new Set<string>(['master'])

/** 判断 folderName 是否为系统 Agent（仅 master）。 */
export function isSystemAgentId(folderName: string): boolean {
  return SYSTEM_AGENT_IDS.has(folderName)
}
