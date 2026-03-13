/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import type { ChatUIMessage } from "@openloaf/api";
import type { CanvasConnectorElement, CanvasElement, CanvasNodeElement } from "../engine/types";
import { GROUP_NODE_TYPE } from "../engine/grouping";
import { generateElementId } from "../engine/id";
import { CHAT_INPUT_NODE_TYPE } from "../nodes/chatInput/types";
import {
  BOARD_CHAT_MESSAGE_META_KEY,
  BOARD_CHAT_PART_META_KEY,
} from "./board-chat-message";
import {
  buildBoardChatProjectionDescriptors,
  buildBoardChatProjectionParts,
} from "./board-chat-projection";

type ImportedBoardMessage = ChatUIMessage & {
  /** Imported creation time for deterministic ordering. */
  createdAt: string;
};

type MessageVisualSpec = {
  /** Anchor element id used for chain connectors. */
  anchorId: string;
  /** Node width. */
  width: number;
  /** Node height. */
  height: number;
  /** Build positioned canvas elements. */
  createElements: (x: number, y: number) => CanvasElement[];
};

const ROOT_PARENT_KEY = "__root__";
const HORIZONTAL_GAP = 520;
const VERTICAL_GAP = 56;
const PART_GAP = 12;
const MESSAGE_MIN_WIDTH = 280;
const MESSAGE_MIN_HEIGHT = 48;
const USER_MESSAGE_WIDTH = 400;
const USER_MESSAGE_HEIGHT = 88;
const CONTINUATION_INPUT_WIDTH = 360;
const CONTINUATION_INPUT_HEIGHT = 200;

/** Build an initial board snapshot from imported chat history. */
export async function buildImportedChatBoardElements(input: {
  messages: ImportedBoardMessage[];
  projectId?: string;
}): Promise<CanvasElement[]> {
  const orderedMessages = sortImportedMessages(input.messages);
  const allMessagesById = new Map(orderedMessages.map((message) => [message.id, message]));
  const renderableMessages = orderedMessages.filter(isRenderableMessage);

  if (renderableMessages.length === 0) {
    return createContinuationInput({ x: 0, y: 0 });
  }

  const childrenOf = new Map<string, string[]>();
  const visualParentById = new Map<string, string | null>();
  const orderById = new Map(renderableMessages.map((message, index) => [message.id, index]));

  for (const message of renderableMessages) {
    const visualParentId = resolveRenderableParentId(message, allMessagesById);
    visualParentById.set(message.id, visualParentId);
    const parentKey = visualParentId ?? ROOT_PARENT_KEY;
    const nextChildren = childrenOf.get(parentKey) ?? [];
    nextChildren.push(message.id);
    childrenOf.set(parentKey, nextChildren);
  }

  const specEntries = await Promise.all(
    renderableMessages.map(async (message) => {
      const spec = await buildMessageVisualSpec({
        message,
        projectId: input.projectId,
        visualParentId: visualParentById.get(message.id) ?? null,
      });
      return [message.id, spec] as const;
    }),
  );
  const specsById = new Map(specEntries);

  const elements: CanvasElement[] = [];
  let cursorY = 0;
  const rootIds = [...(childrenOf.get(ROOT_PARENT_KEY) ?? [])].sort(
    (left, right) => (orderById.get(left) ?? 0) - (orderById.get(right) ?? 0),
  );

  for (const rootId of rootIds) {
    cursorY = layoutMessageTree({
      messageId: rootId,
      x: 0,
      y: cursorY,
      childrenOf,
      specsById,
      orderById,
      elements,
    });
    cursorY += VERTICAL_GAP;
  }

  const latestLeafId = resolveLatestRenderableLeafId(renderableMessages, childrenOf);
  const latestLeafSpec = latestLeafId ? specsById.get(latestLeafId) ?? null : null;
  const latestLeafElements = latestLeafSpec
    ? elements.filter((element) => element.id === latestLeafSpec.anchorId)
    : [];
  if (latestLeafSpec && latestLeafElements.length > 0) {
    const latestAnchor = latestLeafElements[0] as CanvasNodeElement;
    const continuationX = latestAnchor.xywh[0] + HORIZONTAL_GAP;
    const continuationY = latestAnchor.xywh[1];
    const continuation = createContinuationInput({
      x: continuationX,
      y: continuationY,
      parentElementId: latestLeafSpec.anchorId,
    });
    elements.push(...continuation);
  }

  return elements;
}

