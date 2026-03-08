---
version: 0.2.5-beta.8
date: 2026-03-08
---

## ✨ New Features

- Refactored AI Agent template system to dynamic registry architecture, removed individual sub-agent templates, unified under agentFactory
- Added PDF and PPTX tool support
- Added Office engine architecture
- Added "Open Logs Folder" option in settings

## 🚀 Improvements

- Comprehensive refactor of Excel/Word tools with optimized definitions and parameters
- Improved child process management: detached mode + process group signals for complete process tree cleanup on exit
- Enhanced chat file drag-and-drop experience
- Redesigned settings page and about page UI
- Improved file system model and drag interactions

## 🗑️ Deprecated

- Removed WPS integration
- Removed legacy officeTools

## 🔧 Refactoring

- Refactored AI Agent tool registration and capability groups
- Optimized sub-agent preface builder and prompt builder
- Updated cloud model mapper and provider adapters

## 🌐 Internationalization

- Added translation keys for AI tools and settings
