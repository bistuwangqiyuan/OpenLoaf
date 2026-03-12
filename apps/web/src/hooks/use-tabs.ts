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

import i18next from "i18next";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_TAB_INFO, type DockItem } from "@openloaf/api/common";
import { createChatSessionId } from "@/lib/chat-session-id";
import { resolveProjectModeProjectShell } from "@/lib/project-mode";
import {
  resolveProjectShellForNewTab,
  resolveProjectShellSectionFromBase,
} from "@/lib/project-shell-tab";
import { isProjectWindowMode } from "@/lib/window-mode";
import { useChatRuntime } from "./use-chat-runtime";
import { useTabRuntime } from "./use-tab-runtime";
import type { TabMeta } from "./tab-types";
import { LEFT_DOCK_DEFAULT_PERCENT, LEFT_DOCK_MIN_PX } from "./tab-utils";
import type { ProjectShellState } from "@/lib/project-shell";

export const TABS_STORAGE_KEY = "openloaf:tabs";
export { LEFT_DOCK_DEFAULT_PERCENT, LEFT_DOCK_MIN_PX };

type AddTabInput = {
  title?: string; // 标签页标题
  icon?: string; // 标签页图标
  isPin?: boolean; // 是否固定标签页
  createNew?: boolean; // 是否强制创建新标签页
  base?: DockItem; // 基础面板内容
  leftWidthPercent?: number; // 左侧面板宽度百分比
  rightChatCollapsed?: boolean; // 右侧聊天栏是否折叠
  chatSessionId?: string; // 聊天会话ID
  chatParams?: Record<string, unknown>; // 聊天参数
  chatLoadHistory?: boolean; // 是否加载聊天历史
  projectShell?: ProjectShellState; // 项目上下文元信息
};

export interface TabsState {
  tabs: TabMeta[];
  activeTabId: string | null;
  addTab: (input: AddTabInput) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  getTabById: (tabId: string) => TabMeta | undefined;
  reorderTabs: (
    sourceTabId: string,
    targetTabId: string,
    position?: "before" | "after",
  ) => void;
  setTabPinned: (tabId: string, isPin: boolean) => void;
  setTabTitle: (tabId: string, title: string) => void;
  /** Update tab icon. */
  setTabIcon: (tabId: string, icon?: string | null) => void;
  setTabSessionTitles: (tabId: string, titles: Record<string, string>) => void;
  /** Set project id for a specific session. Syncs chatParams.projectId if session is active. */
  setSessionProjectId: (tabId: string, sessionId: string, projectId: string) => void;
  addTabSession: (tabId: string, sessionId: string) => void;
  removeTabSession: (tabId: string, sessionId: string) => void;
  /** Move a tab session within its list. */
  moveTabSession: (tabId: string, sessionId: string, direction: "up" | "down") => void;
  setActiveTabSession: (
    tabId: string,
    sessionId: string,
    options?: { loadHistory?: boolean; replaceCurrent?: boolean },
  ) => void;
  setTabChatSession: (
    tabId: string,
    chatSessionId: string,
    options?: { loadHistory?: boolean; replaceCurrent?: boolean },
  ) => void;
  /** Merge chat params for a tab. */
  setTabChatParams: (tabId: string, patch: Record<string, unknown>) => void;
  /** Set or clear project-shell state for a tab. */
  setTabProjectShell: (tabId: string, projectShell: ProjectShellState | null) => void;
}

