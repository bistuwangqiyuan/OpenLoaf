# External Skill Extensions

本文件只记录“什么时候值得补充外部 skill”，不是必须执行的步骤。

## Code Links

| 入口 | 作用 |
|------|------|
| [SKILL.md](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/.agents/skills/web-style-system/SKILL.md) | Web 风格系统总览 |
| [project-map.md](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/.agents/skills/web-style-system/references/project-map.md) | 当前 web 代码入口地图 |
| [style-dna-layout-tabs.md](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/.agents/skills/web-style-system/references/style-dna-layout-tabs.md) | 当前站点风格母版 |
| [apps/web/src/components/layout](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/apps/web/src/components/layout) | layout 结构入口 |
| [apps/web/src/components](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/apps/web/src/components) | 主要组件目录 |

## 使用原则

- 优先使用当前仓库已有的 skill 完成主流程
- 只有在现有 skill 覆盖不足，或者用户明确要求扩展能力时，才考虑外部 skill
- 外部 skill 只能作为补充参考，最终输出仍要回收为 OpenLoaf 自己的设计语义与实现约束

## 先看仓库内可联动的 skill

| skill | 适用场景 |
|------|----------|
| `skill-development` | 调整 skill 结构、front matter、progressive disclosure 质量 |
| `web-layout-structure` | 需要先理解 `layout`、`sidebar`、`dock` 结构再做风格改造 |
| `frontend-design` | 需要为新页面或组件产出强风格的实现方案 |
| `web-design-guidelines` | 需要做 UI/UX 评审或一致性审查 |
| `find-skills` | 需要检索或安装额外 skill |

## 外部候选的使用条件

只有在下面任一情况成立时，才值得继续看外部候选：

- 仓库内 skill 无法覆盖特定设计方法论
- 需要额外的无障碍、设计系统或审计知识
- 用户明确要求引入外部最佳实践

候选方向可包括：

- 设计系统规划
- UI 审计
- 可访问性审计
- 风格重构方法论

## 评估标准

引入外部 skill 前，至少检查：

- 是否与当前任务直接相关，而不是泛泛重复已有 skill
- 输出风格是否容易映射回当前仓库的 token、layout 和组件约束
- 是否会引入与现有规范冲突的术语或分层方式
- 是否需要额外安装或联网检索；若需要，应先确认这一步真的有价值

## Working Rules

- 只写规则和代码链接，不放示例代码
- 仓库内 skill 足够时，不主动推荐外部依赖
- 需要外部 skill 时，先说明缺口在哪里，再给候选方向
- 外部 skill 给出的建议必须经过本仓库规则过滤，不能原样当作最终规范
