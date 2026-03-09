/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import { useQuery } from "@tanstack/react-query";
import { trpcClient } from "@/utils/trpc";

/** Load a single message by sessionId + messageId from server. */
export function useBoardChatMessage(sessionId: string, messageId?: string) {
  return useQuery({
    queryKey: ["board-chat-message", sessionId, messageId],
    queryFn: async () => {
      if (!messageId || !sessionId) return null;
      const view = await trpcClient.chat.getChatView.query({
        sessionId,
        anchor: { messageId, strategy: "self" },
        window: { limit: 2 },
        include: { messages: true, siblingNav: false },
        includeToolOutput: true,
      });
      const msg = view?.messages?.find((m: any) => m.id === messageId);
      return msg ?? null;
    },
    enabled: Boolean(sessionId && messageId),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 5 * 60 * 1000,
  });
}
