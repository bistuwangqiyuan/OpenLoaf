# Next.js Tailwind Blueprint

## Goal

在 `Next.js App Router + Tailwind 4` 中稳定实现黑场工业目录风，优先保证：

- 页面容器独立
- 不污染现有全局布局
- 风格先跑通，再接业务数据

## Implementation Strategy

### 1. Start from an Isolated Route

优先新建独立页面：

- `apps/web/src/app/<route>/page.tsx`

先验证：

- 黑场关系
- 字体节奏
- Hero 构图
- 规格区层级

不要一开始就改全局 `layout` 或全局主题 token。

### 2. Use Page-Level CSS Variables

在页面根节点声明局部变量：

```tsx
const theme = {
  "--te-bg": "#000000",
  "--te-panel": "#0f0f10",
  "--te-card": "#e5e5e5",
  "--te-card-2": "#cbcbcb",
  "--te-text": "#f5f5f5",
  "--te-text-muted": "#a1a1a1",
  "--te-line": "rgba(255,255,255,0.10)",
} as CSSProperties;
```

好处：

- 与现有 OpenLoaf token 隔离
- 方便逐页迁移
- 更适合风格研究稿

### 3. Prefer Section Components

先拆成这些 section：

- `DirectoryHeader`
- `Hero`
- `StatementSection`
- `FeatureGrid`
- `SpecList`
- `AccessoryGrid`

把每一块都保持单一职责，不要把整页写成一个超长组件。

### 4. Keep the Object First

如果没有真实产品图，先使用：

- CSS block mock
- 占位图容器
- 黑场渐层和几何物体

先验证构图，不要为了等图把页面结构卡住。

## Tailwind Rules

### Typography

- 标题使用 `font-light`
- 避免 `font-semibold` 和 `font-bold` 成为主角
- 用 `tracking-[-0.04em]` 到 `tracking-[0.04em]` 控制呼吸

### Surface

- 黑底 section 用 `border-white/10` 做弱分隔
- 浅灰卡片改用背景和圆角表达层级
- 不用 `shadow-xl` 之类的强阴影

### CTA

- 主 CTA 可用：
  - `rounded-full border border-white/10 px-4 py-2 text-[11px] uppercase tracking-[0.22em]`
  - 或 `bg-black text-white`
- 不做高饱和大按钮

### Motion

- 只给 hover：
  - `transition-colors`
  - `transition-transform`
  - `duration-200`
- 位移控制在 `-translate-y-0.5` 或更轻

## Responsive Strategy

### Desktop

- 让 Hero 保持大空气感
- 让导航像目录板
- 让对象和标题拉开距离

### Mobile

- 把目录导航压成 2 列或 4 列堆叠
- Hero 标题缩到 `40 - 56px`
- 规格区改为单列
- 保留黑场和轻字体，不要为了移动端变成普通电商页

## Suggested File Layout

```text
apps/web/src/app/teenage-opxy/page.tsx
apps/web/src/components/template/DirectoryHeader.tsx
apps/web/src/components/template/HardwareHero.tsx
apps/web/src/components/template/SpecList.tsx
```

如果只是风格验证，允许先全部写在单文件里。确认方向后再拆分。

## Validation Checklist

- 首屏是否只有一个主对象
- 大标题是否够轻
- 页面是否主要由黑灰白构成
- 规格区是否可读且像手册
- 商店卡片是否保持目录感
- 整页是否没有落入 SaaS 视觉习惯

## Example

需要一份可直接复制的页面骨架时，读取：

- `examples/nextjs-tailwind-product-page.tsx`
