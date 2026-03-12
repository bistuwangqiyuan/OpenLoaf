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

import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Palette, Edit2, Trash2, Sparkles, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";
import { useTabs } from "@/hooks/use-tabs";
import { useTabRuntime } from "@/hooks/use-tab-runtime";
import { useNavigation } from "@/hooks/use-navigation";
import { useProjectStorageRootUri } from "@/hooks/use-project-storage-root-uri";
import { useProjects } from "@/hooks/use-projects";
import { buildFileUriFromRoot } from "@/components/project/filesystem/utils/file-system-utils";
import { BOARD_META_FILE_NAME } from "@/lib/file-name";
import { buildBoardChatTabState } from "@/components/board/utils/board-chat-tab";
import { Button } from "@openloaf/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@openloaf/ui/dialog";
import { Input } from "@openloaf/ui/input";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@openloaf/ui/context-menu";
import type { ProjectNode } from "@openloaf/api/services/projectTreeService";

function buildProjectRootUriMap(projects?: ProjectNode[]): Map<string, string> {
  const map = new Map<string, string>();
  const walk = (items?: ProjectNode[]) => {
    items?.forEach((item) => {
      if (item.projectId) map.set(item.projectId, item.rootUri);
      if (item.children?.length) walk(item.children);
    });
  };
  walk(projects);
  return map;
}

