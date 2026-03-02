---
version: 0.2.1
date: 2026-03-02
---

## 新功能

- 完整的国际化（i18n）系统，支持简体中文、繁体中文、英文三种语言
- 设置页面实时切换 UI 语言
- AI Agent 提示词多语言支持（10 个 Agent 模板双语 prompt）
- 工具名称国际化（45 个工具 ID 三语翻译）
- 聊天命令描述国际化
- tRPC 错误消息国际化框架
- 工作空间默认名称多语言支持（8 种语言预定义）

## 改进

- 迁移 50+ 前端组件至 i18next 多语言支持
  - 导航栏（Sidebar、SidebarProject、SidebarWorkspace）
  - AI 对话（ChatInput、ChatModeSelector、Chat、ApprovalModeSelector）
  - 设置页面（BasicSettings、Workspace、ProviderManagement、AgentManagement 等 15+ 组件）
  - 任务管理（TaskBoardPage、BoardToolbar、ScheduledTaskDialog 等）
  - 文件系统（ProjectTree、FileSystem 组件）
  - 项目设置子页面
- 7 个翻译命名空间（common、nav、ai、settings、workspace、tasks、board）
- 2699 个翻译键
- Tab 标题支持 i18next 动态翻译
- 日历组件事件表单 UI 字符串国际化
- 繁体中文（zh-TW）支持添加至日历和 API 语言 schema
- 设置服务 uiLanguage 白名单增加 zh-TW
- 技能系统文档完善

## 修复

- 修复 KeyboardShortcuts 使用冒号而非点号作为命名空间分隔符
- 修复工作空间命名空间键解析问题
- 修复设置菜单和工作空间名称切换语言后不更新
- 修复 i18n 初始化从 Server Component 移至 Client Component
- 修复损坏的 settings.json 翻译文件
- 修复编码问题和多语言 prompt 导出
