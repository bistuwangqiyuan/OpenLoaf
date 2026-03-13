/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import { randomUUID } from "node:crypto";
import { formatDateKey } from "./summaryDateUtils";
import { getProjectStorageRootUri } from "./vfsService";
import { readProjectTrees, type ProjectNode } from "./projectTreeService";
import type {
  EntityVisitType,
  ListSidebarHistoryInput,
  RecordEntityVisitInput,
  SidebarHistoryBoardItem,
  SidebarHistoryChatItem,
  SidebarHistoryItem,
  SidebarHistoryPage,
  SidebarHistoryProjectItem,
  SidebarHistorySort,
} from "../types/entityVisit";

type SidebarHistoryCursor = {
  /** Active sort timestamp used by the cursor. */
  sortVisitedAt: Date;
  /** Stable record id used as a tiebreaker. */
  id: string;
};

type SidebarHistorySortField = "firstVisitedAt" | "lastVisitedAt";

type SidebarHistorySourceRow = {
  id: string;
  entityType: string;
  entityId: string;
  projectId: string | null;
  dateKey: string;
  firstVisitedAt: Date;
  lastVisitedAt: Date;
};

type SidebarHistoryResolvedRow = {
  /** Raw visit row that produced the display item. */
  row: SidebarHistorySourceRow;
  /** Display item returned to the client. */
  item: SidebarHistoryItem;
};

type ProjectVisitInfo = {
  /** Project id. */
  projectId: string;
  /** Project title. */
  title: string;
  /** Project icon. */
  icon: string | null;
  /** Project root uri. */
  rootUri: string;
};

type ChatVisitRecord = {
  id: string;
  title: string;
  projectId: string | null;
};

type BoardVisitRecord = {
  id: string;
  title: string;
  projectId: string | null;
  folderUri: string;
};

const DEFAULT_SIDEBAR_HISTORY_PAGE_SIZE = 30;
const MAX_SIDEBAR_HISTORY_PAGE_SIZE = 100;
const SIDEBAR_HISTORY_SCAN_MULTIPLIER = 4;
const DEFAULT_SIDEBAR_HISTORY_SORT: SidebarHistorySort = "firstVisitedAt";

