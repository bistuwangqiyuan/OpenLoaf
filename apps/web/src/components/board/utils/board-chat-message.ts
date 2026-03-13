/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import type { CanvasConnectorElement, CanvasElement, CanvasNodeElement } from "../engine/types";

export type BoardChatMessageStatus = "streaming" | "complete" | "error";

export type BoardChatMessageMeta = {
  /** Assistant message id stored on the message group. */
  messageId?: string;
  /** User message id that triggered the assistant response. */
  userMessageId?: string;
  /** Source chat input node id. */
  sourceInputNodeId?: string;
  /** Current streaming status. */
  status?: BoardChatMessageStatus;
  /** Error text for failed message projections. */
  errorText?: string;
  /** Chat model id used for this response. */
  chatModelId?: string;
};

export type BoardChatPartMeta = {
  /** Parent message group id. */
  messageGroupId: string;
  /** Stable key used for reconciliation. */
  partKey: string;
  /** Projection kind used for node recreation checks. */
  projectionKind: string;
};

export const BOARD_CHAT_MESSAGE_META_KEY = "boardChatMessage";
export const BOARD_CHAT_PART_META_KEY = "boardChatPart";
const MESSAGE_GROUP_GAP = 12;
const MESSAGE_GROUP_MIN_WIDTH = 280;
const MESSAGE_GROUP_MIN_HEIGHT = 48;

