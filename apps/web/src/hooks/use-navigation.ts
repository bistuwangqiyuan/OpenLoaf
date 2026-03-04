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

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { DockItem } from "@openloaf/api/common";
import { createChatSessionId } from "@/lib/chat-session-id";

export const NAVIGATION_STORAGE_KEY = "openloaf:navigation";
export const LEFT_DOCK_DEFAULT_PERCENT = 50;
export const LEFT_DOCK_MIN_PX = 300;

// 视图类型定义
export type NavigationView =
  | { type: "workbench" }
  | { type: "calendar" }
  | { type: "email" }
  | { type: "scheduled-tasks" }
  | { type: "project"; projectId: string }
  | { type: "workspace-chat"; chatSessionId: string };

// 视图运行时状态（不持久化）
export type ViewRuntime = {
  leftDock?: DockItem;
  stack: DockItem[];
  leftWidthPercent: number;
  minLeftWidth?: number;
  rightChatCollapsed: boolean;
  stackHidden?: boolean;
  activeStackItemId?: string;
  chatSessionId?: string; // 项目视图的 chat session ID
};

// Workspace Chat 元数据（持久化）
export type WorkspaceChatMeta = {
  chatSessionId: string;
  title?: string;
  projectId?: string | null;
  chatParams?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};

export interface NavigationState {
  // 持久化状态
  activeWorkspaceId: string | null;
  activeView: NavigationView | null;
  workspaceChats: Record<string, WorkspaceChatMeta[]>; // workspaceId → chats

  // 运行时状态（内存）
  viewRuntimeByKey: Map<string, ViewRuntime>;

  // Actions
  setActiveWorkspace: (workspaceId: string) => void;
  setActiveView: (view: NavigationView) => void;
  getViewRuntime: (viewKey: string) => ViewRuntime;
  setViewRuntime: (viewKey: string, runtime: Partial<ViewRuntime>) => void;
  clearViewRuntime: (viewKey: string) => void;

  // Workspace Chat 管理
  addWorkspaceChat: (workspaceId: string, chat: Omit<WorkspaceChatMeta, "createdAt" | "updatedAt">) => void;
  updateWorkspaceChat: (workspaceId: string, chatSessionId: string, updates: Partial<WorkspaceChatMeta>) => void;
  removeWorkspaceChat: (workspaceId: string, chatSessionId: string) => void;
  getWorkspaceChats: (workspaceId: string) => WorkspaceChatMeta[];

  // Workspace 清理
  removeWorkspace: (workspaceId: string, fallbackWorkspaceId?: string) => void;
}

// 生成视图唯一键
export function getViewKey(view: NavigationView): string {
  switch (view.type) {
    case "workbench":
      return "workbench";
    case "calendar":
      return "calendar";
    case "email":
      return "email";
    case "scheduled-tasks":
      return "scheduled-tasks";
    case "project":
      return `project:${view.projectId}`;
    case "workspace-chat":
      return `workspace-chat:${view.chatSessionId}`;
  }
}

// 默认视图运行时状态
function getDefaultViewRuntime(): ViewRuntime {
  return {
    stack: [],
    leftWidthPercent: LEFT_DOCK_DEFAULT_PERCENT,
    minLeftWidth: LEFT_DOCK_MIN_PX,
    rightChatCollapsed: true,
    stackHidden: false,
    activeStackItemId: "",
  };
}

