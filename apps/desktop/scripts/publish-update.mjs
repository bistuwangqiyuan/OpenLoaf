#!/usr/bin/env node

/**
 * Electron 整包更新发布脚本（Beta-first 模式）：
 * 1. （可选）运行 dist:mac 构建签名后的安装包
 * 2. 扫描 dist/ 目录中的构建产物和 latest-*.yml
 * 3. 计算安装包 sha256/size，构建完整 versionManifest
 * 4. 安装包 + yml 上传到 R2 的 desktop/{version}/ 版本目录下
 * 5. yml 同时上传到 desktop/beta/ 渠道目录（供渠道感知的 electron-updater 使用）
 *    以及 desktop/ 根目录（向后兼容旧版客户端）
 * 6. 写 desktop/{version}/manifest.json（完整版本信息：sha256、url、size 等）
 * 7. 更新 beta/manifest.json → { "desktop": { "version": "{version}" } }
 * 8. （可选）同步上传到腾讯 COS
 * 9. 上传 changelogs 到版本目录 + changelogs/ 目录
 * 10. 清理旧版本（保留最近 3 个）
 *
 * R2 存储结构（新格式）：
 *   beta/manifest.json              ← 轻量渠道指针: { "desktop": { "version": "0.1.1-beta.1" } }
 *   desktop/
 *     beta/
 *       latest-mac.yml              ← beta 渠道更新清单（供渠道感知的客户端使用）
 *       latest.yml
 *       latest-linux.yml
 *     latest-mac.yml                ← 根目录（向后兼容）
 *     latest.yml
 *     latest-linux.yml
 *     0.1.1-beta.1/
 *       manifest.json               ← 完整版本信息（sha256、url、size、platforms）
 *       CHANGELOG.md                ← 本版本更新记录
 *       OpenLoaf-0.1.1-beta.1-arm64.dmg
 *       OpenLoaf-0.1.1-beta.1.exe
 *       OpenLoaf-0.1.1-beta.1.AppImage
 *       latest-mac.yml              ← electron-updater 兼容文件（版本目录内）
 *       latest.yml
 *
 * 用法：
 *   node scripts/publish-update.mjs                   # 先构建再上传
 *   node scripts/publish-update.mjs --skip-build      # 跳过构建，仅上传已有产物
 *
 * 配置来自 apps/desktop/.env.prod（自动加载，命令行环境变量优先）
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import {
  loadEnvFile,
  validateR2Config,
  validateCosConfig,
  createS3Client,
  createCosS3Client,
  uploadFile,
  uploadJson,
  downloadJson,
  uploadChangelogs,
  computeSha256,
  cleanupOldVersions,
} from '../../../scripts/shared/publishUtils.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const electronRoot = path.resolve(__dirname, '..')

// ---------------------------------------------------------------------------
// 自动加载 .env.prod
// ---------------------------------------------------------------------------

loadEnvFile(path.join(electronRoot, '.env.prod'))

// ---------------------------------------------------------------------------
// 配置校验
// ---------------------------------------------------------------------------

const r2Config = validateR2Config()
const s3 = createS3Client(r2Config)

const cosConfig = validateCosConfig()
const cos = cosConfig ? createCosS3Client(cosConfig) : null

if (cosConfig) {
  console.log(`☁️  COS sync enabled: ${cosConfig.bucket}`)
} else {
  console.log('   COS sync disabled (COS_* env vars not set)')
}

// ---------------------------------------------------------------------------
// 全平台产物匹配规则
// ---------------------------------------------------------------------------

const AUTO_UPDATE_YMLS = ['latest-mac.yml', 'latest.yml', 'latest-linux.yml']

function isAutoUpdateYml(filename) {
  return AUTO_UPDATE_YMLS.includes(filename)
}

function isInstallerArtifact(filename) {
  const exts = ['.dmg', '.dmg.blockmap', '.zip', '.zip.blockmap',
                '.exe', '.exe.blockmap', '.AppImage', '.AppImage.blockmap']
  return exts.some((ext) => filename.endsWith(ext))
}

function isDesktopArtifact(filename) {
  return isAutoUpdateYml(filename) || isInstallerArtifact(filename)
}

// ---------------------------------------------------------------------------
// 平台归类
// ---------------------------------------------------------------------------

/**
 * 从文件名推断 platform key（用于 versionManifest.platforms）。
 */
function inferPlatform(filename) {
  if (filename.includes('-arm64') && (filename.endsWith('.dmg') || filename.endsWith('.zip'))) {
    return 'mac-arm64'
  }
  if ((filename.includes('-x64') || filename.includes('-MacOS-x64')) && (filename.endsWith('.dmg') || filename.endsWith('.zip'))) {
    return 'mac-x64'
  }
  if (filename.endsWith('.exe')) return 'win-x64'
  if (filename.endsWith('.AppImage')) return 'linux-x64'
  return null
}

