/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import type { OpenLoafUIMessage } from "@openloaf/api/types/message";
import { resolveServerUrl } from "@/utils/server-url";
import { getAccessToken } from "@/lib/saas-auth";
import { getWebClientId } from "@/lib/chat/streamClientId";
import { getClientTimeZone } from "@/utils/time-zone";
import { isElectronEnv } from "@/utils/is-electron-env";
import { trpcClient } from "@/utils/trpc";
import type { CanvasEngine } from "../engine/CanvasEngine";
import { projectBoardChatMessageParts } from "../utils/board-chat-projection";
import { useBoardChatStore } from "./boardChatStore";

export type SendBoardChatMessageInput = {
  /** Board session ID (= boardId). */
  sessionId: string;
  /** Board ID. */
  boardId: string;
  /** Project ID. */
  projectId?: string;
  /** The user message to send. */
  userMessage: OpenLoafUIMessage;
  /** Client-generated assistant message ID. */
  assistantMessageId: string;
  /** Ordered message IDs from canvas chain. */
  messageIdChain: string[];
  /** Selected chat model ID. */
  chatModelId?: string;
  /** Message group element id for projection + store keying. */
  messageGroupElementId: string;
  /** Canvas engine used for node projection. */
  engine: CanvasEngine;
  /** Image save directory URI. */
  imageSaveDir?: string;
  /** Callback when Yjs status should be updated. */
  onStatusChange: (status: "streaming" | "complete" | "error", errorText?: string) => void;
};

/** Parse AI SDK data stream wire format lines. */
function parseDataStreamLine(line: string): { type: string; value: string } | null {
  // AI SDK wire format: <type>:<json>
  // type 0 = text-delta, 2 = data, 9 = error, a = message_annotations, d = finish, e = step_finish
  const colonIndex = line.indexOf(":");
  if (colonIndex < 0) return null;
  const type = line.slice(0, colonIndex);
  const value = line.slice(colonIndex + 1);
  return { type, value };
}

/** Load the finalized assistant message parts from chat history. */
async function loadFinalMessageParts(input: {
  sessionId: string;
  messageId: string;
}): Promise<unknown[] | null> {
  const view = await trpcClient.chat.getChatView.query({
    sessionId: input.sessionId,
    anchor: { messageId: input.messageId, strategy: "self" },
    window: { limit: 2 },
    include: { messages: true, siblingNav: false },
    includeToolOutput: true,
  });
  const message = view?.messages?.find((item: any) => item?.id === input.messageId);
  return Array.isArray(message?.parts) ? (message.parts as unknown[]) : null;
}

