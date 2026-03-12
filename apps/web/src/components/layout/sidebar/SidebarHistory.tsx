"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { FolderOpen, MessageSquare, Palette } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SidebarHistoryItem } from "@openloaf/api";
import { useIsInView } from "@/hooks/use-is-in-view";
import { useSidebarNavigation } from "@/hooks/use-sidebar-navigation";
import { useTabs } from "@/hooks/use-tabs";
import { useTabRuntime } from "@/hooks/use-tab-runtime";
import { trpc } from "@/utils/trpc";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@openloaf/ui/sidebar";

const SIDEBAR_HISTORY_PAGE_SIZE = 30;
const LOAD_MORE_IN_VIEW_MARGIN = "240px 0px";

type SidebarHistoryProps = {
  /** Filter rows to the current project when rendering inside project shell. */
  projectId?: string;
};

type SidebarHistoryGroupKey = "today" | "yesterday" | "last7Days" | "earlier";

type SidebarHistoryGroup = {
  /** Group key. */
  key: SidebarHistoryGroupKey;
  /** Translated group title. */
  title: string;
  /** Group items. */
  items: SidebarHistoryItem[];
};

/** Sidebar history loading skeleton. */
function SidebarHistorySkeleton() {
  return (
    <SidebarGroup className="flex min-h-0 flex-1 flex-col gap-2 px-2 pb-2 pt-3">
      <SidebarGroupLabel className="px-2">
        <div className="h-3 w-18 rounded-full bg-muted-foreground/15" />
      </SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-1">
        <SidebarMenuSkeleton
          showIcon
          className="h-12 [&_[data-sidebar=menu-skeleton-icon]]:bg-muted-foreground/15 [&_[data-sidebar=menu-skeleton-text]]:bg-muted-foreground/15"
        />
        <SidebarMenuSkeleton
          showIcon
          className="h-12 [&_[data-sidebar=menu-skeleton-icon]]:bg-muted-foreground/15 [&_[data-sidebar=menu-skeleton-text]]:bg-muted-foreground/15"
        />
        <SidebarMenuSkeleton
          showIcon
          className="h-12 [&_[data-sidebar=menu-skeleton-icon]]:bg-muted-foreground/15 [&_[data-sidebar=menu-skeleton-text]]:bg-muted-foreground/15"
        />
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

/** Normalize a date value to the start of the local day. */
function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Resolve the history group key from a visit timestamp. */
function resolveHistoryGroupKey(value: Date): SidebarHistoryGroupKey {
  const todayStart = startOfDay(new Date()).getTime();
  const targetStart = startOfDay(value).getTime();
  const diffDays = Math.floor((todayStart - targetStart) / (24 * 60 * 60 * 1000));

  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return "last7Days";
  return "earlier";
}

/** Group sidebar history items by coarse time buckets. */
function groupSidebarHistoryItems(
  items: SidebarHistoryItem[],
  t: (key: string) => string,
): SidebarHistoryGroup[] {
  const grouped = new Map<SidebarHistoryGroupKey, SidebarHistoryItem[]>();

  for (const item of items) {
    const groupKey = resolveHistoryGroupKey(new Date(item.firstVisitedAt));
    const bucket = grouped.get(groupKey);
    if (bucket) {
      bucket.push(item);
      continue;
    }
    grouped.set(groupKey, [item]);
  }

  const order: SidebarHistoryGroupKey[] = ["today", "yesterday", "last7Days", "earlier"];
  const titleKeyMap: Record<SidebarHistoryGroupKey, string> = {
    today: "historyToday",
    yesterday: "historyYesterday",
    last7Days: "historyLast7Days",
    earlier: "historyEarlier",
  };

  return order.flatMap((groupKey) => {
    const bucket = grouped.get(groupKey);
    if (!bucket?.length) return [];
    return [{
      key: groupKey,
      title: t(titleKeyMap[groupKey]),
      items: bucket,
    }];
  });
}

/** Resolve a safe display title for the history row. */
function resolveHistoryItemTitle(item: SidebarHistoryItem, t: (key: string) => string): string {
  const trimmed = item.title.trim();
  if (trimmed) return trimmed;
  if (item.entityType === "project") return t("workspaceListPage.untitled");
  if (item.entityType === "board") return t("canvasList.untitled");
  return t("chat");
}

/** Resolve the secondary text for the history row. */
function resolveHistoryItemSubtitle(item: SidebarHistoryItem, t: (key: string) => string): string {
  if (item.entityType === "project") {
    return t("project");
  }
  return item.entityType === "chat" ? t("chat") : t("canvas");
}

/** Resolve the project label shown on the right side of each row. */
function resolveHistoryItemProjectTitle(item: SidebarHistoryItem): string {
  if (item.entityType === "project") {
    return "";
  }
  return item.projectTitle?.trim() ?? "";
}

/** Resolve the board entity id from runtime base params. */
function resolveBoardEntityId(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const normalized = value.trim().replace(/\/+$/u, "");
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

/** Render a stable icon for one history row. */
function renderHistoryItemIcon(item: SidebarHistoryItem) {
  if (item.entityType === "project") {
    if (item.icon?.trim()) {
      return (
        <span className="flex h-4 w-4 shrink-0 self-center items-center justify-center text-sm leading-none">
          {item.icon}
        </span>
      );
    }
    return <FolderOpen className="h-4 w-4 shrink-0 self-center text-sky-600/80 dark:text-sky-300/80" />;
  }
  if (item.entityType === "chat") {
    return <MessageSquare className="h-4 w-4 shrink-0 self-center text-amber-600/80 dark:text-amber-300/80" />;
  }
  return <Palette className="h-4 w-4 shrink-0 self-center text-violet-600/80 dark:text-violet-300/80" />;
}

export function SidebarHistory({ projectId }: SidebarHistoryProps) {
  const { t } = useTranslation("nav");
  const { t: tCommon } = useTranslation("common");
  const nav = useSidebarNavigation();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const normalizedProjectId = projectId?.trim() || undefined;
  const shouldShowProjectTitle = !normalizedProjectId;

  const historyQuery = useInfiniteQuery({
    ...trpc.visit.listSidebarHistory.infiniteQueryOptions(
      {
        pageSize: SIDEBAR_HISTORY_PAGE_SIZE,
        projectId: normalizedProjectId,
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    ),
  });

  const rawItems = useMemo(
    () => historyQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [historyQuery.data],
  );
  const items = useMemo(
    () =>
      normalizedProjectId
        ? rawItems.filter((item) => item.projectId === normalizedProjectId)
        : rawItems,
    [normalizedProjectId, rawItems],
  );
  const groupedItems = useMemo(
    () => groupSidebarHistoryItems(items, t),
    [items, t],
  );

  const hasMore = Boolean(historyQuery.hasNextPage);
  const isFetchingNextPage = historyQuery.isFetchingNextPage;
  const { ref: loadMoreInViewRef, isInView: isLoadMoreInView } = useIsInView(loadMoreRef, {
    inView: hasMore,
    inViewMargin: LOAD_MORE_IN_VIEW_MARGIN,
  });

  useEffect(() => {
    if (!hasMore || !isLoadMoreInView || isFetchingNextPage) {
      return;
    }
    void historyQuery.fetchNextPage();
  }, [hasMore, historyQuery, isFetchingNextPage, isLoadMoreInView]);

  const activeTabId = useTabs((state) => state.activeTabId);
  const tabs = useTabs((state) => state.tabs);
  const runtimeByTabId = useTabRuntime((state) => state.runtimeByTabId);
  const activeTab = activeTabId
    ? tabs.find((tab) => tab.id === activeTabId)
    : undefined;
  const activeBase = activeTabId ? runtimeByTabId[activeTabId]?.base : undefined;

  const isItemActive = useCallback(
    (item: SidebarHistoryItem) => {
      if (item.entityType === "chat") {
        return activeTab?.chatSessionId === item.chatId;
      }
      if (item.entityType === "project") {
        return (
          activeBase?.id === `project:${item.projectId}`
          || activeTab?.projectShell?.projectId === item.projectId
        );
      }
      const boardEntityId = resolveBoardEntityId(activeBase?.params?.boardFolderUri);
      const explicitBoardId =
        typeof activeBase?.params?.boardId === "string"
          ? activeBase.params.boardId.trim()
          : "";
      return (
        activeBase?.component === "board-viewer"
        && (boardEntityId === item.entityId || explicitBoardId === item.boardId)
      );
    },
    [activeBase, activeTab?.chatSessionId, activeTab?.projectShell?.projectId],
  );

  const handleHistoryItemClick = useCallback(
    (item: SidebarHistoryItem) => {
      if (item.entityType === "project") {
        nav.openProject({
          projectId: item.entityId,
          title: resolveHistoryItemTitle(item, t),
          rootUri: item.rootUri,
          icon: item.icon,
        });
        return;
      }
      if (item.entityType === "chat") {
        nav.openChat(item.chatId, resolveHistoryItemTitle(item, t), {
          projectId: item.projectId,
        });
        return;
      }
      nav.openBoard({
        boardId: item.boardId,
        title: resolveHistoryItemTitle(item, t),
        folderUri: item.folderUri,
        rootUri: item.rootUri,
        projectId: item.projectId,
      });
    },
    [nav, t],
  );

  if (historyQuery.isPending && items.length === 0) {
    return <SidebarHistorySkeleton />;
  }

  return (
    <SidebarGroup className="flex min-h-0 flex-1 flex-col gap-2 px-2 pb-2 pt-3">
      <SidebarGroupLabel className="px-2">{t("historySection")}</SidebarGroupLabel>
      <SidebarGroupContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-4 py-8 text-center text-sm text-muted-foreground/70">
            {t("historyEmpty")}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
            {groupedItems.map((group) => (
              <div key={group.key} className="pb-4">
                <div className="px-2 pb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/55">
                  {group.title}
                </div>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const projectTitle = shouldShowProjectTitle
                      ? resolveHistoryItemProjectTitle(item)
                      : "";
                    return (
                      <SidebarMenuItem key={item.recordId}>
                        <SidebarMenuButton
                          type="button"
                          isActive={isItemActive(item)}
                          className="h-auto min-h-12 items-center gap-3 px-2.5 py-2"
                          onClick={() => handleHistoryItemClick(item)}
                        >
                          {renderHistoryItemIcon(item)}
                          <div className="min-w-0 flex-1">
                            <div className="w-full truncate font-medium">
                              {resolveHistoryItemTitle(item, t)}
                            </div>
                            <div className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground/70">
                              <span className="shrink-0">
                                {resolveHistoryItemSubtitle(item, t)}
                              </span>
                              {projectTitle ? (
                                <span className="min-w-0 flex-1 truncate text-right text-muted-foreground/60">
                                  {projectTitle}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </div>
            ))}
            {hasMore ? (
              <div
                ref={loadMoreInViewRef}
                className="flex h-10 items-center justify-center text-xs text-muted-foreground/60"
                aria-hidden="true"
              >
                {isFetchingNextPage ? tCommon("loading") : null}
              </div>
            ) : null}
          </div>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
