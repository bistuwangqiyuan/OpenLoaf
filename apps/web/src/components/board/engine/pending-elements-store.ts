/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import type { CanvasElement } from "./types";

export type PendingBoardElementMode = "append" | "replace-if-empty";

export type PendingBoardElementBatch = {
  /** Elements waiting to be applied into the board document. */
  elements: CanvasElement[];
  /** Apply mode for the incoming batch. */
  mode?: PendingBoardElementMode;
  /** Whether the board should fit the viewport after applying. */
  fitView?: boolean;
};

type PendingBoardElementsEventDetail = {
  /** Board folder uri used as the queue key. */
  boardFolderUri: string;
};

const BOARD_PENDING_ELEMENTS_EVENT = "openloaf:board-pending-elements";
const pendingElementBatches = new Map<string, PendingBoardElementBatch[]>();

/** Emit a lightweight event so already-mounted boards can pull pending imports. */
function emitPendingBoardElements(boardFolderUri: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<PendingBoardElementsEventDetail>(BOARD_PENDING_ELEMENTS_EVENT, {
      detail: { boardFolderUri },
    }),
  );
}

/** Queue pending elements for a board and notify live viewers. */
export function queuePendingBoardElements(
  boardFolderUri: string,
  batch: PendingBoardElementBatch,
): void {
  const normalizedBoardFolderUri = boardFolderUri.trim();
  if (!normalizedBoardFolderUri || batch.elements.length === 0) return;

  const current = pendingElementBatches.get(normalizedBoardFolderUri) ?? [];
  current.push({
    ...batch,
    mode: batch.mode ?? "append",
    fitView: batch.fitView ?? true,
  });
  pendingElementBatches.set(normalizedBoardFolderUri, current);
  emitPendingBoardElements(normalizedBoardFolderUri);
}

/** Consume all pending element batches for one board. */
export function consumePendingBoardElements(
  boardFolderUri: string,
): PendingBoardElementBatch[] {
  const normalizedBoardFolderUri = boardFolderUri.trim();
  if (!normalizedBoardFolderUri) return [];
  const batches = pendingElementBatches.get(normalizedBoardFolderUri) ?? [];
  if (batches.length > 0) {
    pendingElementBatches.delete(normalizedBoardFolderUri);
  }
  return batches;
}

/** Subscribe to pending-board-element notifications. */
export function onPendingBoardElements(
  listener: (detail: PendingBoardElementsEventDetail) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const handleEvent = (event: Event) => {
    const detail = (event as CustomEvent<PendingBoardElementsEventDetail>).detail;
    if (!detail?.boardFolderUri) return;
    listener(detail);
  };

  window.addEventListener(BOARD_PENDING_ELEMENTS_EVENT, handleEvent as EventListener);
  return () => {
    window.removeEventListener(BOARD_PENDING_ELEMENTS_EVENT, handleEvent as EventListener);
  };
}

/** Store initial elements for backward-compatible callers. */
export function setPendingElements(boardFolderUri: string, elements: CanvasElement[]): void {
  queuePendingBoardElements(boardFolderUri, {
    elements,
    mode: "replace-if-empty",
    fitView: true,
  });
}

/** Consume the first pending batch for backward-compatible callers. */
export function consumePendingElements(boardFolderUri: string): CanvasElement[] | undefined {
  return consumePendingBoardElements(boardFolderUri)[0]?.elements;
}
