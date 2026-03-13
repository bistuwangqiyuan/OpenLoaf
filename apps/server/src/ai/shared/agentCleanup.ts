/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { getOpenLoafRootDir, resolveScopedOpenLoafPath } from '@openloaf/config'
/** Migration version marker file. */
const MIGRATION_VERSION_FILE = '.agents-migration-version'
/** Minimum version that no longer scaffolds system agents. */
const MIN_CLEAN_VERSION = '0.2.8'

/**
 * Clean up legacy system agent folders scaffolded by older versions.
 * Reads `.openloaf/.agents-migration-version` to determine if cleanup is needed.
 */
function cleanupLegacySystemAgents(rootPath: string): void {
  const metaDir = resolveScopedOpenLoafPath(rootPath)
  const versionFile = path.join(metaDir, MIGRATION_VERSION_FILE)

  // Check if already migrated.
  if (existsSync(versionFile)) {
    try {
      const existing = readFileSync(versionFile, 'utf8').trim()
      if (existing >= MIN_CLEAN_VERSION) return
    } catch {
      // 读取失败则继续清理。
    }
  }

  // Remove legacy master agent folder.
  const masterDir = path.join(metaDir, 'agents', 'master')
  try {
    if (existsSync(masterDir)) {
      rmSync(masterDir, { recursive: true, force: true })
    }
  } catch {
    // 删除失败时静默忽略。
  }

  // Write current server version as migration marker.
  try {
    const require = createRequire(import.meta.url)
    const version: string = require('../../package.json').version
    writeFileSync(versionFile, version, 'utf8')
  } catch {
    // 写入版本标记失败时静默忽略。
  }
}

/**
 * Initialize global agent cleanup:
 * Clean up legacy system agent folders from older versions.
 */
function initAgentCleanup(rootPath: string): void {
  cleanupLegacySystemAgents(rootPath)
}

/**
 * Ensure the global OpenLoaf directory has been migrated.
 * Called at server startup.
 */
export function ensureDefaultAgentCleanup(): void {
  try {
    const rootPath = getOpenLoafRootDir()
    initAgentCleanup(rootPath)
  } catch {
    // 逻辑：启动时静默忽略，不影响服务启动。
  }
}
