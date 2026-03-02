---
version: 0.2.1
date: 2026-03-02
---

## New Features

- Complete internationalization (i18n) system based on react-i18next, supporting Simplified Chinese, Traditional Chinese, and English
- Real-time UI language switching in Settings
- Tool name internationalization (45 tool IDs translated into 3 languages)
- 7 translation namespaces (common, nav, ai, settings, workspace, tasks, board)
- 2699 translation keys

## Improvements

- Migrate 50+ frontend components to i18next multi-language support
  - Navigation: Sidebar, SidebarProject, SidebarWorkspace
  - AI Chat: ChatInput, ChatModeSelector, Chat, ApprovalModeSelector, MessageHelper
  - Settings: BasicSettings, Workspace, ProviderManagement, ProviderDialog, ModelDialog, ConfirmDeleteDialog, LocalAccess, SkillsSettingsPanel, SchedulerTaskHistoryPanel, AgentManagement, AuxiliaryModelSettings, KeyboardShortcuts
  - Task Management: TaskBoardPage, BoardToolbar, ScheduledTaskDialog, ScheduledTaskList, TaskTemplateDialog, TaskDetailPanel
  - File System: ProjectTree, FileSystem components
  - Project Settings: ProjectBasicSettings, SelectMode, and other subpages
  - AI Session: SessionItem, MessageAiAction, TaskTool, AI Debug components
  - Email and Search components
- Tab titles support i18next dynamic translation

## Fixes

- Fix KeyboardShortcuts using colon instead of dot as namespace separator
- Fix workspace namespace key resolution in Workspace.tsx and SidebarWorkspace.tsx
- Fix settings menu and workspace name not updating on language change
- Move i18n init import from Server Component to Client Component
- Repair corrupted settings.json locale files
- Fix SessionItem rename toast messages to use common namespace
