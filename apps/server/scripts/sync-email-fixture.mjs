/**
 * 邮件测试 Fixture 同步脚本
 *
 * 将当前用户的全局邮箱配置同步到 E2E 测试环境：
 * 1. 读取 ~/.openloaf/email.json
 * 2. 写入 tests/email/email.json
 * 3. 校验 apps/server/.env 中是否存在对应凭据
 *
 * 用法：node scripts/sync-email-fixture.mjs [--dry-run]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dryRun = process.argv.includes('--dry-run')
const serverRoot = join(import.meta.dirname, '..')

// ── 路径定义 ─────────────────────────────────────────────────
const openloafRoot = join(process.env.HOME ?? '~', '.openloaf')
const emailJsonPath = join(openloafRoot, 'email.json')
const envPath = join(serverRoot, '.env')
const fixtureEmailPath = join(
  serverRoot,
  'src/ai/__tests__/agent-behavior/tests/email/email.json',
)

// ── 1. 读取全局 email.json ───────────────────────────────────
if (!existsSync(emailJsonPath)) {
  console.error('❌ 找不到 email.json:', emailJsonPath)
  process.exit(1)
}

console.log(`📧 同步邮件配置到 E2E 测试环境`)
console.log(`   源 Email 配置: ${emailJsonPath}`)
console.log(`   目标 Fixture: ${fixtureEmailPath}`)
if (dryRun) console.log('   🔍 Dry-run 模式，不会实际写入\n')
else console.log()

const emailConfig = JSON.parse(readFileSync(emailJsonPath, 'utf-8'))
const accounts = emailConfig.emailAccounts ?? []

if (accounts.length === 0) {
  console.error('❌ 没有找到邮箱账号')
  process.exit(1)
}

console.log(`   找到 ${accounts.length} 个邮箱账号:`)
for (const acc of accounts) {
  console.log(`     - ${acc.emailAddress} (${acc.label ?? 'no label'})`)
}

// ── 2. 生成 fixture ───────────────────────────────────────────
const fixtureConfig = structuredClone(emailConfig)
for (const acc of fixtureConfig.emailAccounts) {
  // 清除 sync 状态和 status — 测试环境不需要
  delete acc.sync
  delete acc.status
}

console.log(`\n📝 写入 fixture: ${fixtureEmailPath}`)
if (!dryRun) {
  writeFileSync(fixtureEmailPath, JSON.stringify(fixtureConfig, null, 2) + '\n')
}
console.log('   ✅ email.json fixture 已生成')

// ── 3. 校验 .env 凭据 ────────────────────────────────────────
const requiredEnvKeys = collectRequiredEnvKeys(fixtureConfig)
if (!existsSync(envPath)) {
  console.log(`\n⚠️  未找到 apps/server/.env：${envPath}`)
  console.log('   请手动确认 fixture 中引用的邮箱凭据已在测试环境可用。')
} else {
  const envContent = readFileSync(envPath, 'utf-8')
  const missingKeys = requiredEnvKeys.filter((envKey) => {
    const regex = new RegExp(`^${escapeRegex(envKey)}=`, 'm')
    return !regex.test(envContent)
  })

  console.log(`\n🔐 校验凭据 (${requiredEnvKeys.length} 项)`)
  if (missingKeys.length === 0) {
    console.log('   ✅ 所有引用的凭据都已存在于 apps/server/.env')
  } else {
    for (const envKey of missingKeys) {
      console.log(`   ⚠️  缺少凭据: ${envKey}`)
    }
  }
}

console.log('\n🗄️  数据库邮件 fixture 已不再按 workspace 复制。')
console.log('   当前架构下邮件数据为全局账号维度；如需测试消息数据，请单独准备专用测试数据库。')
console.log('\n✅ 邮件 Fixture 同步完成！')
if (dryRun) console.log('   （Dry-run 模式，未实际写入）')

// ── 工具函数 ─────────────────────────────────────────────────
function collectRequiredEnvKeys(config) {
  const keys = []
  for (const account of config.emailAccounts ?? []) {
    const auth = account?.auth
    if (!auth) continue
    if (auth.type === 'password' && auth.envKey) {
      keys.push(auth.envKey)
      continue
    }
    if (auth.refreshTokenEnvKey) keys.push(auth.refreshTokenEnvKey)
    if (auth.accessTokenEnvKey) keys.push(auth.accessTokenEnvKey)
    if (auth.expiresAtEnvKey) keys.push(auth.expiresAtEnvKey)
  }
  return Array.from(new Set(keys.filter(Boolean)))
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