function generateId(prefix = "id") {
  // 生成稳定的本地 ID：优先 randomUUID，降级到时间戳 + 随机数。
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * 判断 tab 是否应该被卸载
 *
 * 卸载条件（需同时满足）：
 * 1. 只有一个会话
 * 2. 该会话是空的（无消息）
 * 3. LeftDock 未打开
 * 4. 不是固定标签
 */
function shouldUnmountTab(tab: TabMeta, runtime: { base?: DockItem }): boolean {
  // 0. 固定标签永不卸载
  if (tab.isPin) return false;

  // 1. 只有一个会话
  const sessionCount = tab.chatSessionIds?.length ?? 1;
  if (sessionCount !== 1) return false;

  // 2. 该会话是空的（无消息）
  // 简化实现：如果 chatLoadHistory === false，认为是新会话
  const isEmpty = tab.chatLoadHistory === false;
  if (!isEmpty) return false;

  // 3. LeftDock 未打开
  const hasLeftDock = runtime.base !== undefined;
  if (hasLeftDock) return false;

  return true;
}

function orderTabs(tabs: TabMeta[]) {
  // 固定标签始终排在前面；普通标签保持相对顺序。
  const pinned: TabMeta[] = [];
  const regular: TabMeta[] = [];

  for (const tab of tabs) {
    if (tab.isPin) pinned.push(tab);
    else regular.push(tab);
  }

  return [...pinned, ...regular];
}

function updateTabById(tabs: TabMeta[], tabId: string, updater: (tab: TabMeta) => TabMeta) {
  const index = tabs.findIndex((tab) => tab.id === tabId);
  if (index === -1) return tabs;
  const nextTabs = [...tabs];
  nextTabs[index] = updater(nextTabs[index]!);
  return nextTabs;
}

function normalizeTabSessionState(tab: TabMeta) {
  const rawIds =
    Array.isArray(tab.chatSessionIds) && tab.chatSessionIds.length > 0
      ? tab.chatSessionIds
      : [tab.chatSessionId];
  const ids = rawIds.filter((id) => typeof id === "string" && id.length > 0);
  const fallbackIds = ids.length > 0 ? ids : [tab.chatSessionId];
  let activeIndex =
    typeof tab.activeSessionIndex === "number" ? tab.activeSessionIndex : -1;
  if (activeIndex < 0 || activeIndex >= fallbackIds.length) {
    activeIndex = Math.max(0, fallbackIds.indexOf(tab.chatSessionId));
  }
  if (activeIndex < 0 || activeIndex >= fallbackIds.length) {
    activeIndex = 0;
  }
  return {
    ids: fallbackIds,
    activeIndex,
    activeSessionId: fallbackIds[activeIndex] ?? tab.chatSessionId,
  };
}

/** Resolve tab storage by renderer mode to isolate project windows. */
function resolveTabsStorage() {
  if (typeof window === "undefined") return localStorage;
  return isProjectWindowMode() ? window.sessionStorage : window.localStorage;
}

export const useTabs = create<TabsState>()(
  persist(
    (set, get): TabsState => ({
      tabs: [],
      activeTabId: null,

      addTab: (input) => {
        // 新建标签：同时创建一个 chatSessionId（即使右侧暂时折叠）。
        const now = Date.now();
        const {
          createNew = false,
          base,
          title,
          icon,
          isPin,
          leftWidthPercent,
          rightChatCollapsed,
          chatSessionId: requestedChatSessionId,
          chatParams,
          chatLoadHistory,
          projectShell,
        } = input;

        const normalizedBase = base?.component === "ai-chat" ? undefined : base;
        const currentActiveTab =
          get().activeTabId
            ? get().tabs.find((tab) => tab.id === get().activeTabId)
            : undefined;
        const inputChatParams =
          typeof chatParams === "object" && chatParams
            ? ({ ...(chatParams as Record<string, unknown>) } as Record<string, unknown>)
            : undefined;
        const inferredSection = resolveProjectShellSectionFromBase(normalizedBase);
        const activeProjectShell = resolveProjectModeProjectShell(
          currentActiveTab?.projectShell,
          inferredSection ?? projectShell?.section ?? "assistant",
        );
        const resolvedProjectShell = resolveProjectShellForNewTab(
          {
            base: normalizedBase,
            chatParams: inputChatParams,
            projectShell,
          },
          activeProjectShell,
        );
        const hasExplicitProjectId = Boolean(
          inputChatParams
          && Object.prototype.hasOwnProperty.call(inputChatParams, "projectId"),
        );
        const resolvedChatParams =
          resolvedProjectShell
          && (
            !hasExplicitProjectId
            || (typeof inputChatParams?.projectId === "string"
              && inputChatParams.projectId.trim().length === 0)
          )
            ? {
                ...(inputChatParams ?? {}),
                projectId: resolvedProjectShell.projectId,
              }
            : inputChatParams;

        const tabId = generateId("tab");
        const createdChatSessionId = requestedChatSessionId ?? createChatSessionId();
        const createdChatLoadHistory = chatLoadHistory ?? Boolean(requestedChatSessionId);

        // 初始化 session → projectId 映射
        const initialProjectId =
          typeof resolvedChatParams?.projectId === "string"
            ? (resolvedChatParams.projectId as string)
            : "";
        const chatSessionProjectIds = initialProjectId
          ? { [createdChatSessionId]: initialProjectId }
          : undefined;

        const nextTab: TabMeta = {
          id: tabId,
          title: title ?? i18next.t(DEFAULT_TAB_INFO.titleKey),
          icon: icon ?? DEFAULT_TAB_INFO.icon,
          isPin: isPin ?? false,
          chatSessionId: createdChatSessionId,
          chatSessionIds: [createdChatSessionId],
          activeSessionIndex: 0,
          chatParams: resolvedChatParams,
          chatSessionProjectIds,
          chatLoadHistory: createdChatLoadHistory,
          projectShell: resolvedProjectShell,
          createdAt: now,
          lastActiveAt: now,
        };

        set((state) => ({
          tabs: [...state.tabs, nextTab],
          activeTabId: nextTab.id,
        }));

        // 中文注释：初始化 runtime，避免 UI 读取到空结构。
        useTabRuntime.getState().setRuntimeByTabId(tabId, {
          base: normalizedBase,
          stack: [],
          leftWidthPercent: normalizedBase ? leftWidthPercent ?? 0 : 0,
          rightChatCollapsed: rightChatCollapsed ?? true,
          stackHidden: false,
          activeStackItemId: "",
        });
      },

      closeTab: (tabId) => {
        let shouldClearRuntime = false;
        set((state) => {
          // 关闭标签规则：
          // - 固定标签不可关闭
          // - 至少保留 1 个标签
          // - 如果关闭的是当前激活标签，回退到 lastActiveAt 最新的标签
          const tabToClose = state.tabs.find((tab) => tab.id === tabId);
          if (!tabToClose || tabToClose.isPin) return state;

          if (state.tabs.length <= 1) return state;

          const nextTabs = state.tabs.filter((tab) => tab.id !== tabId);
          let nextActiveTabId = state.activeTabId;
          if (state.activeTabId === tabId) {
            const fallback =
              nextTabs.reduce<TabMeta | null>(
                (best, tab) => (!best || tab.lastActiveAt > best.lastActiveAt ? tab : best),
                null,
              ) ?? null;
            nextActiveTabId = fallback?.id ?? null;
          }

          shouldClearRuntime = true;
          return {
            tabs: nextTabs,
            activeTabId: nextActiveTabId,
          };
        });
        if (shouldClearRuntime) {
          // 中文注释：关闭标签时清理运行时与聊天状态，避免残留。
          useTabRuntime.getState().clearRuntimeByTabId(tabId);
          useChatRuntime.getState().clearRuntimeByTabId(tabId);
        }
      },

      setActiveTab: (tabId) => {
        const oldTabId = get().activeTabId;

        // 检查旧 tab 是否应该卸载
        if (oldTabId && oldTabId !== tabId) {
          const oldTab = get().tabs.find((t) => t.id === oldTabId);
          const oldRuntime = useTabRuntime.getState().runtimeByTabId[oldTabId];

          if (oldTab && oldRuntime && shouldUnmountTab(oldTab, oldRuntime)) {
            // 延迟卸载，避免切换动画卡顿
            setTimeout(() => {
              const state = get();
              if (state.tabs.find((t) => t.id === oldTabId)) {
                state.closeTab(oldTabId);
              }
            }, 300);
          }
        }

        set((state) => {
          // 激活标签：更新 lastActiveAt，供 closeTab 做”最近使用”回退。
          const existing = state.tabs.find((tab) => tab.id === tabId);
          if (!existing) return state;
          const now = Date.now();
          const nextTabs = updateTabById(state.tabs, tabId, (tab) => ({
            ...tab,
            lastActiveAt: now,
          }));
          return { tabs: nextTabs, activeTabId: tabId };
        });
      },

      getTabById: (tabId) => {
        const meta = get().tabs.find((tab) => tab.id === tabId);
        return meta ?? undefined;
      },

      reorderTabs: (sourceTabId, targetTabId, position = "before") => {
        set((state) => {
          // 拖拽排序：
          // - 固定区/非固定区各自独立排序，禁止跨区混排
          // - position 控制插入到目标前/后
          if (sourceTabId === targetTabId) return state;

          const allTabs = orderTabs([...state.tabs]);
          const pinnedCount = allTabs.filter((tab) => tab.isPin).length;

          const fromIndex = allTabs.findIndex((tab) => tab.id === sourceTabId);
          const toIndex = allTabs.findIndex((tab) => tab.id === targetTabId);
          if (fromIndex === -1 || toIndex === -1) return state;

          const sourcePinned = Boolean(allTabs[fromIndex]?.isPin);
          const targetPinned = Boolean(allTabs[toIndex]?.isPin);

          const reordered = [...allTabs];
          const [moved] = reordered.splice(fromIndex, 1);
          let targetIndex = toIndex;

          if (fromIndex < toIndex) targetIndex -= 1;
          if (position === "after") targetIndex += 1;

          if (sourcePinned && !targetPinned) {
            // 固定标签不能被拖到非固定区
            targetIndex = Math.min(targetIndex, Math.max(0, pinnedCount - 1));
          } else if (!sourcePinned && targetPinned) {
            // 非固定标签不能被拖到固定区
            targetIndex = Math.max(targetIndex, pinnedCount);
          }

          const lowerBound = sourcePinned ? 0 : pinnedCount;
          const upperBound = sourcePinned ? Math.max(pinnedCount - 1, 0) : reordered.length;
          const boundedIndex = Math.max(lowerBound, Math.min(targetIndex, upperBound));
          reordered.splice(boundedIndex, 0, moved!);

          return { tabs: reordered };
        });
      },

      setTabPinned: (tabId, isPin) => {
        set((state) => {
          const target = state.tabs.find((tab) => tab.id === tabId);
          if (!target) return state;

          const updatedTabs = state.tabs.map((tab) => (tab.id === tabId ? { ...tab, isPin } : tab));

          return { tabs: orderTabs(updatedTabs) };
        });
      },

      setTabTitle: (tabId, title) => {
        set((state) => {
          const index = state.tabs.findIndex((tab) => tab.id === tabId);
          if (index === -1) return state;
          const current = state.tabs[index]!;
          if (current.title === title) return state;
          const nextTabs = [...state.tabs];
          nextTabs[index] = { ...current, title };
          return { tabs: nextTabs };
        });
      },
      setTabIcon: (tabId, icon) => {
        set((state) => ({
          tabs: updateTabById(state.tabs, tabId, (tab) => ({
            ...tab,
            icon: icon ?? DEFAULT_TAB_INFO.icon,
          })),
        }));
      },
      setTabSessionTitles: (tabId, titles) => {
        set((state) => ({
          tabs: updateTabById(state.tabs, tabId, (tab) => {
            const nextTitles = { ...(tab.chatSessionTitles ?? {}), ...titles };
            const prevTitles = tab.chatSessionTitles ?? {};
            const prevKeys = Object.keys(prevTitles);
            const nextKeys = Object.keys(nextTitles);
            if (prevKeys.length === nextKeys.length) {
              let same = true;
              for (const key of nextKeys) {
                if (prevTitles[key] !== nextTitles[key]) {
                  same = false;
                  break;
                }
              }
              if (same) return tab;
            }
            return {
              ...tab,
              chatSessionTitles: nextTitles,
            };
          }),
        }));
      },

      setSessionProjectId: (tabId, sessionId, projectId) => {
        set((state) => ({
          tabs: updateTabById(state.tabs, tabId, (tab) => {
            const nextMap = { ...(tab.chatSessionProjectIds ?? {}), [sessionId]: projectId };
            const { activeSessionId } = normalizeTabSessionState(tab);
            // 如果修改的是当前活跃会话 → 同步 chatParams.projectId
            if (sessionId === activeSessionId) {
              const currentParams =
                typeof tab.chatParams === "object" && tab.chatParams
                  ? (tab.chatParams as Record<string, unknown>)
                  : {};
              return {
                ...tab,
                chatSessionProjectIds: nextMap,
                chatParams: { ...currentParams, projectId },
              };
            }
            return { ...tab, chatSessionProjectIds: nextMap };
          }),
        }));
      },

      addTabSession: (tabId, sessionId) => {
        set((state) => ({
          tabs: updateTabById(state.tabs, tabId, (tab) => {
            const { ids, activeSessionId } = normalizeTabSessionState(tab);
            const existingIndex = ids.indexOf(sessionId);
            // 新会话继承当前活跃会话的 projectId
            const currentProjectId =
              (tab.chatSessionProjectIds ?? {})[activeSessionId ?? ""] ??
              ((tab.chatParams as Record<string, unknown> | undefined)?.projectId as string | undefined) ??
              "";
            const nextProjectMap = currentProjectId
              ? { ...(tab.chatSessionProjectIds ?? {}), [sessionId]: currentProjectId }
              : tab.chatSessionProjectIds;
            if (existingIndex >= 0) {
              return {
                ...tab,
                chatSessionIds: ids,
                activeSessionIndex: existingIndex,
                chatSessionId: sessionId,
                chatSessionProjectIds: nextProjectMap,
                chatLoadHistory: false,
              };
            }
            const nextIds = [...ids, sessionId];
            return {
              ...tab,
              chatSessionIds: nextIds,
              activeSessionIndex: nextIds.length - 1,
              chatSessionId: sessionId,
              chatSessionProjectIds: nextProjectMap,
              chatLoadHistory: false,
            };
          }),
        }));
      },

      removeTabSession: (tabId, sessionId) => {
        set((state) => ({
          tabs: updateTabById(state.tabs, tabId, (tab) => {
            const { ids, activeIndex } = normalizeTabSessionState(tab);
            const targetIndex = ids.indexOf(sessionId);
            if (targetIndex === -1) return tab;
            const nextIds = ids.filter((id) => id !== sessionId);
            const nextTitles = { ...(tab.chatSessionTitles ?? {}) };
            if (nextTitles[sessionId]) delete nextTitles[sessionId];
            // 清理被删除会话的 projectId 映射
            const nextProjectMap = { ...(tab.chatSessionProjectIds ?? {}) };
            delete nextProjectMap[sessionId];
            if (nextIds.length === 0) {
              const fallbackSessionId = createChatSessionId();
              return {
                ...tab,
                chatSessionIds: [fallbackSessionId],
                activeSessionIndex: 0,
                chatSessionId: fallbackSessionId,
                chatSessionTitles: nextTitles,
                chatSessionProjectIds: nextProjectMap,
                chatLoadHistory: false,
              };
            }
            let nextActiveIndex = activeIndex;
            if (targetIndex < activeIndex) nextActiveIndex = activeIndex - 1;
            if (targetIndex === activeIndex) {
              nextActiveIndex = Math.min(targetIndex, nextIds.length - 1);
            }
            const nextActiveSessionId = nextIds[nextActiveIndex] ?? nextIds[0]!;
            // 如果删除的是活跃会话，同步新活跃会话的 projectId 到 chatParams
            const isActiveDeleted = targetIndex === activeIndex;
            const nextChatParams = isActiveDeleted
              ? (() => {
                  const currentParams =
                    typeof tab.chatParams === "object" && tab.chatParams
                      ? (tab.chatParams as Record<string, unknown>)
                      : {};
                  const newProjectId = nextProjectMap[nextActiveSessionId] ?? "";
                  return { ...currentParams, projectId: newProjectId };
                })()
              : tab.chatParams;
            return {
              ...tab,
              chatSessionIds: nextIds,
              activeSessionIndex: nextActiveIndex,
              chatSessionId: nextActiveSessionId,
              chatSessionTitles: nextTitles,
              chatSessionProjectIds: nextProjectMap,
              chatParams: nextChatParams,
              chatLoadHistory: isActiveDeleted ? true : tab.chatLoadHistory,
            };
          }),
        }));
      },
      moveTabSession: (tabId, sessionId, direction) => {
        set((state) => ({
          tabs: updateTabById(state.tabs, tabId, (tab) => {
            const { ids, activeIndex, activeSessionId } = normalizeTabSessionState(tab);
            const currentIndex = ids.indexOf(sessionId);
            if (currentIndex === -1) return tab;
            const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
            if (nextIndex < 0 || nextIndex >= ids.length) return tab;
            const nextIds = [...ids];
            // 中文注释：交换相邻会话位置，保持活跃会话不变。
            [nextIds[currentIndex], nextIds[nextIndex]] = [
              nextIds[nextIndex]!,
              nextIds[currentIndex]!,
            ];
            const resolvedActiveIndex = nextIds.indexOf(activeSessionId ?? "");
            const nextActiveIndex =
              resolvedActiveIndex >= 0 ? resolvedActiveIndex : Math.min(activeIndex, nextIds.length - 1);
            const nextActiveSessionId = nextIds[nextActiveIndex] ?? tab.chatSessionId;
            return {
              ...tab,
              chatSessionIds: nextIds,
              activeSessionIndex: nextActiveIndex,
              chatSessionId: nextActiveSessionId,
            };
          }),
        }));
      },

      setActiveTabSession: (tabId, sessionId, options) => {
        set((state) => ({
          tabs: updateTabById(state.tabs, tabId, (tab) => {
            const { ids, activeIndex } = normalizeTabSessionState(tab);
            const existingIndex = ids.indexOf(sessionId);
            let nextIds = ids;
            let nextActiveIndex = activeIndex;
            if (existingIndex >= 0) {
              nextActiveIndex = existingIndex;
            } else if (options?.replaceCurrent && ids.length > 0) {
              nextIds = [...ids];
              nextIds[activeIndex] = sessionId;
            } else {
              nextIds = [...ids, sessionId];
              nextActiveIndex = nextIds.length - 1;
            }
            // 切换活跃会话时，从映射中读取 projectId 并同步到 chatParams
            // 如果新会话没有 projectId 记录，继承当前活跃会话的 projectId（左侧边栏当前项目）
            const { activeSessionId } = normalizeTabSessionState(tab);
            const currentActiveProjectId =
              (tab.chatSessionProjectIds ?? {})[activeSessionId ?? ""] ??
              ((tab.chatParams as Record<string, unknown> | undefined)?.projectId as string | undefined) ??
              "";
            const sessionProjectId = (tab.chatSessionProjectIds ?? {})[sessionId] ?? currentActiveProjectId;
            const currentParams =
              typeof tab.chatParams === "object" && tab.chatParams
                ? (tab.chatParams as Record<string, unknown>)
                : {};
            const nextChatParams = { ...currentParams, projectId: sessionProjectId };
            return {
              ...tab,
              chatSessionIds: nextIds,
              activeSessionIndex: nextActiveIndex,
              chatSessionId: sessionId,
              chatParams: nextChatParams,
              chatLoadHistory: options?.loadHistory,
            };
          }),
        }));
      },

      setTabChatSession: (tabId, chatSessionId, options) => {
        get().setActiveTabSession(tabId, chatSessionId, options);
      },

      setTabChatParams: (tabId, patch) => {
        set((state) => ({
          tabs: updateTabById(state.tabs, tabId, (tab) => {
            const currentParams =
              typeof tab.chatParams === "object" && tab.chatParams
                ? (tab.chatParams as Record<string, unknown>)
                : {};
            const nextParams = { ...currentParams, ...patch };
            const same =
              Object.keys(nextParams).length === Object.keys(currentParams).length &&
              Object.entries(nextParams).every(([key, value]) => currentParams[key] === value);
            if (same) return tab;
            return { ...tab, chatParams: nextParams };
          }),
        }));
      },
      setTabProjectShell: (tabId, projectShell) => {
        set((state) => ({
          tabs: updateTabById(state.tabs, tabId, (tab) => {
            const nextProjectShell = projectShell ?? undefined;
            if (tab.projectShell === nextProjectShell) return tab;
            return {
              ...tab,
              projectShell: nextProjectShell,
            };
          }),
        }));
      },
    }),
    {
      name: TABS_STORAGE_KEY,
      storage: createJSONStorage(resolveTabsStorage),
      version: 10,
      migrate: (persisted: any) => {
        const now = Date.now();
        const tabs = Array.isArray(persisted?.tabs) ? persisted.tabs : [];

        return {
          ...persisted,
          tabs: tabs.map((tab: any): TabMeta => ({
            id: typeof tab?.id === "string" && tab.id ? tab.id : generateId("tab"),
            title:
              typeof tab?.title === "string" && tab.title
                ? tab.title
                : DEFAULT_TAB_INFO.titleKey,
            icon:
              typeof tab?.icon === "string" && tab.icon ? tab.icon : DEFAULT_TAB_INFO.icon,
            isPin: Boolean(tab?.isPin),
            chatSessionId:
              typeof tab?.chatSessionId === "string" && tab.chatSessionId
                ? tab.chatSessionId
                : createChatSessionId(),
            chatSessionIds:
              Array.isArray(tab?.chatSessionIds) && tab.chatSessionIds.length > 0
                ? tab.chatSessionIds.filter((id: unknown) => typeof id === "string")
                : undefined,
            activeSessionIndex:
              typeof tab?.activeSessionIndex === "number" ? tab.activeSessionIndex : undefined,
            chatSessionTitles:
              typeof tab?.chatSessionTitles === "object" && tab.chatSessionTitles
                ? (tab.chatSessionTitles as Record<string, string>)
                : undefined,
            chatSessionProjectIds:
              typeof tab?.chatSessionProjectIds === "object" && tab.chatSessionProjectIds
                ? (tab.chatSessionProjectIds as Record<string, string>)
                : undefined,
            chatParams:
              typeof tab?.chatParams === "object" && tab.chatParams ? tab.chatParams : undefined,
            chatLoadHistory:
              typeof tab?.chatLoadHistory === "boolean" ? tab.chatLoadHistory : undefined,
            projectShell:
              tab?.projectShell && typeof tab.projectShell === "object"
                ? (tab.projectShell as ProjectShellState)
                : undefined,
            createdAt: Number.isFinite(tab?.createdAt) ? tab.createdAt : now,
            lastActiveAt: Number.isFinite(tab?.lastActiveAt) ? tab.lastActiveAt : now,
          })).map((tab: TabMeta) => {
            const { ids, activeIndex, activeSessionId } = normalizeTabSessionState(tab);
            // v7→v8 迁移：为缺少 chatSessionProjectIds 的 Tab 补填活跃会话映射
            let projectIds = tab.chatSessionProjectIds;
            if (!projectIds && activeSessionId) {
              const pid =
                typeof (tab.chatParams as Record<string, unknown> | undefined)?.projectId === "string"
                  ? ((tab.chatParams as Record<string, unknown>).projectId as string)
                  : "";
              if (pid) {
                projectIds = { [activeSessionId]: pid };
              }
            }
            return {
              ...tab,
              chatSessionIds: ids,
              activeSessionIndex: activeIndex,
              chatSessionId: activeSessionId,
              chatSessionProjectIds: projectIds,
            };
          }),
        };
      },
      // 只落盘 tabs 与 activeTabId。
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
      }),
    },
  ),
);
