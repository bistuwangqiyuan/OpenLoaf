---
version: 0.2.1
date: 2026-03-02
---

## 新功能

- 完整的国际化（i18n）系统，基于 react-i18next，支持简体中文、繁体中文、英文
- 设置页面实时切换 UI 语言
- 工具名称国际化（45 个工具 ID 三语翻译）
- 7 个翻译命名空间（common、nav、ai、settings、workspace、tasks、board）
- 2699 个翻译键

## 改进

- 迁移 50+ 前端组件至 i18next 多语言支持
  - 导航栏：Sidebar、SidebarProject、SidebarWorkspace
  - AI 对话：ChatInput、ChatModeSelector、Chat、ApprovalModeSelector、MessageHelper
  - 设置页面：BasicSettings、Workspace、ProviderManagement、ProviderDialog、ModelDialog、ConfirmDeleteDialog、LocalAccess、SkillsSettingsPanel、SchedulerTaskHistoryPanel、AgentManagement、AuxiliaryModelSettings、KeyboardShortcuts
  - 任务管理：TaskBoardPage、BoardToolbar、ScheduledTaskDialog、ScheduledTaskList、TaskTemplateDialog、TaskDetailPanel
  - 文件系统：ProjectTree、FileSystem 组件
  - 项目设置：ProjectBasicSettings、SelectMode 等子页面
  - AI 会话：SessionItem、MessageAiAction、TaskTool、AI Debug 组件
  - 邮件与搜索组件
- Tab 标题支持 i18next 动态翻译

## 修复

- 修复 KeyboardShortcuts 使用冒号而非点号作为命名空间分隔符
- 修复 Workspace.tsx 和 SidebarWorkspace.tsx 工作空间命名空间键解析
- 修复设置菜单和工作空间名称切换语言后不更新
- 修复 i18n 初始化从 Server Component 移至 Client Component
- 修复损坏的 settings.json 翻译文件
- 修复 SessionItem 重命名 toast 消息使用 common 命名空间
