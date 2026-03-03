#!/usr/bin/env node

/**
 * Promote desktop beta 版本到 stable 渠道。
 *
 * 流程：
 * 1. 从环境变量读取 STABLE_VERSION 和 BETA_VERSION
 * 2. 在 R2 写 desktop/{stableVersion}/manifest.json（redirect 文件，指向 beta 目录）
 * 3. 复制 beta 渠道的 latest-*.yml 到 stable 渠道目录
 * 4. 更新 stable/manifest.json 中的 desktop.version 字段
 * 5. 删除 R2 中的 beta 版本目录（desktop/{betaVersion}/）
 *
 * 用法：
 *   STABLE_VERSION=0.1.1 BETA_VERSION=0.1.1-beta.1 node scripts/promote-desktop.mjs
 *
 * 或通过 CI 环境变量自动传入。
 */

import {
  loadEnvFile,
  validateR2Config,
  createS3Client,
  downloadJson,
  uploadJson,
} from './shared/publishUtils.mjs'
import { S3Client, CopyObjectCommand, ListObjectsV2Command, DeleteObjectsCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载本地 .env.prod（CI 中由环境变量覆盖）
const desktopEnvPath = path.join(__dirname, '..', 'apps', 'desktop', '.env.prod')
loadEnvFile(desktopEnvPath)

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------

const r2Config = validateR2Config()
const s3 = createS3Client(r2Config)

const stableVersion = process.env.STABLE_VERSION
const betaVersion = process.env.BETA_VERSION

if (!stableVersion || !betaVersion) {
  console.error('❌ 缺少 STABLE_VERSION 或 BETA_VERSION 环境变量')
  console.error('   用法: STABLE_VERSION=0.1.1 BETA_VERSION=0.1.1-beta.1 node scripts/promote-desktop.mjs')
  process.exit(1)
}

if (stableVersion.includes('-beta')) {
  console.error(`❌ STABLE_VERSION 不能包含 -beta：${stableVersion}`)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

async function getObjectText(bucket, key) {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  return res.Body.transformToString()
}

async function putObjectText(bucket, key, body, contentType = 'application/json') {
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  }))
}

async function listKeys(bucket, prefix) {
  const keys = []
  let token
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: token,
    }))
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key)
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)
  return keys
}

async function copyObject(bucket, srcKey, destKey) {
  await s3.send(new CopyObjectCommand({
    Bucket: bucket,
    CopySource: `${bucket}/${srcKey}`,
    Key: destKey,
  }))
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

async function main() {
  const { bucket, publicUrl } = r2Config

  console.log(`🚀 Promoting desktop ${betaVersion} → ${stableVersion}`)
  console.log(`   R2 Bucket: ${bucket}`)
  console.log()

  // 1. 验证 beta 目录存在
  const betaManifestKey = `desktop/${betaVersion}/manifest.json`
  let betaManifest
  try {
    betaManifest = await downloadJson(s3, bucket, betaManifestKey)
    console.log(`✅ Found beta manifest: desktop/${betaVersion}/manifest.json`)
  } catch {
    console.error(`❌ Beta manifest not found: ${betaManifestKey}`)
    console.error(`   请确认 ${betaVersion} 已发布到 R2`)
    process.exit(1)
  }

  // 2. 写 desktop/{stableVersion}/manifest.json（redirect 文件）
  const redirectManifest = {
    version: stableVersion,
    redirectTo: betaVersion,
    publishedAt: new Date().toISOString(),
  }
  const redirectKey = `desktop/${stableVersion}/manifest.json`
  await uploadJson(s3, bucket, redirectKey, redirectManifest)
  console.log(`✅ Written redirect manifest: ${redirectKey}`)
  console.log(`   redirectTo: ${betaVersion}`)

  // 3. 复制 beta 目录的 latest-*.yml 到 stable 渠道目录（desktop/stable/）
  //    同时也写到 desktop/ 根目录（保持 electron-updater 向后兼容）
  const AUTO_UPDATE_YMLS = ['latest-mac.yml', 'latest.yml', 'latest-linux.yml']
  const betaPrefix = `desktop/${betaVersion}/`
  const betaKeys = await listKeys(bucket, betaPrefix)

  console.log()
  console.log('📋 Copying auto-update YML files...')
  for (const ymlName of AUTO_UPDATE_YMLS) {
    const srcKey = `${betaPrefix}${ymlName}`
    if (!betaKeys.includes(srcKey)) continue

    // 复制到 desktop/stable/（渠道目录）
    const stableChannelKey = `desktop/stable/${ymlName}`
    await copyObject(bucket, srcKey, stableChannelKey)
    console.log(`   [R2] Copied: ${srcKey} → ${stableChannelKey}`)
  }

  // 4. 更新 stable/manifest.json 的 desktop.version 字段
  console.log()
  console.log('📝 Updating stable/manifest.json...')
  let stableManifest = {}
  try {
    stableManifest = await downloadJson(s3, bucket, 'stable/manifest.json')
  } catch {
    // 首次创建
    console.log('   (stable/manifest.json 不存在，将创建新文件)')
  }

  // 只更新 desktop.version，保留其他字段（server、web 等）
  stableManifest.desktop = { version: stableVersion }
  await uploadJson(s3, bucket, 'stable/manifest.json', stableManifest)
  console.log(`   Updated stable/manifest.json: desktop.version = "${stableVersion}"`)

  // 5. 删除 beta 目录（promote 后不再需要）
  console.log()
  console.log(`🗑️  Deleting beta directory: desktop/${betaVersion}/`)
  for (let i = 0; i < betaKeys.length; i += 1000) {
    const batch = betaKeys.slice(i, i + 1000)
    await s3.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: batch.map((Key) => ({ Key })) },
    }))
  }
  console.log(`   Deleted ${betaKeys.length} files from desktop/${betaVersion}/`)

  // 6. 输出摘要
  console.log()
  console.log(`🎉 Promote 完成！`)
  console.log(`   Stable version: ${stableVersion}`)
  console.log(`   Sources from:   ${betaVersion}`)
  console.log()
  console.log('📥 Stable manifest:')
  console.log(`   ${publicUrl}/stable/manifest.json`)
  console.log()
  console.log('📥 Version redirect:')
  console.log(`   ${publicUrl}/desktop/${stableVersion}/manifest.json → ${betaVersion}`)
  console.log()
  console.log('📥 Version details:')
  console.log(`   ${publicUrl}/desktop/${betaVersion}/manifest.json`)

  if (betaManifest.platforms) {
    console.log()
    console.log('📥 Download URLs (from beta):')
    for (const [platform, info] of Object.entries(betaManifest.platforms)) {
      if (info?.url) {
        console.log(`   [${platform}] ${info.url}`)
      }
    }
  }
}

main().catch((err) => {
  console.error('❌ Promote failed:', err)
  process.exit(1)
})
