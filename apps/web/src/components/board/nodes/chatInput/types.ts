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

export type ChatInputNodeProps = {
  /** User message ID (filled after send). */
  messageId?: string;
  /** Input text from the textarea. */
  inputText?: string;
  /** Node status. */
  status?: "idle" | "sending" | "sent" | "error";
  /** Error text for failed sends. */
  errorText?: string;
  /** Auto focus on mount. */
  autoFocus?: boolean;
  /** Selected chat model ID. */
  chatModelId?: string;
};

/** Schema for chat input node props. */
export const ChatInputNodeSchema = z.object({
  messageId: z.string().optional(),
  inputText: z.string().optional(),
  status: z.enum(["idle", "sending", "sent", "error"]).optional(),
  errorText: z.string().optional(),
  autoFocus: z.boolean().optional(),
  chatModelId: z.string().optional(),
});

export const CHAT_INPUT_NODE_TYPE = "chat_input";
