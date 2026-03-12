/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import { create } from "zustand";

/** Streaming entry keyed by ChatMessageNode element ID. */
export type BoardChatStreamEntry = {
  /** Accumulated streaming text. */
  text: string;
  /** Ordered streamed parts and data events. */
  parts: unknown[];
  /** Stream status. */
  status: "streaming" | "complete" | "error";
  /** Error text if failed. */
  errorText?: string;
  /** AbortController for stopping the stream. */
  abortController?: AbortController;
};

type BoardChatStoreState = {
  /** Active stream entries keyed by element ID. */
  streams: Record<string, BoardChatStreamEntry>;
  /** Start a stream for an element. */
  startStream: (elementId: string, abortController: AbortController) => void;
  /** Append text delta to a stream. */
  appendText: (elementId: string, delta: string) => void;
  /** Append a part to the stream. */
  appendPart: (elementId: string, part: unknown) => void;
  /** Mark a stream as complete. */
  completeStream: (elementId: string) => void;
  /** Mark a stream as error. */
  errorStream: (elementId: string, errorText: string) => void;
  /** Remove a stream entry. */
  removeStream: (elementId: string) => void;
  /** Get a stream entry. */
  getStream: (elementId: string) => BoardChatStreamEntry | undefined;
};

export const useBoardChatStore = create<BoardChatStoreState>((set, get) => ({
  streams: {},

  startStream: (elementId, abortController) => {
    set((state) => ({
      streams: {
        ...state.streams,
        [elementId]: {
          text: "",
          parts: [],
          status: "streaming",
          abortController,
        },
      },
    }));
  },

  appendText: (elementId, delta) => {
    set((state) => {
      const entry = state.streams[elementId];
      if (!entry || entry.status !== "streaming") return state;
      const currentParts = Array.isArray(entry.parts) ? [...entry.parts] : [];
      const last = currentParts.at(-1);
      if (last && typeof last === "object" && !Array.isArray(last) && (last as any).type === "text") {
        currentParts[currentParts.length - 1] = {
          ...(last as Record<string, unknown>),
          text: `${String((last as any).text ?? "")}${delta}`,
        };
      } else {
        currentParts.push({ type: "text", text: delta });
      }
      return {
        streams: {
          ...state.streams,
          [elementId]: {
            ...entry,
            text: entry.text + delta,
            parts: currentParts,
          },
        },
      };
    });
  },

  appendPart: (elementId, part) => {
    set((state) => {
      const entry = state.streams[elementId];
      if (!entry) return state;
      return {
        streams: {
          ...state.streams,
          [elementId]: { ...entry, parts: [...entry.parts, part] },
        },
      };
    });
  },

  completeStream: (elementId) => {
    set((state) => {
      const entry = state.streams[elementId];
      if (!entry) return state;
      return {
        streams: {
          ...state.streams,
          [elementId]: { ...entry, status: "complete", abortController: undefined },
        },
      };
    });
  },

  errorStream: (elementId, errorText) => {
    set((state) => {
      const entry = state.streams[elementId];
      if (!entry) return state;
      return {
        streams: {
          ...state.streams,
          [elementId]: {
            ...entry,
            status: "error",
            errorText,
            abortController: undefined,
          },
        },
      };
    });
  },

  removeStream: (elementId) => {
    set((state) => {
      const { [elementId]: _, ...rest } = state.streams;
      return { streams: rest };
    });
  },

  getStream: (elementId) => get().streams[elementId],
}));
