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

import { useEffect } from "react";
import { DEFAULT_TAB_INFO } from "@openloaf/api/common";
import { openProjectShell } from "@/lib/project-shell";
import { getProjectWindowBootstrapPayload } from "@/lib/window-mode";
import { useTabs } from "@/hooks/use-tabs";
import { useProjectStorageRootQuery } from "@/hooks/use-project-storage-root-uri";

/**
 * Bootstrap compatibility workspace side effects.
 */
export function WorkspaceBootstrap() {
  const { isLoading } = useProjectStorageRootQuery();
  const addTab = useTabs((state) => state.addTab);
  const tabs = useTabs((state) => state.tabs);
  const activeTabId = useTabs((state) => state.activeTabId);
  const workspaceId = "default";

  useEffect(() => {
    document.cookie = `workspace-id=${encodeURIComponent(workspaceId)}; path=/; max-age=31536000; SameSite=Lax`;
  }, [workspaceId]);

  useEffect(() => {
    if (isLoading) return;
    if (activeTabId) return;
    if (tabs.length > 0) return;

    const projectWindowPayload = getProjectWindowBootstrapPayload();
    if (projectWindowPayload) {
      openProjectShell({
        projectId: projectWindowPayload.projectId,
        rootUri: projectWindowPayload.rootUri,
        title: projectWindowPayload.title,
        icon: projectWindowPayload.icon,
        section: "assistant",
      });
      return;
    }

    // 逻辑：首次启动且无任何标签页时，补一个默认 AI 标签页，保持旧行为不变。
    addTab({
      createNew: true,
      title: DEFAULT_TAB_INFO.titleKey,
      icon: DEFAULT_TAB_INFO.icon,
      leftWidthPercent: 0,
      rightChatCollapsed: false,
    });
  }, [isLoading, activeTabId, tabs.length, addTab]);

  return null;
}