export function WorkspaceCanvasList() {
  const { t } = useTranslation("nav");

  const [renameTarget, setRenameTarget] = useState<{
    boardId: string;
    title: string;
    nextTitle: string;
  } | null>(null);
  const [aiNaming, setAiNaming] = useState(false);
  const { data: projects } = useProjects();
  const projectRootUriMap = useMemo(() => buildProjectRootUriMap(projects), [projects]);
  const projectStorageRootUri = useProjectStorageRootUri();

  const queryClient = useQueryClient();

  const addTab = useTabs((s) => s.addTab);
  const setActiveTab = useTabs((s) => s.setActiveTab);
  const tabs = useTabs((s) => s.tabs);
  const runtimeByTabId = useTabRuntime((s) => s.runtimeByTabId);
  const setActiveView = useNavigation((s) => s.setActiveView);

  const { data: boards } = useQuery(
    trpc.board.list.queryOptions({}),
  );

  const resolveBoardRootUri = useCallback(
    (projectId?: string | null) =>
      projectId ? projectRootUriMap.get(projectId) : projectStorageRootUri,
    [projectRootUriMap, projectStorageRootUri],
  );

  const handleBoardClick = useCallback(
    (board: { id: string; title: string; folderUri: string; projectId: string | null }) => {
      const rootUri = resolveBoardRootUri(board.projectId);
      if (!rootUri) return;
      const boardFolderUri = buildFileUriFromRoot(rootUri, board.folderUri);
      const boardFileUri = buildFileUriFromRoot(
        rootUri,
        `${board.folderUri}${BOARD_META_FILE_NAME}`,
      );
      const baseId = `board:${boardFolderUri}`;

      const existingTab = tabs.find((tab) => {
        const base = runtimeByTabId[tab.id]?.base;
        return base?.id === baseId;
      });

      if (existingTab) {
        setActiveTab(existingTab.id);
      } else {
        addTab({
          createNew: true,
          title: board.title || t("canvasList.untitled"),
          icon: "🎨",
          ...buildBoardChatTabState(board.id, board.projectId),
          leftWidthPercent: 100,
          base: {
            id: baseId,
            component: "board-viewer",
            params: {
              boardFolderUri,
              boardFileUri,
              boardId: board.id,
              projectId: board.projectId,
              rootUri,
            },
          },
        });
      }

      setActiveView("canvas-list");
    },
    [resolveBoardRootUri, tabs, runtimeByTabId, addTab, setActiveTab, setActiveView, t],
  );

  // Rename via DB
  const updateMutation = useMutation(
    trpc.board.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.board.list.queryKey() });
        setRenameTarget(null);
      },
    }),
  );

  const handleCanvasRename = useCallback(
    (boardId: string, title: string) => {
      setRenameTarget({ boardId, title, nextTitle: title });
    },
    [],
  );

  const handleCanvasRenameSave = useCallback(() => {
    if (!renameTarget || !renameTarget.nextTitle.trim()) return;
    updateMutation.mutate({
      boardId: renameTarget.boardId,
      title: renameTarget.nextTitle.trim(),
    });
  }, [renameTarget, updateMutation]);

  const inferBoardNameMutation = useMutation(
    trpc.settings.inferBoardName.mutationOptions(),
  );

  const handleAiName = useCallback(async () => {
    if (!renameTarget) return;
    setAiNaming(true);
    try {
      // For AI naming, we still use the folder URI approach
      const board = boards?.find((b) => b.id === renameTarget.boardId);
      if (!board) return;
      const result = await inferBoardNameMutation.mutateAsync({
        boardFolderUri: board.folderUri,
      });
      if (result.title) {
        setRenameTarget((prev) =>
          prev ? { ...prev, nextTitle: result.title } : prev,
        );
      } else {
        toast.error(t("canvasList.aiNameEmpty"));
      }
    } catch {
      toast.error(t("canvasList.aiNameFailed"));
    } finally {
      setAiNaming(false);
    }
  }, [renameTarget, boards, t]);

  // Soft delete via DB
  const deleteMutation = useMutation(
    trpc.board.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.board.list.queryKey() });
      },
    }),
  );

  const handleCanvasDelete = useCallback(
    (boardId: string) => {
      if (confirm(t("canvasList.confirmDelete"))) {
        deleteMutation.mutate({ boardId });
      }
    },
    [deleteMutation, t],
  );

  // Active board detection
  const activeTabId = useTabs((s) => s.activeTabId);
  const activeBase = activeTabId ? runtimeByTabId[activeTabId]?.base : undefined;
  const activeBoardBaseId =
    activeBase?.component === "board-viewer" ? activeBase.id : undefined;

  if (!boards || boards.length === 0) {
    return null;
  }

  return (
    <div className="workspace-canvas-list flex flex-col">
      <div className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground/70">{t('canvas')}</div>
      <div className="px-2 space-y-0.5">
        {boards.map((board) => {
          const rootUri = resolveBoardRootUri(board.projectId);
          const boardFolderUri = rootUri
            ? buildFileUriFromRoot(rootUri, board.folderUri)
            : "";
          const baseId = `board:${boardFolderUri}`;
          const isActive = activeBoardBaseId === baseId;

          return (
            <ContextMenu key={board.id}>
              <ContextMenuTrigger asChild>
                <div
                  className={`group/canvas-item flex h-8 items-center gap-2 rounded-lg px-2 text-sm hover:bg-[var(--sidebar-project-accent)] dark:hover:bg-[var(--sidebar-project-accent)] cursor-pointer ${
                    isActive
                      ? "bg-[var(--sidebar-project-accent)] dark:bg-[var(--sidebar-project-accent)]"
                      : ""
                  }`}
                  onClick={() => handleBoardClick(board)}
                >
                  <Palette className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate min-w-0">
                    {board.title || t("canvasList.untitled")}
                  </span>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-44">
                <ContextMenuItem
                  icon={Edit2}
                  onClick={() => handleCanvasRename(board.id, board.title)}
                >
                  {t("workspaceChatList.contextMenu.rename")}
                </ContextMenuItem>
                <ContextMenuItem
                  icon={Trash2}
                  onClick={() => handleCanvasDelete(board.id)}
                  className="text-destructive"
                >
                  {t("workspaceChatList.contextMenu.delete")}
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </div>
      {/* Rename dialog */}
      <Dialog
        open={!!renameTarget}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("canvasList.renameTitle")}</DialogTitle>
            <DialogDescription>{t("canvasList.renameDesc")}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input
              value={renameTarget?.nextTitle ?? ""}
              onChange={(e) =>
                setRenameTarget((prev) =>
                  prev ? { ...prev, nextTitle: e.target.value } : prev,
                )
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCanvasRenameSave();
              }}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="icon"
              title={t("canvasList.aiName")}
              disabled={aiNaming}
              onClick={handleAiName}
            >
              {aiNaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </Button>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("cancel")}</Button>
            </DialogClose>
            <Button onClick={handleCanvasRenameSave}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
