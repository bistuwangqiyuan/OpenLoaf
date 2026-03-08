/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import path from 'node:path'
import { existsSync, mkdirSync, writeFileSync, cpSync, readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import os from 'node:os'
import { getProviderSettings } from '@/modules/settings/settingsService'
import { resolveChatModel } from '@/ai/models/resolveChatModel'
import { setRequestContext, setChatModel, setAbortSignal } from '@/ai/shared/context/requestContext'
import { installHttpProxy } from '@/modules/proxy/httpProxy'
import { getOpenLoafRootDir, setOpenLoafRootOverride, setDefaultWorkspaceRootOverride } from '@openloaf/config'

// 测试环境初始化代理 — 确保 Node.js fetch 走系统代理（undici 不自动识别环境变量）
installHttpProxy()

const ENV_KEY = 'OPENLOAF_TEST_CHAT_MODEL_ID'

/**
 * 读取 OPENLOAF_TEST_CHAT_MODEL_ID 环境变量（格式：profileId:modelId）。
 * 未设置时返回 undefined，走 resolveChatModel 自动 fallback。
 */
export function getTestChatModelId(): string | undefined {
  const raw = process.env[ENV_KEY]
  return raw?.trim() || undefined
}

/**
 * 解析测试模型为 LanguageModelV3。
 */
export async function resolveTestModel() {
  const chatModelId = getTestChatModelId()
  return resolveChatModel({ chatModelId, chatModelSource: 'local' })
}

/** E2E 测试工作区 ID（与 fixtures/workspaces.json 一致）。 */
export const E2E_WORKSPACE_ID = '00000000-e2e0-4000-8000-000000000001'

/**
 * 设置最小 RequestContext（sessionId + cookies + workspaceId）。
 * workspaceId 使用 E2E 测试工作区，确保 calendar/email/project 等工具能正确查询数据。
 */
export function setMinimalRequestContext() {
  setRequestContext({
    sessionId: `test-${Date.now()}`,
    cookies: {},
    workspaceId: E2E_WORKSPACE_ID,
  })
}

/**
 * 初始化 E2E 测试环境。
 *
 * 两步复制策略：
 * 1. 复制共享基础 fixtures（workspace/.openloaf/tasks、README.md、配置文件）
 * 2. 扫描各域 tests/{domain}/workspace/ 并 overlay（master 项目结构、tools 文档文件、email 数据等）
 *
 * 合并后的 workspace 结构完整，测试行为不受影响。
 *
 * 注意：Prisma 在 import 时已初始化，不受 root override 影响。
 * 仅影响 workspaces.json、workspace.json、settings.json 等文件读取。
 */
let e2eTempRoot: string | null = null

export function setupE2eTestEnv(): string {
  if (e2eTempRoot) return e2eTempRoot

  const behaviorDir = path.resolve(import.meta.dirname, '../agent-behavior')
  const fixturesDir = path.join(behaviorDir, 'fixtures')
  const testsDir = path.join(behaviorDir, 'tests')

  if (!existsSync(fixturesDir)) {
    throw new Error(`Fixture 目录不存在: ${fixturesDir}`)
  }

  // 创建临时 root 目录
  const tempRoot = path.join(os.tmpdir(), `openloaf-e2e-${Date.now()}`)
  mkdirSync(tempRoot, { recursive: true })

  const destWorkspace = path.join(tempRoot, 'workspace')

  // 1. 复制共享基础 workspace（.openloaf/tasks、README.md 等）
  const sharedWorkspace = path.join(fixturesDir, 'workspace')
  if (existsSync(sharedWorkspace)) {
    cpSync(sharedWorkspace, destWorkspace, { recursive: true })
  }

  // 2. 扫描 tests/*/workspace/ 并 overlay 到目标 workspace
  for (const domain of readdirSync(testsDir)) {
    const domainWorkspace = path.join(testsDir, domain, 'workspace')
    if (existsSync(domainWorkspace)) {
      cpSync(domainWorkspace, destWorkspace, { recursive: true })
    }
  }

  // 生成 workspaces.json，rootUri 指向本地路径
  const workspacesPayload = {
    workspaces: [
      {
        id: E2E_WORKSPACE_ID,
        name: 'E2E Test Workspace',
        type: 'local',
        isActive: true,
        rootUri: pathToFileURL(destWorkspace).href,
        projects: {},
        ignoreSkills: [],
      },
    ],
  }
  writeFileSync(
    path.join(tempRoot, 'workspaces.json'),
    JSON.stringify(workspacesPayload, null, 2),
  )

  // 复制 settings.json（模型配置等）
  const settingsSrc = path.join(fixturesDir, 'settings.json')
  if (existsSync(settingsSrc)) {
    cpSync(settingsSrc, path.join(tempRoot, 'settings.json'))
  }

  // 复制 providers.json — 优先使用 fixture，fallback 到用户实际配置
  const providersDest = path.join(tempRoot, 'providers.json')
  const fixtureProviders = path.join(fixturesDir, 'providers.json')
  if (existsSync(fixtureProviders)) {
    cpSync(fixtureProviders, providersDest)
  } else {
    const userProviders = path.join(getOpenLoafRootDir(), 'providers.json')
    if (existsSync(userProviders)) {
      cpSync(userProviders, providersDest)
    }
  }

  // 设置 root override — 所有后续的 getOpenLoafRootDir() 都指向临时目录
  setOpenLoafRootOverride(tempRoot)
  // 设置 workspace root override — 避免 normalizeLegacyWorkspaceUri 把 rootUri 替换为默认路径
  setDefaultWorkspaceRootOverride(destWorkspace)
  e2eTempRoot = tempRoot

  return tempRoot
}

export function getE2eTempRoot(): string | null {
  return e2eTempRoot
}

/**
 * 动态写入 master agent 配置到 E2E workspace。
 * 用于多模型对比测试 —— 每次 provider 调用前更新 chatModelId。
 *
 * chatStreamService 从 workspace/.openloaf/agents/master/agent.json 读取
 * modelLocalIds[0] 作为 chatModelId，跳过 requiredTags 过滤。
 */
export function setE2eAgentModel(chatModelId: string): void {
  if (!e2eTempRoot) return
  const agentDir = path.join(e2eTempRoot, 'workspace', '.openloaf', 'agents', 'master')
  mkdirSync(agentDir, { recursive: true })
  writeFileSync(
    path.join(agentDir, 'agent.json'),
    JSON.stringify({ name: 'master', modelLocalIds: [chatModelId] }),
  )
}

export { getProviderSettings, setChatModel, setAbortSignal }
