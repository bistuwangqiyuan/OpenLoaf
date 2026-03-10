/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */

import type { PrismaClient } from '../prisma/generated/client'

// baseline 迁移名称：db:push 时代的老库需要跳过此迁移
const BASELINE_MIGRATION = '20260307000000_baseline'

export type EmbeddedMigration = {
  name: string
  sql: string
  checksum: string
}

/**
 * 在 server 启动时执行所有待应用的数据库迁移。
 *
 * 兼容三种场景：
 * 1. 新用户（seed.db 复制）：_prisma_migrations 已有全部记录 → 跳过
 * 2. 老用户（db:push 时代）：无 _prisma_migrations 表但有业务表 → baseline 标记已应用，执行后续迁移
 * 3. 空库：从 baseline 开始全部执行
 */
export async function runPendingMigrations(
  prisma: PrismaClient,
  migrations: readonly EmbeddedMigration[],
): Promise<{ applied: string[] }> {
  const applied: string[] = []

  const hasTable = await hasMigrationsTable(prisma)
  const hasBiz = await hasBusinessTables(prisma)

  if (!hasTable) {
    await createMigrationsTable(prisma)

    if (hasBiz) {
      // 老库：db:push 时代的遗产，业务表已存在但没有迁移记录。
      // 标记 baseline 为已应用（不执行 SQL），后续增量迁移正常执行。
      const baseline = migrations.find((m) => m.name === BASELINE_MIGRATION)
      if (baseline) {
        await recordMigration(prisma, baseline)
      }
    }
  }

  let appliedSet = await getAppliedMigrations(prisma)

  // 修复：v0.2.5-beta.12 及之前版本的 SQL 解析 bug 导致迁移被标记为已应用
  // 但实际 DDL 未执行（注释行过滤器错误地丢弃了整条语句）。
  // 检测并移除这些"幽灵"迁移记录，使其能被重新执行。
  await repairGhostMigrations(prisma, appliedSet, migrations)
  appliedSet = await getAppliedMigrations(prisma)

  // 按名称排序，确保迁移顺序正确
  const sorted = [...migrations].sort((a, b) => a.name.localeCompare(b.name))

  for (const migration of sorted) {
    if (appliedSet.has(migration.name)) continue

    // 将 migration.sql 按语句拆分执行
    // Prisma 生成的 SQL 用 `;` + 换行分隔
    // 注释行已在生成阶段（generate-migrations-index.mjs）剥离，
    // 此处做防御性处理以兼容旧版嵌入数据。
    const statements = migration.sql
      .split(/;\s*\n/)
      .map((s) => s.replace(/^(--[^\n]*\n)*/g, '').trim())
      .filter((s) => s.length > 0)

    for (const stmt of statements) {
      await prisma.$executeRawUnsafe(stmt)
    }

    await recordMigration(prisma, migration)
    applied.push(migration.name)
  }

  return { applied }
}

async function hasMigrationsTable(prisma: PrismaClient): Promise<boolean> {
  const result = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='_prisma_migrations'`,
  )
  return result.length > 0
}

async function hasBusinessTables(prisma: PrismaClient): Promise<boolean> {
  // 检查任意一个核心业务表是否存在
  const result = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='ChatSession'`,
  )
  return result.length > 0
}

async function createMigrationsTable(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id"                    TEXT PRIMARY KEY NOT NULL,
      "checksum"              TEXT NOT NULL,
      "finished_at"           DATETIME,
      "migration_name"        TEXT NOT NULL,
      "logs"                  TEXT,
      "rolled_back_at"        DATETIME,
      "started_at"            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "applied_steps_count"   INTEGER NOT NULL DEFAULT 0
    )
  `)
}

async function getAppliedMigrations(prisma: PrismaClient): Promise<Set<string>> {
  const rows = await prisma.$queryRawUnsafe<{ migration_name: string }[]>(
    `SELECT migration_name FROM "_prisma_migrations" WHERE rolled_back_at IS NULL`,
  )
  return new Set(rows.map((r) => r.migration_name))
}

function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  for (let i = 0; i < 36; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return id
}

/**
 * 修复"幽灵"迁移：迁移被记录为已应用，但 DDL 实际未执行。
 * 针对每个已应用的非 baseline 迁移，检查其预期创建的表是否存在，
 * 若不存在则删除迁移记录使其可以被重新执行。
 */
async function repairGhostMigrations(
  prisma: PrismaClient,
  appliedSet: Set<string>,
  migrations: readonly EmbeddedMigration[],
): Promise<void> {
  for (const migration of migrations) {
    if (migration.name === BASELINE_MIGRATION) continue
    if (!appliedSet.has(migration.name)) continue

    // 从 SQL 中提取 CREATE TABLE 语句的表名
    const tableNames = [...migration.sql.matchAll(/CREATE\s+TABLE\s+"(\w+)"/gi)].map((m) => m[1])
    if (tableNames.length === 0) continue

    // 检查第一个表是否存在
    const result = await prisma.$queryRawUnsafe<{ name: string }[]>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      tableNames[0],
    )

    if (result.length === 0) {
      // 表不存在——迁移是"幽灵"记录，删除以便重新执行
      await prisma.$executeRawUnsafe(
        `DELETE FROM "_prisma_migrations" WHERE migration_name = ?`,
        migration.name,
      )
    }
  }
}

async function recordMigration(
  prisma: PrismaClient,
  migration: EmbeddedMigration,
): Promise<void> {
  const id = generateId()
  const now = new Date().toISOString()
  await prisma.$executeRawUnsafe(
    `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
     VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)`,
    id,
    migration.checksum,
    now,
    migration.name,
    now,
  )
}
