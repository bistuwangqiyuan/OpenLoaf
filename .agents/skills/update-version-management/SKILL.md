---
name: update-version-management
description: >
  Use when the user wants to release a new version, bump versions, publish
  updates, or create changelogs for server/web/electron apps.
  Also use when publishing npm packages (widget-sdk, @openloaf-saas/sdk),
  modifying update-related code: publish scripts, manifest structure,
  incremental update logic, crash rollback, or update UI components.
---

# Update & Version Management

> **维护要求：** 当发布流程、CI/CD 配置、产物命名、R2 目录结构或版本管理策略发生变更时，必须同步更新本 skill（SKILL.md、publish-release.md、update-system.md）。

## Overview

OpenLoaf 采用 **"先 bump、后发布"** 流程：本地 bump 版本号 → 提交 → 打 tag → CI 自动构建发布。各 app 版本号独立管理。

**版本号规则：**
- **Server/Web**：增量更新 `x.y.z-beta.n`，稳定版 `x.y.z`
- **Desktop**：beta `x.y.z-beta.n`，stable `x.y.z`（stable 发布后 CI 自动 bump desktop patch）

## When to Use

- 发布新版本、升级版本号、写 changelog
- 通过 git tag 触发 CI 发布
- 发布 widget-sdk / @openloaf-saas/sdk 到 npm
- 修改 CI 发布 workflow、更新系统逻辑、manifest 结构、渠道管理、崩溃回滚

**不适用：** 普通功能开发、bug 修复（除非涉及上述更新系统代码）

---

## 变更影响范围映射（关键）

packages/ 下各子包的消费者不同，**禁止将所有 packages/ 变更笼统归到每个 app**。

### 目录 → App 影响表

| 目录 | Server | Web | Desktop | 说明 |
|------|--------|-----|---------|------|
| `apps/server/` | ✅ | - | - | Server 独有 |
| `apps/web/` | - | ✅ | - | Web 独有 |
| `apps/desktop/` | - | - | ✅ | Desktop 独有 |
| `packages/db/` | ✅ | - | - | Prisma schema、数据库客户端，仅 Server 直接使用 |
| `packages/ui/` | - | ✅ | - | UI 组件库，仅 Web 引用（252 个文件） |
| `packages/widget-sdk/` | - | ✅ | - | Widget SDK，仅 Web 引用 |
| `packages/config/` | ✅ | - | ✅ | 路径/环境配置工具。Web 仅引用 tsconfig.base.json（devDeps），运行时代码不影响 Web |
| `packages/api/` | ⚠️ | ⚠️ | - | **共享包，需看具体文件**（见下方规则） |
| `.agents/`、`docs/` | - | - | - | 文档/skill，不影响任何 app |

### packages/api/ 细分规则

`packages/api/` 被 Web（215 个文件）和 Server（45+ 个文件）同时引用，需按子目录判断：

| 子目录/文件 | 主要消费者 | 判断方法 |
|------------|-----------|----------|
| `src/services/` | **Server** | 业务逻辑服务层（VFS、项目、工作空间、git） |
| `src/routers/` | **Server** | tRPC 路由定义和辅助函数 |
| `src/common/tabs.ts` | **Web** | Tab 常量定义（Sidebar/Header 消费） |
| `src/common/model*.ts` | **Server** | AI 模型定义（Server AI 路由消费） |
| `src/types/` | **两者** | 类型定义，两边都用 |
| 其他 `src/common/` | **需检查** | grep 具体 import 路径确认消费者 |

**实操原则：** 当 `packages/api/` 有变更时，检查变更的具体文件，根据上表判断影响哪个 app。如果不确定，检查该文件的 import 链。

### 精确的变更检测命令

```bash
# 获取基准点
BASELINE=$(git tag --list "server-v*" "web-v*" "desktop@*" --sort=-creatordate | head -1)

# ===== Server 变更 =====
# Server 独有路径
git log $BASELINE..HEAD --oneline --no-merges -- apps/server/ packages/db/ packages/config/src/
git diff --stat HEAD -- apps/server/ packages/db/ packages/config/src/

# ===== Web 变更 =====
# Web 独有路径
git log $BASELINE..HEAD --oneline --no-merges -- apps/web/ packages/ui/ packages/widget-sdk/
git diff --stat HEAD -- apps/web/ packages/ui/ packages/widget-sdk/

# ===== 共享路径（需人工判断归属）=====
git log $BASELINE..HEAD --oneline --no-merges -- packages/api/
git diff --stat HEAD -- packages/api/

# ===== Desktop 变更 =====
git log $BASELINE..HEAD --oneline --no-merges -- apps/desktop/ packages/config/src/
git diff --stat HEAD -- apps/desktop/ packages/config/src/
```

