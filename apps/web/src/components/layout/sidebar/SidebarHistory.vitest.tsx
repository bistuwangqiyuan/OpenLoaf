/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { SidebarHistoryPage } from "@openloaf/api";
import { SidebarHistory } from "./SidebarHistory";

const translationMap: Record<string, string> = {
  historySection: "History",
  historyEmpty: "No history yet",
  historyToday: "Today",
  historyYesterday: "Yesterday",
  historyLast7Days: "Last 7 Days",
  historyEarlier: "Earlier",
  project: "Project",
  chat: "Chat",
  canvas: "Canvas",
  "workspaceListPage.untitled": "Untitled Project",
  "canvasList.untitled": "Untitled Canvas",
  loading: "Loading…",
};

const openChatMock = vi.fn();
const openProjectMock = vi.fn();
const openBoardMock = vi.fn();
const fetchNextPageMock = vi.fn();
const useInfiniteQueryMock = vi.fn();
const useIsInViewMock = vi.fn();

const tabsState = {
  activeTabId: null as string | null,
  tabs: [] as Array<Record<string, unknown>>,
};

const runtimeState = {
  runtimeByTabId: {} as Record<string, { base?: { id?: string; component?: string; params?: Record<string, unknown> } }>,
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => translationMap[key] ?? key,
  }),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useInfiniteQuery: (...args: unknown[]) => useInfiniteQueryMock(...args),
  };
});

vi.mock("@/utils/trpc", () => ({
  trpc: {
    visit: {
      listSidebarHistory: {
        infiniteQueryOptions: () => ({
          queryKey: ["visit", "listSidebarHistory"],
          queryFn: vi.fn(),
        }),
      },
    },
  },
}));

vi.mock("@/hooks/use-is-in-view", () => ({
  useIsInView: (...args: unknown[]) => useIsInViewMock(...args),
}));

vi.mock("@/hooks/use-sidebar-navigation", () => ({
  useSidebarNavigation: () => ({
    openChat: openChatMock,
    openProject: openProjectMock,
    openBoard: openBoardMock,
  }),
}));

vi.mock("@/hooks/use-tabs", () => ({
  useTabs: (selector: (state: typeof tabsState) => unknown) => selector(tabsState),
}));

vi.mock("@/hooks/use-tab-runtime", () => ({
  useTabRuntime: (selector: (state: typeof runtimeState) => unknown) => selector(runtimeState),
}));

vi.mock("@openloaf/ui/sidebar", () => ({
  SidebarGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenuButton: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  SidebarMenuSkeleton: () => <div>Skeleton</div>,
}));

function buildHistoryPage(items: SidebarHistoryPage["items"]): SidebarHistoryPage {
  return {
    items,
    nextCursor: null,
    pageSize: 30,
    hasMore: false,
  };
}

describe("SidebarHistory", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:00:00.000Z"));
    openChatMock.mockReset();
    openProjectMock.mockReset();
    openBoardMock.mockReset();
    fetchNextPageMock.mockReset();
    useIsInViewMock.mockReturnValue({ ref: vi.fn(), isInView: false });
    useInfiniteQueryMock.mockReturnValue({
      data: {
        pages: [buildHistoryPage([])],
      },
      isPending: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: fetchNextPageMock,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders grouped history rows and delegates clicks by entity type", () => {
    useInfiniteQueryMock.mockReturnValue({
      data: {
        pages: [buildHistoryPage([
          {
            recordId: "visit_chat",
            entityType: "chat",
            entityId: "chat_alpha",
            chatId: "chat_alpha",
            title: "Alpha Chat",
            projectId: "proj_alpha",
            projectTitle: "Attached Project",
            dateKey: "2026-03-11",
            firstVisitedAt: new Date("2026-03-11T11:30:00.000Z"),
          },
          {
            recordId: "visit_project",
            entityType: "project",
            entityId: "proj_alpha",
            projectId: "proj_alpha",
            title: "Alpha Project",
            icon: "📁",
            rootUri: "file:///workspace/projects/alpha",
            dateKey: "2026-03-10",
            firstVisitedAt: new Date("2026-03-10T10:00:00.000Z"),
          },
          {
            recordId: "visit_board",
            entityType: "board",
            entityId: "board_alpha",
            boardId: "board_alpha",
            title: "Alpha Board",
            folderUri: ".openloaf/boards/board_alpha/",
            rootUri: "file:///workspace",
            projectId: null,
            projectTitle: null,
            dateKey: "2026-03-01",
            firstVisitedAt: new Date("2026-03-01T08:00:00.000Z"),
          },
        ])],
      },
      isPending: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: fetchNextPageMock,
    });

    render(<SidebarHistory />);

    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
    expect(screen.getByText("Earlier")).toBeInTheDocument();
    expect(screen.getAllByText("Project")[0]).toBeInTheDocument();
    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(screen.getByText("Canvas")).toBeInTheDocument();
    expect(screen.getByText("Attached Project")).toBeInTheDocument();
    expect(screen.queryByText("Chat · Attached Project")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Alpha Chat/i }));
    expect(openChatMock).toHaveBeenCalledWith("chat_alpha", "Alpha Chat", {
      projectId: "proj_alpha",
    });

    fireEvent.click(screen.getByRole("button", { name: /Alpha Project/i }));
    expect(openProjectMock).toHaveBeenCalledWith({
      projectId: "proj_alpha",
      title: "Alpha Project",
      rootUri: "file:///workspace/projects/alpha",
      icon: "📁",
    });

    fireEvent.click(screen.getByRole("button", { name: /Alpha Board/i }));
    expect(openBoardMock).toHaveBeenCalledWith({
      boardId: "board_alpha",
      title: "Alpha Board",
      folderUri: ".openloaf/boards/board_alpha/",
      rootUri: "file:///workspace",
      projectId: null,
    });
  });

  it("fetches the next page when the sentinel enters view", async () => {
    useIsInViewMock.mockReturnValue({ ref: vi.fn(), isInView: true });
    useInfiniteQueryMock.mockReturnValue({
      data: {
        pages: [buildHistoryPage([
          {
            recordId: "visit_chat",
            entityType: "chat",
            entityId: "chat_alpha",
            chatId: "chat_alpha",
            title: "Alpha Chat",
            projectId: null,
            projectTitle: null,
            dateKey: "2026-03-11",
            firstVisitedAt: new Date("2026-03-11T11:30:00.000Z"),
          },
        ])],
      },
      isPending: false,
      hasNextPage: true,
      isFetchingNextPage: false,
      fetchNextPage: fetchNextPageMock,
    });

    render(<SidebarHistory />);

    await Promise.resolve();
    expect(fetchNextPageMock).toHaveBeenCalledTimes(1);
  });
});