export type EntityVisitRecordClient = {
  entityVisitRecord: {
    /** Upsert a daily entity visit record. */
    upsert: (args: {
      where: {
        entityType_entityId_dateKey: {
          entityType: string;
          entityId: string;
          dateKey: string;
        };
      };
      update: {
        projectId?: string;
        lastTrigger: string;
        lastVisitedAt: Date;
      };
      create: {
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
    }) => Promise<unknown>;
    /** Read visit rows for sidebar history. */
    findMany: (args: {
      where?: {
        projectId?: string;
        OR?: Array<
          | { firstVisitedAt: { lt: Date } }
          | { firstVisitedAt: Date; id: { lt: string } }
          | { lastVisitedAt: { lt: Date } }
          | { lastVisitedAt: Date; id: { lt: string } }
        >;
      };
      orderBy:
        | [{ firstVisitedAt: "desc" }, { id: "desc" }]
        | [{ lastVisitedAt: "desc" }, { id: "desc" }];
      take: number;
      select: {
        id: true;
        entityType: true;
        entityId: true;
        projectId: true;
        dateKey: true;
        firstVisitedAt: true;
        lastVisitedAt: true;
      };
    }) => Promise<SidebarHistorySourceRow[]>;
  };
  chatSession: {
    /** Read chat sessions by id batch. */
    findMany: (args: {
      where: { id: { in: string[] }; deletedAt: null };
      select: { id: true; title: true; projectId: true };
    }) => Promise<ChatVisitRecord[]>;
  };
  board: {
    /** Read boards by id batch. */
    findMany: (args: {
      where: { id: { in: string[] }; deletedAt: null };
      select: { id: true; title: true; projectId: true; folderUri: true };
    }) => Promise<BoardVisitRecord[]>;
  };
};

/** Normalize an optional id value. */
function normalizeOptionalId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/** Resolve the owning project id for the entity visit row. */
function resolveVisitProjectId(input: {
  entityType: EntityVisitType;
  entityId: string;
  projectId?: string;
}): string | undefined {
  if (input.entityType === "project") {
    return input.entityId;
  }
  return normalizeOptionalId(input.projectId);
}

/** Normalize sidebar history page size into a safe bounded integer. */
function normalizeSidebarHistoryPageSize(pageSize?: number | null): number {
  if (!pageSize || Number.isNaN(pageSize)) return DEFAULT_SIDEBAR_HISTORY_PAGE_SIZE;
  const normalized = Math.floor(pageSize);
  if (normalized < 1) return DEFAULT_SIDEBAR_HISTORY_PAGE_SIZE;
  return Math.min(normalized, MAX_SIDEBAR_HISTORY_PAGE_SIZE);
}

/** Normalize sidebar history sort mode into a supported field. */
function normalizeSidebarHistorySort(sortBy?: SidebarHistorySort): SidebarHistorySortField {
  return sortBy === "lastVisitedAt" ? "lastVisitedAt" : DEFAULT_SIDEBAR_HISTORY_SORT;
}

/** Encode a stable sidebar history cursor. */
function encodeSidebarHistoryCursor(row: SidebarHistorySourceRow, sortField: SidebarHistorySortField): string {
  return Buffer.from(
    JSON.stringify({
      sortVisitedAt: row[sortField].toISOString(),
      id: row.id,
    }),
    "utf-8",
  ).toString("base64url");
}

/** Decode a stable sidebar history cursor. */
function decodeSidebarHistoryCursor(cursor?: string | null): SidebarHistoryCursor | null {
  if (!cursor) return null;
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf-8")) as {
      sortVisitedAt?: string;
      id?: string;
    };
    const id = decoded.id?.trim();
    const sortVisitedAt = decoded.sortVisitedAt ? new Date(decoded.sortVisitedAt) : null;
    if (!id || !sortVisitedAt || Number.isNaN(sortVisitedAt.getTime())) {
      return null;
    }
    return { id, sortVisitedAt };
  } catch {
    return null;
  }
}

/** Resolve the visit entity id from a board folder uri. */
function resolveBoardEntityId(folderUri: string): string {
  return folderUri.replace(/\/+$/u, "").split("/").filter(Boolean).pop() ?? "";
}

/** Build a flat project info map from the top-level project trees. */
function buildProjectVisitInfoMap(nodes: ProjectNode[]): Map<string, ProjectVisitInfo> {
  const projectMap = new Map<string, ProjectVisitInfo>();
  const stack = [...nodes];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    projectMap.set(current.projectId, {
      projectId: current.projectId,
      title: current.title,
      icon: current.icon ?? null,
      rootUri: current.rootUri,
    });
    if (current.children?.length) {
      stack.push(...current.children);
    }
  }
  return projectMap;
}

/** Fetch a raw visit batch after the provided cursor. */
async function fetchSidebarHistoryRows(
  prisma: EntityVisitRecordClient,
  input: {
    cursor: SidebarHistoryCursor | null;
    take: number;
    projectId?: string;
    sortField: SidebarHistorySortField;
  },
): Promise<SidebarHistorySourceRow[]> {
  const where: {
    projectId?: string;
    OR?: Array<
      | { firstVisitedAt: { lt: Date } }
      | { firstVisitedAt: Date; id: { lt: string } }
      | { lastVisitedAt: { lt: Date } }
      | { lastVisitedAt: Date; id: { lt: string } }
    >;
  } = {};

  if (input.projectId) {
    where.projectId = input.projectId;
  }

  if (input.cursor) {
    where.OR = input.sortField === "lastVisitedAt"
      ? [
          { lastVisitedAt: { lt: input.cursor.sortVisitedAt } },
          {
            lastVisitedAt: input.cursor.sortVisitedAt,
            id: { lt: input.cursor.id },
          },
        ]
      : [
          { firstVisitedAt: { lt: input.cursor.sortVisitedAt } },
          {
            firstVisitedAt: input.cursor.sortVisitedAt,
            id: { lt: input.cursor.id },
          },
        ];
  }

  return prisma.entityVisitRecord.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    orderBy: input.sortField === "lastVisitedAt"
      ? [{ lastVisitedAt: "desc" }, { id: "desc" }]
      : [{ firstVisitedAt: "desc" }, { id: "desc" }],
    take: input.take,
    select: {
      id: true,
      entityType: true,
      entityId: true,
      projectId: true,
      dateKey: true,
      firstVisitedAt: true,
      lastVisitedAt: true,
    },
  });
}

