/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
// packages/db/src/index.ts

import { Prisma, PrismaClient } from "../prisma/generated/client";
export { Prisma };
export type { PrismaClient };
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { resolveOpenLoafDatabaseUrl } from "@openloaf/config";

const adapter = new PrismaLibSql({
  url: resolveOpenLoafDatabaseUrl(),
});

export const prisma = new PrismaClient({ adapter });

/**
 * 初始化 SQLite PRAGMA 配置。必须在首个业务查询前调用。
 *
 * - journal_mode=WAL：允许读写并发，避免 SQLITE_BUSY
 * - busy_timeout=5000：锁冲突时自动重试等待 5 秒，而非立即报错
 */
export async function initDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe("PRAGMA journal_mode = WAL");
  await prisma.$executeRawUnsafe("PRAGMA busy_timeout = 5000");
}

// 你要保留 default export 也可以
export default prisma;
