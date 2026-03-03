#!/usr/bin/env node
/**
 * 一次性脚本：为已上传到 R2 的安装包生成 electron-updater yml 并上传。
 * 用法：node fix-upload-ymls.mjs
 */
import { createHash } from 'node:crypto'
import https from 'node:https'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  loadEnvFile,
  validateR2Config,
  validateCosConfig,
  createS3Client,
  createCosS3Client,
  downloadJson,
  uploadJson,
} from '../../../scripts/shared/publishUtils.mjs'
import { PutObjectCommand } from '@aws-sdk/client-s3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const electronRoot = path.resolve(__dirname, '..')

loadEnvFile(path.join(electronRoot, '.env.prod'))

const r2Config = validateR2Config()
const s3 = createS3Client(r2Config)
const cosConfig = validateCosConfig()
const cos = cosConfig ? createCosS3Client(cosConfig) : null

// 从 package.json 读版本
const pkg = JSON.parse((await import('node:fs')).readFileSync(path.join(electronRoot, 'package.json'), 'utf-8'))
const version = pkg.version
const isBeta = version.includes('-beta')
const channel = isBeta ? 'beta' : 'stable'

console.log(`📦 Version: ${version}, Channel: ${channel}`)

// 读取已有的 version manifest
const manifestKey = `desktop/${version}/manifest.json`
let manifest
try {
  manifest = await downloadJson(s3, r2Config.bucket, manifestKey)
} catch {
  console.error(`❌ Cannot read ${manifestKey} from R2`)
  process.exit(1)
}

console.log(`📖 Manifest platforms: ${Object.keys(manifest.platforms).join(', ')}`)

// 平台 → yml 映射
const YML_MAP = {
  'mac-arm64': { yml: 'latest-mac.yml', ext: '.zip' },
  'mac-x64':   { yml: 'latest-mac.yml', ext: '.zip' },
  'win-x64':   { yml: 'latest.yml',     ext: '.exe' },
  'linux-x64': { yml: 'latest-linux.yml', ext: '.AppImage' },
}

/** 流式下载并计算 SHA-512（不存盘）。 */
function streamSha512(url) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http
    proto.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return streamSha512(res.headers.location).then(resolve, reject)
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        return
      }
      const hash = createHash('sha512')
      let received = 0
      const total = Number(res.headers['content-length']) || 0
      res.on('data', (chunk) => {
        hash.update(chunk)
        received += chunk.length
        if (total > 0) {
          const pct = Math.round(received / total * 100)
          process.stdout.write(`\r   ${(received / 1024 / 1024).toFixed(1)}/${(total / 1024 / 1024).toFixed(1)} MB (${pct}%)`)
        }
      })
      res.on('end', () => {
        process.stdout.write('\n')
        resolve(hash.digest('base64'))
      })
      res.on('error', reject)
    }).on('error', reject)
  })
}

async function uploadString(key, content) {
  const buf = Buffer.from(content, 'utf-8')
  await s3.send(new PutObjectCommand({
    Bucket: r2Config.bucket,
    Key: key,
    Body: buf,
    ContentType: 'text/yaml',
  }))
  console.log(`   [R2]  ${key}`)
  if (cos && cosConfig) {
    await cos.send(new PutObjectCommand({
      Bucket: cosConfig.bucket,
      Key: key,
      Body: buf,
      ContentType: 'text/yaml',
    }))
    console.log(`   [COS] ${key}`)
  }
}

// 按 yml 文件分组
const ymlGroups = new Map()
for (const [platform, info] of Object.entries(manifest.platforms)) {
  const mapping = YML_MAP[platform]
  if (!mapping) continue
  // 检查 url 是否匹配扩展名
  if (!info.url.endsWith(mapping.ext)) continue
  if (!ymlGroups.has(mapping.yml)) ymlGroups.set(mapping.yml, [])
  ymlGroups.get(mapping.yml).push({ platform, ...info })
}

for (const [ymlName, entries] of ymlGroups) {
  console.log(`\n📝 Generating ${ymlName}...`)
  const files = []
  let primaryUrl = null
  let primarySha512 = null

  for (const entry of entries) {
    console.log(`   Hashing ${entry.platform}: ${entry.url}`)
    const sha512 = await streamSha512(entry.url)
    const fileName = entry.url.split('/').pop()
    files.push({ url: `${version}/${fileName}`, sha512, size: entry.size })
    if (!primaryUrl) {
      primaryUrl = `${version}/${fileName}`
      primarySha512 = sha512
    }
  }

  let yml = `version: ${version}\n`
  yml += 'files:\n'
  for (const f of files) {
    yml += `  - url: ${f.url}\n`
    yml += `    sha512: ${f.sha512}\n`
    yml += `    size: ${f.size}\n`
  }
  yml += `path: ${primaryUrl}\n`
  yml += `sha512: ${primarySha512}\n`
  yml += `releaseDate: '${manifest.publishedAt}'\n`

  console.log(`\n${yml}`)

  // 上传
  await uploadString(`desktop/${version}/${ymlName}`, yml)
  await uploadString(`desktop/${channel}/${ymlName}`, yml)
  console.log(`   ✅ ${ymlName} uploaded`)
}

console.log('\n🎉 Done!')