对于 `packages/api/` 的变更，读取具体 diff 内容后再判断归属。

---

## 发布决策流程

### Step 1: 分析变更范围（必须第一步，禁止跳过）

无论用户输入什么参数，**第一步永远是用上述精确路径命令分析变更范围**，确定每个 app 是否有实质性变更。

### Step 2: 选择发布类型

```
有 apps/desktop/ 变更？ ──── 是 → 必须发布 Desktop
        │
        否
        │
有 server/web 实质性变更？ ── 是 → 询问用户：Desktop beta 还是 Server/Web 增量更新？
        │
        否 → 无需发布
```

**Desktop 优先原则：** Desktop 打包包含最新 server + web 代码，是用户获取更新的主要渠道。当有实质性变更时，默认建议发布 Desktop beta。仅在以下情况选择 Server/Web 增量更新：
- 极小的热修复（文案修正、配置调整），不值得触发 Desktop 全量构建
- 用户明确要求只发布 Server/Web

**关键：** 只 bump 和发布有实际变更的 app。如果只有 Web 变更没有 Server 变更，就只发布 Web，不发布 Server（反之亦然）。

### 用户参数解析

| 用户输入 | 含义 |
|---------|------|
| 无参数 / `beta` | 先分析变更范围，自动判断发布哪些 app |
| `release` / `stable` / `正式版` | Desktop 正式版发布 |
| `server` / `web` / `desktop` | 指定 app（仍需分析确认） |
| `全部commit` | 先提交所有未暂存变更，再分析 |

---

## Server/Web 增量发布流程

### Step 1: 基准点与变更分析

基准点取所有 app tag 中时间最新的那个（通常是最近的 `desktop@*` tag），因为 Desktop 打包时已包含最新 server + web。

用精确路径命令（见「变更检测命令」）分析变更。packages/api/ 的变更需读 diff 判断归属。

### Step 2: Changelog

- 同时检查已提交 commit 和未提交变更
- 按 emoji 类别分组：💥 Breaking → ✨ 新功能 → 🚀 改进 → 💄 界面优化 → ⚡ 性能 → 🌐 国际化 → 🐛 修复 → 🔒 安全 → 🔧 重构 → 📦 依赖 → 🗑️ 废弃
- 生成**英文版**（用于 annotated tag）
- **展示给用户确认后再继续**

### Step 3: Lockfile（如需要）

如 `package.json` 有修改但 lockfile 未同步：`pnpm install --no-frozen-lockfile`

### Step 4: 类型检查（必须在 commit 之前）

```bash
pnpm check-types
```

失败则先修复再继续。

### Step 5: Bump 版本号并提交

**只 bump 有变更的 app。** 例如只有 Web 变更就只 bump Web，不碰 Server。

```bash
# 仅在有变更时 bump 对应 app
npm version {newVersion} --no-git-tag-version --prefix apps/server  # 仅 server 有变更时
npm version {newVersion} --no-git-tag-version --prefix apps/web     # 仅 web 有变更时

git add -A
git commit -m "feat(web): <summary>"  # scope 只写实际发布的 app
```

- commit message **禁止包含 `[skip ci]`**
- scope 只包含实际发布的 app（如只发 web 就写 `feat(web): ...`，两个都发写 `feat(server,web): ...`）

### Step 6: 打 tag 并推送

**只为有变更的 app 打 tag。**

```bash
# 只打需要的 tag
git tag -a web-v{version} -m "$(cat <<'EOF'
changelog here
EOF
)"

git push origin main
git push origin web-v{version}
```

> **Workflow 文件：** `.github/workflows/publish-server.yml`、`.github/workflows/publish-web.yml`
> **触发条件：** `push.tags: server-v*` / `web-v*`

### Step 7: 监控 CI

```bash
gh run list --limit 5
```

CI 成功即完成。失败则见下方「故障恢复」。

