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
import { existsSync, mkdirSync, writeFileSync, cpSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import os from 'node:os'
import { getProviderSettings } from '@/modules/settings/settingsService'
import { resolveChatModel } from '@/ai/models/resolveChatModel'
import { setRequestContext, setChatModel, setAbortSignal } from '@/ai/shared/context/requestContext'
import { installHttpProxy } from '@/modules/proxy/httpProxy'
import { setOpenLoafRootOverride } from '@openloaf/config'

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

/** E2E 测试工作区 ID（与 scripts/docker-e2e/openloaf-root/workspaces.json 一致）。 */
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
 * 创建临时 OpenLoaf root 目录，将 Docker E2E 测试数据（workspace 目录、配置文件）
 * 复制到临时目录，并设置 setOpenLoafRootOverride 使所有文件系统配置读取指向测试数据。
 *
 * 注意：Prisma 在 import 时已初始化，不受 root override 影响。
 * 仅影响 workspaces.json、workspace.json、settings.json 等文件读取。
 */
let e2eTempRoot: string | null = null

export function setupE2eTestEnv(): string {
  if (e2eTempRoot) return e2eTempRoot

  // Docker E2E 数据源目录
  const e2eDataDir = path.resolve(
    import.meta.dirname,
    '../../../../../../scripts/docker-e2e/openloaf-root',
  )
  if (!existsSync(e2eDataDir)) {
    throw new Error(`E2E 数据目录不存在: ${e2eDataDir}`)
  }

  // 创建临时 root 目录
  const tempRoot = path.join(os.tmpdir(), `openloaf-e2e-${Date.now()}`)
  mkdirSync(tempRoot, { recursive: true })

  // 复制 workspace 目录（含项目数据、workspace.json、tasks 等）
  const srcWorkspace = path.join(e2eDataDir, 'workspace')
  const destWorkspace = path.join(tempRoot, 'workspace')
  cpSync(srcWorkspace, destWorkspace, { recursive: true })

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
  const settingsSrc = path.join(e2eDataDir, 'settings.json')
  if (existsSync(settingsSrc)) {
    cpSync(settingsSrc, path.join(tempRoot, 'settings.json'))
  }

  // 复制 providers.json（模型 Provider 配置）
  const providersSrc = path.join(e2eDataDir, 'providers.json')
  if (existsSync(providersSrc)) {
    cpSync(providersSrc, path.join(tempRoot, 'providers.json'))
  }

  // 设置 root override — 所有后续的 getOpenLoafRootDir() 都指向临时目录
  setOpenLoafRootOverride(tempRoot)
  e2eTempRoot = tempRoot

  return tempRoot
}

export function getE2eTempRoot(): string | null {
  return e2eTempRoot
}

export { getProviderSettings, setChatModel, setAbortSignal }
