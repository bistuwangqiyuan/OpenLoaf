#!/usr/bin/env node

/**
 * Desktop dev wrapper — kills stale desktop-session processes before launching Electron.
 *
 * Problem: Previous desktop dev sessions can leave orphaned server/web/electron
 * processes that hold ports (23333, 3001) or consume resources.
 *
 * Solution: Kill only desktop-session-specific stale processes (server on dev port,
 * Next.js dev, electron-forge), then spawn with proper process group cleanup.
 * Intentional processes like behavior tests are NOT touched.
 */

import { spawn, execSync } from 'node:child_process'

// Default dev ports used by desktop session (must match portAllocation.ts dev defaults)
const SERVER_PORT = process.env.PORT || 23334
const WEB_PORT = process.env.WEB_PORT || 53665

// ── 1. Kill stale desktop-session processes ──────────────────────────
function killStaleProcesses() {
  let killed = 0

  if (process.platform === 'win32') {
    // Windows: kill by port binding
    for (const port of [SERVER_PORT, WEB_PORT]) {
      try {
        const output = execSync(
          `netstat -ano | findstr "LISTENING" | findstr ":${port}"`,
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 3000 },
        ).trim()
        for (const line of output.split(/\r?\n/)) {
          const pid = line.trim().split(/\s+/).pop()
          if (pid && /^\d+$/.test(pid) && pid !== '0') {
            console.log(`[desktop] Killing stale process PID ${pid} on port ${port}`)
            try { execSync(`taskkill /pid ${pid} /t /f`, { stdio: 'ignore' }) } catch {}
            killed++
          }
        }
      } catch {}
    }
    return
  }

  // Unix (macOS / Linux): kill by port binding
  for (const port of [SERVER_PORT, WEB_PORT]) {
    try {
      const output = execSync(
        `lsof -ti tcp:${port} -sTCP:LISTEN`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 3000 },
      ).trim()
      for (const pidStr of output.split(/\s+/)) {
        const pid = parseInt(pidStr, 10)
        if (!isNaN(pid) && pid !== process.pid && pid !== process.ppid) {
          console.log(`[desktop] Killing stale process PID ${pid} on port ${port}`)
          try { process.kill(pid, 'SIGTERM') } catch {}
          killed++
        }
      }
    } catch {}
  }

  // Also kill stale electron-forge processes
  try {
    const raw = execSync(
      'ps ax -o pid=,command= | grep -E "electron-forge start|Electron\\.app.*OpenLoaf" | grep -v grep',
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    )
    for (const line of raw.trim().split('\n').filter(Boolean)) {
      const pid = parseInt(line.trim().split(/\s+/)[0], 10)
      if (!isNaN(pid) && pid !== process.pid && pid !== process.ppid) {
        console.log(`[desktop] Killing stale Electron process PID ${pid}`)
        try { process.kill(pid, 'SIGTERM') } catch {}
        killed++
      }
    }
  } catch {}

  if (killed > 0) {
    console.log(`[desktop] Cleaned up ${killed} stale process(es)`)
  }
}

killStaleProcesses()

// ── 2. Spawn the desktop command in its own process group ────────────
const child = spawn('pnpm', ['--filter', 'desktop', 'desktop'], {
  stdio: 'inherit',
  detached: true,
  env: {
    ...process.env,
    NODE_OPTIONS: '--conditions=development',
  },
})

// ── 3. Cleanup: kill entire process group on ANY exit ────────────────
let exiting = false

function cleanup(signal) {
  if (exiting) return
  exiting = true

  try {
    process.kill(-child.pid, signal || 'SIGTERM')
  } catch {}

  setTimeout(() => {
    try { process.kill(-child.pid, 'SIGKILL') } catch {}
    process.exit(signal === 'SIGINT' ? 0 : 1)
  }, 5000) // Electron needs a bit more time to gracefully shut down
}

process.on('SIGTERM', () => cleanup('SIGTERM'))
process.on('SIGINT', () => cleanup('SIGINT'))
process.on('SIGHUP', () => cleanup('SIGHUP'))
process.on('exit', () => {
  try { process.kill(-child.pid, 'SIGKILL') } catch {}
})

child.on('exit', (code, signal) => {
  exiting = true
  try { process.kill(-child.pid, 'SIGTERM') } catch {}
  process.exit(code ?? (signal === 'SIGINT' ? 0 : 1))
})
