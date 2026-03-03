---
version: 0.2.4-beta.1
date: 2026-03-03
---

## 🐛 问题修复

- 修复 Windows 环境下 PATH 解析问题，确保正确找到 Python 和 CLI 工具路径
- 修复 Server 作为 Electron 子进程运行时 PATH 环境变量未正确继承的问题
- 修复 macOS 发布时 YML 文件合并异常导致自动更新失效的问题
- 修复 Windows 增量更新写入文件时出现 EPERM 权限错误的问题