export const useNavigation = create<NavigationState>()(
  persist(
    (set, get): NavigationState => ({
      activeWorkspaceId: null,
      activeView: null,
      workspaceChats: {},
      viewRuntimeByKey: new Map(),

      setActiveWorkspace: (workspaceId) => {
        set({ activeWorkspaceId: workspaceId });
      },

      setActiveView: (view) => {
        set({ activeView: view });
      },

      getViewRuntime: (viewKey) => {
        const existing = get().viewRuntimeByKey.get(viewKey);
        if (existing) return existing;

        const defaultRuntime = getDefaultViewRuntime();
        get().viewRuntimeByKey.set(viewKey, defaultRuntime);
        return defaultRuntime;
      },

      setViewRuntime: (viewKey, runtime) => {
        const current = get().getViewRuntime(viewKey);
        const updated = { ...current, ...runtime };
        set((state) => {
          const next = new Map(state.viewRuntimeByKey);
          next.set(viewKey, updated);
          return { viewRuntimeByKey: next };
        });
      },

      clearViewRuntime: (viewKey) => {
        set((state) => {
          const next = new Map(state.viewRuntimeByKey);
          next.delete(viewKey);
          return { viewRuntimeByKey: next };
        });
      },

      addWorkspaceChat: (workspaceId, chat) => {
        const now = Date.now();
        const newChat: WorkspaceChatMeta = {
          ...chat,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => {
          const chats = state.workspaceChats[workspaceId] ?? [];
          // 检查是否已存在
          const existingIndex = chats.findIndex((c) => c.chatSessionId === chat.chatSessionId);
          if (existingIndex >= 0) {
            // 更新现有对话
            const updated = [...chats];
            updated[existingIndex] = { ...chats[existingIndex]!, ...chat, updatedAt: now };
            return {
              workspaceChats: {
                ...state.workspaceChats,
                [workspaceId]: updated,
              },
            };
          }
          // 添加新对话（最新的在前）
          return {
            workspaceChats: {
              ...state.workspaceChats,
              [workspaceId]: [newChat, ...chats],
            },
          };
        });
      },

      updateWorkspaceChat: (workspaceId, chatSessionId, updates) => {
        set((state) => {
          const chats = state.workspaceChats[workspaceId] ?? [];
          const index = chats.findIndex((c) => c.chatSessionId === chatSessionId);
          if (index === -1) return state;

          const updated = [...chats];
          updated[index] = {
            ...updated[index]!,
            ...updates,
            updatedAt: Date.now(),
          };

          // 如果更新了 updatedAt，重新排序（最新的在前）
          updated.sort((a, b) => b.updatedAt - a.updatedAt);

          return {
            workspaceChats: {
              ...state.workspaceChats,
              [workspaceId]: updated,
            },
          };
        });
      },

      removeWorkspaceChat: (workspaceId, chatSessionId) => {
        set((state) => {
          const chats = state.workspaceChats[workspaceId] ?? [];
          const filtered = chats.filter((c) => c.chatSessionId !== chatSessionId);

          // 如果删除的是当前活跃对话，切换到 workbench
          let nextView = state.activeView;
          if (
            state.activeView?.type === "workspace-chat" &&
            state.activeView.chatSessionId === chatSessionId
          ) {
            nextView = { type: "workbench" };
          }

          return {
            workspaceChats: {
              ...state.workspaceChats,
              [workspaceId]: filtered,
            },
            activeView: nextView,
          };
        });

        // 清理运行时状态
        const viewKey = getViewKey({ type: "workspace-chat", chatSessionId });
        get().clearViewRuntime(viewKey);
      },

      getWorkspaceChats: (workspaceId) => {
        return get().workspaceChats[workspaceId] ?? [];
      },

      removeWorkspace: (workspaceId, fallbackWorkspaceId) => {
        set((state) => {
          // 删除 workspace 的所有对话
          const nextChats = { ...state.workspaceChats };
          delete nextChats[workspaceId];

          // 如果当前 workspace 被删除，切换到 fallback
          let nextWorkspaceId = state.activeWorkspaceId;
          let nextView = state.activeView;

          if (state.activeWorkspaceId === workspaceId) {
            nextWorkspaceId = fallbackWorkspaceId ?? null;
            nextView = { type: "workbench" };
          }

          return {
            workspaceChats: nextChats,
            activeWorkspaceId: nextWorkspaceId,
            activeView: nextView,
          };
        });

        // 清理该 workspace 所有对话的运行时状态
        const chats = get().workspaceChats[workspaceId] ?? [];
        chats.forEach((chat) => {
          const viewKey = getViewKey({ type: "workspace-chat", chatSessionId: chat.chatSessionId });
          get().clearViewRuntime(viewKey);
        });
      },
    }),
    {
      name: NAVIGATION_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // 只持久化必要的状态
      partialize: (state) => ({
        activeWorkspaceId: state.activeWorkspaceId,
        activeView: state.activeView,
        workspaceChats: state.workspaceChats,
      }),
    },
  ),
);
