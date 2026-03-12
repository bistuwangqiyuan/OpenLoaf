/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import type {
  CanvasNodeDefinition,
  CanvasNodeViewProps,
  CanvasToolbarContext,
  CanvasToolbarItem,
} from "../engine/types";
import { z } from "zod";
import { Layers, Maximize2, MessageSquarePlus, RotateCcw, Square } from "lucide-react";
import { cn } from "@udecode/cn";
import i18next from "i18next";
import {
  BOARD_TOOLBAR_ITEM_AMBER,
  BOARD_TOOLBAR_ITEM_BLUE,
} from "../ui/board-style-system";
import { GROUP_NODE_TYPE, IMAGE_GROUP_NODE_TYPE, getGroupMemberIds } from "../engine/grouping";
import { CHAT_INPUT_NODE_TYPE } from "./chatInput/types";
import { NodeFrame } from "./NodeFrame";
import { resolveRightStackPlacement } from "../utils/output-placement";
import { useBoardChatStore } from "../hooks/boardChatStore";
import {
  deleteBoardChatMessageGroup,
  getBoardChatMessageMeta,
} from "../utils/board-chat-message";

export type GroupNodeProps = {
  /** Child node ids stored for grouping semantics. */
  childIds: string[];
};

/** Render a transparent group container. */
function GroupNodeView(_props: CanvasNodeViewProps<GroupNodeProps>) {
  return (
    <NodeFrame>
      <div
        className={cn(
          "pointer-events-none absolute inset-0 rounded-xl",
          "bg-neutral-300/25 dark:bg-neutral-600/20"
        )}
      />
    </NodeFrame>
  );
}

const groupSchema = z.object({
  childIds: z.array(z.string()),
});

const groupCapabilities = {
  resizable: false,
  rotatable: false,
  connectable: "anchors" as const,
};

/** Node types eligible for uniform-size inside a group. */
const UNIFORM_SIZE_TYPES = new Set(["image", "video"]);
const MESSAGE_CONTINUE_NODE_SIZE: [number, number] = [360, 200];
const MESSAGE_OUTPUT_SIDE_GAP = 60;
const MESSAGE_OUTPUT_STACK_GAP = 16;

/** Build toolbar items for a board chat message group. */
function createBoardChatMessageToolbarItems(
  ctx: CanvasToolbarContext<GroupNodeProps>,
  messageMeta: NonNullable<ReturnType<typeof getBoardChatMessageMeta>>,
): CanvasToolbarItem[] {
  const t = (k: string) => i18next.t(k);
  const groupId = ctx.element.id;
  const engine = ctx.engine;
  const status = messageMeta.status ?? "streaming";

  if (status === "streaming") {
    return [
      {
        id: "stop",
        label: t("board:chatMessage.stop"),
        icon: <Square size={14} />,
        className: BOARD_TOOLBAR_ITEM_AMBER,
        onSelect: () => {
          const stream = useBoardChatStore.getState().getStream(groupId);
          stream?.abortController?.abort();
        },
      },
    ];
  }

  if (status === "error") {
    return [
      {
        id: "retry",
        label: t("board:chatMessage.retry"),
        icon: <RotateCcw size={14} />,
        className: BOARD_TOOLBAR_ITEM_AMBER,
        onSelect: () => {
          const nextSelection =
            typeof messageMeta.sourceInputNodeId === "string" && messageMeta.sourceInputNodeId
              ? [messageMeta.sourceInputNodeId]
              : [];
          if (messageMeta.sourceInputNodeId) {
            engine.doc.updateNodeProps(messageMeta.sourceInputNodeId, {
              status: "idle",
              errorText: undefined,
            });
          }
          deleteBoardChatMessageGroup(engine, groupId);
          engine.selection.setSelection(nextSelection);
          engine.commitHistory();
        },
      },
    ];
  }

  const continueChat = () => {
    const element = engine.doc.getElementById(groupId);
    if (!element || element.kind !== "node") return;
    const existingOutputs: [number, number, number, number][] = [];
    for (const item of engine.doc.getElements()) {
      if (item.kind !== "connector") continue;
      if (!item.source || !("elementId" in item.source) || item.source.elementId !== groupId) continue;
      if (!item.target || !("elementId" in item.target)) continue;
      const targetElement = engine.doc.getElementById(item.target.elementId);
      if (targetElement && targetElement.kind === "node") {
        existingOutputs.push(targetElement.xywh);
      }
    }
    const placement = resolveRightStackPlacement(element.xywh, existingOutputs, {
      sideGap: MESSAGE_OUTPUT_SIDE_GAP,
      stackGap: MESSAGE_OUTPUT_STACK_GAP,
      outputHeights: [MESSAGE_CONTINUE_NODE_SIZE[1]],
    });
    if (!placement) return;
    const nextId = engine.addNodeElement(
      CHAT_INPUT_NODE_TYPE,
      { status: "idle", autoFocus: true },
      [
        placement.baseX,
        placement.startY,
        MESSAGE_CONTINUE_NODE_SIZE[0],
        MESSAGE_CONTINUE_NODE_SIZE[1],
      ],
    );
    if (!nextId) return;
    engine.addConnectorElement({
      source: { elementId: groupId },
      target: { elementId: nextId },
      style: engine.getConnectorStyle(),
    });
  };

  return [
    {
      id: "continue-chat",
      label: t("board:chatMessage.continueChatLabel"),
      icon: <MessageSquarePlus size={14} />,
      className: BOARD_TOOLBAR_ITEM_BLUE,
      onSelect: continueChat,
    },
    {
      id: "ungroup",
      label: t("board:groupNode.dissolve"),
      icon: <Layers size={14} />,
      className: BOARD_TOOLBAR_ITEM_AMBER,
      onSelect: () => ctx.ungroupSelection(),
    },
  ];
}

