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

import { useMemo } from "react";
import { useTabs } from "@/hooks/use-tabs";

/** Collect all open session ids across all tabs. */
export function useOpenSessionIds() {
  const tabs = useTabs((s) => s.tabs);

  return useMemo(() => {
    const openSessionIds = new Set<string>();
    const sessionToTabId = new Map<string, string>();

    for (const tab of tabs) {
      const ids =
        Array.isArray(tab.chatSessionIds) && tab.chatSessionIds.length > 0
          ? tab.chatSessionIds
          : [tab.chatSessionId];
      for (const sid of ids) {
        if (typeof sid === "string" && sid) {
          openSessionIds.add(sid);
          // 首次出现的 tab 优先（后续打开的不覆盖）
          if (!sessionToTabId.has(sid)) {
            sessionToTabId.set(sid, tab.id);
          }
        }
      }
    }

    return { openSessionIds, sessionToTabId };
  }, [tabs]);
}
