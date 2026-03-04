---
description: 提交并推送代码（自动分析变更、生成 Conventional Commits 消息、push 到远程）
---

在开始之前，阅读 Git 工作流 Skill：`.agents/skills/git-workflow/SKILL.md`，确保 commit message 严格遵循项目 Conventional Commits 规范。

## 工作流

### 第一步：分析当前状态

并行执行以下命令：

```bash
git status
git diff --stat
git diff --cached --stat
git log --oneline -5
```

检查是否有可提交的变更。如果工作区和暂存区都干净，告知用户没有可提交的内容并结束。

### 第二步：分析变更内容

1. 查看未暂存的变更详情：`git diff`
2. 查看已暂存的变更详情：`git diff --cached`
3. 查看未跟踪的文件列表

根据变更内容判断：
- 是否需要暂存新文件（排除 `.env`、凭证文件等敏感内容）
- 变更是否应该拆成多个 commit（涉及不相关的多个改动）

### 第三步：决定提交策略

**单次提交**：所有变更属于同一个主题/功能。

**拆分提交**：变更涉及多个不相关的主题。拆分时：
- 按主题分组暂存文件
- 每组单独提交
- 每个 commit message 独立描述该组变更

**向用户确认**：如果不确定是否需要拆分，展示变更分组方案并询问用户。

### 第四步：暂存文件

将需要提交的文件加入暂存区。优先 `git add <具体文件>` 而非 `git add -A`。

**禁止暂存的文件**（如果发现，警告用户）：
- `.env`、`.env.*`
- 含密钥/凭证的配置文件
- `node_modules/`
- 大型二进制文件

### 第五步：生成 Commit Message

严格遵循项目 Conventional Commits 规范：

```
<type>(<scope>): <subject>
```

**规则**：
- **type**：feat / fix / refactor / perf / chore / docs / style / test / ci / revert
- **scope**：server / web / desktop / db / api / ui / config / i18n / ai / email / calendar / board / tasks / auth / editor / terminal / deps / ci / release
- **subject**：小写开头、不加句号、祈使语气、100 字符以内
- 跨多个 scope 的变更：选择最主要的 scope，或省略 scope
- 多行 body：用于补充说明具体改动点

**commit message 必须使用 HEREDOC 格式**：

```bash
git commit -m "$(cat <<'EOF'
type(scope): subject

- Detail 1
- Detail 2

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

### 第六步：推送到远程

```bash
git push
```

如果推送失败（如远程有新提交），执行：

```bash
git pull --rebase
git push
```

如果 rebase 有冲突，停止并告知用户手动解决。**绝不执行 `git push --force`**。

### 第七步：输出报告

```
## 提交报告

- 📝 Commit: <hash 前 8 位> <commit message 首行>
- 📁 文件: <N> 个文件变更 (+X/-Y)
- 🚀 已推送到 origin/<branch>
```

如果有多个 commit，逐一列出。

## 特殊情况处理

### commitlint 校验失败

如果 commit 被 commitlint 拦截：
1. 读取错误信息
2. 修正 commit message 格式
3. 重新提交

### 用户传入参数

`$ARGUMENTS` 可用于：
- 指定 commit message：`/openloaf-git-commit-push fix(web): resolve login redirect`
- 其他参数会被忽略

如果用户提供了 commit message，直接使用（仍需验证格式合规）。如果未提供，自动分析变更生成。

## 约束规则

1. **不提交敏感文件**：发现 `.env`、凭证等文件时警告而非提交
2. **不使用 `git push --force`**：任何情况下都不执行强制推送
3. **不修改 git config**：不更改用户的 git 配置
4. **不跳过 hooks**：不使用 `--no-verify`
5. **Commit message 始终追加 Co-Authored-By**：`Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
6. **中文交互**：所有输出说明使用中文，commit message 使用英文