/** Build a renderable parent id by walking ancestors until another renderable message is found. */
function resolveRenderableParentId(
  message: ImportedBoardMessage,
  messagesById: Map<string, ImportedBoardMessage>,
): string | null {
  let parentId = message.parentMessageId;
  const visited = new Set<string>();
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = messagesById.get(parentId);
    if (!parent) return null;
    if (isRenderableMessage(parent)) return parent.id;
    parentId = parent.parentMessageId;
  }
  return null;
}

/** Build a visual spec for a renderable imported message. */
async function buildMessageVisualSpec(input: {
  message: ImportedBoardMessage;
  projectId?: string;
  visualParentId: string | null;
}): Promise<MessageVisualSpec> {
  if (input.message.role === "user") {
    const nodeId = generateElementId("import-user");
    const text = extractTextFromParts(input.message.parts);
    return {
      anchorId: nodeId,
      width: USER_MESSAGE_WIDTH,
      height: USER_MESSAGE_HEIGHT,
      createElements: (x, y) => [
        {
          id: nodeId,
          kind: "node",
          type: "text",
          xywh: [x, y, USER_MESSAGE_WIDTH, USER_MESSAGE_HEIGHT],
          props: {
            readOnlyProjection: true,
            markdownText: text || " ",
          },
          meta: {
            [BOARD_CHAT_MESSAGE_META_KEY]: {
              messageId: input.message.id,
              status: "complete",
            },
          },
        } satisfies CanvasNodeElement<Record<string, unknown>>,
      ],
    };
  }

  const descriptors = await buildBoardChatProjectionDescriptors({
    parts: buildBoardChatProjectionParts(Array.isArray(input.message.parts) ? input.message.parts : []),
    projectId: input.projectId,
  });

  if (descriptors.length <= 1) {
    const descriptor =
      descriptors[0] ??
      ({
        key: "fallback-text",
        projectionKind: "text",
        nodeType: "text",
        props: {
          readOnlyProjection: true,
          markdownText: extractTextFromParts(input.message.parts) || " ",
        },
        size: [USER_MESSAGE_WIDTH, USER_MESSAGE_HEIGHT],
      } as const);
    const nodeId = generateElementId("import-assistant");
    return {
      anchorId: nodeId,
      width: descriptor.size[0],
      height: descriptor.size[1],
      createElements: (x, y) => [
        {
          id: nodeId,
          kind: "node",
          type: descriptor.nodeType,
          xywh: [x, y, descriptor.size[0], descriptor.size[1]],
          props: descriptor.props,
          meta: {
            [BOARD_CHAT_MESSAGE_META_KEY]: {
              messageId: input.message.id,
              status: "complete",
              ...(input.visualParentId ? { userMessageId: input.visualParentId } : null),
            },
          },
        } satisfies CanvasNodeElement<Record<string, unknown>>,
      ],
    };
  }

  const groupId = generateElementId("import-group");
  const childEntries = descriptors.map((descriptor) => ({
    descriptor,
    id: generateElementId(`import-${descriptor.nodeType}`),
  }));
  const width = Math.max(
    MESSAGE_MIN_WIDTH,
    ...childEntries.map((entry) => entry.descriptor.size[0]),
  );
  const height = Math.max(
    MESSAGE_MIN_HEIGHT,
    childEntries.reduce((total, entry, index) => {
      return total + entry.descriptor.size[1] + (index > 0 ? PART_GAP : 0);
    }, 0),
  );

  return {
    anchorId: groupId,
    width,
    height,
    createElements: (x, y) => {
      let cursorY = y;
      const childIds: string[] = [];
      const childElements = childEntries.map((entry) => {
        const childId = entry.id;
        childIds.push(childId);
        const element: CanvasNodeElement<Record<string, unknown>> = {
          id: childId,
          kind: "node",
          type: entry.descriptor.nodeType,
          xywh: [x, cursorY, entry.descriptor.size[0], entry.descriptor.size[1]],
          props: entry.descriptor.props,
          meta: {
            groupId,
            [BOARD_CHAT_PART_META_KEY]: {
              messageGroupId: groupId,
              partKey: entry.descriptor.key,
              projectionKind: entry.descriptor.projectionKind,
            },
          },
        };
        cursorY += entry.descriptor.size[1] + PART_GAP;
        return element;
      });

      const groupElement: CanvasNodeElement<{ childIds: string[] }> = {
        id: groupId,
        kind: "node",
        type: GROUP_NODE_TYPE,
        xywh: [x, y, width, height],
        props: { childIds },
        meta: {
          [BOARD_CHAT_MESSAGE_META_KEY]: {
            messageId: input.message.id,
            status: "complete",
            ...(input.visualParentId ? { userMessageId: input.visualParentId } : null),
          },
        },
      };

      return [groupElement, ...childElements];
    },
  };
}

