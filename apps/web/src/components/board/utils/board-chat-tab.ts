/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */

/** Normalize an optional id-like string. */
function normalizeOptionalId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/** Build chat state so a board tab and the right chat share the same session. */
export function buildBoardChatTabState(boardId: string, projectId?: string | null) {
  const normalizedBoardId = normalizeOptionalId(boardId);
  if (!normalizedBoardId) {
    throw new Error("boardId is required");
  }

  const normalizedProjectId = normalizeOptionalId(projectId);

  return {
    chatSessionId: normalizedBoardId,
    chatParams: {
      boardId: normalizedBoardId,
      projectId: normalizedProjectId ?? null,
    },
    chatLoadHistory: true,
  };
}
