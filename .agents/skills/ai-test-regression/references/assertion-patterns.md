# Assertion Patterns — 回归测试断言模板

本文档为各故障类型提供即用的 YAML 断言代码模板，供回归测试用例直接复制使用。

---

## 1. WRONG_TOOL — 调了错误的工具

**场景**：用户输入应触发工具 A，但 Agent 调了工具 B。

```yaml
assert:
  # 验证正确工具被调用
  - type: javascript
    weight: 2
    metric: tool_selection
    value: |
      const tools = context.providerResponse?.metadata?.toolNames || [];
      return tools.includes('<期望工具>')
        ? { pass: true, score: 1, reason: '正确调用了 <期望工具>' }
        : { pass: false, score: 0, reason: `未调用 <期望工具>，实际: [${tools}]` };
  # 验证错误工具未被调用（可选，当需要排除特定工具时添加）
  - type: javascript
    weight: 2
    metric: tool_selection
    value: |
      const tools = context.providerResponse?.metadata?.toolNames || [];
      return !tools.includes('<错误工具>')
        ? { pass: true, score: 1, reason: '未错误调用 <错误工具>' }
        : { pass: false, score: 0, reason: `不应调用 <错误工具>，但实际调用了` };
  - type: llm-rubric
    weight: 1
    metric: output_quality
    value: "回复应<期望行为描述>（<容错情况>也可接受）"
```

---

## 2. NO_TOOL — 应调工具但未调

**场景**：用户请求明确需要工具辅助，但 Agent 直接文本回复。

```yaml
assert:
  - type: javascript
    weight: 2
    metric: tool_selection
    value: |
      const tools = context.providerResponse?.metadata?.toolNames || [];
      return tools.length > 0
        ? { pass: true, score: 1, reason: `调用了工具: [${tools}]` }
        : { pass: false, score: 0, reason: '未调用任何工具，但此请求需要工具辅助' };
  - type: llm-rubric
    weight: 1
    metric: output_quality
    value: "回复应基于实际数据（通过工具查询获得），而非凭猜测或通用知识回答"
```

**变体 — 验证特定工具被调用**：

```yaml
assert:
  - type: javascript
    weight: 2
    metric: tool_selection
    value: |
      const tools = context.providerResponse?.metadata?.toolNames || [];
      return tools.includes('<期望工具>')
        ? { pass: true, score: 1, reason: '正确调用了 <期望工具>' }
        : { pass: false, score: 0, reason: `未调用 <期望工具>，实际: [${tools.length ? tools : '无工具调用'}]` };
  - type: llm-rubric
    weight: 1
    metric: output_quality
    value: "回复应<基于工具结果的期望行为>"
```

---

## 3. TOOL_ERROR — 工具调用返回错误

**场景**：正确的工具被调用，但返回了错误结果。

```yaml
assert:
  # 验证正确工具被调用（工具选择本身是对的）
  - type: javascript
    weight: 2
    metric: tool_selection
    value: |
      const tools = context.providerResponse?.metadata?.toolNames || [];
      return tools.includes('<期望工具>')
        ? { pass: true, score: 1, reason: '正确调用了 <期望工具>' }
        : { pass: false, score: 0, reason: `未调用 <期望工具>，实际: [${tools}]` };
  # 验证工具未返回错误
  - type: javascript
    weight: 2
    metric: tool_selection
    value: |
      const calls = context.providerResponse?.metadata?.toolCalls || [];
      const targetCall = calls.find(c => c.toolName === '<期望工具>');
      if (!targetCall) return { pass: false, score: 0, reason: '未找到工具调用记录' };
      const hasError = targetCall.result?.state === 'output-error';
      return hasError
        ? { pass: false, score: 0, reason: `工具返回错误: ${JSON.stringify(targetCall.result).slice(0, 200)}` }
        : { pass: true, score: 1, reason: '工具执行成功' };
  - type: llm-rubric
    weight: 1
    metric: output_quality
    value: "回复应<期望的成功输出描述>"
```

---

## 4. OUTPUT_QUALITY — 工具选对但输出质量差

**场景**：工具选择正确，但 Agent 的最终回复不够好。

