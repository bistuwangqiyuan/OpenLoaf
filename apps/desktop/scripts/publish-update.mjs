#!/usr/bin/env node

/**
 * Electron 整包更新发布脚本：
 * 1. （可选）运行 dist:mac 构建签名后的安装包
 * 2. 扫描 dist/ 目录中的构建产物和 latest-*.yml
 * 3. 上传到 Cloudflare R2 的 desktop/ 路径下
 * 4. （可选）同步上传到腾讯 COS（配置 COS_* 环境变量后生效）
 * 5. 上传 changelogs
 *
 * 用法：
 *   node scripts/publish-update.mjs                   # 先构建再上传
 *   node scripts/publish-update.mjs --skip-build      # 跳过构建，仅上传已有产物
 *
 * 配置来自 apps/desktop/.env.prod（自动加载，命令行环境变量优先）
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
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

function isDesktopArtifact(filename) {
  // Auto-update manifests
  if (['latest-mac.yml', 'latest.yml', 'latest-linux.yml'].includes(filename)) return true
  // Installers, archives and blockmaps (all platforms)
  const exts = ['.dmg', '.dmg.blockmap', '.zip', '.zip.blockmap',
                '.exe', '.exe.blockmap', '.AppImage', '.AppImage.blockmap']
  return exts.some((ext) => filename.endsWith(ext))
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

  console.log(`\n📋 将上传 ${filesToUpload.length} 个文件到 desktop/ 路径：`)
  for (const f of filesToUpload) {
    console.log(`   - ${f}`)
  }
  console.log()

  // 4. 上传到 R2 + COS（并行）
  for (const file of filesToUpload) {
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

  // 5. 上传 changelogs（R2 主存储，COS 可选同步）
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

  console.log(`\n🎉 Electron v${version} published successfully!`)
  console.log(`   R2:  ${r2Config.publicUrl}/desktop/`)
  if (cosConfig) {
    console.log(`   COS: ${cosConfig.publicUrl}/desktop/`)
  }
  console.log(`\n📥 Download URLs:`)
  for (const file of filesToUpload) {
    if (file.endsWith('.yml') || file.endsWith('.blockmap')) continue
    console.log(`   ${r2Config.publicUrl}/desktop/${file}`)
  }
}

main().catch((err) => {
  console.error('❌ Publish failed:', err)
  process.exit(1)
})
