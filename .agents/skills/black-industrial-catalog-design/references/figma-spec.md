
## File Structure

建议按 3 个页面组织：

1. `00 Foundations`
2. `01 Components`
3. `02 Product Page Templates`

### Color Styles

- `surface/base` `#000000`
- `surface/elevated` `#0f0f10`
- `surface/card` `#e5e5e5`
- `surface/card-2` `#cbcbcb`
- `text/primary` `#f5f5f5`
- `text/secondary` `#a1a1a1`
- `text/dark` `#111111`
- `line/subtle` `rgba(255,255,255,0.10)`
- `accent/record` `#d92626`
- `accent/info` `#0071bb`

### Spacing Tokens

- `4`
- `8`
- `12`
- `16`
- `24`
- `32`
- `48`
- `72`
- `96`
- `144`

### Radius Tokens

- `sm 10`
- `md 14`
- `lg 20`
- `xl 28`

### Grid

Desktop：

- frame `1440`
- grid `12 columns`
- margin `72`
- gutter `16`

Mobile：

- frame `390`
- grid `4 columns`
- margin `20`
- gutter `12`

### Typography

建议样式：

- `Display/XL` `88 / 0.96 / Light`
- `Display/L` `64 / 0.98 / Light`
- `Heading/M` `44 / 1.04 / Light`
- `Body/L` `24 / 1.35 / Light`
- `Body/M` `18 / 1.45 / Light`
- `Meta/S` `12 / 1.2 / Light`
- `Spec/S` `14 / 1.35 / Light`

如没有商用字体，先用：

- `Helvetica Neue`
- `Nimbus Sans`

### Directory Nav

用途：

- 用作目录式头部
- 承担品牌、栏目、子项导航

规则：

- 标题大于子项，但仍然保持轻字重
- 通过分组、间距和列宽建立层级
- 不要加厚边框和饱和底色

### Hero Label

用途：

- 标识型号、系列、年份、分类

规则：

- 小尺寸
- 可以用细边框或黑底浅字
- 文案控制在 `2 - 8` 个字符或短词

### Primary CTA

用途：

- 购买
- 查看详情
- 进入目录

规则：

- 高度 `40 - 48`
- 形态像标签、胶囊或分段块
- 文案极短
- 不要做大面积高饱和色

### Product Card

用途：

- 配件
- 周边
- 商品列表

规则：

- 浅灰底
- 大图先行
- 标题和价格像目录标签
- 不要做卡片阴影

### Spec List

用途：

- 参数清单
- 技术规格
- 连接口、材料、尺寸

规则：

- 双列或多列排版
- 分类名亮、参数值暗
- 通过空行和组距建立结构

## Page Template

建议一个标准产品页按以下顺序：

1. `Directory Header`
2. `Hero`
3. `Statement Section`
4. `Feature Grid`
5. `Editorial Image Section`
6. `Specs`
7. `Accessories / Shop`
8. `Minimal Footer`

## Handoff Checklist

- 黑场是否足够纯净
- 主对象是否绝对主导
- 标题是否过粗
- CTA 是否过像营销按钮
- 卡片是否出现重阴影
- 规格区是否像说明书
- 移动端是否仍保留目录感