function createGroupToolbarItems(ctx: CanvasToolbarContext<GroupNodeProps>) {
  const t = (k: string) => i18next.t(k);
  const groupId = ctx.element.id;
  const boardChatMeta = getBoardChatMessageMeta(ctx.element);
  if (boardChatMeta) {
    return createBoardChatMessageToolbarItems(ctx, boardChatMeta);
  }

  const elements = ctx.engine.doc.getElements();
  const memberIds = getGroupMemberIds(elements, groupId);
  const memberTypes = memberIds.map(id => {
    const el = elements.find((e: { id: string }) => e.id === id);
    return el?.kind === "node" ? el.type : null;
  });
  const allSameMediaType =
    memberTypes.length > 0 &&
    memberTypes.every(t => t !== null && UNIFORM_SIZE_TYPES.has(t)) &&
    new Set(memberTypes).size === 1;

  const items = [
    {
      id: 'ungroup',
      label: t('board:groupNode.dissolve'),
      icon: <Layers size={14} />,
      className: BOARD_TOOLBAR_ITEM_AMBER,
      onSelect: () => ctx.ungroupSelection(),
    },
  ];

  if (allSameMediaType) {
    items.push({
      id: 'uniform-size',
      label: t('board:groupNode.uniformSize'),
      icon: <Maximize2 size={14} />,
      className: BOARD_TOOLBAR_ITEM_BLUE,
      onSelect: () => ctx.uniformGroupSize(groupId),
    });
  }

  return items;
}

/** Definition for a generic group node. */
export const GroupNodeDefinition: CanvasNodeDefinition<GroupNodeProps> = {
  type: GROUP_NODE_TYPE,
  schema: groupSchema,
  defaultProps: {
    childIds: [],
  },
  view: GroupNodeView,
  capabilities: groupCapabilities,
  toolbar: ctx => createGroupToolbarItems(ctx),
};

/** Definition for an image group node. */
export const ImageGroupNodeDefinition: CanvasNodeDefinition<GroupNodeProps> = {
  type: IMAGE_GROUP_NODE_TYPE,
  schema: groupSchema,
  defaultProps: {
    childIds: [],
  },
  view: GroupNodeView,
  capabilities: groupCapabilities,
  toolbar: ctx => createGroupToolbarItems(ctx),
};
