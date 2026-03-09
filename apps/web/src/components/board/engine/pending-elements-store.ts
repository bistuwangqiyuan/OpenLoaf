/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import type { CanvasElement } from './types'

const pendingElements = new Map<string, CanvasElement[]>()

/** Store initial elements to be consumed when a board mounts. */
export function setPendingElements(boardFolderUri: string, elements: CanvasElement[]): void {
  pendingElements.set(boardFolderUri, elements)
}

/** Consume and remove pending elements for a board. Returns undefined if none. */
export function consumePendingElements(boardFolderUri: string): CanvasElement[] | undefined {
  const elements = pendingElements.get(boardFolderUri)
  if (elements) {
    pendingElements.delete(boardFolderUri)
  }
  return elements
}
