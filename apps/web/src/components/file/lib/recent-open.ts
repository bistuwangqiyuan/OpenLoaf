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

import { getWorkspaceIdFromCookie } from "@/components/board/core/boardSession";
import type { FileSystemEntry } from "@/components/project/filesystem/utils/file-system-utils";

export const RECENT_OPEN_EVENT = "openloaf:recent-open";
const RECENT_OPEN_STORAGE_KEY = "openloaf:recent-open";
const RECENT_OPEN_STORAGE_KEY_LEGACY_PREFIX = "openloaf:recent-open:";

export type RecentOpenItem = {
  /** Project id for the entry. */
  projectId?: string | null;
  /** Relative uri for the entry. */
  fileUri: string;
  /** Display name of the entry. */
  fileName: string;
  /** Entry kind for rendering. */
  kind: "file";
  /** Optional file extension. */
  ext?: string | null;
  /** Last opened timestamp (ms). */
  openedAt: number;
};

type RecentOpenStore = {
  /** Global recent entries. */
  global: RecentOpenItem[];
  /** Project-level recent entries. */
  projects: Record<string, RecentOpenItem[]>;
};

type RecordRecentOpenInput = {
  /** @deprecated Retained for call-site compatibility. */
  tabId?: string | null;
  /** @deprecated Retained for call-site compatibility. */
  workspaceId?: string | null;
  /** Project id for the entry. */
  projectId?: string | null;
  /** Entry payload. */
  entry: FileSystemEntry;
  /** Max items to keep. */
  maxItems?: number;
};

/** Build the legacy storage key for workspace-scoped history. */
function buildLegacyStorageKey(workspaceId: string): string {
  return `${RECENT_OPEN_STORAGE_KEY_LEGACY_PREFIX}${workspaceId}`;
}

/** Read the legacy workspace-scoped store for one-time migration fallback. */
function readLegacyStore(): RecentOpenStore | null {
  if (typeof window === "undefined") return null;
  const workspaceId = getWorkspaceIdFromCookie();
  if (!workspaceId) return null;
  const raw = window.localStorage.getItem(buildLegacyStorageKey(workspaceId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<{
      workspace: RecentOpenItem[];
      projects: Record<string, RecentOpenItem[]>;
    }>;
    return {
      global: Array.isArray(parsed.workspace) ? parsed.workspace : [],
      projects: parsed.projects && typeof parsed.projects === "object" ? parsed.projects : {},
    };
  } catch {
    return null;
  }
}

/** Safely read the recent-open store. */
function readStore(): RecentOpenStore {
  if (typeof window === "undefined") {
    return { global: [], projects: {} };
  }
  const raw = window.localStorage.getItem(RECENT_OPEN_STORAGE_KEY);
  if (!raw) return readLegacyStore() ?? { global: [], projects: {} };
  try {
    const parsed = JSON.parse(raw) as Partial<RecentOpenStore>;
    return {
      global: Array.isArray(parsed.global) ? parsed.global : [],
      projects: parsed.projects && typeof parsed.projects === "object" ? parsed.projects : {},
    };
  } catch {
    return readLegacyStore() ?? { global: [], projects: {} };
  }
}

/** Persist the recent-open store to localStorage. */
function writeStore(store: RecentOpenStore): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RECENT_OPEN_STORAGE_KEY, JSON.stringify(store));
}

/** Build a unique key for de-duplication. */
function buildItemKey(item: RecentOpenItem): string {
  return `${item.projectId ?? "global"}:${item.fileUri}`;
}

/** Record a file open event into the recent list. */
export function recordRecentOpen(input: RecordRecentOpenInput): void {
  if (typeof window === "undefined") return;
  if (input.entry.kind !== "file") return;
  const fileUri = input.entry.uri?.trim();
  if (!fileUri) return;
  const projectId = input.projectId?.trim();
  if (!projectId) return;

  const maxItems = input.maxItems ?? 5;
  const store = readStore();
  const item: RecentOpenItem = {
    projectId,
    fileUri,
    fileName: input.entry.name || fileUri.split("/").pop() || fileUri,
    kind: "file",
    ext: input.entry.ext ?? null,
    openedAt: Date.now(),
  };

  // 逻辑：同一文件重复打开时置顶，避免重复项。
  const nextGlobal = [
    item,
    ...store.global.filter((existing) => buildItemKey(existing) !== buildItemKey(item)),
  ].slice(0, maxItems);
  store.global = nextGlobal;

  const projectList = store.projects[projectId] ?? [];
  const nextProjectList = [
    item,
    ...projectList.filter((existing) => buildItemKey(existing) !== buildItemKey(item)),
  ].slice(0, maxItems);
  store.projects[projectId] = nextProjectList;

  writeStore(store);
  window.dispatchEvent(new CustomEvent(RECENT_OPEN_EVENT));
}

/** Read recent entries for global and project scopes. */
export function getRecentOpens(input: {
  /** @deprecated Retained for call-site compatibility. */
  workspaceId?: string | null;
  projectId?: string | null;
  limit?: number;
}): { global: RecentOpenItem[]; project: RecentOpenItem[] } {
  if (typeof window === "undefined") {
    return { global: [], project: [] };
  }
  const store = readStore();
  const limit = input.limit ?? 5;
  const globalItems = store.global.slice(0, limit);
  const projectItems = input.projectId
    ? (store.projects[input.projectId] ?? []).slice(0, limit)
    : [];
  return { global: globalItems, project: projectItems };
}
