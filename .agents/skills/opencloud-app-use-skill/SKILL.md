---
name: opencloud-app-use-skill
description: >
  Use when developing or using OpenLoaf app skill system — app 里面的技能系统
---

## Overview

OpenLoaf 技能系统由四层组成：

- `SKILL.md` 文件规范
- 服务端摘要扫描
- 运行时 `SkillSelector` 正文解析
- 前端 `SkillsSettingsPanel` 管理面板

当前实现里，技能启用状态只会持久化到两类配置：

- 全局应用配置
- 当前项目配置

历史 `workspace` 只保留兼容说明，不再是现行 scope。

## When to Use

- 创建新的 `SKILL.md`
- 修改技能扫描目录、优先级或覆盖逻辑
- 修改 front matter 解析规则
- 修改技能启用、禁用、删除或 ignoreKey 逻辑
- 修改设置面板中的技能列表展示和交互
- 调试技能未加载、未显示、优先级异常、继承来源错误

## Current Scope Model

- settings 对外 schema 只支持 `project | global`
- 摘要扫描来源覆盖顺序是 `global -> parent-project -> project`
- 运行时正文搜索优先级是 `project -> parent-project -> global`
- 父项目技能属于“继承来源”，不是新的持久化 scope
- 历史 `workspace:<folderName>` 输入只用于服务端兼容归一化，最终会转换成 `global:<folderName>`

## Code Links

| 代码 | 作用 |
|------|------|
| [skillsLoader.ts](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/apps/server/src/ai/services/skillsLoader.ts) | 扫描技能摘要、合并来源、生成基础列表 |
| [SkillSelector.ts](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/apps/server/src/ai/tools/SkillSelector.ts) | 运行时解析 `/skill/<name>` 并按优先级读取正文 |
| [settings.ts](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/apps/server/src/routers/settings.ts) | 计算 `ignoreKey`、启用状态、删除权限 |
| [absSetting.ts](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/packages/api/src/routers/absSetting.ts) | settings 对外 skill schema |
| [SkillsSettingsPanel.tsx](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/apps/web/src/components/setting/skills/SkillsSettingsPanel.tsx) | 技能设置面板 UI |

## Detailed References

| 文件 | 内容 | 查阅时机 |
|------|------|----------|
| [skill-format.md](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/.agents/skills/opencloud-app-use-skill/skill-format.md) | 技能目录结构、front matter、覆盖规则 | 创建新技能或调整技能格式 |
| [skill-backend.md](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/.agents/skills/opencloud-app-use-skill/skill-backend.md) | 扫描加载器、`SkillSelector`、settings 规则 | 修改后端技能逻辑 |
| [skill-frontend.md](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/.agents/skills/opencloud-app-use-skill/skill-frontend.md) | 设置面板 UI、scope 展示、启用/删除交互 | 修改前端技能管理 UI |

## Working Rules

- 只写规则和代码链接，不放示例代码。
- 只要 scope、优先级、ignoreKey 或删除权限发生变化，必须同时更新 backend 与 frontend 两侧说明。
- 只要扫描目录或 front matter 解析规则发生变化，必须同步更新 `skill-format.md`。
- 只要 settings 面板展示语义变化，必须重新核对 `skill.scope`、`ownerProjectId`、`isEnabled`、`isDeletable` 的来源是否仍正确。

## Skill Sync Policy

| 变更范围 | 需更新的文件 |
|----------|-------------|
| `skillsLoader.ts` 扫描逻辑或类型变更 | `skill-backend.md` |
| `SkillSelector.ts` 搜索逻辑变更 | `skill-backend.md` |
| `settings.ts` 技能相关 tRPC 路由变更 | `skill-backend.md` |
| `absSetting.ts` 中 skill schema 变更 | `skill-backend.md`、`skill-frontend.md` |
| `SkillsSettingsPanel.tsx` UI 变更 | `skill-frontend.md` |
| `SKILL.md` front matter 规则变更 | `skill-format.md` |
| 新增技能存储目录 | `skill-format.md`、`skill-backend.md` |

同步规则：修改上述文件后，在提交前检查对应 skill 文件是否需要更新，确保文档仍与现行实现一致。
