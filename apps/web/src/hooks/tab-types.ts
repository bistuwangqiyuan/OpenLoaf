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

import type { DockItem, Tab } from "@openloaf/api/common";
import type { ProjectShellState } from "@/lib/project-shell";

/** Tab metadata persisted in storage. */
export type TabMeta = Pick<
  Tab,
  | "id"
  | "title"
  | "icon"
  | "isPin"
  | "chatSessionId"
  | "chatParams"
  | "chatLoadHistory"
  | "createdAt"
  | "lastActiveAt"
> & {
  /** Multi-session ids for the tab. */
  chatSessionIds?: string[];
  /** Active session index in chatSessionIds. */
  activeSessionIndex?: number;
  /** Session title overrides keyed by session id. */
  chatSessionTitles?: Record<string, string>;
  /** Project id bound to each session (sessionId → projectId). */
  chatSessionProjectIds?: Record<string, string>;
  /** Project-context metadata when this tab is used as a project shell. */
  projectShell?: ProjectShellState;
};

/** Snapshot of LeftDock state for a specific session. */
export type DockSnapshot = {
  base?: DockItem;
  stack: DockItem[];
  leftWidthPercent: number;
  minLeftWidth?: number;
  rightChatCollapsed?: boolean;
  rightChatCollapsedSnapshot?: boolean;
  stackHidden?: boolean;
  activeStackItemId?: string;
};

/** Tab runtime state stored in memory only. */
export type TabRuntime = {
  /** Left dock base panel. */
  base?: DockItem;
  /** Left dock stack overlays. */
  stack: DockItem[];
  /** Left dock width in percent. */
  leftWidthPercent: number;
  /** Optional minimum width for left dock in px. */
  minLeftWidth?: number;
  /** Whether right chat is collapsed. */
  rightChatCollapsed?: boolean;
  /** Snapshot of right chat collapsed state before opening a board. */
  rightChatCollapsedSnapshot?: boolean;
  /** Whether the stack is hidden (minimized). */
  stackHidden?: boolean;
  /** Active stack item id. */
  activeStackItemId?: string;
  /** Dock state snapshots per session (sessionId → snapshot). */
  dockSnapshotBySessionId?: Record<string, DockSnapshot>;
};

/** Tab view composed from meta + runtime. */
export type TabView = TabMeta & TabRuntime;
