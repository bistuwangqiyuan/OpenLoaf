/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 *
 * Seed script: creates a showcase chat session with all tool types.
 *
 * Usage:
 *   pnpm --filter server run seed:showcase
 *   npx tsx apps/server/scripts/seed-tool-showcase.ts
 */

import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '@openloaf/db'
import { resolveOpenLoafPath } from '@openloaf/config'

// We import the shared fixture from the web app's test fixtures.
// Since this runs via tsx, TypeScript path resolution handles the monorepo.
import { fileURLToPath } from 'node:url'

const fixtureModule = await import(
  fileURLToPath(new URL('../../web/src/components/ai/message/__tests__/fixtures/toolShowcaseFixture.ts', import.meta.url))
)
const { TOOL_SHOWCASE_GROUPS, buildShowcaseMessages } = fixtureModule

const SESSION_ID = 'showcase-tool-ui-components'
const SESSION_TITLE = '🧪 工具 UI 组件展示'

async function main() {
  try {
    // 1. Read workspaceId from the first existing chat session (if any)
    let workspaceId: string | null = null
    const existingSession = await prisma.chatSession.findFirst({
      where: { workspaceId: { not: null } },
      select: { workspaceId: true },
    })
    if (existingSession?.workspaceId) {
      workspaceId = existingSession.workspaceId
    }

    // 2. Upsert the chat session
    const messageCount = TOOL_SHOWCASE_GROUPS.length * 2 // user + assistant per group
    const now = new Date()

    await prisma.chatSession.upsert({
      where: { id: SESSION_ID },
      create: {
        id: SESSION_ID,
        title: SESSION_TITLE,
        isUserRename: true,
        isPin: true,
        workspaceId,
        messageCount,
        createdAt: now,
        updatedAt: now,
      },
      update: {
        title: SESSION_TITLE,
        isPin: true,
        messageCount,
        updatedAt: now,
        deletedAt: null,
      },
    })

    console.log(`✓ ChatSession upserted: ${SESSION_ID}`)

    // 3. Write messages.jsonl
    const chatHistoryDir = resolveOpenLoafPath('chat-history', SESSION_ID)
    fs.mkdirSync(chatHistoryDir, { recursive: true })

    const messages = buildShowcaseMessages()
    const jsonl = messages.map((m) => JSON.stringify(m)).join('\n') + '\n'

    const messagesPath = path.join(chatHistoryDir, 'messages.jsonl')
    fs.writeFileSync(messagesPath, jsonl, 'utf-8')

    console.log(`✓ Wrote ${messages.length} messages to ${messagesPath}`)
    console.log(`✓ Tool groups: ${TOOL_SHOWCASE_GROUPS.length}`)
    console.log(`✓ Total tool parts: ${TOOL_SHOWCASE_GROUPS.reduce((s, g) => s + g.parts.length, 0)}`)
    console.log('\n🎉 Showcase session ready! Refresh the app to see "🧪 工具 UI 组件展示" in the chat list.')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
