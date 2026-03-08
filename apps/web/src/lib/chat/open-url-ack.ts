/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
"use client";

import type { OpenLoafWebContentsViewStatus } from "@/components/browser/browser-types";

export type WebContentsReadyResult = {
  /** Result status. */
  status: "ready" | "failed";
  /** Source status detail. */
  detail: OpenLoafWebContentsViewStatus;
};

/** Default client-side timeout for waiting on WebContentsView ready (ms). */
const VIEW_READY_TIMEOUT_MS = 45_000;

/** Resolve when a WebContentsView finishes loading for the given viewKey. */
export function waitForWebContentsViewReady(
  viewKey: string,
  timeoutMs = VIEW_READY_TIMEOUT_MS,
): Promise<WebContentsReadyResult | null> {
  const key = viewKey.trim();
  if (!key) return Promise.resolve(null);
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    let settled = false;
    // 中文注释：必须先观察到 loading=true，避免初始状态 loading=false 导致过早回执。
    let sawLoading = false;

    const cleanup = () => {
      window.removeEventListener("openloaf:webcontents-view:status", handler);
      clearTimeout(timer);
    };

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<OpenLoafWebContentsViewStatus>).detail;
      if (!detail || detail.key !== key) return;
      // 中文注释：只有在加载结束或失败时才回执，避免打开后立刻 ack。
      if (detail.failed) {
        if (settled) return;
        settled = true;
        cleanup();
        resolve({ status: "failed", detail });
        return;
      }
      if (detail.loading === true) {
        sawLoading = true;
      }
      const isReady = detail.ready === true || (detail.loading === false && sawLoading);
      if (!isReady) return;
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ status: "ready", detail });
    };

    // 中文注释：前端兜底超时，避免事件永远不触发时 handler 永久挂起、ack 无法发出。
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      window.removeEventListener("openloaf:webcontents-view:status", handler);
      console.warn("[open-url] waitForWebContentsViewReady timed out", { viewKey: key, timeoutMs });
      // 中文注释：超时视为成功（URL 已打开），避免因加载确认超时导致整个工具失败。
      resolve(null);
    }, timeoutMs);

    window.addEventListener("openloaf:webcontents-view:status", handler);
  });
}
