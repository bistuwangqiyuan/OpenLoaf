# Skill Format

## 目录结构

- 一个 skill 对应一个独立目录。
- 每个目录必须包含一个 `SKILL.md`。
- 可选支持文档放在同目录或子目录中，由 `SKILL.md` 按需引用。
- 支持文档只写规则和代码链接，不放示例代码。

## 存储位置与现行 Scope

| 位置 | 角色 | 对外 scope | 说明 |
|------|------|-----------|------|
| `~/.agents/skills/<skill-name>/` | 全局技能目录 | `global` | 跨所有项目共享，作为全局根目录直接扫描 |
| `<ancestor-project>/.agents/skills/<skill-name>/` | 父项目继承来源 | 不对外暴露 | 只参与继承与搜索，不是 settings 新 scope |
| `<project>/.agents/skills/<skill-name>/` | 当前项目技能目录 | `project` | 当前项目自己的技能，优先级最高 |

补充说明：

- settings 接口当前只支持 `project | global`
- `parent-project` 是运行时搜索与继承概念，不是前端 toggle/delete 时可传的 scope
- 历史 `workspace:<folderName>` 只在服务端归一化阶段兼容，不应继续写入新文档或新逻辑

## Code Links

| 代码 | 作用 |
|------|------|
| [skillsLoader.ts](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/apps/server/src/ai/services/skillsLoader.ts) | 摘要加载与来源覆盖 |
| [SkillSelector.ts](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/apps/server/src/ai/tools/SkillSelector.ts) | 正文搜索优先级 |
| [settings.ts](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/apps/server/src/routers/settings.ts) | `ignoreKey`、启用和删除边界 |
| [absSetting.ts](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/packages/api/src/routers/absSetting.ts) | settings 对外 scope schema |

## Front Matter

系统当前只解析 `SKILL.md` front matter 中的两个字段：

### `name`

- 作为技能标识符，用于同名覆盖判断和 `/skill/<name>` 引用
- 推荐使用英文小写加连字符
- 未提供时，后端会回退到文件夹名称
- 匹配时会先做名称规范化，大小写不敏感

### `description`

- 用于设置面板展示和技能列表搜索
- 多行描述会被折叠为单行文本
- 未提供时，不影响技能正文解析，只影响列表展示

## 正文写法

- front matter 之后的 Markdown 正文才是 Agent 实际读取的指令内容
- 正文优先写适用场景、关键入口、流程、约束、检查点、常见错误
- 需要拆分时，用相对路径引用同目录支持文档
- 规则文档以现行实现为准，不保留历史示例代码，不用示例代码定义约束

## 技能引用与匹配

- 用户通过 `/skill/<name>` 引用技能
- `SkillSelector` 会先提取文本中的 skill 名称，再按搜索优先级读取正文
- 同名 skill 的命中结果依赖当前项目上下文，不是简单的全局唯一匹配

## 优先级与覆盖规则

### 摘要加载

- settings 列表的摘要覆盖顺序是 `global -> parent-project -> project`
- 摘要阶段的父项目技能仍会以项目来源的形式出现在结果中，由 `ownerProjectId` 与 `ignoreKey` 区分来源

### 运行时正文解析

- `SkillSelector` 的搜索优先级是 `project -> parent-project -> global`
- 当前项目同名 skill 总是优先于父项目与全局 skill
- 父项目技能位于当前项目与全局之间，用于继承覆盖

## 维护检查点

- 修改 front matter 解析逻辑时，更新 `opencloud-app-use-skill/SKILL.md` 与 `skill-backend.md`
- 修改 scope、ignoreKey 或启用状态逻辑时，同时更新 `skill-backend.md` 与 `skill-frontend.md`
- 新增新的扫描来源前，先确认它属于“持久化 scope”还是“只读继承来源”，不要混写