/** Resolve display items from one raw visit batch. */
async function resolveSidebarHistoryBatch(
  prisma: EntityVisitRecordClient,
  rows: SidebarHistorySourceRow[],
  projectMap: Map<string, ProjectVisitInfo>,
  storageRootUri: string,
): Promise<SidebarHistoryResolvedRow[]> {
  const chatIds = rows
    .filter((row) => row.entityType === "chat")
    .map((row) => row.entityId);
  const boardIds = rows
    .filter((row) => row.entityType === "board")
    .map((row) => row.entityId);

  const [chats, boards] = await Promise.all([
    chatIds.length > 0
      ? prisma.chatSession.findMany({
          where: { id: { in: chatIds }, deletedAt: null },
          select: { id: true, title: true, projectId: true },
        })
      : Promise.resolve([]),
    boardIds.length > 0
      ? prisma.board.findMany({
          where: { id: { in: boardIds }, deletedAt: null },
          select: { id: true, title: true, projectId: true, folderUri: true },
        })
      : Promise.resolve([]),
  ]);

  const chatMap = new Map(chats.map((chat) => [chat.id, chat]));
  const boardMap = new Map<string, BoardVisitRecord>();
  for (const board of boards) {
    boardMap.set(board.id, board);
    boardMap.set(resolveBoardEntityId(board.folderUri), board);
  }

  const resolved: SidebarHistoryResolvedRow[] = [];

  for (const row of rows) {
    if (row.entityType === "project") {
      const projectInfo = projectMap.get(row.entityId);
      if (!projectInfo) continue;
      const item: SidebarHistoryProjectItem = {
        recordId: row.id,
        entityType: "project",
        entityId: row.entityId,
        projectId: projectInfo.projectId,
        dateKey: row.dateKey,
        firstVisitedAt: row.firstVisitedAt,
        lastVisitedAt: row.lastVisitedAt,
        title: projectInfo.title,
        icon: projectInfo.icon,
        rootUri: projectInfo.rootUri,
      };
      resolved.push({ row, item });
      continue;
    }

    if (row.entityType === "chat") {
      const chat = chatMap.get(row.entityId);
      if (!chat) continue;
      const rawProjectId = normalizeOptionalId(chat.projectId) ?? normalizeOptionalId(row.projectId);
      const projectInfo = rawProjectId ? projectMap.get(rawProjectId) : undefined;
      const item: SidebarHistoryChatItem = {
        recordId: row.id,
        entityType: "chat",
        entityId: row.entityId,
        chatId: chat.id,
        projectId: projectInfo?.projectId ?? null,
        dateKey: row.dateKey,
        firstVisitedAt: row.firstVisitedAt,
        lastVisitedAt: row.lastVisitedAt,
        title: chat.title,
        projectTitle: projectInfo?.title ?? null,
      };
      resolved.push({ row, item });
      continue;
    }

    const board = boardMap.get(row.entityId);
    if (!board) continue;
    const rawProjectId = normalizeOptionalId(board.projectId) ?? normalizeOptionalId(row.projectId);
    const projectInfo = rawProjectId ? projectMap.get(rawProjectId) : undefined;
    const rootUri = projectInfo?.rootUri ?? (!rawProjectId ? storageRootUri : undefined);
    if (!rootUri) continue;
    const item: SidebarHistoryBoardItem = {
      recordId: row.id,
      entityType: "board",
      entityId: row.entityId,
      boardId: board.id,
      projectId: projectInfo?.projectId ?? null,
      dateKey: row.dateKey,
      firstVisitedAt: row.firstVisitedAt,
      lastVisitedAt: row.lastVisitedAt,
      title: board.title,
      folderUri: board.folderUri,
      rootUri,
      projectTitle: projectInfo?.title ?? null,
    };
    resolved.push({ row, item });
  }

  return resolved;
}

