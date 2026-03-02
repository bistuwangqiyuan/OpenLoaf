---
description: 运行 AI Agent 行为测试并自动修复失败用例（迭代闭环）
---

在开始之前，阅读 Skill 知识库：`.agents/skills/ai-test-autofix/SKILL.md` 和 `.agents/skills/ai-test-autofix/references/fix-patterns.md`。

## 自动修复工作流

### 第一步：运行测试并保留输出

通过 Docker 运行，确保环境隔离和配置固定：

```bash
cd scripts/docker-e2e && docker compose run --rm behavior-test pnpm run test:ai:behavior --keep-output $ARGUMENTS
```

如果用户传入了参数（如 `--filter-description "e2e-001"`），追加到命令末尾。

输出文件会写入 `apps/server/.behavior-test-output.json`（Docker volume 挂载了整个项目目录，宿主机可直接读取）。

### 第二步：解析测试结果

读取 `apps/server/.behavior-test-output.json`，解析 `results.results[]` 数组。

将每个用例分为三类：
- **PASS**：`success === true`
- **FAIL**：`success === false` 且无 `error` 字段
- **ERROR**：存在 `error` 字段（Provider 错误，不可代码修复）

如果全部 PASS，输出祝贺信息并结束。

### 第三步：分析每个 FAIL 用例

对每个失败用例，提取以下信息：
1. `testCase.description` — 用例 ID 和描述
2. `testCase.vars.prompt` — 用户输入
3. `response.output` — Agent 的完整回复
4. `gradingResult.componentResults[]` — 每个断言的 `pass`、`reason`、`assertion.type`
5. `metadata.toolNames` — 实际调用的工具列表
6. `metadata.toolCalls` — 工具调用详情（参数和结果）

### 第四步：分类失败类型

按照 SKILL.md 中的决策树分类：
- **WRONG_TOOL**：javascript 断言失败，期望的工具未出现在 toolNames 中
- **FORBIDDEN_TOOL**：javascript 断言失败，禁止的工具出现在 toolNames 中
- **NO_TOOL**：toolNames 为空，Agent 没有调用任何工具
- **OUTPUT_QUALITY**：llm-rubric 断言失败（工具选择正确但输出语义不满足）
- **PROVIDER_ERROR**：error 字段存在（跳过，不做代码修复）

### 第五步：诊断根因并修复

读取相关源文件，根据 SKILL.md 中的修复策略矩阵和 fix-patterns.md 中的模式进行修复。

**修复优先级**（按顺序尝试）：
1. Master prompt 中的 toolIds 列表 — 缺少工具则添加
2. 工具描述 `packages/api/src/types/tools/*.ts` — 描述不够明确则增强
3. Master prompt 的工具使用指引 — 添加针对性规则
4. 工具别名 `apps/server/src/ai/tools/toolRegistry.ts` TOOL_ALIASES — 添加缺失别名

**每次修改后，输出修改说明**：
```
🔧 修复 [用例ID]: [失败类型]
   文件: [文件路径]
   原因: [诊断的根因]
   改动: [具体修改内容]
```

### 第六步：重跑失败用例

收集所有失败用例的 description，用 `--filter-description` 逐个或批量重跑：

```bash
cd scripts/docker-e2e && docker compose run --rm behavior-test pnpm run test:ai:behavior --keep-output --filter-description "e2e-001"
```

### 第七步：评估进度

重新读取 `.behavior-test-output.json`，比较本轮和上轮的通过率：

- **全部通过** → 转到第八步，输出最终报告
- **有进展**（通过率提升）→ 迭代次数 < 3 则回到第三步
- **无进展**（通过率未变）→ 停止迭代，输出手动修复建议
- **迭代次数已达 3 轮** → 停止迭代，输出剩余问题的手动修复建议

### 第八步：输出最终报告

```
## AI Agent 行为测试自动修复报告

### 迭代摘要
- 初始状态: X/Y 通过 (Z%)
- 最终状态: X'/Y' 通过 (Z'%)
- 迭代轮数: N

### 修复记录
| 用例 | 失败类型 | 修复文件 | 修改说明 | 结果 |
|------|----------|----------|----------|------|
| e2e-001 | WRONG_TOOL | prompt.zh.md | 添加工具使用指引 | PASS ✅ |

### 仍然失败的用例（如有）
| 用例 | 失败类型 | 建议 |
|------|----------|------|

### 修改的文件列表
- `apps/server/src/ai/agent-templates/templates/master/prompt.zh.md`
- ...
```

## 约束规则

1. **不得修改测试断言**：不改 `promptfooconfig.yaml` 中的 `assert` 内容
2. **最小化修改**：对 prompt 和工具描述的修改应增量式，不做大规模重写
3. **每次修改说明原因**：输出清晰的诊断和修复理由
4. **最多 3 轮迭代**：防止无限循环
5. **不修复 PROVIDER_ERROR**：这类错误是环境/配置问题，不是代码问题
6. **中文优先修改 prompt.zh.md**：如有英文 prompt 需要同步修改，同时更新 prompt.en.md

## 与 /ai-test 的关系

- `/ai-test` — 只读诊断，安全无副作用
- `/ai-test-autofix` — 会修改源文件，用于自动修复失败用例
- 建议：先用 `/ai-test` 查看状态，再用 `/ai-test-autofix` 自动修复