/** Send a board chat message and handle SSE streaming. */
export async function sendBoardChatMessage(input: SendBoardChatMessageInput): Promise<void> {
  const store = useBoardChatStore.getState();
  const abortController = new AbortController();
  store.startStream(input.messageGroupElementId, abortController);
  input.onStatusChange("streaming");

  let projectionChain = Promise.resolve();
  const queueProjection = (rawParts: unknown[]) => {
    const snapshot = Array.isArray(rawParts) ? [...rawParts] : [];
    projectionChain = projectionChain
      .catch(() => undefined)
      .then(() =>
        projectBoardChatMessageParts({
          engine: input.engine,
          groupId: input.messageGroupElementId,
          rawParts: snapshot,
          projectId: input.projectId,
        }),
      )
      .catch(() => undefined);
    return projectionChain;
  };

  const queueCurrentProjection = () => {
    const currentStream = useBoardChatStore.getState().getStream(input.messageGroupElementId);
    return queueProjection(currentStream?.parts ?? []);
  };

  try {
    const accessToken = await getAccessToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const body = {
      sessionId: input.sessionId,
      boardId: input.boardId,
      projectId: input.projectId,
      messages: [input.userMessage],
      messageId: input.assistantMessageId,
      messageIdChain: input.messageIdChain,
      chatModelId: input.chatModelId,
      imageSaveDir: input.imageSaveDir,
      clientId: getWebClientId() || undefined,
      timezone: getClientTimeZone(),
      intent: "chat",
      responseMode: "stream",
      clientPlatform: isElectronEnv() ? "desktop" : "web",
    };

    const response = await fetch(`${resolveServerUrl()}/ai/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: abortController.signal,
      credentials: "include",
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Request failed");
      store.errorStream(input.messageGroupElementId, errorText);
      await queueProjection([{ type: "text", text: errorText }]);
      input.onStatusChange("error", errorText);
      store.removeStream(input.messageGroupElementId);
      return;
    }

    if (!response.body) {
      store.errorStream(input.messageGroupElementId, "No response body");
      await queueProjection([{ type: "text", text: "No response body" }]);
      input.onStatusChange("error", "No response body");
      store.removeStream(input.messageGroupElementId);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const parsed = parseDataStreamLine(trimmed);
        if (!parsed) continue;

        switch (parsed.type) {
          case "0": {
            // text-delta
            try {
              const text = JSON.parse(parsed.value) as string;
              store.appendText(input.messageGroupElementId, text);
              void queueCurrentProjection();
            } catch {
              // Ignore parse errors
            }
            break;
          }
          case "2": {
            // data (tool results, annotations)
            try {
              const data = JSON.parse(parsed.value);
              if (Array.isArray(data)) {
                for (const item of data) {
                  store.appendPart(input.messageGroupElementId, item);
                }
                void queueCurrentProjection();
              }
            } catch {
              // Ignore parse errors
            }
            break;
          }
          case "9": {
            // error
            try {
              const errorData = JSON.parse(parsed.value);
              const errorText = typeof errorData === "string"
                ? errorData
                : errorData?.message ?? "Unknown error";
              store.errorStream(input.messageGroupElementId, errorText);
              const currentStream = useBoardChatStore.getState().getStream(input.messageGroupElementId);
              await queueProjection(
                (currentStream?.parts?.length ?? 0) > 0
                  ? currentStream?.parts ?? []
                  : [{ type: "text", text: errorText }],
              );
              input.onStatusChange("error", errorText);
              store.removeStream(input.messageGroupElementId);
              return;
            } catch {
              store.errorStream(input.messageGroupElementId, "Stream error");
              await queueProjection([{ type: "text", text: "Stream error" }]);
              input.onStatusChange("error", "Stream error");
              store.removeStream(input.messageGroupElementId);
              return;
            }
          }
          case "d": {
            // finish
            store.completeStream(input.messageGroupElementId);
            await projectionChain;
            const finalParts = await loadFinalMessageParts({
              sessionId: input.sessionId,
              messageId: input.assistantMessageId,
            }).catch(() => null);
            await queueProjection(finalParts ?? (store.getStream(input.messageGroupElementId)?.parts ?? []));
            input.onStatusChange("complete");
            store.removeStream(input.messageGroupElementId);
            return;
          }
          case "e": {
            // step_finish — continue reading
            break;
          }
        }
      }
    }

    // Stream ended without explicit finish signal
    const currentStream = store.getStream(input.messageGroupElementId);
    if (currentStream && currentStream.status === "streaming") {
      store.completeStream(input.messageGroupElementId);
      await projectionChain;
      const finalParts = await loadFinalMessageParts({
        sessionId: input.sessionId,
        messageId: input.assistantMessageId,
      }).catch(() => null);
      await queueProjection(finalParts ?? currentStream.parts);
      input.onStatusChange("complete");
      store.removeStream(input.messageGroupElementId);
    }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      store.errorStream(input.messageGroupElementId, "Cancelled");
      await queueProjection([{ type: "text", text: "Cancelled" }]);
      input.onStatusChange("error", "Cancelled");
      store.removeStream(input.messageGroupElementId);
      return;
    }
    const errorText = err instanceof Error ? err.message : "Unknown error";
    store.errorStream(input.messageGroupElementId, errorText);
    await queueProjection([{ type: "text", text: errorText }]);
    input.onStatusChange("error", errorText);
    store.removeStream(input.messageGroupElementId);
  }
}
