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
import { useBoardChatStore } from "./boardChatStore";

export type SendBoardChatMessageInput = {
  /** Board session ID (= boardId). */
  sessionId: string;
  /** Board ID. */
  boardId: string;
  /** Workspace ID. */
  workspaceId?: string;
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
  /** ChatMessageNode element ID for store keying. */
  messageNodeElementId: string;
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

/** Send a board chat message and handle SSE streaming. */
export async function sendBoardChatMessage(input: SendBoardChatMessageInput): Promise<void> {
  const store = useBoardChatStore.getState();
  const abortController = new AbortController();
  store.startStream(input.messageNodeElementId, abortController);
  input.onStatusChange("streaming");

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
      workspaceId: input.workspaceId,
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
      store.errorStream(input.messageNodeElementId, errorText);
      input.onStatusChange("error", errorText);
      return;
    }

    if (!response.body) {
      store.errorStream(input.messageNodeElementId, "No response body");
      input.onStatusChange("error", "No response body");
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
              store.appendText(input.messageNodeElementId, text);
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
                  store.appendPart(input.messageNodeElementId, item);
                }
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
              store.errorStream(input.messageNodeElementId, errorText);
              input.onStatusChange("error", errorText);
              return;
            } catch {
              store.errorStream(input.messageNodeElementId, "Stream error");
              input.onStatusChange("error", "Stream error");
              return;
            }
          }
          case "d": {
            // finish
            store.completeStream(input.messageNodeElementId);
            input.onStatusChange("complete");
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
    const currentStream = store.getStream(input.messageNodeElementId);
    if (currentStream && currentStream.status === "streaming") {
      store.completeStream(input.messageNodeElementId);
      input.onStatusChange("complete");
    }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      store.errorStream(input.messageNodeElementId, "Cancelled");
      input.onStatusChange("error", "Cancelled");
      return;
    }
    const errorText = err instanceof Error ? err.message : "Unknown error";
    store.errorStream(input.messageNodeElementId, errorText);
    input.onStatusChange("error", errorText);
  }
}
