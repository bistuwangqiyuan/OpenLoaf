#!/usr/bin/env node
/**
 * Promote beta manifest entries to stable.
 *
 * Usage:
 *   node scripts/promote-beta-to-stable.mjs [--component=server|web] [--dry-run]
 *
 * Reads beta/manifest.json from R2, copies matching component entries into
 * stable/manifest.json. Artifact URLs and version strings are preserved as-is.
 *
 * Requires R2 credentials in apps/server/.env.prod (or environment variables).
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  loadEnvFile,
  validateR2Config,
  createS3Client,
  downloadJson,
  uploadJson,
} from './shared/publishUtils.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------------------
// CLI 参数
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

let componentFilter = null
for (const arg of args) {
  const match = arg.match(/^--component=(.+)$/)
  if (match) {
    if (!['server', 'web'].includes(match[1])) {
      console.error(`❌ --component 仅支持 server 或 web，收到: ${match[1]}`)
      process.exit(1)
    }
    componentFilter = match[1]
  }
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

async function main() {
  // 加载 R2 凭证
  loadEnvFile(path.resolve(__dirname, '..', 'apps', 'server', '.env.prod'))
  const r2Config = validateR2Config()
  const s3 = createS3Client({
    endpoint: r2Config.endpoint,
    accessKeyId: r2Config.accessKeyId,
    secretAccessKey: r2Config.secretAccessKey,
  })

  // 下载 beta manifest
  let beta
  try {
    beta = await downloadJson(s3, r2Config.bucket, 'beta/manifest.json')
  } catch (err) {
    console.error('❌ 无法下载 beta/manifest.json:', err.message)
    process.exit(1)
  }

  // 下载 stable manifest（可能不存在）
  let stable
  try {
    stable = await downloadJson(s3, r2Config.bucket, 'stable/manifest.json')
  } catch {
    stable = { schemaVersion: 1 }
  }

  if (beta.schemaVersion !== 1) {
    console.error(`❌ beta manifest schemaVersion 不支持: ${beta.schemaVersion}`)
    process.exit(1)
  }

  const components = componentFilter ? [componentFilter] : ['server', 'web']
  let changed = false

  for (const comp of components) {
    const betaEntry = beta[comp]
    if (!betaEntry) {
      console.log(`⏭️  beta 中无 ${comp} 条目，跳过`)
      continue
    }
    const stableEntry = stable[comp]
    const stableVersion = stableEntry?.version ?? '(无)'
    console.log(`📦 ${comp}: beta ${betaEntry.version} → stable (当前 ${stableVersion})`)
    stable[comp] = betaEntry
    changed = true
  }

  // 同步 electron.minVersion
  if (beta.electron?.minVersion) {
    const prev = stable.electron?.minVersion ?? '(无)'
    console.log(`🔧 electron.minVersion: ${prev} → ${beta.electron.minVersion}`)
    stable.electron = { ...stable.electron, ...beta.electron }
    changed = true
  }

  if (!changed) {
    console.log('✅ 无需更新')
    return
  }

  if (dryRun) {
    console.log('\n🔍 [dry-run] 将写入的 stable/manifest.json:')
    console.log(JSON.stringify(stable, null, 2))
    console.log('\n🔍 [dry-run] 未实际写入。去掉 --dry-run 以执行。')
    return
  }

  await uploadJson(s3, r2Config.bucket, 'stable/manifest.json', stable)
  console.log('\n✅ stable/manifest.json 已更新')
}

main().catch((err) => {
  console.error('❌ promote 失败:', err)
  process.exit(1)
})