/** Resolve board chat message meta from an element. */
export function getBoardChatMessageMeta(
  element: CanvasElement | null | undefined,
): BoardChatMessageMeta | null {
  if (!element || element.kind !== "node") return null;
  const meta = element.meta as Record<string, unknown> | undefined;
  const raw = meta?.[BOARD_CHAT_MESSAGE_META_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as BoardChatMessageMeta;
}

/** Resolve board chat part meta from an element. */
export function getBoardChatPartMeta(
  element: CanvasElement | null | undefined,
): BoardChatPartMeta | null {
  if (!element || element.kind !== "node") return null;
  const meta = element.meta as Record<string, unknown> | undefined;
  const raw = meta?.[BOARD_CHAT_PART_META_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as BoardChatPartMeta;
}

/** Return whether the target node is a board chat message group. */
export function isBoardChatMessageGroup(
  element: CanvasElement | null | undefined,
): element is CanvasNodeElement<{ childIds?: string[] }> {
  return Boolean(getBoardChatMessageMeta(element));
}

/** Return whether the target node is a projected board chat part node. */
export function isBoardChatPartNode(
  element: CanvasElement | null | undefined,
): element is CanvasNodeElement {
  return Boolean(getBoardChatPartMeta(element));
}

/** Update board chat message meta on a group node. */
export function updateBoardChatMessageMeta(
  engine: {
    doc: {
      getElementById: (id: string) => CanvasElement | null | undefined;
      updateElement: (id: string, patch: Partial<CanvasNodeElement>) => void;
    };
  },
  groupId: string,
  patch: Partial<BoardChatMessageMeta>,
): void {
  const group = engine.doc.getElementById(groupId);
  if (!group || group.kind !== "node") return;
  const currentMeta = (group.meta as Record<string, unknown> | undefined) ?? {};
  const currentMessageMeta = getBoardChatMessageMeta(group) ?? {};
  engine.doc.updateElement(groupId, {
    meta: {
      ...currentMeta,
      [BOARD_CHAT_MESSAGE_META_KEY]: {
        ...currentMessageMeta,
        ...patch,
      },
    },
  });
}

/** Update board chat part meta on a child node. */
export function updateBoardChatPartMeta(
  engine: {
    doc: {
      getElementById: (id: string) => CanvasElement | null | undefined;
      updateElement: (id: string, patch: Partial<CanvasNodeElement>) => void;
    };
  },
  elementId: string,
  patch: BoardChatPartMeta,
): void {
  const node = engine.doc.getElementById(elementId);
  if (!node || node.kind !== "node") return;
  const currentMeta = (node.meta as Record<string, unknown> | undefined) ?? {};
  engine.doc.updateElement(elementId, {
    meta: {
      ...currentMeta,
      groupId: patch.messageGroupId,
      [BOARD_CHAT_PART_META_KEY]: patch,
    },
  });
}

/** Return ordered child ids for a board chat message group. */
export function getBoardChatMessageChildIds(
  element: CanvasNodeElement<{ childIds?: string[] }>,
  allElements: CanvasElement[],
): string[] {
  const configured = Array.isArray(element.props?.childIds)
    ? element.props.childIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];
  if (configured.length > 0) {
    return configured.filter((id) => allElements.some((item) => item.id === id));
  }
  return allElements
    .filter((item): item is CanvasNodeElement => item.kind === "node")
    .filter((item) => getBoardChatPartMeta(item)?.messageGroupId === element.id)
    .map((item) => item.id);
}

/** Layout board chat part nodes vertically and sync group bounds. */
export function layoutBoardChatMessageGroup(engine: {
  batch: (fn: () => void) => void;
  doc: {
    getElementById: (id: string) => CanvasElement | null | undefined;
    getElements: () => CanvasElement[];
    transact: (fn: () => void) => void;
    updateElement: (id: string, patch: Partial<CanvasNodeElement>) => void;
    updateNodeProps: (id: string, patch: Record<string, unknown>) => void;
  };
} , groupId: string): void {
  const group = engine.doc.getElementById(groupId);
  if (!group || group.kind !== "node") return;
  const elements = engine.doc.getElements();
  const childIds = getBoardChatMessageChildIds(group as CanvasNodeElement<{ childIds?: string[] }>, elements);
  const childNodes = childIds
    .map((id) => engine.doc.getElementById(id))
    .filter((item): item is CanvasNodeElement => item?.kind === "node");
  const [groupX, groupY, groupW, groupH] = group.xywh;

  engine.batch(() => {
    engine.doc.transact(() => {
      if (childNodes.length === 0) {
        engine.doc.updateNodeProps(groupId, { childIds: [] });
        engine.doc.updateElement(groupId, {
          xywh: [
            groupX,
            groupY,
            Math.max(groupW, MESSAGE_GROUP_MIN_WIDTH),
            Math.max(groupH, MESSAGE_GROUP_MIN_HEIGHT),
          ],
        });
        return;
      }

      let cursorY = groupY;
      let maxRight = groupX + MESSAGE_GROUP_MIN_WIDTH;

      childNodes.forEach((child) => {
        const [, , width, height] = child.xywh;
        engine.doc.updateElement(child.id, {
          xywh: [groupX, cursorY, width, height],
        });
        cursorY += height + MESSAGE_GROUP_GAP;
        maxRight = Math.max(maxRight, groupX + width);
      });

      const totalHeight = cursorY - groupY - MESSAGE_GROUP_GAP;
      engine.doc.updateNodeProps(groupId, { childIds });
      engine.doc.updateElement(groupId, {
        xywh: [
          groupX,
          groupY,
          Math.max(maxRight - groupX, MESSAGE_GROUP_MIN_WIDTH),
          Math.max(totalHeight, MESSAGE_GROUP_MIN_HEIGHT),
        ],
      });
    });
  });
}

/** Delete related connectors for a board chat message element set. */
function deleteBoardChatConnectors(
  engine: {
    doc: {
      getElements: () => CanvasElement[];
      deleteElements: (ids: string[]) => void;
    };
  },
  elementIds: Set<string>,
): void {
  const connectorIds = engine.doc
    .getElements()
    .filter((element): element is CanvasConnectorElement => element.kind === "connector")
    .filter((element) => {
      const sourceId = "elementId" in element.source ? element.source.elementId : null;
      const targetId = "elementId" in element.target ? element.target.elementId : null;
      return (
        (sourceId ? elementIds.has(sourceId) : false)
        || (targetId ? elementIds.has(targetId) : false)
      );
    })
    .map((element) => element.id);
  if (connectorIds.length > 0) {
    engine.doc.deleteElements(connectorIds);
  }
}

/** Delete one board chat message element, handling both group and single-node forms. */
export function deleteBoardChatMessageElement(engine: {
  batch: (fn: () => void) => void;
  doc: {
    getElementById: (id: string) => CanvasElement | null | undefined;
    getElements: () => CanvasElement[];
    transact: (fn: () => void) => void;
    deleteElements: (ids: string[]) => void;
  };
}, elementId: string): void {
  const element = engine.doc.getElementById(elementId);
  if (!element || element.kind !== "node") return;
  const deleteSet = new Set<string>([elementId]);

  if (Array.isArray((element.props as { childIds?: string[] }).childIds)) {
    const elements = engine.doc.getElements();
    const childIds = getBoardChatMessageChildIds(
      element as CanvasNodeElement<{ childIds?: string[] }>,
      elements,
    );
    childIds.forEach((childId) => deleteSet.add(childId));
  }

  engine.batch(() => {
    engine.doc.transact(() => {
      deleteBoardChatConnectors(engine, deleteSet);
      engine.doc.deleteElements(Array.from(deleteSet));
    });
  });
}

/** Delete a board chat message group with all projected child nodes and related connectors. */
export function deleteBoardChatMessageGroup(engine: {
  batch: (fn: () => void) => void;
  doc: {
    getElementById: (id: string) => CanvasElement | null | undefined;
    getElements: () => CanvasElement[];
    transact: (fn: () => void) => void;
    deleteElements: (ids: string[]) => void;
  };
}, groupId: string): void {
  deleteBoardChatMessageElement(engine, groupId);
}

/** Collapse a single-child board chat group into a standalone message node. */
export function collapseBoardChatMessageGroup(engine: {
  batch: (fn: () => void) => void;
  selection: {
    getSelectedIds: () => string[];
    setSelection: (ids: string[]) => void;
  };
  doc: {
    getElementById: (id: string) => CanvasElement | null | undefined;
    getElements: () => CanvasElement[];
    transact: (fn: () => void) => void;
    updateElement: (id: string, patch: Partial<CanvasElement>) => void;
    deleteElement: (id: string) => void;
  };
}, groupId: string): string | null {
  const group = engine.doc.getElementById(groupId);
  if (!group || group.kind !== "node") return null;

  const groupMeta = getBoardChatMessageMeta(group);
  if (!groupMeta) return null;

  const childIds = getBoardChatMessageChildIds(
    group as CanvasNodeElement<{ childIds?: string[] }>,
    engine.doc.getElements(),
  );
  if (childIds.length !== 1) return null;

  const childId = childIds[0]!;
  const child = engine.doc.getElementById(childId);
  if (!child || child.kind !== "node") return null;

  const childMeta = { ...((child.meta as Record<string, unknown> | undefined) ?? {}) };
  delete childMeta.groupId;
  delete childMeta[BOARD_CHAT_PART_META_KEY];

  const selectedIds = engine.selection.getSelectedIds();
  const nextSelectedIds = Array.from(new Set(
    selectedIds.map((id) => (id === groupId ? childId : id)),
  ));

  engine.batch(() => {
    engine.doc.transact(() => {
      engine.doc.updateElement(childId, {
        xywh: [group.xywh[0], group.xywh[1], child.xywh[2], child.xywh[3]],
        zIndex: group.zIndex ?? child.zIndex,
        meta: {
          ...childMeta,
          [BOARD_CHAT_MESSAGE_META_KEY]: {
            ...groupMeta,
          },
        },
      });

      engine.doc
        .getElements()
        .filter((element): element is CanvasConnectorElement => element.kind === "connector")
        .forEach((element) => {
          const nextSource =
            "elementId" in element.source && element.source.elementId === groupId
              ? { ...element.source, elementId: childId }
              : element.source;
          const nextTarget =
            "elementId" in element.target && element.target.elementId === groupId
              ? { ...element.target, elementId: childId }
              : element.target;
          if (nextSource === element.source && nextTarget === element.target) return;
          engine.doc.updateElement(element.id, {
            source: nextSource,
            target: nextTarget,
          } as Partial<CanvasConnectorElement>);
        });

      engine.doc.deleteElement(groupId);
    });
  });

  engine.selection.setSelection(nextSelectedIds);
  return childId;
}
