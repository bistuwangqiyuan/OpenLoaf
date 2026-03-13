# OpenLoaf i18n 组件迁移速查手册

本文档提供常见组件迁移模式的即时参考，帮助快速将硬编码文本转换为多语言支持。

---

### 多 Namespace

**或者**（数组简写，但需指定 key 前缀）：

---

### ✅ After（使用 i18n）

**翻译文件**（JSON）：

---

### ✅ After（使用插值）

**翻译文件**：

**使用多个变量**：

---

### ✅ After

**更复杂的 Toast**：

---

### ✅ After（方案 B：返回对象）

**对应翻译**（方案 B）：

---

### ✅ After

**或者（从 JSON 返回对象）**：

**翻译文件**：

---

### ✅ After（动态 locale 感知）

**或使用格式化工具**：

---

### ✅ After

**翻译文件**：

---

### ✅ After

---

### 场景：根据语言选择不同的 UI 布局

---

### 场景：同一组件中临时切换到另一 namespace

---

### ✅ After（使用 i18n）

或使用 i18next 测试工具（见 i18next 官方文档）。

---

## Pattern 12: 异步加载（Suspense）

如果翻译文件异步加载，使用 Suspense：

---

## 检查清单

迁移组件时，依次检查：

- [ ] 导入了 `useTranslation` 和正确的 namespace
- [ ] 所有硬编码的中文/其他语言文本已替换为 `t('key')`
- [ ] 动态变量使用了 `{{variable}}` 插值语法
- [ ] Toast / Alert / Error messages 通过 `t()` 翻译
- [ ] HTML 属性（placeholder、title、aria-label）使用了翻译
- [ ] 新增 key 同时添加到 zh-CN / zh-TW / en-US 三个文件
- [ ] 繁体翻译使用了正确术语（参考 SKILL.md 术语表）
- [ ] 英文翻译符合规范（技术术语保持英文，按钮用现在式）
- [ ] 日期/数字使用了 locale-aware 格式化
- [ ] 没有遗留的注释如 `// TODO: 翻译` 或 `// 待国际化`

---

### ✅ 正确

---

### ✅ 正确

---

### ✅ 正确

---

### ❌ 错误 4: 忘记添加到全部三个语言文件

结果：i18n 报错或 fallback 到中文。

### ✅ 正确

所有三个文件同时添加相同的 key。

---

### ❌ 错误 5: workspace.json 顶层包装键未使用 keyPrefix

`workspace.json` 的结构是所有 key 都嵌套在顶层 `workspace` 对象下。如果不用 `keyPrefix`，所有 `t()` 调用都会找不到 key：

启用 `keyPrefix` 后，已有 `workspace.` 前缀的调用要去掉，避免双重叠加：

---

### ❌ 错误 6: 用 `:` 代替 `.` 作为 key 路径分隔符

`:` 是 i18next **namespace 分隔符**，不是 key 路径分隔符。

---

### ❌ 错误 7: 将 titleKey 直接用作显示文本

配置对象中的 `titleKey: "nav:workbench"` 是 i18n key 引用，不是翻译后的字符串：

在 Zustand store 等非 React 上下文中同样使用 `import i18next from 'i18next'` + `i18next.t()`。

---

### ❌ 错误 8: useMemo 空依赖数组，语言切换后不更新

---

### ❌ 错误 9: 组件外静态数组含翻译标签

---

## packages/api 层 i18n 模式

`packages/api` 的 tRPC procedure 通过 `ctx.lang` 获取用户语言（已在 Context 中定义），可以做运行时国际化。但由于 packages 层不能 import `apps/server` 的代码，需要用内联翻译。

### apps/server 路由用 getErrorMessage（推荐）

`apps/server` 中的路由优先使用 `errorMessages.ts`，覆盖更完整：

### 纯工具函数（无 ctx）

纯工具函数（如 `packages/api/src/types/toolResult.ts` 的 `notImplemented()`）没有请求上下文：

- **技术性错误/开发占位** → 直接用英文
- **确实需要国际化** → 增加 `lang?: string` 参数，由调用方传入 `ctx.lang`

---

## 快速参考

| 需求 | 用法 | 示例 |
|------|------|------|
| 静态文本 | `t('key')` | `t('save')` |
| 动态变量 | `t('key', { var })` | `t('greeting', { name: 'Alice' })` |
| 多语言插值 | JSON: `{{var}}` | `"msg": "你好 {{name}}"` |
| 返回对象 | `t('key', { returnObjects: true })` | `const obj = t('statuses', { returnObjects: true })` |
| 切换语言 | `i18n.changeLanguage(lang)` | `i18n.changeLanguage('en-US')` |
| 获取当前语言 | `i18n.language` | `if (i18n.language === 'zh-CN')` |
| 多 namespace | `useTranslation(['ns1', 'ns2'])` + 前缀 | `t('ns1:key')` |