```yaml
assert:
  - type: javascript
    weight: 2
    metric: tool_selection
    value: |
      const tools = context.providerResponse?.metadata?.toolNames || [];
      return tools.includes('<期望工具>')
        ? { pass: true, score: 1, reason: '正确调用了 <期望工具>' }
        : { pass: false, score: 0, reason: `未调用 <期望工具>，实际: [${tools}]` };
  - type: llm-rubric
    weight: 1
    metric: output_quality
    value: "回复应<详细的质量期望>。具体应包含<关键信息点 1>和<关键信息点 2>（<替代表述>也可接受）"
```

---

## 5. COMMAND_FAIL — 命令未触发

**场景**：用户使用斜杠命令，但对应事件未触发。

```yaml
assert:
  - type: javascript
    weight: 2
    metric: tool_selection
    value: |
      const cmds = context.providerResponse?.metadata?.commandEvents || [];
      return cmds.some(c => c.type === '<期望事件类型>')
        ? { pass: true, score: 1, reason: '正确触发了 <期望事件类型>' }
        : { pass: false, score: 0, reason: `未触发 <期望事件类型>，实际事件: ${JSON.stringify(cmds)}` };
  - type: llm-rubric
    weight: 1
    metric: output_quality
    value: "回复应<命令执行后的期望行为>"
```

---

## 6. SYSTEM_ERROR — 超时或崩溃

**场景**：Agent 处理超时或系统异常。

```yaml
assert:
  - type: javascript
    weight: 2
    metric: tool_selection
    value: |
      const error = context.providerResponse?.error;
      return !error
        ? { pass: true, score: 1, reason: '无系统错误' }
        : { pass: false, score: 0, reason: `系统错误: ${error}` };
  - type: llm-rubric
    weight: 1
    metric: output_quality
    value: "回复应正常完成，不应出现超时或系统错误提示"
```

---

## 7. 多轮对话故障

**场景**：多轮交互中某个轮次出现问题。

```yaml
- description: "regression-NNN: <多轮故障简述>"
  vars:
    prompt: "dummy"
    turns: '[{"text": "<Turn 1>"}, {"text": "<Turn 2（故障轮次）>"}]'
  assert:
    - type: javascript
      value: |
        const tools = context.providerResponse?.metadata?.toolNames || [];
        // 验证最终轮次的工具选择
        return tools.includes('<期望工具>')
          ? { pass: true, score: 1, reason: '正确调用了 <期望工具>' }
          : { pass: false, score: 0, reason: `未调用 <期望工具>，实际: [${tools}]` };
    - type: llm-rubric
      value: "回复应在前一轮上下文基础上<期望行为>，保持对话连贯性"
```

---

## 8. 复合断言（同时验证多个条件）

**场景**：一个测试需要验证多个工具协同工作。

```yaml
assert:
  # 验证工具 A 被调用
  - type: javascript
    weight: 2
    metric: tool_selection
    value: |
      const tools = context.providerResponse?.metadata?.toolNames || [];
      return tools.includes('<工具A>')
        ? { pass: true, score: 1, reason: '调用了 <工具A>' }
        : { pass: false, score: 0, reason: `未调用 <工具A>，实际: [${tools}]` };
  # 验证工具 B 也被调用
  - type: javascript
    weight: 2
    metric: tool_selection
    value: |
      const tools = context.providerResponse?.metadata?.toolNames || [];
      return tools.includes('<工具B>')
        ? { pass: true, score: 1, reason: '调用了 <工具B>' }
        : { pass: false, score: 0, reason: `未调用 <工具B>，实际: [${tools}]` };
  # 语义质量
  - type: llm-rubric
    weight: 1
    metric: output_quality
    value: "回复应综合<工具A>和<工具B>的结果，<期望的综合行为>"
```

---

## llm-rubric 写作提醒

1. **并列同义词**：`"指出文件未找到/不存在"`
2. **容错括号**：`"（提示检查路径也可接受）"`
3. **描述范围**：避免要求精确数值匹配
4. **避免格式要求**：不要求 Markdown 表格等特定格式
