/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import { z } from "zod";

/** Entity types tracked by the unified visit table. */
export const entityVisitTypeSchema = z.enum(["project", "chat", "board"]);

/** Visit triggers tracked by the unified visit table. */
export const entityVisitTriggerSchema = z.enum([
  "project-open",
  "chat-create",
  "chat-open",
  "board-create",
  "board-open",
]);

/** Supported sort modes for sidebar history. */
export const sidebarHistorySortSchema = z.enum(["firstVisitedAt", "lastVisitedAt"]);

/** Input schema for recording a unified entity visit. */
export const recordEntityVisitInputSchema = z.object({
  /** Entity type. */
  entityType: entityVisitTypeSchema,
  /** Entity id. */
  entityId: z.string().min(1),
  /** Owning project id when available. */
  projectId: z.string().trim().min(1).optional(),
  /** Visit trigger. */
  trigger: entityVisitTriggerSchema,
});

/** Input schema for paginated sidebar history queries. */
export const listSidebarHistoryInputSchema = z.object({
  /** Opaque cursor returned by the previous page. */
  cursor: z.string().nullable().optional(),
  /** Requested page size. */
  pageSize: z.number().int().min(1).max(100).nullable().optional(),
  /** Limit sidebar history to one project when provided. */
  projectId: z.string().trim().min(1).optional(),
  /** Sort rows by first visit or last visit time. */
  sortBy: sidebarHistorySortSchema.optional(),
});

const sidebarHistoryItemBaseSchema = z.object({
  /** Visit record id. */
  recordId: z.string().min(1),
  /** Entity id stored in the visit row. */
  entityId: z.string().min(1),
  /** Owning project id when available. */
  projectId: z.string().nullable(),
  /** Natural day key in YYYY-MM-DD format. */
  dateKey: z.string().min(1),
  /** First visit timestamp of the daily record. */
  firstVisitedAt: z.date(),
  /** Last visit timestamp of the daily record. */
  lastVisitedAt: z.date(),
});

/** Sidebar history item for project visits. */
export const sidebarHistoryProjectItemSchema = sidebarHistoryItemBaseSchema.extend({
  entityType: z.literal("project"),
  /** Project title. */
  title: z.string(),
  /** Project icon. */
  icon: z.string().nullable(),
  /** Project root uri. */
  rootUri: z.string().min(1),
});

/** Sidebar history item for chat visits. */
export const sidebarHistoryChatItemSchema = sidebarHistoryItemBaseSchema.extend({
  entityType: z.literal("chat"),
  /** Chat session id. */
  chatId: z.string().min(1),
  /** Chat title. */
  title: z.string(),
  /** Related project title when the chat belongs to a project. */
  projectTitle: z.string().nullable(),
});

/** Sidebar history item for board visits. */
export const sidebarHistoryBoardItemSchema = sidebarHistoryItemBaseSchema.extend({
  entityType: z.literal("board"),
  /** Board id. */
  boardId: z.string().min(1),
  /** Board title. */
  title: z.string(),
  /** Board folder uri relative to the root. */
  folderUri: z.string().min(1),
  /** Root uri used to reopen the board. */
  rootUri: z.string().min(1),
  /** Related project title when the board belongs to a project. */
  projectTitle: z.string().nullable(),
});

/** Discriminated union for sidebar history items. */
export const sidebarHistoryItemSchema = z.discriminatedUnion("entityType", [
  sidebarHistoryProjectItemSchema,
  sidebarHistoryChatItemSchema,
  sidebarHistoryBoardItemSchema,
]);

/** Paginated response schema for sidebar history. */
export const sidebarHistoryPageSchema = z.object({
  /** Current page items. */
  items: z.array(sidebarHistoryItemSchema),
  /** Cursor for the next page. */
  nextCursor: z.string().nullable(),
  /** Effective page size. */
  pageSize: z.number().int().min(1).max(100),
  /** Whether more displayable items remain. */
  hasMore: z.boolean(),
});

export type EntityVisitType = z.infer<typeof entityVisitTypeSchema>;
export type EntityVisitTrigger = z.infer<typeof entityVisitTriggerSchema>;
export type SidebarHistorySort = z.infer<typeof sidebarHistorySortSchema>;
export type RecordEntityVisitInput = z.infer<typeof recordEntityVisitInputSchema>;
export type ListSidebarHistoryInput = z.infer<typeof listSidebarHistoryInputSchema>;
export type SidebarHistoryProjectItem = z.infer<typeof sidebarHistoryProjectItemSchema>;
export type SidebarHistoryChatItem = z.infer<typeof sidebarHistoryChatItemSchema>;
export type SidebarHistoryBoardItem = z.infer<typeof sidebarHistoryBoardItemSchema>;
export type SidebarHistoryItem = z.infer<typeof sidebarHistoryItemSchema>;
export type SidebarHistoryPage = z.infer<typeof sidebarHistoryPageSchema>;
