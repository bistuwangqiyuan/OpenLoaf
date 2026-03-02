---
name: github-security-audit
description: >
  Use this skill when the user asks to check, audit, or fix GitHub security alerts,
  code scanning results, CodeQL findings, Dependabot vulnerabilities, secret scanning,
  or code quality issues. Also use when the user mentions "security tab", "security page",
  "code quality", "security alerts", "安全扫描", "代码质量", "安全告警", "漏洞扫描",
  "CodeQL", "Dependabot", or wants to review and remediate security findings.

  TRIGGERS ON: "security audit", "security alerts", "code scanning", "CodeQL",
  "Dependabot", "secret scanning", "code quality", "安全扫描", "代码质量",
  "安全告警", "漏洞", "security tab", "fix security issues", "security findings"
version: 0.1.0
---

# GitHub Security Audit

通过 `gh` CLI 查询 GitHub Security 页面的所有告警（Code Scanning、Dependabot、Secret Scanning），分析严重级别，定位问题代码并修复。

## When to Use

- 检查仓库安全告警状态
- 审计和修复 CodeQL 代码扫描发现的问题
- 查看和修复 Dependabot 依赖漏洞
- 检查 Secret Scanning 密钥泄露
- 定期安全巡检

**不适用：** 配置 GitHub Actions workflow 中的 CodeQL 扫描步骤 — 那属于 CI/CD 配置。

## 执行流程

### Step 1: 拉取所有安全告警

同时查询三类告警，获取完整视图：

```bash
# Code Scanning（CodeQL 等）— 所有 open 告警
gh api 'repos/{owner}/{repo}/code-scanning/alerts?state=open&per_page=100' \
  --jq '.[] | {number, rule: .rule.id, severity: .rule.security_severity_level, file: .most_recent_instance.location.path, line: .most_recent_instance.location.start_line}'

# Dependabot 依赖漏洞
gh api 'repos/{owner}/{repo}/dependabot/alerts?state=open' \
  --jq '.[] | {number, package: .security_vulnerability.package.name, severity: .security_vulnerability.severity, state: .state}'

# Secret Scanning 密钥泄露
gh api 'repos/{owner}/{repo}/secret-scanning/alerts?state=open' \
  --jq '.[] | {number, secret_type: .secret_type_display_name, state: .state}'
```

> **注意：** zsh 中 URL 含 `?` 需要用单引号包裹，否则会被当作通配符。

### Step 2: 按严重级别分类

将告警按严重级别排序，优先处理高危问题：

| 优先级 | 严重级别 | 处理要求 |
|--------|---------|---------|
| P0 | **critical** | 立即修复，可能被远程利用 |
| P1 | **high** | 尽快修复，存在安全风险 |
| P2 | **medium** | 计划修复，最佳实践改进 |
| P3 | **low** / note | 评估后决定，可能是误报 |

### Step 3: 逐一分析并修复

对每个告警：

1. **读取告警详情** — 通过 API 获取完整规则说明和修复建议
2. **读取问题代码** — 定位到具体文件和行号
3. **评估是否误报** — 结合上下文判断
4. **实施修复** — 按规则建议修改代码
5. **类型检查** — 运行 `pnpm run check-types` 确认没有破坏

```bash
# 查看单个告警的完整信息（含修复建议）
gh api 'repos/{owner}/{repo}/code-scanning/alerts/{number}'
```

### Step 4: 验证并提交

```bash
# 类型检查
pnpm run check-types

# 仅暂存修复涉及的文件（不要 git add -A）
git add <changed-files>

# 提交
git commit -m "fix(<scopes>): resolve CodeQL security and code quality alerts

- <逐条列出修复内容>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

# 推送后 GitHub 会自动重新扫描
git push
```

### Step 5: 处理误报

某些告警可能是误报（如：SHA-256 用于缓存 key 被标记为 `insufficient-password-hash`）。对于确认的误报：

- 建议用户在 GitHub Security 页面手动 dismiss，选择合适的 reason（如 "Used in tests"、"Won't fix"、"False positive"）
- 也可以通过 API dismiss：

```bash
gh api -X PATCH 'repos/{owner}/{repo}/code-scanning/alerts/{number}' \
  -f state=dismissed \
  -f dismissed_reason=false-positive \
  -f dismissed_comment="SHA-256 used for cache key hashing, not password storage"
```

## 常见 CodeQL 规则修复速查

### js/command-line-injection (Critical)

**问题：** 用户输入未经验证直接传入 shell 命令。

