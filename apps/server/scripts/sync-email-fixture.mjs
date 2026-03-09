/**
 * 邮件测试 Fixture 同步脚本
 *
 * 将当前用户的邮箱配置同步到 E2E 测试环境：
 * 1. 读取 ~/.openloaf/workspaces.json 找到活跃 workspace
 * 2. 读取该 workspace 的 email.json
 * 3. 将 auth.envKey 中的 workspaceId 替换为 E2E 测试 ID
 * 4. 写入 tests/email/workspace/email.json
 * 5. 复制数据库中的 EmailMailbox / EmailMessage 到 E2E workspace
 * 6. 在 .env 中添加对应的凭据映射
 *
 * 用法：node scripts/sync-email-fixture.mjs [--dry-run]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'
import { randomUUID } from 'node:crypto'

const E2E_WORKSPACE_ID = '00000000-e2e0-4000-8000-000000000001'
const dryRun = process.argv.includes('--dry-run')
const serverRoot = join(import.meta.dirname, '..')

// ── 路径定义 ─────────────────────────────────────────────────
const openloafRoot = join(process.env.HOME ?? '~', '.openloaf')
const workspacesPath = join(openloafRoot, 'workspaces.json')
const dbPath = join(openloafRoot, 'openloaf.db')
const envPath = join(serverRoot, '.env')
const fixtureEmailPath = join(
  serverRoot,
  'src/ai/__tests__/agent-behavior/tests/email/workspace/email.json',
)

// ── 1. 找到活跃 workspace ────────────────────────────────────
if (!existsSync(workspacesPath)) {
  console.error('❌ 找不到 workspaces.json:', workspacesPath)
  process.exit(1)
}

const workspacesData = JSON.parse(readFileSync(workspacesPath, 'utf-8'))
const activeWs = workspacesData.workspaces?.find((ws) => ws.isActive)
if (!activeWs) {
  console.error('❌ 没有找到活跃的 workspace')
  process.exit(1)
}

const realWsId = activeWs.id
const wsRootPath = fileURLToPath(activeWs.rootUri)
const emailJsonPath = join(wsRootPath, 'email.json')

console.log(`📧 同步邮件配置到 E2E 测试环境`)
console.log(`   源 Workspace: ${activeWs.name} (${realWsId})`)
console.log(`   源 Root: ${wsRootPath}`)
console.log(`   目标 E2E ID: ${E2E_WORKSPACE_ID}`)
if (dryRun) console.log('   🔍 Dry-run 模式，不会实际写入\n')
else console.log()

// ── 2. 读取 email.json ──────────────────────────────────────
if (!existsSync(emailJsonPath)) {
  console.error('❌ 找不到 email.json:', emailJsonPath)
  process.exit(1)
}

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

// ── 3. 重写 envKey 并生成 fixture ─────────────────────────────
const envKeyMapping = [] // { oldKey, newKey }

const fixtureConfig = structuredClone(emailConfig)
for (const acc of fixtureConfig.emailAccounts) {
  if (acc.auth?.envKey) {
    const oldKey = acc.auth.envKey
    const newKey = oldKey.replace(realWsId, E2E_WORKSPACE_ID)
    acc.auth.envKey = newKey
    envKeyMapping.push({ oldKey, newKey })
  }
  // 清除 sync 状态和 status — 测试环境不需要
  delete acc.sync
  delete acc.status
}

console.log(`\n📝 写入 fixture: ${fixtureEmailPath}`)
if (!dryRun) {
  writeFileSync(fixtureEmailPath, JSON.stringify(fixtureConfig, null, 2) + '\n')
}
console.log('   ✅ email.json fixture 已生成')

// ── 4. 同步 .env 凭据 ───────────────────────────────────────
if (envKeyMapping.length > 0 && existsSync(envPath)) {
  let envContent = readFileSync(envPath, 'utf-8')
  let envChanged = false

  for (const { oldKey, newKey } of envKeyMapping) {
    // 从 .env 中提取原始密码
    const regex = new RegExp(`^${escapeRegex(oldKey)}=(.+)$`, 'm')
    const match = envContent.match(regex)
    if (!match) {
      console.log(`   ⚠️  .env 中未找到 ${oldKey}，跳过`)
      continue
    }

    const password = match[1]
    // 检查是否已有 E2E 条目
    if (envContent.includes(newKey)) {
      // 更新已有条目
      envContent = envContent.replace(
        new RegExp(`^${escapeRegex(newKey)}=.*$`, 'm'),
        `${newKey}=${password}`,
      )
      console.log(`   🔄 更新 .env: ${newKey}`)
    } else {
      // 在原始条目后插入 E2E 条目
      envContent = envContent.replace(
        regex,
        `${match[0]}\n${newKey}=${password}`,
      )
      console.log(`   ➕ 添加 .env: ${newKey}`)
    }
    envChanged = true
  }

  if (envChanged && !dryRun) {
    writeFileSync(envPath, envContent)
    console.log('   ✅ .env 凭据已同步')
  }
}

// ── 5. 同步数据库记录 ────────────────────────────────────────
console.log(`\n🗄️  同步数据库记录...`)

if (!existsSync(dbPath)) {
  console.error('   ⚠️  数据库不存在:', dbPath)
  console.log('   跳过数据库同步')
} else {
  const client = createClient({ url: `file:${dbPath}` })

  try {
    // 获取源邮件数量
    const mailboxCount = await client.execute({
      sql: 'SELECT COUNT(*) as cnt FROM EmailMailbox WHERE workspaceId = ?',
      args: [realWsId],
    })
    const messageCount = await client.execute({
      sql: 'SELECT COUNT(*) as cnt FROM EmailMessage WHERE workspaceId = ?',
      args: [realWsId],
    })

    const mbCnt = mailboxCount.rows[0]?.cnt ?? 0
    const msgCnt = messageCount.rows[0]?.cnt ?? 0
    console.log(`   源数据: ${mbCnt} 个邮件夹, ${msgCnt} 封邮件`)

    if (!dryRun) {
      // 删除 E2E workspace 的旧数据
      await client.execute({
        sql: 'DELETE FROM EmailMailbox WHERE workspaceId = ?',
        args: [E2E_WORKSPACE_ID],
      })
      await client.execute({
        sql: 'DELETE FROM EmailMessage WHERE workspaceId = ?',
        args: [E2E_WORKSPACE_ID],
      })
      await client.execute({
        sql: 'DELETE FROM EmailDraft WHERE workspaceId = ?',
        args: [E2E_WORKSPACE_ID],
      })

      // 复制 EmailMailbox
      const mailboxes = await client.execute({
        sql: 'SELECT * FROM EmailMailbox WHERE workspaceId = ?',
        args: [realWsId],
      })
      for (const row of mailboxes.rows) {
        await client.execute({
          sql: `INSERT INTO EmailMailbox (id, workspaceId, accountEmail, path, name, parentPath, delimiter, attributes, sort, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            randomUUID(),
            E2E_WORKSPACE_ID,
            row.accountEmail,
            row.path,
            row.name,
            row.parentPath,
            row.delimiter,
            row.attributes,
            row.sort,
            row.createdAt,
            row.updatedAt,
          ],
        })
      }
      console.log(`   ✅ 复制了 ${mailboxes.rows.length} 个邮件夹`)

      // 复制 EmailMessage（限制最近 50 封，避免过多数据）
      const messages = await client.execute({
        sql: 'SELECT * FROM EmailMessage WHERE workspaceId = ? ORDER BY date DESC LIMIT 50',
        args: [realWsId],
      })
      for (const row of messages.rows) {
        await client.execute({
          sql: `INSERT INTO EmailMessage (id, workspaceId, accountEmail, mailboxPath, externalId, messageId, subject, "from", "to", cc, bcc, date, flags, snippet, attachments, size, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            randomUUID(),
            E2E_WORKSPACE_ID,
            row.accountEmail,
            row.mailboxPath,
            row.externalId,
            row.messageId,
            row.subject,
            row.from,
            row.to,
            row.cc,
            row.bcc,
            row.date,
            row.flags,
            row.snippet,
            row.attachments,
            row.size,
            row.createdAt,
            row.updatedAt,
          ],
        })
      }
      console.log(`   ✅ 复制了 ${messages.rows.length} 封邮件`)
    } else {
      console.log('   🔍 Dry-run: 跳过数据库写入')
    }
  } finally {
    client.close()
  }
}

console.log('\n✅ 邮件 Fixture 同步完成！')
if (dryRun) console.log('   （Dry-run 模式，未实际写入）')

// ── 工具函数 ─────────────────────────────────────────────────
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
