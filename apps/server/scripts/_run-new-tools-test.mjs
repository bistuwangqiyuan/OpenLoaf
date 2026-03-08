/**
 * 临时脚本：只运行新增工具的 18 个行为测试
 */
import { execSync } from 'node:child_process'
import { readFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const outFile = join(import.meta.dirname, '..', '.behavior-test-new-tools.json')

const cmd = [
  'node --no-warnings --env-file=.env',
  '--enable-source-maps --import tsx/esm',
  '--import ./scripts/registerMdTextLoader.mjs',
  '../../node_modules/promptfoo/dist/src/entrypoint.js eval',
  '-c src/ai/__tests__/agent-behavior/_new-tools-only.yaml',
  '--no-cache --max-concurrency 1 --no-progress-bar',
  `-o ${outFile}`,
].join(' ')

console.log('🔬 运行新工具行为测试（18 个用例）...\n')

let exitCode = 0
try {
  execSync(cmd, {
    cwd: join(import.meta.dirname, '..'),
    stdio: ['inherit', 'ignore', 'ignore'],
    timeout: 10 * 60 * 1000,
  })
} catch (err) {
  exitCode = err.status ?? 1
}

try {
  const data = JSON.parse(readFileSync(outFile, 'utf-8'))
  const results = data?.results?.results ?? []

  let passed = 0
  let failed = 0

  for (const r of results) {
    const desc = r.testCase?.description ?? '?'
    const ok = r.success
    const asserts = r.gradingResult?.componentResults ?? []
    const output = (r.response?.output ?? '').slice(0, 80)

    if (ok) {
      passed++
      console.log(`  ✅ ${desc}`)
    } else {
      failed++
      console.log(`  ❌ ${desc}`)
      for (const a of asserts) {
        if (a.pass === false) {
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

  const total = passed + failed
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0
  console.log(`\n📊 结果: ${passed}/${total} 通过 (${pct}%)`)
  if (failed > 0) console.log(`   ${failed} 个用例失败`)

  console.log(`\n📁 输出文件: ${outFile}`)
  process.exit(failed > 0 ? 1 : 0)
} catch {
  console.log('\n⚠️  无法解析测试结果，请检查配置。')
  process.exit(1)
}
