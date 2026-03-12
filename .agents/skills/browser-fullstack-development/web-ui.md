
## Overview

Web 侧负责浏览器面板 UI、`browserTabs` 状态，以及 `open-url` 的前端执行链路。核心组件是 `ElectrronBrowserWindow`。

## Core Components

- `ElectrronBrowserWindow.tsx`
  - 管理浏览器子标签、激活 tab、`viewKey` 生成与状态同步。
  - 通过 `openloafElectron.ensureWebContentsView` 获取 `cdpTargetId`。
  - 监听 `openloaf:webcontents-view:status` 更新 loading/ready/error。
  - 监听 `openloaf:webcontents-view:window-open` 转成新标签页。
- `BrowserTabsBar.tsx`
  - 负责标签栏切换、新建、关闭和地址输入。
- `BrowserProgressBar.tsx`
  - 负责顶部加载进度展示。
- `BrowserLoadingOverlay.tsx`
  - 负责加载遮罩、估算进度和下载速度展示。
- `BrowserErrorOverlay.tsx`
  - 负责错误态与重试入口。
- `BrowserHome.tsx`
  - 负责新标签页内容。

## Data Model & Flow

- `BrowserTab` 定义在 `packages/api/src/types/tabs.ts`。
- `browserTabs` 存在 stack item 的 `params` 中，由 `normalizeBrowserWindowItem` 统一合并。
- `params.__open` 用于从外部入口追加并激活新标签。
- `params.browserTabs` 用于 UI 内部全量覆盖标签状态。
- `params.activeBrowserTabId` 存放当前激活标签。
- `open-url` 前端执行时会生成新的 `viewKey`，然后通过 `pushStackItem` 注入 `__open`。
- Electron 环境下会等待 `waitForWebContentsViewReady(viewKey)` 回执。

## Storage

- `browser-storage.ts` 使用 localStorage 持久化收藏夹和最近关闭标签。
- UI 通过 `openloaf:browser-storage` 事件刷新本地状态。

## UI Event Channels

- `openloaf:webcontents-view:status`
  - Electron 主进程回推 loading/ready/error/favIcon/网络统计。
- `openloaf:webcontents-view:window-open`
  - 主进程拦截 `window.open` 后转成 renderer 侧的新标签事件。

## Notes

- `normalizeUrl` 在多个浏览器 UI 组件之间复用。
- `viewKey` 当前基于 `tabId/chatSessionId/browserTabId` 生成，不再拼接历史工作空间标识。
- tab snapshot 由 `upsertTabSnapshotNow` 上报给 server，确保后续 CDP 工具可用。