---

## Desktop 发布

Desktop 采用 **Beta-only 构建策略**：新构建只能打 beta tag，stable 通过打正式 tag 触发完整重新构建。

### Tag 格式

| 类型 | 格式 | 示例 |
|------|------|------|
| Beta | `desktop@{x.y.z-beta.n}` | `desktop@0.2.5-beta.16` |
| Stable | `desktop@{x.y.z}` | `desktop@0.2.5` |

> ⚠️ 旧格式 `desktop-v*` 已废弃，必须用 `desktop@*`。

### Beta 发布流程

```
1. 确认变更已提交到 main

2. 创建 changelog 文件
   apps/desktop/changelogs/{x.y.z-beta.n}/zh.md
   apps/desktop/changelogs/{x.y.z-beta.n}/en.md

3. Bump 版本号并提交（commit message 禁止含 [skip ci]）
   npm version {x.y.z-beta.n} --no-git-tag-version --prefix apps/desktop
   git add apps/desktop/package.json
   git commit -m "chore(desktop): bump version to {x.y.z-beta.n}"

4. 打 tag 并推送
   git tag desktop@{x.y.z-beta.n}
   git push origin main --tags

   CI 自动：build-prerequisites → 多平台构建 → 上传 R2 → GitHub Release (prerelease)
```

**发布 Desktop 时不需要单独 bump/tag server 和 web。** Desktop 打包已包含最新 server + web 代码。

### Stable 发布流程

```
1. Bump 版本号（去掉 -beta.n）
   npm version {x.y.z} --no-git-tag-version --prefix apps/desktop
   git add apps/desktop/package.json
   git commit -m "chore(desktop): bump version to {x.y.z}"

2. 打 stable tag
   git tag desktop@{x.y.z}
   git push origin main --tags

   CI 自动：完整重新构建 → 上传 R2 → GitHub Release → version-bump (desktop patch +1)
```

### CI 模式

| mode | 触发条件 | 构建 | create-release | version-bump |
|------|---------|------|----------------|-------------|
| `beta` | tag 含 `-beta` | ✅ | ✅（prerelease） | ❌ |
| `stable` | tag 不含 `-beta` | ✅（完整重新构建） | ✅ | ✅（仅 desktop） |
| `workflow_dispatch` | 手动触发 | ✅ | ✅ | ❌ |

### CI 产物命名

| 平台 | R2 文件名 | GitHub Release 文件名 |
|------|----------|---------------------|
| macOS ARM64 | `OpenLoaf-{ver}-MacOS-arm64.dmg` / `.zip` | `OpenLoaf-{ver}-MacOS.dmg` |
| macOS x64 | `OpenLoaf-{ver}-MacOS-x64.dmg` / `.zip` | `OpenLoaf-{ver}-MacOS-Intel.dmg` |
| Windows | `OpenLoaf-{ver}-Windows-Installer.exe` | 同名 |
| Linux | `OpenLoaf-{ver}-Linux.AppImage` | 同名 |

> `.zip` 仅用于 electron-updater 自动更新（R2），不上传 GitHub Release。

### CI 配置

- **Workflow**：`.github/workflows/publish-desktop.yml`
- **触发**：`push.tags: desktop@*` 或 `workflow_dispatch`
- **Web 构建环境变量**：`NEXT_PUBLIC_SERVER_URL`、`NEXT_PUBLIC_OPENLOAF_SAAS_URL`、`NEXT_PUBLIC_UPDATE_BASE_URL`
- **`dist.mjs`**：自动 `--publish=never`；支持 `--beta[=N]` 本地测试
- **Linux**：仅 AppImage
- **手动触发**：可选构建平台（`build_mac`、`build_windows`、`build_linux`）

---

## 故障恢复

### Tag 推送后 CI 失败

```bash
# 1. 删除远端和本地 tag
git push origin :refs/tags/{tag-name}
git tag -d {tag-name}

# 2. 修复并提交
git add ... && git commit -m "fix: ..." && git push origin main

# 3. 重新打 tag 并推送
git tag -a {tag-name} -m "changelog"
git push origin {tag-name}
```

### 撤回已发布的 Server/Web 版本

