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

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { PenTool } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { skipToken } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { useTabs } from "@/hooks/use-tabs";
import { useTabRuntime } from "@/hooks/use-tab-runtime";
import { useNavigation } from "@/hooks/use-navigation";
import { useWorkspace } from "@/components/workspace/workspaceContext";
import { buildFileUriFromRoot } from "@/components/project/filesystem/utils/file-system-utils";
import { BOARD_META_FILE_NAME, getBoardDisplayName } from "@/lib/file-name";

interface WorkspaceCanvasListProps {
  workspaceId: string;
}

export function WorkspaceCanvasList({ workspaceId }: WorkspaceCanvasListProps) {
  const { t } = useTranslation("nav");
  const { workspace } = useWorkspace();
  const rootUri = workspace?.rootUri;

  const boardsDirUri = rootUri
    ? buildFileUriFromRoot(rootUri, ".openloaf/boards")
    : "";

  const addTab = useTabs((s) => s.addTab);
  const setActiveTab = useTabs((s) => s.setActiveTab);
  const tabs = useTabs((s) => s.tabs);
  const runtimeByTabId = useTabRuntime((s) => s.runtimeByTabId);
  const setActiveView = useNavigation((s) => s.setActiveView);

  const { data } = useQuery(
    trpc.fs.list.queryOptions(
      boardsDirUri
        ? {
            workspaceId,
            uri: ".openloaf/boards",
            includeHidden: true,
            sort: { field: "mtime", order: "desc" },
          }
        : skipToken,
    ),
  );

  const boards = (data?.entries ?? []).filter((e: any) => e.kind === "folder");

  const handleBoardClick = useCallback(
    (board: { uri: string; name: string }) => {
      if (!rootUri) return;
      const boardFolderUri = buildFileUriFromRoot(rootUri, board.uri);
      const boardFileUri = buildFileUriFromRoot(
        rootUri,
        `${board.uri}/${BOARD_META_FILE_NAME}`,
      );
      const baseId = `board:${boardFolderUri}`;

      // Check if already open in a tab
      const existingTab = tabs.find((tab) => {
        if (tab.workspaceId !== workspaceId) return false;
        const base = runtimeByTabId[tab.id]?.base;
        return base?.id === baseId;
      });

      if (existingTab) {
        setActiveTab(existingTab.id);
      } else {
        const displayName = getBoardDisplayName(board.name) || t("canvasList.untitled");
        addTab({
          workspaceId,
          createNew: true,
          title: displayName,
          icon: "🎨",
          leftWidthPercent: 100,
          base: {
            id: baseId,
            component: "board-viewer",
            params: { boardFolderUri, boardFileUri },
          },
        });
      }

      setActiveView("canvas" as any);
    },
    [rootUri, workspaceId, tabs, runtimeByTabId, addTab, setActiveTab, setActiveView, t],
  );

  // Find which board is currently active
  const activeTabId = useTabs((s) => s.activeTabId);
  const activeBase = activeTabId ? runtimeByTabId[activeTabId]?.base : undefined;
  const activeBoardBaseId =
    activeBase?.component === "board-viewer" ? activeBase.id : undefined;

  if (boards.length === 0) {
    return null;
  }

  return (
    <div className="workspace-canvas-list flex flex-col">
      <div className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground/70">{t('canvas')}</div>
      <div className="px-2 space-y-0.5">
        {boards.map((board: any) => {
          const boardFolderUri = rootUri
            ? buildFileUriFromRoot(rootUri, board.uri)
            : "";
          const baseId = `board:${boardFolderUri}`;
          const isActive = activeBoardBaseId === baseId;
          const displayName = getBoardDisplayName(board.name) || t("canvasList.untitled");

          return (
            <div
              key={board.uri}
              className={`group/canvas-item flex h-8 items-center gap-2 rounded-lg px-2 text-sm hover:bg-[var(--sidebar-project-accent)] dark:hover:bg-[var(--sidebar-project-accent)] cursor-pointer ${
                isActive
                  ? "bg-[var(--sidebar-project-accent)] dark:bg-[var(--sidebar-project-accent)]"
                  : ""
              }`}
              onClick={() => handleBoardClick(board)}
            >
              <PenTool className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate min-w-0">{displayName}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
