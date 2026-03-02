#!/usr/bin/env node

/**
 * Electron 整包更新发布脚本：
 * 1. （可选）运行 dist:mac 构建签名后的安装包
 * 2. 扫描 dist/ 目录中的构建产物和 latest-*.yml
 * 3. 安装包上传到 R2 的 desktop/{version}/ 路径下
 * 4. latest-*.yml 修改 url 前缀后上传到 desktop/ 根目录
 * 5. （可选）同步上传到腾讯 COS
 * 6. 上传 changelogs
 * 7. 清理旧版本（保留最近 3 个）
 *
 * R2 存储结构：
 *   desktop/
 *     latest-mac.yml          ← 自动更新清单（根目录）
 *     latest.yml
 *     latest-linux.yml
 *     0.2.3/
 *       OpenLoaf-0.2.3-MacOS-arm64.dmg
 *       OpenLoaf-0.2.3-MacOS-arm64.dmg.blockmap
 *       OpenLoaf-0.2.3.exe
 *       ...
 *
 * 用法：
 *   node scripts/publish-update.mjs                   # 先构建再上传
 *   node scripts/publish-update.mjs --skip-build      # 跳过构建，仅上传已有产物
 *
 * 配置来自 apps/desktop/.env.prod（自动加载，命令行环境变量优先）
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
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
  uploadChangelogs,
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
    console.log(`\n📋 将上传 ${ymlFiles.length} 个更新清单到 desktop/：`)
    for (const f of ymlFiles) {
      console.log(`   - ${f}`)
    }
  }
  console.log()

  // 4. 修改 yml 中的 url 路径
  for (const file of ymlFiles) {
    const ymlPath = path.join(distDir, file)
    patchYmlUrls(ymlPath, version)
    console.log(`   ✏️  Patched ${file} urls with ${version}/ prefix`)
  }

  // 5. 上传安装包到 desktop/{version}/
  for (const file of installerFiles) {
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

  // 6. 上传 yml 到 desktop/ 根目录
  for (const file of ymlFiles) {
    const key = `desktop/${file}`
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

  // 7. 上传 changelogs（R2 主存储，COS 可选同步）
  console.log('\n📝 Uploading changelogs...')
  await uploadChangelogs({
    s3,
    bucket: r2Config.bucket,
    component: 'desktop',
    changelogsDir: path.join(electronRoot, 'changelogs'),
    publicUrl: r2Config.publicUrl,
  })
  if (cos && cosConfig) {
    await uploadChangelogs({
      s3: cos,
      bucket: cosConfig.bucket,
      component: 'desktop',
      changelogsDir: path.join(electronRoot, 'changelogs'),
      publicUrl: cosConfig.publicUrl,
    })
  }

  // 8. 清理旧版本（保留最近 3 个版本文件夹）
  await cleanupOldVersions({ s3, bucket: r2Config.bucket, prefix: 'desktop/', keep: 3 })
  if (cos && cosConfig) {
    await cleanupOldVersions({ s3: cos, bucket: cosConfig.bucket, prefix: 'desktop/', keep: 3 })
  }

  console.log(`\n🎉 Electron v${version} published successfully!`)
  console.log(`   R2:  ${r2Config.publicUrl}/desktop/${version}/`)
  if (cosConfig) {
    console.log(`   COS: ${cosConfig.publicUrl}/desktop/${version}/`)
  }
  console.log(`\n📥 Download URLs:`)
  for (const file of installerFiles) {
    if (file.endsWith('.blockmap')) continue
    console.log(`   ${r2Config.publicUrl}/desktop/${version}/${file}`)
  }
}

main().catch((err) => {
  console.error('❌ Publish failed:', err)
  process.exit(1)
})
