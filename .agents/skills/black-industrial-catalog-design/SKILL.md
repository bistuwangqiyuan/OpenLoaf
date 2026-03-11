---
name: black-industrial-catalog-design
description: This skill should be used when the user asks to "做成 OP-XY 风格", "做黑场工业目录风页面", "做硬件展品化产品页", "做黑色 editorial 硬件官网", "把页面改成黑场工业目录风", "给我一套 Figma 规范和 Next.js 骨架", or wants a dark, catalog-like, hardware-first design system derived from the teenage engineering OP-XY product page.
version: 0.1.0
---

# Black Industrial Catalog Design

## Purpose

提炼并复用一种更具体的页面语言：

`黑场工业目录风`

这个风格来自对 `teenage engineering / OP-XY` 页面语法的拆解，但默认目标不是复刻品牌资产，而是沉淀一套可复用的方法，适用于：

- 黑色硬件产品页
- 器材感品牌首页
- 展品化产品详情页
- 需要 `Figma 规范 + Next.js/Tailwind 骨架` 的视觉方案

默认输出强调：

- 对象优先，而不是 UI 优先
- 栅格与留白优先，而不是特效优先
- 黑灰白层级优先，而不是彩色营销优先

## Scope

把这个 skill 用于两类任务：

1. 风格分析：总结页面的版式、色彩、字体、图像、组件和文案语气。
2. 风格构建：生成可直接落地的设计规范、Figma 样式稿、Next.js/Tailwind 页面骨架、组件拆分建议和评审清单。

如果用户要的是更广义的 TE 品牌风格，而不是这种更黑、更压抑、更 editorial 的分支，回退到 `../teenage-engineering-brand-design/SKILL.md`。

## Source of Truth

执行任务前，按顺序读取：

1. `references/style-dna.md`
2. `references/figma-spec.md`
3. `references/nextjs-tailwind-blueprint.md`
4. `examples/nextjs-tailwind-product-page.tsx`（仅当需要代码骨架）
5. `../teenage-engineering-brand-design/SKILL.md`（仅当需要更宽的 TE 母体语境）

如遇冲突，优先级如下：

1. 用户本次明确要求
2. `style-dna.md`
3. `figma-spec.md`
4. `nextjs-tailwind-blueprint.md`
5. `teenage-engineering-brand-design`

## Mode Selection

### Analysis Mode

在以下请求中使用：

- “分析 OP-XY 这种页面风格”
- “总结黑场工业目录风”
- “拆一下这个页面为什么像器材目录”

执行流程：

1. 先给一句话风格定义。
2. 再拆 `版式 / 色彩 / 字体 / 图像 / 组件 / 动效 / 文案语气`。
3. 最后给一条可复用风格公式。

输出要求：

- 先给结论，再给分解。
- 明确“像什么”，也明确“不是什么”。
- 如用户要复用，补一版设计规则。

### Design System Mode

在以下请求中使用：

- “给我一套 Figma 风格规范”
- “整理成设计系统”
- “做一版 token / 字体 / 栅格规则”

执行流程：

1. 用 `references/figma-spec.md` 产出基础变量。
2. 把页面拆成 `Foundations / Components / Templates`。
3. 明确桌面和移动端的栅格、字号、间距和层级。
4. 最后给交互与交付检查项。

输出要求：

- 先给风格总纲，再给具体变量。
- 必须包含 `颜色 / 字体 / 栅格 / 组件 / 页面模板`。
- 必须说明哪些点不能做，否则会掉回普通 SaaS 风格。

### Build Mode

在以下请求中使用：

- “做一个这类产品页”
- “给我 Next.js / Tailwind 骨架”
- “把这个页面改成黑场工业目录风”

执行流程：

1. 判断产物类型：品牌页、产品详情页、商店页、单个 Hero、组件局部。
2. 判断参考强度：
   `轻参考`：借气质，不借显著构图。
   `中参考`：默认，明显像该风格分支，但保留自有识别度。
   `强参考`：只用于风格研究稿，不直接复刻品牌表达。
3. 先确定对象、图像比例和黑场关系。
4. 再建立目录式导航、轻标题、规格区和克制 CTA。
5. 最后才补 hover、动效和响应式折叠。

