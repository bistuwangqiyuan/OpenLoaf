# Test Patterns Reference

详细代码模板，供 AI 创建测试时直接复制使用。

## Web 端完整测试模板

Vitest 配置要点（`apps/web/vitest.config.ts`）：
- 环境：`jsdom`
- 匹配：`src/**/*.vitest.ts`, `src/**/*.vitest.tsx`
- 别名：`@/` → `./src/`, `@openloaf/ui` → `packages/ui/src`

### 缓存清除

切换 `setOpenLoafRootOverride` 后，如果被测模块有内部缓存，需要手动清除：

## 并发测试模式

验证 mutex/锁机制是否正确工作：

### 提取原则

1. **参数用对象模式**：`function fn(input: { ... })` 而非多个位置参数
2. **返回值明确**：避免 `void`，返回计算结果
3. **无副作用**：不修改外部状态、不做 I/O
4. **类型最小化**：参数类型只声明实际使用的字段（`Array<{ id: string }>` 而非完整 Message 类型）

---

## Promptfoo YAML 测试用例模板

以下模板用于在 `apps/server/src/ai/__tests__/agent-behavior/tests/<domain>/<domain>.yaml` 中添加新的 AI Agent 行为测试用例。

### 模板 A：单轮工具测试（默认路径）

最常见的模式。不设 `agentType`，走完整 `AiExecuteService.execute()` pipeline。

### 模板 B：子 Agent 直接调用

设置 `agentType` 和 `toolIds`，通过 `createSubAgent()` 直接运行子 Agent，跳过会话管理。

### 模板 C：多轮对话 + 命令

使用 `vars.turns` 模拟多轮对话。常用于测试斜杠命令（如 `/summary-title`）。

### 命名规范

- **前缀**：与所在 YAML 文件的领域对应
  - `master.yaml` → `master-NNN`
  - `calendar.yaml` → `cal-NNN`
  - `email.yaml` → `email-NNN`
  - `tools.yaml` → `tools-<sub>-NNN`（如 `tools-imgproc-001`、`tools-docconv-001`）
  - `commands.yaml` → `cmd-<name>-NNN`（如 `cmd-summarytitle-001`）
- **编号**：三位数字，从 001 开始
- **描述**：简洁说明测试意图（中文）

### 断言编写要点

1. **javascript 断言**必须从 `context.providerResponse?.metadata` 取数据（`toolNames`、`commandEvents` 等）
2. **llm-rubric 断言**遵循写作规范：并列同义词、容错括号、描述范围而非精确值
3. 每个用例**同时**具备 `javascript` + `llm-rubric` 两种断言
4. 失败 reason 应包含实际值，方便诊断（如 `实际: [${tools}]`）
