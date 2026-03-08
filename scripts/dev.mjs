#!/usr/bin/env node

/**
 * Dev process wrapper — ensures the entire process tree is killed on exit.
 *
 * Problem: `turbo → pnpm → next/node` spawns children in different process
 * groups.  When the terminal closes or you press Ctrl+C, only the top-level
 * process receives the signal; grandchildren (webpack-loaders, postcss
 * workers, node --watch) become orphans.
 *
 * Solution: spawn turbo with `detached: true` so it becomes its own process
 * group leader.  On ANY exit, kill the entire group via `kill(-pgid)`.
 */

import { spawn, execSync } from 'node:child_process'

// ── 1. Kill stale dev processes from previous runs ──────────────────
function killStaleDevProcesses() {
  try {
    const raw = execSync(
      'ps ax -o pid=,command= | grep -E "OpenLoaf.*(next dev|--watch src/index|turbo.*dev|webpack-loaders\\.js|postcss\\.js)" | grep -v grep',
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    )
    const pids = raw
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => parseInt(l.trim().split(/\s+/)[0], 10))
      .filter((p) => !isNaN(p) && p !== process.pid && p !== process.ppid)

    if (pids.length > 0) {
      console.log(`[dev] Killing ${pids.length} stale processes: ${pids.join(', ')}`)
      for (const pid of pids) {
        try { process.kill(pid, 'SIGTERM') } catch {}
      }
    }
  } catch {
    // No stale processes — normal
  }
}

killStaleDevProcesses()

// ── 2. Parse arguments ──────────────────────────────────────────────
// Usage: node scripts/dev.mjs [filter]
// e.g.  node scripts/dev.mjs          → turbo dev
//       node scripts/dev.mjs web      → turbo -F web dev
//       node scripts/dev.mjs server   → turbo -F server dev
const filter = process.argv[2]
const turboArgs = filter
  ? ['-F', filter, 'dev', '--ui=stream']
  : ['dev', '--ui=stream']

// ── 3. Spawn turbo in its own process group ─────────────────────────
const child = spawn('node_modules/.bin/turbo', turboArgs, {
  stdio: 'inherit',
  detached: true, // Key: child becomes process group leader
  env: {
    ...process.env,
    CI: '1',
    NODE_OPTIONS: '--conditions=development',
  },
})

// ── 4. Cleanup: kill entire process group on ANY exit ───────────────
let exiting = false

function cleanup(signal) {
  if (exiting) return
  exiting = true

  try {
    // Negative PID = kill the entire process group
    process.kill(-child.pid, signal || 'SIGTERM')
  } catch {}

  // Force-kill after 3s if graceful shutdown didn't work
  setTimeout(() => {
    try { process.kill(-child.pid, 'SIGKILL') } catch {}
    process.exit(signal === 'SIGINT' ? 0 : 1)
  }, 3000)
}

process.on('SIGTERM', () => cleanup('SIGTERM'))
process.on('SIGINT', () => cleanup('SIGINT'))
process.on('SIGHUP', () => cleanup('SIGHUP'))
process.on('exit', () => {
  // Last resort: fire-and-forget SIGKILL to the group
  try { process.kill(-child.pid, 'SIGKILL') } catch {}
})

child.on('exit', (code, signal) => {
  exiting = true
  // Also kill the group in case turbo exited but left children
  try { process.kill(-child.pid, 'SIGTERM') } catch {}
  process.exit(code ?? (signal === 'SIGINT' ? 0 : 1))
})