输出要求：

- 先给页面骨架，再给组件语法。
- 如用户要代码，优先给 `token + section 分解 + 组件骨架`。
- 如用户要直接实现，参考 `references/nextjs-tailwind-blueprint.md` 和 `examples/nextjs-tailwind-product-page.tsx`。

### Review Mode

在以下请求中使用：

- “看这个页面像不像 OP-XY 风格”
- “审一下这套 UI 是否符合黑场工业目录风”
- “给我列出改造清单”

执行流程：

1. 读取目标页面、组件或设计稿。
2. 用 `references/style-dna.md` 逐项核对。
3. 先报高风险偏差，再报中低风险偏差。
4. 每条问题都给替代方向。

输出要求：

- 先列破坏气质的高风险项。
- 再列细节层级问题。
- 如是代码评审，使用 `file:line` 定位。

## Default Workflow

1. 确认主角是否真的是“对象 / 产品 / 设备”，而不是运营文案。
2. 设定画面关系：
   `黑场 > 对象 > 超轻标题 > 技术说明 > 购买动作`
3. 用 `references/style-dna.md` 锁定：
   `硬栅格 + 黑灰白 + 细无衬线 + 克制动效 + 目录式 CTA`
4. 如用户要规范，转到 `references/figma-spec.md` 输出 token 和模板。
5. 如用户要代码，按 `references/nextjs-tailwind-blueprint.md` 组织页面结构。
6. 最后检查是否掉进以下误区：
   紫蓝渐变、重阴影、软萌圆角、粗重字体、营销型大按钮、过量动效。

## Hard Rules

### 1. Object First

让产品、设备、包装或器材细节成为主角。不要让装饰性 UI 抢走画面。

### 2. Black Field Before Decoration

先处理黑场、留白和对象比例，再决定色块、细线和标签。这个风格不是靠特效堆出来的。

### 3. Thin Type, Not Loud Type

标题要轻，不要粗。层级主要靠字号、位置、呼吸和明度，而不是靠 bold。

### 4. CTA as Directory Action

按钮要像目录动作或设备标签，不要像大促销按钮。

### 5. Specs as Manual

规格区必须像说明书和技术清单，不能做成互联网文案瀑布流。

### 6. Motion as Precision

动效只表达状态，不表达情绪表演。避免视差、回弹、发光、漂浮。

## Anti-Patterns

以下特征会明显破坏目标风格：

- SaaS 式紫蓝渐变、玻璃发光、霓虹描边
- 大量 box-shadow 和悬浮卡片
- 过度圆润、过度可爱的按钮和输入框
- Hero 里堆满营销文案而不是对象
- 直接使用 `Inter / Space Grotesk / Poppins` 且不做覆盖
- 全页面靠彩色建立层级，缺少字重、间距和版式秩序

## Output Templates

### Analysis Template

1. 一句话风格定义
2. 风格公式
3. 版式
4. 色彩
5. 字体
6. 图像与组件
7. 动效与文案
8. 可复用规则

### Design System Template

1. 风格总纲
2. Foundations
3. Components
4. Page Templates
5. 交付检查项

### Build Template

1. 设计目标
2. 参考强度
3. 页面骨架
4. 视觉系统
5. 关键组件规则
6. 响应式与状态
7. 风险与避坑

### Review Template

1. 总体符合度
2. 高风险偏差
3. 中低风险偏差
4. 最小整改批次

## Collaboration Notes

- 用户只要规范时，只输出规范，不直接写代码。
- 用户要实现时，优先产出独立页面骨架，避免一开始污染现有全局布局。
- 用户要 OpenLoaf 页面适配时，优先做“局部页面容器覆盖”，不要先动全局字体或主题 token。

## Additional Resources

- `references/style-dna.md`：黑场工业目录风的风格 DNA
- `references/figma-spec.md`：Figma 规范、token、组件模板
- `references/nextjs-tailwind-blueprint.md`：Next.js App Router + Tailwind 4 落地蓝图
- `examples/nextjs-tailwind-product-page.tsx`：可复制的页面骨架示例
