---
version: 0.2.1
date: 2026-03-02
---

## New Features

- Complete internationalization (i18n) system supporting Simplified Chinese, Traditional Chinese, and English
- Real-time UI language switching in Settings
- AI Agent prompt multilingual support (10 agent templates with bilingual prompts)
- Tool name internationalization (45 tool IDs translated into 3 languages)
- Chat command description internationalization
- tRPC error message internationalization framework
- Workspace default names multilingual support (8 languages predefined)

## Improvements

- Migrate 50+ frontend components to i18next multi-language support
  - Navigation (Sidebar, SidebarProject, SidebarWorkspace)
  - AI Chat (ChatInput, ChatModeSelector, Chat, ApprovalModeSelector)
  - Settings (BasicSettings, Workspace, ProviderManagement, AgentManagement, and 15+ components)
  - Task Management (TaskBoardPage, BoardToolbar, ScheduledTaskDialog, etc.)
  - File System (ProjectTree, FileSystem components)
  - Project settings subpages
- 7 translation namespaces (common, nav, ai, settings, workspace, tasks, board)
- 2699 translation keys
- Tab titles support i18next dynamic translation
- Calendar event form UI string internationalization
- Add Traditional Chinese (zh-TW) support to Calendar and API language schema
- Add zh-TW to uiLanguage whitelist in settings service
- Enhance skill system documentation

## Fixes

- Fix KeyboardShortcuts using colon instead of dot as namespace separator
- Fix workspace namespace key resolution
- Fix settings menu and workspace name not updating on language change
- Move i18n init import from Server Component to Client Component
- Repair corrupted settings.json locale files
- Fix encoding issues and multilingual prompt exports