```bash
# 1. 清理 R2（先 dry-run）
node scripts/cleanup-r2-version.mjs --server={ver} --web={ver} --dry-run
node scripts/cleanup-r2-version.mjs --server={ver} --web={ver}

# 2. 删除 tag
git push origin :refs/tags/server-v{ver} :refs/tags/web-v{ver}
git tag -d server-v{ver} web-v{ver}

# 3. 回退版本号
npm version {prev-ver} --no-git-tag-version --prefix apps/server
npm version {prev-ver} --no-git-tag-version --prefix apps/web
git add apps/server/package.json apps/web/package.json
git commit -m "chore(server,web): revert version bump ({ver} withdrawn)"
git push origin main
```

---

## 数据库迁移与更新

Server 增量更新可能含 schema 变更。迁移系统流程：

```
增量更新 → backupDatabase() → 替换 server.mjs → 重启
         → runPendingMigrations() → initDatabase() → startServer()

启动失败 → recordServerCrash() → 回退 server → restoreDatabase() → 黑名单崩溃版本
```

- Schema 变更必须 `pnpm run db:migrate` 生成迁移文件，禁止 `db:push`
- 迁移文件提交到 Git，CI 构建时内嵌到 server.mjs
- seed.db 保留 `_prisma_migrations` 表

> 详见 skill：[database-migration](../database-migration/SKILL.md)

---

## npm 包发布

### Widget SDK

```bash
cd packages/widget-sdk
pnpm version patch
pnpm publish --no-git-checks
cd ../..
git add packages/widget-sdk/package.json
git commit -m "chore: release @openloaf/widget-sdk v$(node -p "require('./packages/widget-sdk/package.json').version")"
git push
```

### @openloaf-saas/sdk

从 npm 安装（`^0.1.1`），更新：`pnpm update @openloaf-saas/sdk`

**Turbopack 兼容性：** 以下 javascript-obfuscator 选项**绝对禁止**：`controlFlowFlattening`、`deadCodeInjection`、`selfDefending`（会导致 Next.js dev 编译挂起）。

排查 dev 编译挂起：检查 `node_modules/@openloaf-saas/sdk/dist/index.js` 是否含巨型 `while(true){switch(...)}`。

---

## Quick Reference

| 操作 | 命令 |
|------|------|
| Server 增量发布 | `git tag -a server-v{ver} -m "..." && git push origin server-v{ver}` |
| Web 增量发布 | `git tag -a web-v{ver} -m "..." && git push origin web-v{ver}` |
| Desktop beta | `git tag desktop@{x.y.z-beta.n} && git push origin main --tags` |
| Desktop stable | bump → `git tag desktop@{x.y.z}` → `git push origin main --tags` |
| widget-sdk 发布 | `cd packages/widget-sdk && pnpm version patch && pnpm publish --no-git-checks` |
| 撤回 server/web | `node scripts/cleanup-r2-version.mjs --server={ver} --web={ver}` |
| 本地打包 beta 测试 | `pnpm run dist:mac -- --beta=2` |

## Common Mistakes

| 错误 | 正确做法 |
|------|----------|
| `packages/` 变更笼统归到所有 app | **按映射表判断**：ui/widget-sdk→Web，db→Server，api→看具体文件 |
| 只有 Web 变更却同时发布 Server | **只 bump/tag 有实际变更的 app** |
| 先 commit 再类型检查 | **先 `pnpm check-types`，通过后再 commit** |
| 用 `server-v*`/`web-v*` 作 changelog 基准 | **用所有 tag 中最新的**（通常是 `desktop@*`） |
| 只看已提交 commit，忽略未提交变更 | **同时检查 `git log` 和 `git diff --stat HEAD`** |
| 发布 Desktop 时多余 bump server/web | **Desktop 打包已含最新 server+web，无需单独 bump** |
| Desktop 用旧格式 `desktop-v*` | 必须用 `desktop@{version}` |
| commit message 含 `[skip ci]` | CI 不触发，禁止使用 |
| Lockfile 未更新就推送 tag | 先 `pnpm install --no-frozen-lockfile` |

---

## Detailed References

| 文件 | 查阅时机 |
|------|----------|
| [publish-release.md](publish-release.md) | R2 目录结构、changelog 格式、环境变量配置 |
| [update-system.md](update-system.md) | 更新检查/下载/校验逻辑、崩溃回滚、manifest 结构 |
