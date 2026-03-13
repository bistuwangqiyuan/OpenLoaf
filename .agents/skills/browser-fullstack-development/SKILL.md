---
name: browser-fullstack-development
description: Use when building, extending, or debugging the in-app browser system across web UI, Electron WebContentsView/IPC, server tools, CDP automation, or tab snapshot/open-url ack flows (viewKey mismatch, cdpTargetId missing, loading stuck, tool ack timeout).
---

## Overview

OpenLoaf 的内置浏览器由三层协作完成：
1) Web UI 的浏览器面板与子标签（Renderer）。
2) Electron 主进程的 WebContentsView 生命周期与事件推送。
3) Server 侧的 open-url 工具、CDP 自动化与 tab 快照存储。

核心绑定点是 `viewKey` 与 `cdpTargetId`：前者让 UI 能正确匹配主进程事件，后者让 Server 通过 CDP 精准控制当前页。

## When to Use

- 新增/修改浏览器面板 UI（Tabs/Loading/Error/Home/Progress）
- 调整 browserTabs 的生成、合并、持久化与激活逻辑
- 修改 Electron WebContentsView 行为或 IPC 桥接
- 调整 open-url 前端工具执行或 ack 回执链路
- 开发/维护浏览器自动化（browser-* tools, CDP）
- 排查加载卡住、viewKey 匹配失败、cdpTargetId 丢失、open-url 超时等问题

## Key Invariants

- `viewKey` 必须唯一且稳定，用于匹配 `openloaf:webcontents-view:status` 事件。
- `browserTabs` 只存放在 stack item `params` 中，必须通过 `normalizeBrowserWindowItem` 合并。
- `cdpTargetIds` 必须写回当前激活的 browser tab，并及时 `upsertTabSnapshotNow`。
- `open-url` 是前端工具执行链路，不走 runtime UI event。

## Detailed References

- [web-ui.md](web-ui.md) - 组件职责、browserTabs 数据流、storage 与事件。
- [electron-runtime.md](electron-runtime.md) - WebContentsView、IPC、status/window-open 事件、CDP 端口。
- [server-tools.md](server-tools.md) - open-url 工具、ack、CDP 自动化与 tab 快照。
- [troubleshooting.md](troubleshooting.md) - 常见问题与排查清单。

## Quick Reference

| Task | Files |
| --- | --- |
| Add/adjust browser UI | `apps/web/src/components/browser/*` |
| Change browserTabs merge logic | `apps/web/src/hooks/browser-panel.ts` |
| Open URL tool flow | `apps/server/src/ai/tools/openUrl.ts`, `apps/web/src/lib/chat/frontend-tool-executor.ts` |
| WebContentsView behavior | `apps/desktop/src/main/ipc/webContentsViews.ts` |
| CDP automation errors | `apps/server/src/ai/tools/browserAutomationTools.ts`, `apps/server/src/modules/browser/cdpClient.ts` |
| Tab snapshot/cdpTargetId | `apps/web/src/lib/tab-snapshot.ts`, `apps/server/src/modules/tab/TabSnapshotStoreAdapter.ts` |

## Common Mistakes

- `viewKey` 为空或复用，导致 status 事件无法匹配、页面永远 loading。
- 直接覆盖 `browserTabs` 而没走 `normalizeBrowserWindowItem` 合并逻辑。
- `cdpTargetId` 没写回或没上报快照，导致 `browser-act` 报错。
- 将 open-url 当作 server-side tool 执行，忽略前端 ack 机制。
- Electron 端发出的 `openloaf:webcontents-view:*` 事件未监听，导致 UI 不更新。

## Skill Sync Policy

| 变更范围 | 需更新文档 |
| --- | --- |
| `apps/web/src/components/browser/*` 组件变更 | web-ui.md |
| `browser-panel.ts` / `use-tab-runtime.ts` 变更 | web-ui.md |
| `webContentsViews.ts` / IPC 变更 | electron-runtime.md |
| `openUrl.ts` / `frontend-tool-executor.ts` 变更 | server-tools.md + web-ui.md |
| `browserAutomationTools.ts` / `cdpClient.ts` 变更 | server-tools.md |
| `TabSnapshotStoreAdapter.ts` 变更 | server-tools.md |
| `packages/api/src/types/tools/browser*.ts` 变更 | SKILL.md + server-tools.md |
