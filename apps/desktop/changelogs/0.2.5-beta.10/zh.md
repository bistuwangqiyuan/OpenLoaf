---
version: 0.2.5-beta.10
date: 2026-03-10
---

## ✨ 新功能

- 画布 VideoNode 新增 HLS 内联视频播放（基于 hls.js）
- 画布聊天输入节点支持"编辑"工具栏（已发送消息可复制编辑）
- 画布聊天消息节点支持创建连接节点并自动排列
- 新增意见反馈快捷键（Mod+Shift+U）
- 新增 Board 数据库表（画布持久化）

## 🚀 改进

- MediaGenerateTool 错误解析重构，支持结构化错误码和重试
- 聊天附件存储路径优化，使用 asset/ 子目录
- 文件系统路由增加文件未找到时的 warn 日志

## 💄 界面优化

- 7 个文件预览组件统一更新（代码、文档、Excel、图片、Markdown 等）
- SelectionOverlay 选区覆盖层优化
- SidebarWorkspace 和 PageTitle 组件调整

## 🌐 国际化

- 更新 board 和 settings 翻译键（zh-CN、zh-TW、en-US）
- 新增键盘快捷键 i18n 条目

## 🐛 问题修复

- 恢复 stash 事件丢失的 layout、sidebar、canvas list 和 board 变更
