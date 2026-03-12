---
name: file-system-development
description: Use when developing, extending, or debugging the file preview/viewer system, file system operations, file browser UI, or backend fs tRPC routes — adding viewers, file operations, drag-drop, context menus, or fixing preview/upload/download issues
---

## Overview

OpenLoaf 的文件系统由**预览查看器**（11 种 Viewer 组件）、**文件操作模型**（CRUD/拖拽/历史）、**预览分发系统**（Store + 类型路由 + 三种打开模式）、**后端 tRPC 路由**四层构成。

## When to Use

- 添加或修改文件查看器（image/video/code/markdown/pdf/doc/sheet/terminal）
- 修改文件打开逻辑、预览弹窗、Stack 面板集成
- 修改文件系统操作（CRUD、拖拽、重命名、复制粘贴、撤销重做）
- 修改文件选择、框选、右键菜单行为
- 修改后端 `fs` tRPC 路由（读写/缩略图/搜索）
- 调试文件预览、大文件处理、Office 文件路由问题

## Detailed References

| 文件 | 内容 | 查阅时机 |
|------|------|----------|
| [viewer-development.md](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/.agents/skills/file-system-development/viewer-development.md) | Viewer 开发指南、类型映射、Props 模式、错误处理 | 添加/修改文件查看器 |
| [file-operations.md](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/.agents/skills/file-system-development/file-operations.md) | Model API、CRUD、拖拽、历史、选择、重命名 | 文件操作功能开发 |
| [preview-system.md](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/.agents/skills/file-system-development/preview-system.md) | Store、打开模式、类型路由、最近打开 | 预览/打开逻辑修改 |
| [backend-api.md](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/.agents/skills/file-system-development/backend-api.md) | tRPC fs 路由 API 速查 | 后端文件操作开发 |
| [path-conventions.md](/Users/zhao/Documents/01.Code/Hex/Tenas-All/OpenLoaf/.agents/skills/file-system-development/path-conventions.md) | 文件路径规范、作用域隔离、安全原则、各模块路径处理 | 涉及文件路径传递/解析的所有开发 |

## Skill Sync Policy

**当以下文件发生变更时，应检查并同步更新本 skill：**

| 变更范围 | 需更新的文件 |
|----------|-------------|
| `file-preview-types.ts` 类型变更 | preview-system.md, viewer-development.md |
| `file-viewer-target.ts` 映射变更 | viewer-development.md |
| `open-file.ts` 打开逻辑变更 | preview-system.md |
| `file-preview-store.ts` Store 变更 | preview-system.md |
| `open-file-preview.tsx` 嵌入渲染变更 | viewer-development.md |
| `viewer-guard.tsx` 兜底组件变更 | viewer-development.md |
| `read-file-error.tsx` 错误处理变更 | viewer-development.md |
| 新增 Viewer 组件 | viewer-development.md (现有 Viewer 参考表) |
| `file-system-model.ts` Model 变更 | file-operations.md |
| `file-system-history.ts` 历史变更 | file-operations.md |
| `use-file-rename.ts` / `use-file-selection.ts` 变更 | file-operations.md |
| `use-file-system-context-menu.ts` 变更 | file-operations.md |
| `use-file-system-drag.ts` / `use-file-system-selection.ts` 变更 | file-operations.md |
| `packages/api/src/routers/fs.ts` 路由变更 | backend-api.md |
| 新增 tRPC fs 操作 | backend-api.md |
| `vfsService.ts` 路径解析变更 | path-conventions.md |
| `workspaceConfig.ts` 配置变更 | path-conventions.md |
| `hlsService.ts` 路径解析变更 | path-conventions.md |
| 新增需要文件路径的 API 端点 | path-conventions.md |

**同步规则**: 修改上述文件后，在提交前检查对应 skill 文件是否需要更新。保持 skill 与代码一致。
