/**
 * AI Agent 行为测试运行器
 * 包装 Promptfoo，抑制噪音日志，只输出测试结果摘要。
 *
 * 用法:
 *   node scripts/run-behavior-test.mjs [--filter-pattern "ts-001"] [--repeat 3]
 *   node scripts/run-behavior-test.mjs --no-cache          # 禁用缓存（默认启用）
 *   node scripts/run-behavior-test.mjs --model "pid:mid"   # 指定模型（对比用）
 */
import { execSync } from 'node:child_process'
import { readFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

// ── CLI 参数解析 ─────────────────────────────────────────────
const rawArgs = process.argv.slice(2)

const keepOutput = rawArgs.includes('--keep-output')
const noCache = rawArgs.includes('--no-cache')

// --model <id> 指定测试模型（格式：profileId:modelId）
let modelOverride = undefined
const modelIdx = rawArgs.indexOf('--model')
if (modelIdx !== -1 && rawArgs[modelIdx + 1]) {
  modelOverride = rawArgs[modelIdx + 1]
}

const filteredArgs = rawArgs
  .filter(a => a !== '--keep-output' && a !== '--no-cache' && a !== '--')
  .filter((a, i, arr) => {
    if (a === '--model') return false
    if (i > 0 && arr[i - 1] === '--model') return false
    return true
  })
  .join(' ')

const outFile = join(import.meta.dirname, '..', '.behavior-test-output.json')

// ── 模型覆盖 ─────────────────────────────────────────────────
if (modelOverride) {
  process.env.OPENLOAF_TEST_CHAT_MODEL_ID = modelOverride
  console.log(`🔧 模型覆盖: ${modelOverride}`)
}

// ── 构建命令 ─────────────────────────────────────────────────
const cacheFlag = noCache ? '--no-cache' : ''

const cmd = [
  'node --no-warnings --env-file=.env',
  '--enable-source-maps --import tsx/esm',
  '--import ./scripts/registerMdTextLoader.mjs',
  '../../node_modules/promptfoo/dist/src/entrypoint.js eval',
  '-c src/ai/__tests__/agent-behavior/promptfooconfig.yaml',
  `${cacheFlag} --max-concurrency 1 --no-progress-bar`,
  `-o ${outFile}`,
  filteredArgs,
].filter(Boolean).join(' ')

console.log(`🔬 运行 AI Agent 行为测试...${noCache ? '（无缓存）' : '（缓存启用）'}\n`)

let exitCode = 0
try {
  execSync(cmd, {
    cwd: join(import.meta.dirname, '..'),
    stdio: ['inherit', 'ignore', 'ignore'],
    timeout: 10 * 60 * 1000,
    env: { ...process.env },
  })
} catch (err) {
  exitCode = err.status ?? 1
}

// ── 解析并输出结果 ────────────────────────────────────────────
try {
  const data = JSON.parse(readFileSync(outFile, 'utf-8'))
  const results = data?.results?.results ?? []

  let passed = 0
  let failed = 0
  const latencies = []

  for (const r of results) {
    const desc = r.testCase?.description ?? '?'
    const ok = r.success
    const asserts = r.gradingResult?.componentResults ?? []
    const output = (r.response?.output ?? '').slice(0, 80)
    const latency = r.latencyMs ?? r.response?.latencyMs

    if (latency) latencies.push(latency)

    if (ok) {
      passed++
      const latStr = latency ? ` (${(latency / 1000).toFixed(1)}s)` : ''
      console.log(`  ✅ ${desc}${latStr}`)
    } else {
      failed++
      const latStr = latency ? ` (${(latency / 1000).toFixed(1)}s)` : ''
      console.log(`  ❌ ${desc}${latStr}`)
      for (const a of asserts) {
        if (!a.pass) {
          const type = a.assertion?.type ?? '?'
          const reason = (a.reason ?? '').slice(0, 120)
          console.log(`     └─ [${type}] ${reason}`)
        }
      }
    }
    if (output) {
      console.log(`     💬 ${output}...`)
    }
  }

  // ── 汇总 ──────────────────────────────────────────────────
  const total = passed + failed
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0
  console.log(`\n📊 结果: ${passed}/${total} 通过 (${pct}%)`)
  if (failed > 0) console.log(`   ${failed} 个用例失败`)

  // 延迟统计
  if (latencies.length > 0) {
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length
    const max = Math.max(...latencies)
    const min = Math.min(...latencies)
    console.log(`\n⏱  延迟: 平均 ${(avg / 1000).toFixed(1)}s | 最快 ${(min / 1000).toFixed(1)}s | 最慢 ${(max / 1000).toFixed(1)}s`)
    if (max > 30000) {
      console.log(`   ⚠️  有用例超过 30s 延迟门槛`)
    }
  }

  // 模型信息
  if (modelOverride) {
    console.log(`\n🤖 测试模型: ${modelOverride}`)
  }

  // 清理临时文件
  if (keepOutput) {
    console.log(`\n📁 输出文件: ${outFile}`)
  } else {
    try { unlinkSync(outFile) } catch {}
  }

  process.exit(failed > 0 ? 1 : 0)
} catch {
  console.log('\n⚠️  无法解析测试结果，请检查配置。')
  process.exit(1)
}