/** Layout a message subtree and append elements in DFS order. */
function layoutMessageTree(input: {
  messageId: string;
  x: number;
  y: number;
  childrenOf: Map<string, string[]>;
  specsById: Map<string, MessageVisualSpec>;
  orderById: Map<string, number>;
  elements: CanvasElement[];
}): number {
  const spec = input.specsById.get(input.messageId);
  if (!spec) return input.y;

  input.elements.push(...spec.createElements(input.x, input.y));

  let cursorY = input.y + spec.height + VERTICAL_GAP;
  const childIds = [...(input.childrenOf.get(input.messageId) ?? [])].sort(
    (left, right) => (input.orderById.get(left) ?? 0) - (input.orderById.get(right) ?? 0),
  );

  for (const childId of childIds) {
    const childSpec = input.specsById.get(childId);
    if (!childSpec) continue;
    const childStartY = cursorY;
    cursorY = layoutMessageTree({
      ...input,
      messageId: childId,
      x: input.x + HORIZONTAL_GAP,
      y: childStartY,
    });
    input.elements.push(
      createChainConnector({
        sourceElementId: spec.anchorId,
        targetElementId: childSpec.anchorId,
      }),
    );
    cursorY += VERTICAL_GAP;
  }

  return cursorY;
}

/** Resolve the latest renderable leaf from the imported message list. */
function resolveLatestRenderableLeafId(
  messages: ImportedBoardMessage[],
  childrenOf: Map<string, string[]>,
): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const children = childrenOf.get(message.id) ?? [];
    if (children.length === 0) return message.id;
  }
  return null;
}

/** Create the continuation input node and optional connector. */
function createContinuationInput(input: {
  x: number;
  y: number;
  parentElementId?: string;
}): CanvasElement[] {
  const inputId = generateElementId("import-input");
  const elements: CanvasElement[] = [
    {
      id: inputId,
      kind: "node",
      type: CHAT_INPUT_NODE_TYPE,
      xywh: [input.x, input.y, CONTINUATION_INPUT_WIDTH, CONTINUATION_INPUT_HEIGHT],
      props: {
        autoFocus: true,
        status: "idle",
      },
    } satisfies CanvasNodeElement<Record<string, unknown>>,
  ];
  if (input.parentElementId) {
    elements.push(
      createChainConnector({
        sourceElementId: input.parentElementId,
        targetElementId: inputId,
      }),
    );
  }
  return elements;
}

/** Create a connector between two imported chain nodes. */
function createChainConnector(input: {
  sourceElementId: string;
  targetElementId: string;
}): CanvasConnectorElement {
  return {
    id: generateElementId("import-connector"),
    kind: "connector",
    type: "connector",
    xywh: [0, 0, 0, 0],
    source: { elementId: input.sourceElementId },
    target: { elementId: input.targetElementId },
    style: "curve",
  };
}

/** Extract plain text from message parts for imported user nodes. */
function extractTextFromParts(parts: unknown[]): string {
  return parts
    .filter(
      (part): part is { type: string; text: string } =>
        Boolean(part) &&
        typeof part === "object" &&
        (part as { type?: unknown }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string",
    )
    .map((part) => part.text)
    .join("\n")
    .trim();
}

/** Return whether a message should appear on the imported board. */
function isRenderableMessage(message: ImportedBoardMessage): boolean {
  const kind = message.messageKind ?? "normal";
  if (kind === "compact_prompt") return false;
  if (kind === "compact_summary") return true;
  if (message.role === "subagent" || message.role === "system") return false;
  if (message.role === "user") return true;
  return Array.isArray(message.parts) && message.parts.length > 0;
}

/** Sort imported messages with stable chronological ordering. */
function sortImportedMessages(messages: ImportedBoardMessage[]): ImportedBoardMessage[] {
  return [...messages].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();
    return leftTime - rightTime || left.id.localeCompare(right.id);
  });
}
