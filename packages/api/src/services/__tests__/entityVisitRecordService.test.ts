/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import { describe, expect, it } from "vitest";
import {
  listSidebarHistoryPage,
  recordEntityVisit,
  type EntityVisitRecordClient,
} from "../entityVisitRecordService";

type StoredVisitRecord = {
  id: string;
  entityType: string;
  entityId: string;
  projectId: string | null;
  dateKey: string;
  firstTrigger: string;
  lastTrigger: string;
  firstVisitedAt: Date;
  lastVisitedAt: Date;
};

type StoredChatRecord = {
  id: string;
  title: string;
  projectId: string | null;
  deletedAt?: Date | null;
};

type StoredBoardRecord = {
  id: string;
  title: string;
  projectId: string | null;
  folderUri: string;
  deletedAt?: Date | null;
};

/** Create a fake visit record client backed by an in-memory map. */
function createFakeClient(seed?: {
  visits?: StoredVisitRecord[];
  chats?: StoredChatRecord[];
  boards?: StoredBoardRecord[];
}) {
  const store = new Map<string, StoredVisitRecord>(
    (seed?.visits ?? []).map((record) => [
      `${record.entityType}:${record.entityId}:${record.dateKey}`,
      record,
    ]),
  );
  const chats = new Map<string, StoredChatRecord>(
    (seed?.chats ?? []).map((record) => [record.id, record]),
  );
  const boards = new Map<string, StoredBoardRecord>(
    (seed?.boards ?? []).map((record) => [record.id, record]),
  );

  const client: EntityVisitRecordClient = {
    entityVisitRecord: {
      async upsert(args) {
        const unique = args.where.entityType_entityId_dateKey;
        const key = `${unique.entityType}:${unique.entityId}:${unique.dateKey}`;
        const existing = store.get(key);
        if (existing) {
          const next: StoredVisitRecord = {
            ...existing,
            ...("projectId" in args.update ? { projectId: args.update.projectId ?? existing.projectId } : {}),
            lastTrigger: args.update.lastTrigger,
            lastVisitedAt: args.update.lastVisitedAt,
          };
          store.set(key, next);
          return next;
        }
        const created: StoredVisitRecord = {
          ...args.create,
        };
        store.set(key, created);
        return created;
      },
      async findMany(args) {
        let rows = Array.from(store.values());
        if (args.where?.projectId) {
          rows = rows.filter((row) => row.projectId === args.where?.projectId);
        }
        const conditions = args.where?.OR ?? [];
        if (conditions.length > 0) {
          rows = rows.filter((row) =>
            conditions.some((condition) => {
              if ("lastVisitedAt" in condition && "lt" in condition.lastVisitedAt) {
                return row.lastVisitedAt.getTime() < condition.lastVisitedAt.lt.getTime();
              }
              if ("lastVisitedAt" in condition && condition.lastVisitedAt instanceof Date) {
                return (
                  row.lastVisitedAt.getTime() === condition.lastVisitedAt.getTime()
                  && "id" in condition
                  && row.id < condition.id.lt
                );
              }
              if ("firstVisitedAt" in condition && "lt" in condition.firstVisitedAt) {
                return row.firstVisitedAt.getTime() < condition.firstVisitedAt.lt.getTime();
              }
              return (
                "firstVisitedAt" in condition
                && condition.firstVisitedAt instanceof Date
                && row.firstVisitedAt.getTime() === condition.firstVisitedAt.getTime()
                && "id" in condition
                && row.id < condition.id.lt
              );
            }),
          );
        }
        const sortField = "lastVisitedAt" in args.orderBy[0] ? "lastVisitedAt" : "firstVisitedAt";
        rows.sort((a, b) => {
          const timeDiff = b[sortField].getTime() - a[sortField].getTime();
          if (timeDiff !== 0) return timeDiff;
          return b.id.localeCompare(a.id);
        });
        return rows.slice(0, args.take).map((row) => ({
          id: row.id,
          entityType: row.entityType as "project" | "chat" | "board",
          entityId: row.entityId,
          projectId: row.projectId,
          dateKey: row.dateKey,
          firstVisitedAt: row.firstVisitedAt,
          lastVisitedAt: row.lastVisitedAt,
        }));
      },
    },
    chatSession: {
      async findMany(args) {
        return args.where.id.in.flatMap((id) => {
          const record = chats.get(id);
          if (!record || record.deletedAt) return [];
          return [{
            id: record.id,
            title: record.title,
            projectId: record.projectId,
          }];
        });
      },
    },
    board: {
      async findMany(args) {
        return args.where.id.in.flatMap((id) => {
          const record = boards.get(id);
          if (!record || record.deletedAt) return [];
          return [{
            id: record.id,
            title: record.title,
            projectId: record.projectId,
            folderUri: record.folderUri,
          }];
        });
      },
    },
  };

  return { client, store, chats, boards };
}
describe("entityVisitRecordService", () => {
  it("records project visit with projectId mapped to entityId", async () => {
    const { client, store } = createFakeClient();
    const visitedAt = new Date("2026-03-11T08:30:00.000Z");

    await recordEntityVisit(client, {
      entityType: "project",
      entityId: "proj_alpha",
      trigger: "project-open",
      visitedAt,
    });

    const record = store.get("project:proj_alpha:2026-03-11");
    expect(record).toBeDefined();
    expect(record?.projectId).toBe("proj_alpha");
    expect(record?.firstTrigger).toBe("project-open");
    expect(record?.lastTrigger).toBe("project-open");
    expect(record?.firstVisitedAt.toISOString()).toBe(visitedAt.toISOString());
    expect(record?.lastVisitedAt.toISOString()).toBe(visitedAt.toISOString());
  });

  it("updates existing daily record instead of creating a second row", async () => {
    const { client, store } = createFakeClient();
    const firstVisitedAt = new Date("2026-03-11T08:30:00.000Z");
    const secondVisitedAt = new Date("2026-03-11T10:45:00.000Z");

    await recordEntityVisit(client, {
      entityType: "chat",
      entityId: "chat_alpha",
      trigger: "chat-create",
      visitedAt: firstVisitedAt,
    });
    await recordEntityVisit(client, {
      entityType: "chat",
      entityId: "chat_alpha",
      projectId: "proj_alpha",
      trigger: "chat-open",
      visitedAt: secondVisitedAt,
    });

    expect(store.size).toBe(1);
    const record = store.get("chat:chat_alpha:2026-03-11");
    expect(record).toBeDefined();
    expect(record?.projectId).toBe("proj_alpha");
    expect(record?.firstTrigger).toBe("chat-create");
    expect(record?.lastTrigger).toBe("chat-open");
    expect(record?.firstVisitedAt.toISOString()).toBe(firstVisitedAt.toISOString());
    expect(record?.lastVisitedAt.toISOString()).toBe(secondVisitedAt.toISOString());
  });

  it("creates a new row when the visit crosses natural days", async () => {
    const { client, store } = createFakeClient();

    await recordEntityVisit(client, {
      entityType: "board",
      entityId: "board_alpha",
      trigger: "board-open",
      visitedAt: new Date("2026-03-11T23:50:00+08:00"),
    });
    await recordEntityVisit(client, {
      entityType: "board",
      entityId: "board_alpha",
      trigger: "board-open",
      visitedAt: new Date("2026-03-12T00:10:00+08:00"),
    });

    expect(store.size).toBe(2);
    expect(store.has("board:board_alpha:2026-03-11")).toBe(true);
    expect(store.has("board:board_alpha:2026-03-12")).toBe(true);
  });

  it("lists mixed sidebar history with stable first-visit cursor pagination", async () => {
    const visitedAt = new Date("2026-03-11T09:30:00.000Z");
    const { client } = createFakeClient({
      visits: [
        {
          id: "visit_c",
          entityType: "chat",
          entityId: "chat_alpha",
          projectId: "proj_alpha",
          dateKey: "2026-03-11",
          firstTrigger: "chat-open",
          lastTrigger: "chat-open",
          firstVisitedAt: visitedAt,
          lastVisitedAt: visitedAt,
        },
        {
          id: "visit_b",
          entityType: "board",
          entityId: "board_alpha",
          projectId: null,
          dateKey: "2026-03-11",
          firstTrigger: "board-open",
          lastTrigger: "board-open",
          firstVisitedAt: visitedAt,
          lastVisitedAt: visitedAt,
        },
        {
          id: "visit_a",
          entityType: "project",
          entityId: "proj_alpha",
          projectId: "proj_alpha",
          dateKey: "2026-03-11",
          firstTrigger: "project-open",
          lastTrigger: "project-open",
          firstVisitedAt: visitedAt,
          lastVisitedAt: visitedAt,
        },
      ],
      chats: [
        { id: "chat_alpha", title: "Alpha Chat", projectId: "proj_alpha" },
      ],
      boards: [
        {
          id: "board_alpha",
          title: "Alpha Board",
          projectId: null,
          folderUri: ".openloaf/boards/board_alpha/",
        },
      ],
    });

    const projectTrees = [{
      projectId: "proj_alpha",
      title: "Alpha Project",
      icon: "📁",
      rootUri: "file:///project-root/projects/alpha",
      isGitProject: false,
      children: [],
    }];

    const firstPage = await listSidebarHistoryPage(
      client,
      { pageSize: 2 },
      {
        projectTrees,
        storageRootUri: "file:///project-space",
      },
    );

    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.items[0]?.entityType).toBe("chat");
    expect(firstPage.items[1]?.entityType).toBe("board");
    expect(firstPage.items[0]?.firstVisitedAt.toISOString()).toBe(visitedAt.toISOString());
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.nextCursor).toBeTruthy();

    const secondPage = await listSidebarHistoryPage(
      client,
      {
        pageSize: 2,
        cursor: firstPage.nextCursor,
      },
      {
        projectTrees,
        storageRootUri: "file:///project-space",
      },
    );

    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0]?.entityType).toBe("project");
    expect(secondPage.hasMore).toBe(false);
    expect(secondPage.nextCursor).toBeNull();
  });

  it("skips invalid rows but still backfills page with later valid items", async () => {
    const { client } = createFakeClient({
      visits: [
        {
          id: "visit_4",
          entityType: "project",
          entityId: "proj_missing",
          projectId: "proj_missing",
          dateKey: "2026-03-11",
          firstTrigger: "project-open",
          lastTrigger: "project-open",
          firstVisitedAt: new Date("2026-03-11T14:00:00.000Z"),
          lastVisitedAt: new Date("2026-03-11T14:00:00.000Z"),
        },
        {
          id: "visit_3",
          entityType: "chat",
          entityId: "chat_beta",
          projectId: "proj_missing",
          dateKey: "2026-03-11",
          firstTrigger: "chat-open",
          lastTrigger: "chat-open",
          firstVisitedAt: new Date("2026-03-11T13:00:00.000Z"),
          lastVisitedAt: new Date("2026-03-11T13:00:00.000Z"),
        },
        {
          id: "visit_2",
          entityType: "board",
          entityId: "board_beta",
          projectId: "proj_beta",
          dateKey: "2026-03-11",
          firstTrigger: "board-open",
          lastTrigger: "board-open",
          firstVisitedAt: new Date("2026-03-11T12:00:00.000Z"),
          lastVisitedAt: new Date("2026-03-11T12:00:00.000Z"),
        },
        {
          id: "visit_1",
          entityType: "project",
          entityId: "proj_beta",
          projectId: "proj_beta",
          dateKey: "2026-03-11",
          firstTrigger: "project-open",
          lastTrigger: "project-open",
          firstVisitedAt: new Date("2026-03-11T11:00:00.000Z"),
          lastVisitedAt: new Date("2026-03-11T11:00:00.000Z"),
        },
      ],
      chats: [
        { id: "chat_beta", title: "Beta Chat", projectId: "proj_missing" },
      ],
      boards: [
        {
          id: "board_beta",
          title: "Beta Board",
          projectId: "proj_beta",
          folderUri: ".openloaf/boards/board_beta/",
        },
      ],
    });

    const page = await listSidebarHistoryPage(
      client,
      { pageSize: 3 },
      {
        projectTrees: [{
          projectId: "proj_beta",
          title: "Beta Project",
          rootUri: "file:///project-root/projects/beta",
          isGitProject: false,
          children: [],
        }],
        storageRootUri: "file:///project-space",
      },
    );

    expect(page.items).toHaveLength(3);
    expect(page.items.map((item) => item.entityType)).toEqual(["chat", "board", "project"]);
    const firstItem = page.items[0];
    expect(firstItem).toBeDefined();
    expect(firstItem?.entityType).toBe("chat");
    expect(firstItem?.projectId).toBeNull();
    expect(firstItem?.entityType === "chat" ? firstItem.projectTitle : null).toBeNull();
    expect(page.hasMore).toBe(false);
  });

  it("keeps same-day history order stable after a later reopen updates only lastVisitedAt", async () => {
    const { client } = createFakeClient({
      chats: [
        { id: "chat_alpha", title: "Alpha Chat", projectId: null },
        { id: "chat_beta", title: "Beta Chat", projectId: null },
      ],
    });
    const firstVisitedAt = new Date("2026-03-11T08:00:00.000Z");
    const secondVisitedAt = new Date("2026-03-11T10:00:00.000Z");
    const thirdVisitedAt = new Date("2026-03-11T09:00:00.000Z");

    await recordEntityVisit(client, {
      entityType: "chat",
      entityId: "chat_alpha",
      trigger: "chat-create",
      visitedAt: firstVisitedAt,
    });
    await recordEntityVisit(client, {
      entityType: "chat",
      entityId: "chat_alpha",
      trigger: "chat-open",
      visitedAt: secondVisitedAt,
    });
    await recordEntityVisit(client, {
      entityType: "chat",
      entityId: "chat_beta",
      trigger: "chat-create",
      visitedAt: thirdVisitedAt,
    });

    const page = await listSidebarHistoryPage(
      client,
      { pageSize: 10 },
      {
        projectTrees: [],
        storageRootUri: "file:///project-space",
      },
    );

    expect(page.items).toHaveLength(2);
    expect(page.items[0]?.entityId).toBe("chat_beta");
    expect(page.items[1]?.entityId).toBe("chat_alpha");
    expect(page.items[1]?.firstVisitedAt.toISOString()).toBe(firstVisitedAt.toISOString());
    expect(page.items[1]?.lastVisitedAt.toISOString()).toBe(secondVisitedAt.toISOString());
  });

  it("can sort sidebar history by last visit time", async () => {
    const { client } = createFakeClient({
      chats: [
        { id: "chat_alpha", title: "Alpha Chat", projectId: null },
        { id: "chat_beta", title: "Beta Chat", projectId: null },
      ],
    });

    await recordEntityVisit(client, {
      entityType: "chat",
      entityId: "chat_alpha",
      trigger: "chat-create",
      visitedAt: new Date("2026-03-11T08:00:00.000Z"),
    });
    await recordEntityVisit(client, {
      entityType: "chat",
      entityId: "chat_beta",
      trigger: "chat-create",
      visitedAt: new Date("2026-03-11T09:00:00.000Z"),
    });
    await recordEntityVisit(client, {
      entityType: "chat",
      entityId: "chat_alpha",
      trigger: "chat-open",
      visitedAt: new Date("2026-03-11T10:00:00.000Z"),
    });

    const page = await listSidebarHistoryPage(
      client,
      { pageSize: 10, sortBy: "lastVisitedAt" },
      {
        projectTrees: [],
        storageRootUri: "file:///project-space",
      },
    );

    expect(page.items).toHaveLength(2);
    expect(page.items.map((item) => item.entityId)).toEqual(["chat_alpha", "chat_beta"]);
    expect(page.items[0]?.lastVisitedAt.toISOString()).toBe("2026-03-11T10:00:00.000Z");
  });

  it("filters sidebar history by project id when requested", async () => {
    const { client } = createFakeClient({
      visits: [
        {
          id: "visit_project_alpha",
          entityType: "project",
          entityId: "proj_alpha",
          projectId: "proj_alpha",
          dateKey: "2026-03-11",
          firstTrigger: "project-open",
          lastTrigger: "project-open",
          firstVisitedAt: new Date("2026-03-11T12:00:00.000Z"),
          lastVisitedAt: new Date("2026-03-11T12:00:00.000Z"),
        },
        {
          id: "visit_chat_alpha",
          entityType: "chat",
          entityId: "chat_alpha",
          projectId: "proj_alpha",
          dateKey: "2026-03-11",
          firstTrigger: "chat-open",
          lastTrigger: "chat-open",
          firstVisitedAt: new Date("2026-03-11T11:00:00.000Z"),
          lastVisitedAt: new Date("2026-03-11T11:00:00.000Z"),
        },
        {
          id: "visit_chat_beta",
          entityType: "chat",
          entityId: "chat_beta",
          projectId: "proj_beta",
          dateKey: "2026-03-11",
          firstTrigger: "chat-open",
          lastTrigger: "chat-open",
          firstVisitedAt: new Date("2026-03-11T10:00:00.000Z"),
          lastVisitedAt: new Date("2026-03-11T10:00:00.000Z"),
        },
      ],
      chats: [
        { id: "chat_alpha", title: "Alpha Chat", projectId: "proj_alpha" },
        { id: "chat_beta", title: "Beta Chat", projectId: "proj_beta" },
      ],
    });

    const page = await listSidebarHistoryPage(
      client,
      { pageSize: 10, projectId: "proj_alpha" },
      {
        projectTrees: [
          {
            projectId: "proj_alpha",
            title: "Alpha Project",
            rootUri: "file:///project-root/projects/alpha",
            isGitProject: false,
            children: [],
          },
          {
            projectId: "proj_beta",
            title: "Beta Project",
            rootUri: "file:///project-root/projects/beta",
            isGitProject: false,
            children: [],
          },
        ],
        storageRootUri: "file:///project-space",
      },
    );

    expect(page.items).toHaveLength(2);
    expect(page.items.map((item) => item.projectId)).toEqual(["proj_alpha", "proj_alpha"]);
    expect(page.items.map((item) => item.entityId)).toEqual(["proj_alpha", "chat_alpha"]);
  });
});
