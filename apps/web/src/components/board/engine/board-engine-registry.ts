/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import type { CanvasEngine } from "./CanvasEngine";

const registry = new Map<string, CanvasEngine>();

export function registerBoardEngine(panelKey: string, engine: CanvasEngine): void {
  registry.set(panelKey, engine);
}

export function unregisterBoardEngine(panelKey: string): void {
  registry.delete(panelKey);
}

export function getBoardEngine(panelKey: string): CanvasEngine | undefined {
  return registry.get(panelKey);
}
