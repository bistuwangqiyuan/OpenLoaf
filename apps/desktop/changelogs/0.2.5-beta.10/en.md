---
version: 0.2.5-beta.10
date: 2026-03-10
---

## ✨ New Features

- Add inline HLS video playback in canvas VideoNode with hls.js
- Add "Edit" toolbar for sent chat input nodes (creates editable copy)
- Add connected node creation from chat message nodes with auto-placement
- Add feedback shortcut (Mod+Shift+U)
- Add Board database table for canvas persistence

## 🚀 Improvements

- Refactor MediaGenerateTool error parsing with structured error codes and retry support
- Organize chat attachments into asset/ subdirectory
- Add warn logging for missing files in fs.readBinary

## 💄 UI Improvements

- Update 7 file viewer components (Code, Doc, Excel, Image, Markdown, FilePreview, FileViewer)
- Refine SelectionOverlay behavior
- Update SidebarWorkspace and PageTitle components

## 🌐 Internationalization

- Update board and settings translation keys (zh-CN, zh-TW, en-US)
- Add keyboard shortcuts i18n entry

## 🐛 Bug Fixes

- Recover lost layout, sidebar, canvas list, and board changes from stash incident
