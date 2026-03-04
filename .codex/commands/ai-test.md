---
description: 运行 AI Agent 行为测试（基于 Promptfoo），检查工具选择和输出质量
---

## 工作流

1. 通过 Docker 运行 Promptfoo 行为测试（隔离环境，固定模型配置）：
   ```bash
   cd scripts/docker-e2e && docker compose run --rm behavior-test pnpm run test:ai:behavior $ARGUMENTS
   ```
   如果用户传入了参数（如 `--filter-description "e2e-001"` 或 `--repeat 3`），追加到命令末尾。

   Docker 环境说明：
   - 使用 `scripts/docker-e2e/openloaf-root/` 中的固定配置（providers.json、settings.json、workspace）
   - 首次运行会自动安装依赖（后续通过 Docker volume 缓存加速）
   - 如果宿主机 `~/.openloaf/` 有 providers.json / auth.json，会自动复制进容器

2. 测试完成后，读取输出中的结果摘要。

3. 对每个测试用例，解读结果：
   - **javascript 断言**：检查工具选择是否正确（确定性）
   - **llm-rubric 断言**：LLM 判断输出质量（语义级）

4. 汇总输出人类可读报告，格式如下：
   ```
   ## AI Agent 行为测试报告

   | 用例 | 描述 | 工具选择 | 输出质量 | 结果 |
   |------|------|----------|----------|------|
   | ts-001 | 项目列表查询 | project-query ✓ | ✓ | PASS |
   | ts-002 | 时间查询 | time-now ✓ | - | PASS |
   ```

5. 如有失败用例，分析根因并给出修复建议：
   - 工具描述不够明确 → 修改 `packages/api/src/types/tools/*.ts` 中的工具描述
   - 系统提示词引导不足 → 修改 `apps/server/src/ai/agent-templates/templates/master/prompt.zh.md`
   - 工具别名缺失 → 修改 `apps/server/src/ai/tools/toolRegistry.ts` 中的 TOOL_ALIASES

6. 修改后可重新执行 `/ai-test` 验证修复。

## 可选参数

- 无参数：运行所有用例
- `-- --filter-description "ts-001"`: 运行指定用例
- `-- --repeat 3`: 每个用例运行 3 次（测试稳定性）
- `-- -o output.json`: 输出 JSON 结果文件

## 查看 Web UI 结果

运行后可执行 `cd apps/server && pnpm run test:ai:behavior:view` 打开 Promptfoo Web UI 查看详细的结果矩阵。（Web UI 在宿主机运行，无需 Docker）

## 测试用例文件

测试用例定义在 `apps/server/src/ai/__tests__/agent-behavior/promptfooconfig.yaml`。

添加新用例时，在 `tests:` 数组中追加新条目，遵循 `ts-NNN` 编号规范。
