---
version: 0.2.5-beta.8
date: 2026-03-08
---

## ✨ 新功能

- AI Agent 模板系统重构为动态注册架构，移除独立子 Agent 模板，统一由 agentFactory 动态管理
- 新增 PDF 工具和 PPTX 工具支持
- 新增 Office 引擎架构
- 设置页新增「打开日志目录」功能

## 🚀 改进

- Excel/Word 工具全面重构，优化工具定义和参数结构
- 子进程管理改进：detached 模式 + 进程组信号，确保退出时清理整棵进程树
- 聊天界面文件拖放体验优化
- 设置页面和关于页面 UI 重构
- 文件系统模型和拖拽交互改进

## 🗑️ 废弃

- 移除 WPS 集成
- 移除旧版 officeTools

## 🔧 重构

- AI Agent 工具注册和能力组重构
- Sub-agent preface builder 和 prompt builder 优化
- 云模型映射和 provider 适配器更新

## 🌐 国际化

- 新增 AI 工具和设置相关翻译键