/** Record a daily entity visit and update the last visit timestamp on duplicates. */
export async function recordEntityVisit(
  prisma: EntityVisitRecordClient,
  input: RecordEntityVisitInput & {
    /** Override visit time for tests. */
    visitedAt?: Date;
  },
): Promise<void> {
  const entityId = input.entityId.trim();
  if (!entityId) {
    throw new Error("Entity id is required.");
  }

  const visitedAt = input.visitedAt ?? new Date();
  const dateKey = formatDateKey(visitedAt);
  const projectId = resolveVisitProjectId({
    entityType: input.entityType,
    entityId,
    projectId: input.projectId,
  });

  await prisma.entityVisitRecord.upsert({
    where: {
      entityType_entityId_dateKey: {
        entityType: input.entityType,
        entityId,
        dateKey,
      },
    },
    update: {
      ...(projectId ? { projectId } : {}),
      lastTrigger: input.trigger,
      lastVisitedAt: visitedAt,
    },
    create: {
      id: randomUUID(),
      entityType: input.entityType,
      entityId,
      projectId: projectId ?? null,
      dateKey,
      firstTrigger: input.trigger,
      lastTrigger: input.trigger,
      firstVisitedAt: visitedAt,
      lastVisitedAt: visitedAt,
    },
  });
}

/** List paginated sidebar history items from the unified visit table. */
export async function listSidebarHistoryPage(
  prisma: EntityVisitRecordClient,
  input: ListSidebarHistoryInput = {},
  options?: {
    /** Override project trees for tests. */
    projectTrees?: ProjectNode[];
    /** Override project storage root uri for tests. */
    storageRootUri?: string;
  },
): Promise<SidebarHistoryPage> {
  const pageSize = normalizeSidebarHistoryPageSize(input.pageSize);
  const projectId = normalizeOptionalId(input.projectId);
  const sortField = normalizeSidebarHistorySort(input.sortBy);
  const targetCount = pageSize + 1;
  const scanTake = Math.max(pageSize * SIDEBAR_HISTORY_SCAN_MULTIPLIER, pageSize + 1);
  const projectTrees = options?.projectTrees ?? (await readProjectTrees());
  const projectMap = buildProjectVisitInfoMap(projectTrees);
  const storageRootUri = options?.storageRootUri ?? getProjectStorageRootUri();

  const resolvedRows: SidebarHistoryResolvedRow[] = [];
  let scanCursor = decodeSidebarHistoryCursor(input.cursor);
  let exhausted = false;

  while (!exhausted && resolvedRows.length < targetCount) {
    const batch = await fetchSidebarHistoryRows(prisma, {
      cursor: scanCursor,
      take: scanTake,
      projectId,
      sortField,
    });

    if (batch.length === 0) {
      exhausted = true;
      break;
    }

    const batchResolved = await resolveSidebarHistoryBatch(
      prisma,
      batch,
      projectMap,
      storageRootUri,
    );
    resolvedRows.push(...batchResolved);

    const lastRow = batch[batch.length - 1];
    scanCursor = lastRow
      ? {
          sortVisitedAt: lastRow[sortField],
          id: lastRow.id,
        }
      : scanCursor;

    // 中文注释：原始 visit 行已经读尽时，即使中间跳过了失效对象，也不再继续追页。
    if (batch.length < scanTake) {
      exhausted = true;
    }
  }

  const pageRows = resolvedRows.slice(0, pageSize);
  const hasMore = resolvedRows.length > pageSize;
  const lastPageRow = pageRows.length > 0 ? pageRows[pageRows.length - 1] : null;
  const nextCursor = hasMore && lastPageRow
    ? encodeSidebarHistoryCursor(lastPageRow.row, sortField)
    : null;

  return {
    items: pageRows.map((entry) => entry.item),
    nextCursor,
    pageSize,
    hasMore,
  };
}
