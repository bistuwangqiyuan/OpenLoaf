/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import type { CanvasToolbarContext, CanvasToolbarItem } from "../engine/types";
import type { BoardChatMessageMeta } from "./board-chat-message";
import { MessageSquarePlus, RotateCcw, Square } from "lucide-react";
import i18next from "i18next";
import { CHAT_INPUT_NODE_TYPE } from "../nodes/chatInput/types";
import { resolveRightStackPlacement } from "./output-placement";
import { useBoardChatStore } from "../hooks/boardChatStore";
import { deleteBoardChatMessageElement } from "./board-chat-message";
import {
  BOARD_TOOLBAR_ITEM_AMBER,
  BOARD_TOOLBAR_ITEM_BLUE,
} from "../ui/board-style-system";

const MESSAGE_CONTINUE_NODE_SIZE: [number, number] = [360, 200];
const MESSAGE_OUTPUT_SIDE_GAP = 60;
const MESSAGE_OUTPUT_STACK_GAP = 16;

/** Build shared toolbar items for a board chat message container node. */
export function createBoardChatMessageToolbarItems<P>(
  ctx: CanvasToolbarContext<P>,
  messageMeta: BoardChatMessageMeta,
): CanvasToolbarItem[] {
  const t = (key: string) => i18next.t(key);
  const elementId = ctx.element.id;
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
          const stream = useBoardChatStore.getState().getStream(elementId);
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
          deleteBoardChatMessageElement(engine, elementId);
          engine.selection.setSelection(nextSelection);
          engine.commitHistory();
        },
      },
    ];
  }

  return [
    {
      id: "continue-chat",
      label: t("board:chatMessage.continueChatLabel"),
      icon: <MessageSquarePlus size={14} />,
      className: BOARD_TOOLBAR_ITEM_BLUE,
      onSelect: () => {
        const element = engine.doc.getElementById(elementId);
        if (!element || element.kind !== "node") return;
        const existingOutputs: [number, number, number, number][] = [];
        for (const item of engine.doc.getElements()) {
          if (item.kind !== "connector") continue;
          if (!item.source || !("elementId" in item.source) || item.source.elementId !== elementId) {
            continue;
          }
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
          source: { elementId },
          target: { elementId: nextId },
          style: engine.getConnectorStyle(),
        });
      },
    },
  ];
}