**修复：**
- 验证输入（文件存在性、扩展名白名单、路径格式）
- 使用 `execFileSync(cmd, args[])` 代替 `execSync(cmdString)`
- 避免通过 `cmd.exe /c` 传递不可信参数

```ts
// BAD
await execa("cmd", ["/c", "start", "", userInput]);

// GOOD
if (!existsSync(filePath)) throw new Error("File not found");
const ext = path.extname(filePath).toLowerCase();
if (!allowedExts.includes(ext)) throw new Error("Invalid extension");
await execa("cmd", ["/c", "start", "", filePath]);
```

### js/shell-command-injection-from-environment (Medium)

**问题：** 环境变量或配置值拼接成 shell 命令字符串。

**修复：**
- `execSync(cmdString)` → `execFileSync(binary, argsArray)`
- 手动 `cmd.exe /c` → Node.js `spawn(cmd, args, { shell: true })`

```js
// BAD
const cmd = `pnpm exec ${tool} ${args.join(' ')}`;
execSync(cmd);

// GOOD
execFileSync('pnpm', ['exec', tool, ...args]);
```

### js/polynomial-redos (High)

**问题：** 正则表达式在恶意输入上可能导致指数级回溯（ReDoS）。

**修复：**
- 在正则处理前限制输入长度
- 使用更精确的字符类（避免 `.*` 与回溯组合）
- 考虑使用非回溯引擎（如 `re2`）

```ts
// 限制输入长度防止 ReDoS
const MAX_LEN = 100_000;
if (input.length > MAX_LEN) {
  input = input.slice(0, MAX_LEN);
}
```

### js/insecure-randomness (High)

**问题：** `Math.random()` 用于生成标识符或 token。

**修复：**
- `Math.random()` → `crypto.randomUUID()` 或 `crypto.randomBytes()`

```ts
// BAD
const id = Math.random().toString(16).slice(2, 8);

// GOOD
const id = crypto.randomUUID().slice(0, 8);
```

### js/insufficient-password-hash (High)

**问题：** 使用 SHA-256/MD5 等非专用哈希算法存储密码。

**判断：** 如果是缓存 key / 数据校验而非密码存储，则为**误报**，应 dismiss。
如果确实用于密码，改用 `bcrypt` / `argon2` / `scrypt`。

### actions/missing-workflow-permissions (Medium)

**问题：** GitHub Actions workflow 没有显式声明 `permissions`，使用仓库默认权限。

**修复：** 在 workflow 顶层添加最小权限声明：

```yaml
permissions:
  contents: read

jobs:
  build:
    # 继承顶层 permissions
    ...
  release:
    # 需要写权限的 job 单独覆盖
    permissions:
      contents: write
    ...
```

## 组织级别批量审计

如果需要扫描组织下所有仓库：

```bash
# 组织级别代码扫描告警
gh api 'orgs/{org}/code-scanning/alerts?state=open&per_page=100' \
  --jq '.[] | {repo: .repository.full_name, rule: .rule.id, severity: .rule.security_severity_level}'

# 组织级别 Dependabot 告警
gh api 'orgs/{org}/dependabot/alerts?state=open&per_page=100' \
  --jq '.[] | {repo: .repository.full_name, package: .security_vulnerability.package.name, severity: .security_vulnerability.severity}'
```

## API 权限要求

| 数据 | 所需 Scope | 说明 |
|------|-----------|------|
| Code Scanning | `security_events` | 私有仓库必须 |
| Dependabot | `security_events` 或 fine-grained `Dependabot alerts: read` | |
| Secret Scanning | `security_events` | 私有仓库必须 |
| 公有仓库 | `public_repo` | 仅需此 scope |

## 关键文件

| 文件 | 说明 |
|------|------|
| `.github/workflows/codeql.yml` | CodeQL 扫描 workflow 配置 |
| `.github/workflows/publish-desktop.yml` | 常见 permissions 告警来源 |
| `packages/api/src/services/webMetaParser.ts` | ReDoS 易发区域（HTML 正则解析） |

## Common Mistakes

| 错误 | 后果 | 正确做法 |
|------|------|----------|
| 只查 `state=open` 前 30 条 | 遗漏告警 | 加 `per_page=100`，必要时分页 |
| zsh 中 URL 不加引号 | `?` 被当通配符报错 | 用单引号包裹 API 路径 |
| `git add -A` 提交所有改动 | 混入无关变更 | 只 `git add` 修复涉及的文件 |
| 把缓存哈希当密码哈希修 | 过度修复引入性能问题 | 先判断是否误报 |
| 直接 dismiss 不分析 | 遗漏真实漏洞 | 先读代码确认是否误报 |
