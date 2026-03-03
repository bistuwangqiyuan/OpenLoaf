/**
 * 测试 claude CLI stdin 模式是否正常工作
 * 用法：CLAUDECODE= node apps/server/scripts/test-claude-stdin.mjs
 */
import { execa } from "execa";

const prompt = "请用一句话回答：1+1等于几？";
const model = "claude-sonnet-4-6";

console.log(`[test] 测试 claude stdin 模式`);
console.log(`[test] model: ${model}`);
console.log(`[test] prompt: ${prompt}`);
console.log(`[test] 启动子进程...`);

const env = { ...process.env };
delete env.ANTHROPIC_API_KEY;
delete env.ANTHROPIC_API_KEY_OLD;

const proc = execa(
  "claude",
  ["-p", "--output-format", "json", "--dangerously-skip-permissions", "--model", model],
  {
    input: prompt,
    env,
    all: true,
    reject: false,
    timeout: 60_000,
  },
);

const result = await proc;

console.log(`[test] exitCode: ${result.exitCode}`);
console.log(`[test] stdout:\n${result.stdout}`);
if (result.stderr) console.log(`[test] stderr:\n${result.stderr}`);

if (result.stdout) {
  try {
    const parsed = JSON.parse(result.stdout.trim());
    console.log(`\n[test] ✅ 解析成功`);
    console.log(`[test] type: ${parsed.type}`);
    console.log(`[test] result: ${parsed.result}`);
    console.log(`[test] session_id: ${parsed.session_id}`);
  } catch (e) {
    console.log(`[test] ❌ JSON 解析失败: ${e.message}`);
  }
} else {
  console.log(`[test] ❌ 无输出`);
}
