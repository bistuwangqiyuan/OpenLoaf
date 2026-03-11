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

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquare, MoreHorizontal, Trash2, Edit2, FolderInput, Palette, Sparkles, Loader2 } from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@openloaf/ui/dropdown-menu";
import { ConvertChatToProjectDialog } from "./ConvertChatToProjectDialog";
import { useSaasAuth } from "@/hooks/use-saas-auth";
import { getCachedAccessToken } from "@/lib/saas-auth";
import { SaasLoginDialog } from "@/components/auth/SaasLoginDialog";
import type { ProjectNode } from "@openloaf/api/services/projectTreeService";

type MixedItem =
  | { kind: "chat"; id: string; title: string; updatedAt: string; isPin?: boolean; raw: any }
  | { kind: "canvas"; boardId: string; title: string; folderUri: string; projectId: string | null; updatedAt: string; raw: any };

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

export function WorkspaceMixedList() {
  const { t } = useTranslation("nav");

  const [expanded, setExpanded] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<{
    boardId: string;
    title: string;
    nextTitle: string;
  } | null>(null);
  const [aiNaming, setAiNaming] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const { loggedIn: saasLoggedIn } = useSaasAuth();
  const { data: projects } = useProjects();
  const projectRootUriMap = useMemo(() => buildProjectRootUriMap(projects), [projects]);
  const projectStorageRootUri = useProjectStorageRootUri();

  const queryClient = useQueryClient();
  const addTab = useTabs((s) => s.addTab);
  const setActiveTab = useTabs((s) => s.setActiveTab);
  const tabs = useTabs((s) => s.tabs);
  const activeTabId = useTabs((s) => s.activeTabId);
  const runtimeByTabId = useTabRuntime((s) => s.runtimeByTabId);
  const setActiveWorkspaceChat = useNavigation((s) => s.setActiveWorkspaceChat);
  const activeWorkspaceChatSessionId = useNavigation((s) => s.activeWorkspaceChatSessionId);

  // Fetch chats
  const { data: chats, refetch: refetchChats } = useQuery(
    trpc.chat.listByWorkspace.queryOptions({
      projectId: null,
      limit: expanded ? undefined : 50,
    })
  );

  // Fetch boards from DB
  const { data: boards } = useQuery(
    trpc.board.list.queryOptions({}),
  );

  const deleteMutation = useMutation(
    trpc.chat.deleteSession.mutationOptions({
      onSuccess: () => refetchChats(),
    })
  );

  const updateMutation = useMutation(
    trpc.chat.updateSession.mutationOptions({
      onSuccess: () => refetchChats(),
    })
  );

  // Merge and sort by updatedAt descending
  const mixedItems = useMemo<MixedItem[]>(() => {
    const items: MixedItem[] = [];

    if (chats) {
      for (const chat of chats) {
        items.push({
          kind: "chat",
          id: chat.id,
          title: chat.title,
          updatedAt: chat.updatedAt as unknown as string,
          isPin: chat.isPin ?? undefined,
          raw: chat,
        });
      }
    }

    if (boards) {
      for (const board of boards) {
        items.push({
          kind: "canvas",
          boardId: board.id,
          title: board.title || t("canvasList.untitled"),
          folderUri: board.folderUri,
          projectId: board.projectId ?? null,
          updatedAt: board.updatedAt as unknown as string,
          raw: board,
        });
      }
    }

    // Pinned chats first, then sort by updatedAt desc
    items.sort((a, b) => {
      const aPin = a.kind === "chat" && a.isPin ? 1 : 0;
      const bPin = b.kind === "chat" && b.isPin ? 1 : 0;
      if (aPin !== bPin) return bPin - aPin;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return items;
  }, [chats, boards, t]);

  // Chat click handler
  const handleChatClick = useCallback(
    (chatId: string, chatTitle: string) => {
      const existingTab = tabs.find(
        (tab) => tab.chatSessionId === chatId
      );

      if (existingTab) {
        setActiveTab(existingTab.id);
      } else {
        addTab({
          createNew: true,
          title: chatTitle,
          icon: "\uD83D\uDCAC",
          chatSessionId: chatId,
          chatParams: { projectId: null },
          leftWidthPercent: 0,
          rightChatCollapsed: false,
          chatLoadHistory: true,
        });
      }

      setActiveWorkspaceChat(chatId);
    },
    [tabs, addTab, setActiveTab, setActiveWorkspaceChat]
  );

  // Board click handler
  const resolveBoardRootUri = useCallback(
    (projectId?: string | null) =>
      projectId ? projectRootUriMap.get(projectId) : projectStorageRootUri,
    [projectRootUriMap, projectStorageRootUri],
  );

  const handleBoardClick = useCallback(
    (board: { boardId: string; title: string; folderUri: string; projectId: string | null }) => {
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
          icon: "\uD83C\uDFA8",
          leftWidthPercent: 100,
          base: {
            id: baseId,
            component: "board-viewer",
            params: {
              boardFolderUri,
              boardFileUri,
              boardId: board.boardId,
              projectId: board.projectId,
              rootUri,
            },
          },
        });
      }

      setActiveWorkspaceChat(null);
    },
    [resolveBoardRootUri, tabs, runtimeByTabId, addTab, setActiveTab, setActiveWorkspaceChat, t],
  );

  const handleDelete = useCallback(
    (chatId: string) => {
      if (confirm(t("workspaceChatList.confirmDelete"))) {
        deleteMutation.mutate({ sessionId: chatId });
      }
    },
    [deleteMutation, t]
  );

  const handleRename = useCallback(
    (chatId: string, currentTitle: string) => {
      const newTitle = prompt(t("workspaceChatList.renamePrompt"), currentTitle);
      if (newTitle && newTitle.trim() !== currentTitle) {
        updateMutation.mutate({
          sessionId: chatId,
          title: newTitle.trim(),
          isUserRename: true,
        });
      }
    },
    [updateMutation, t]
  );

  const handleConvertToProject = useCallback((chatId: string) => {
    setSelectedChatId(chatId);
    setConvertDialogOpen(true);
  }, []);

  // Board rename via DB
  const boardUpdateMutation = useMutation(
    trpc.board.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.board.list.queryKey() });
        setRenameTarget(null);
      },
    }),
  );

  // Board soft delete via DB
  const boardDeleteMutation = useMutation(
    trpc.board.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.board.list.queryKey() });
      },
    }),
  );

  const handleCanvasRename = useCallback(
    (boardId: string, title: string) => {
      setRenameTarget({ boardId, title, nextTitle: title });
    },
    [],
  );

  const handleCanvasDelete = useCallback(
    (boardId: string) => {
      if (confirm(t("canvasList.confirmDelete"))) {
        boardDeleteMutation.mutate({ boardId });
      }
    },
    [boardDeleteMutation, t],
  );

  const handleCanvasRenameSave = useCallback(() => {
    if (!renameTarget || !renameTarget.nextTitle.trim()) return;
    boardUpdateMutation.mutate({
      boardId: renameTarget.boardId,
      title: renameTarget.nextTitle.trim(),
    });
  }, [renameTarget, boardUpdateMutation]);

  const inferBoardNameMutation = useMutation(
    trpc.settings.inferBoardName.mutationOptions(),
  );

  const handleAiName = useCallback(async () => {
    if (!renameTarget) return;
    if (!saasLoggedIn) {
      setLoginOpen(true);
      return;
    }
    setAiNaming(true);
    try {
      const board = boards?.find((b) => b.id === renameTarget.boardId);
      if (!board) return;
      const result = await inferBoardNameMutation.mutateAsync({
        boardFolderUri: board.folderUri,
        saasAccessToken: getCachedAccessToken() ?? undefined,
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
  }, [renameTarget, saasLoggedIn, boards, t]);

  // Auto-close login dialog on successful login
  useEffect(() => {
    if (saasLoggedIn && loginOpen) setLoginOpen(false);
  }, [saasLoggedIn, loginOpen]);

  // Active board detection
  const activeBase = activeTabId ? runtimeByTabId[activeTabId]?.base : undefined;
  const activeBoardBaseId =
    activeBase?.component === "board-viewer" ? activeBase.id : undefined;

  if (mixedItems.length === 0) {
    return null;
  }

  const COLLAPSED_LIMIT = 15;
  const displayItems = expanded ? mixedItems : mixedItems.slice(0, COLLAPSED_LIMIT);
  const hasMore = mixedItems.length > COLLAPSED_LIMIT;

  return (
    <div className="workspace-mixed-list flex flex-col">
      <div className="px-2 space-y-0.5">
        {displayItems.map((item) => {
          if (item.kind === "chat") {
            const isActive = activeWorkspaceChatSessionId === item.id;
            return (
              <div
                key={`chat:${item.id}`}
                className={`group/chat-item flex h-8 items-center gap-2 rounded-lg px-2 text-sm hover:bg-[var(--sidebar-project-accent)] dark:hover:bg-[var(--sidebar-project-accent)] cursor-pointer ${
                  isActive ? "bg-[var(--sidebar-project-accent)] dark:bg-[var(--sidebar-project-accent)]" : ""
                }`}
                onClick={() => handleChatClick(item.id, item.title)}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate min-w-0">{item.title}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 opacity-0 group-hover/chat-item:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleRename(item.id, item.title)}>
                      <Edit2 className="mr-2 h-4 w-4" />
                      {t("workspaceChatList.contextMenu.rename")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleConvertToProject(item.id)}>
                      <FolderInput className="mr-2 h-4 w-4" />
                      {t("workspaceChatList.contextMenu.convertToProject")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(item.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t("workspaceChatList.contextMenu.delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          }

          // Canvas item from DB
          const rootUri = resolveBoardRootUri(item.projectId);
          const boardFolderUri = rootUri
            ? buildFileUriFromRoot(rootUri, item.folderUri)
            : "";
          const baseId = `board:${boardFolderUri}`;
          const isActive = activeBoardBaseId === baseId;

          return (
            <div
              key={`canvas:${item.boardId}`}
              className={`group/canvas-item flex h-8 items-center gap-2 rounded-lg px-2 text-sm hover:bg-[var(--sidebar-project-accent)] dark:hover:bg-[var(--sidebar-project-accent)] cursor-pointer ${
                isActive
                  ? "bg-[var(--sidebar-project-accent)] dark:bg-[var(--sidebar-project-accent)]"
                  : ""
              }`}
              onClick={() => handleBoardClick(item)}
            >
              <Palette className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate min-w-0">{item.title}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 opacity-0 group-hover/canvas-item:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleCanvasRename(item.boardId, item.title)}>
                    <Edit2 className="mr-2 h-4 w-4" />
                    {t("workspaceChatList.contextMenu.rename")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleCanvasDelete(item.boardId)}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("workspaceChatList.contextMenu.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>
      {!expanded && hasMore && (
        <div className="px-2 pt-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => setExpanded(true)}
          >
            {t("workspaceChatList.viewMore")}
          </Button>
        </div>
      )}
      {selectedChatId && (
        <ConvertChatToProjectDialog
          open={convertDialogOpen}
          onOpenChange={setConvertDialogOpen}
          chatSessionId={selectedChatId}
          onSuccess={() => {
            refetchChats();
            setConvertDialogOpen(false);
          }}
        />
      )}
      <SaasLoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
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
              className={`transition-colors duration-150 ${
                aiNaming
                  ? "text-muted-foreground opacity-50"
                  : saasLoggedIn
                    ? "text-amber-500 hover:text-amber-600 hover:border-amber-300 dark:text-amber-400 dark:hover:text-amber-300"
                    : "text-muted-foreground"
              }`}
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