// ---------------------------------------------------------------------------
// yml url 前缀修改
// ---------------------------------------------------------------------------

/**
 * 修改 latest-*.yml 中的 url 字段，加上 {version}/ 前缀。
 * electron-builder 生成的 yml 中 url 是裸文件名（如 OpenLoaf-0.2.3.dmg），
 * 需要改为 0.2.3/OpenLoaf-0.2.3.dmg 才能匹配版本化的目录结构。
 */
function patchYmlUrls(ymlPath, version) {
  const content = readFileSync(ymlPath, 'utf-8')
  // 匹配 "url: SomeFile.ext" 和 "  - url: SomeFile.ext" 格式
  const patched = content.replace(
    /^(\s*-?\s*url:\s*)(.+)$/gm,
    (match, prefix, url) => {
      const trimmedUrl = url.trim()
      // 跳过已经有路径前缀或者是完整 URL 的
      if (trimmedUrl.startsWith('http') || trimmedUrl.includes('/')) return match
      return `${prefix}${version}/${trimmedUrl}`
    }
  )
  // 同样修改顶层 path 字段
  const patchedPath = patched.replace(
    /^(path:\s*)(.+)$/m,
    (match, prefix, p) => {
      const trimmedPath = p.trim()
      if (trimmedPath.startsWith('http') || trimmedPath.includes('/')) return match
      return `${prefix}${version}/${trimmedPath}`
    }
  )
  writeFileSync(ymlPath, patchedPath, 'utf-8')
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)
  const skipBuild = args.includes('--skip-build')

  // 1. 读取版本号
  const pkg = JSON.parse(readFileSync(path.join(electronRoot, 'package.json'), 'utf-8'))
  const version = pkg.version
  console.log(`📦 Electron version: ${version}`)

  // 检测渠道（beta 还是 stable）
  const isBeta = version.includes('-beta')
  const channel = isBeta ? 'beta' : 'stable'
  console.log(`📡 Channel: ${channel}`)

  // 2. 构建（可选）
  if (!skipBuild) {
    console.log('🔨 Building Electron app (dist:mac)...')
    execSync('pnpm run dist:mac', { cwd: electronRoot, stdio: 'inherit' })
  }

  // 3. 扫描 dist/ 目录
  const distDir = path.join(electronRoot, 'dist')
  if (!existsSync(distDir)) {
    console.error('❌ dist/ 目录不存在。请先运行构建或去掉 --skip-build')
    process.exit(1)
  }

  const allFiles = readdirSync(distDir)
  const filesToUpload = allFiles.filter(isDesktopArtifact)

  if (filesToUpload.length === 0) {
    console.error('❌ dist/ 目录中没有找到可上传的构建产物')
    process.exit(1)
  }

  const installerFiles = filesToUpload.filter(isInstallerArtifact)
  const ymlFiles = filesToUpload.filter(isAutoUpdateYml)

  console.log(`\n📋 将上传 ${installerFiles.length} 个安装包到 desktop/${version}/：`)
  for (const f of installerFiles) {
    console.log(`   - ${f}`)
  }
  if (ymlFiles.length > 0) {
    console.log(`\n📋 将上传 ${ymlFiles.length} 个更新清单到版本目录 + 渠道目录：`)
    for (const f of ymlFiles) {
      console.log(`   - ${f}`)
    }
  }
  console.log()

  // 4. 修改 yml 中的 url 路径（加版本前缀）
  for (const file of ymlFiles) {
    const ymlPath = path.join(distDir, file)
    patchYmlUrls(ymlPath, version)
    console.log(`   ✏️  Patched ${file} urls with ${version}/ prefix`)
  }

  // 5. 上传安装包到 desktop/{version}/
  const platforms = {}
  for (const file of installerFiles) {
    const key = `desktop/${version}/${file}`
    const filePath = path.join(distDir, file)
    const fileSize = statSync(filePath).size

    const uploads = [
      uploadFile(s3, r2Config.bucket, key, filePath).then(() => console.log(`   [R2]  ${key}`)),
    ]
    if (cos && cosConfig) {
      uploads.push(
        uploadFile(cos, cosConfig.bucket, key, filePath).then(() => console.log(`   [COS] ${key}`)),
      )
    }
    await Promise.all(uploads)

    // 为 versionManifest 收集平台信息（仅对主安装包，跳过 blockmap 等）
    if (!file.endsWith('.blockmap')) {
      const platform = inferPlatform(file)
      if (platform) {
        // 计算 sha256（只对主安装包）
        const sha256 = await computeSha256(filePath)
        platforms[platform] = {
          url: `${r2Config.publicUrl}/desktop/${version}/${file}`,
          sha256,
          size: fileSize,
        }
      }
    }
  }

  // 6. 上传 yml 到版本目录 desktop/{version}/
  for (const file of ymlFiles) {
    const key = `desktop/${version}/${file}`
    const filePath = path.join(distDir, file)
    const uploads = [
      uploadFile(s3, r2Config.bucket, key, filePath).then(() => console.log(`   [R2]  ${key}`)),
    ]
    if (cos && cosConfig) {
      uploads.push(
        uploadFile(cos, cosConfig.bucket, key, filePath).then(() => console.log(`   [COS] ${key}`)),
      )
    }
    await Promise.all(uploads)
  }

  // 7. 上传 yml 到渠道目录 desktop/{channel}/ 及根目录 desktop/
  for (const file of ymlFiles) {
    const filePath = path.join(distDir, file)

    // 渠道目录
    const channelKey = `desktop/${channel}/${file}`
    await uploadFile(s3, r2Config.bucket, channelKey, filePath)
    console.log(`   [R2]  ${channelKey}`)
    if (cos && cosConfig) {
      await uploadFile(cos, cosConfig.bucket, channelKey, filePath)
      console.log(`   [COS] ${channelKey}`)
    }

    // 根目录（向后兼容旧版客户端）
    const rootKey = `desktop/${file}`
    await uploadFile(s3, r2Config.bucket, rootKey, filePath)
    console.log(`   [R2]  ${rootKey} (compat)`)
    if (cos && cosConfig) {
      await uploadFile(cos, cosConfig.bucket, rootKey, filePath)
      console.log(`   [COS] ${rootKey} (compat)`)
    }
  }

  // 8. 写 desktop/{version}/manifest.json（完整版本信息）
  const versionManifest = {
    version,
    publishedAt: new Date().toISOString(),
    channel,
    platforms,
  }
  const versionManifestKey = `desktop/${version}/manifest.json`
  await uploadJson(s3, r2Config.bucket, versionManifestKey, versionManifest)
  console.log(`\n✅ Written version manifest: ${versionManifestKey}`)
  if (cos && cosConfig) {
    await uploadJson(cos, cosConfig.bucket, versionManifestKey, versionManifest)
  }

  // 9. 更新渠道指针 {channel}/manifest.json
  //    只写 desktop.version（轻量指针），保留其他字段不变
  const channelManifestKey = `${channel}/manifest.json`
  let channelManifest = {}
  try {
    channelManifest = await downloadJson(s3, r2Config.bucket, channelManifestKey)
  } catch {
    // 首次创建
  }
  channelManifest.desktop = { version }
  await uploadJson(s3, r2Config.bucket, channelManifestKey, channelManifest)
  console.log(`✅ Updated ${channelManifestKey}: desktop.version = "${version}"`)
  if (cos && cosConfig) {
    let cosChannelManifest = {}
    try {
      cosChannelManifest = await downloadJson(cos, cosConfig.bucket, channelManifestKey)
    } catch {
      // ignore
    }
    cosChannelManifest.desktop = { version }
    await uploadJson(cos, cosConfig.bucket, channelManifestKey, cosChannelManifest)
  }

  // 10. 上传 changelogs（同时写到版本目录和 changelogs/ 目录）
  console.log('\n📝 Uploading changelogs...')
  const changelogsDir = path.join(electronRoot, 'changelogs')
  await uploadChangelogs({
    s3,
    bucket: r2Config.bucket,
    component: 'desktop',
    changelogsDir,
    publicUrl: r2Config.publicUrl,
    versionDirPrefix: `desktop/${version}`,
  })
  if (cos && cosConfig) {
    await uploadChangelogs({
      s3: cos,
      bucket: cosConfig.bucket,
      component: 'desktop',
      changelogsDir,
      publicUrl: cosConfig.publicUrl,
      versionDirPrefix: `desktop/${version}`,
    })
  }

  // 11. 清理旧版本（保留最近 3 个版本文件夹）
  await cleanupOldVersions({ s3, bucket: r2Config.bucket, prefix: 'desktop/', keep: 3 })
  if (cos && cosConfig) {
    await cleanupOldVersions({ s3: cos, bucket: cosConfig.bucket, prefix: 'desktop/', keep: 3 })
  }

  console.log(`\n🎉 Electron v${version} published to ${channel} channel!`)
  console.log(`   R2:  ${r2Config.publicUrl}/desktop/${version}/`)
  if (cosConfig) {
    console.log(`   COS: ${cosConfig.publicUrl}/desktop/${version}/`)
  }
  console.log(`\n📥 Version manifest:`)
  console.log(`   ${r2Config.publicUrl}/${channelManifestKey}`)
  console.log(`   ${r2Config.publicUrl}/${versionManifestKey}`)
  console.log(`\n📥 Download URLs:`)
  for (const [platform, info] of Object.entries(platforms)) {
    console.log(`   [${platform}] ${info.url}`)
  }
}

main().catch((err) => {
  console.error('❌ Publish failed:', err)
  process.exit(1)
})
