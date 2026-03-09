/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import { z } from "zod";

export type ChatMessageNodeProps = {
  /** Assistant message ID (client-generated). */
  messageId?: string;
  /** Corresponding user message ID. */
  userMessageId?: string;
  /** Source ChatInputNode element ID. */
  sourceInputNodeId?: string;
  /** Node status. */
  status?: "streaming" | "complete" | "error";
  /** Error text for display. */
  errorText?: string;
  /** Chat model ID used for display. */
  chatModelId?: string;
  /** Indices of parts hidden by user. */
  hiddenPartIndices?: number[];
  /** Resolved image URLs from completed message (for downstream connectors). */
  resolvedImageUrls?: string[];
};

/** Schema for chat message node props. */
export const ChatMessageNodeSchema = z.object({
  messageId: z.string().optional(),
  userMessageId: z.string().optional(),
  sourceInputNodeId: z.string().optional(),
  status: z.enum(["streaming", "complete", "error"]).optional(),
  errorText: z.string().optional(),
  chatModelId: z.string().optional(),
  hiddenPartIndices: z.array(z.number()).optional(),
  resolvedImageUrls: z.array(z.string()).optional(),
});

export const CHAT_MESSAGE_NODE_TYPE = "chat_message";
