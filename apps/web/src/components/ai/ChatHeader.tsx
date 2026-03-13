/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
"use client"

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Bug, Lightbulb, MessageSquarePlus, Palette, X } from "lucide-react";
import * as React from "react";
import { useChatActions, useChatSession, useChatState } from "./context";
import { trpcClient } from "@/utils/trpc";
import { useLayoutState } from "@/hooks/use-layout-state";
import { useAppState } from "@/hooks/use-app-state";
import { useBasicConfig } from "@/hooks/use-basic-config";
import { useHeaderSlot } from "@/hooks/use-header-slot";
import { useSaasAuth } from "@/hooks/use-saas-auth";
import { toast } from "sonner";
import { SaaSClient, SaaSHttpError } from "@openloaf-saas/sdk";
import { MessageAction, MessageActions } from "@/components/ai-elements/message";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@openloaf/ui/dialog";
import { Textarea } from "@openloaf/ui/textarea";
import { Button } from "@openloaf/ui/button";
import { getAccessToken, resolveSaasBaseUrl } from "@/lib/saas-auth";
import { resolveServerUrl } from "@/utils/server-url";
import { isElectronEnv } from "@/utils/is-electron-env";
import { CopyChatToCanvasDialog } from "./CopyChatToCanvasDialog";
import { createPortal } from "react-dom";

interface ChatHeaderProps {
  onNewSession?: () => void;
  onCloseSession?: () => void;
  /** Icon color palette for header action buttons. */
  iconPalette?: "default" | "email";
  /** Enable multi-session mode (show new session button). Default: auto-detect from projectId. */
  enableMultiSession?: boolean;
}

const CHAT_HEADER_EMAIL_ICON_CLASS = {
  debug: "text-ol-purple",
  feedback: "text-ol-purple",
  copyToCanvas:
    "text-ol-purple/70 hover:text-ol-purple",
  closeDock: "text-ol-amber",
  clear: "text-ol-green",
  close: "text-ol-text-auxiliary",
} as const;

export default function ChatHeader({
  onNewSession,
  onCloseSession,
  iconPalette = "default",
  enableMultiSession,
}: ChatHeaderProps) {
  const { t: tAi } = useTranslation('ai');
  const { sessionId: activeSessionId, tabId, leafMessageId: activeLeafMessageId } = useChatSession();
  const { newSession } = useChatActions();
  const { messages } = useChatState();
  /** Preface button loading state. */
  const [prefaceLoading, setPrefaceLoading] = React.useState(false);
  /** Chat feedback dialog open state. */
  const [chatFeedbackOpen, setChatFeedbackOpen] = React.useState(false);
  /** Copy current chat into a board dialog state. */
  const [copyToCanvasOpen, setCopyToCanvasOpen] = React.useState(false);
  /** Chat feedback input content. */
  const [chatFeedbackContent, setChatFeedbackContent] = React.useState("");
  /** Chat feedback submitting state. */
  const [chatFeedbackSubmitting, setChatFeedbackSubmitting] = React.useState(false);
  const pushStackItem = useLayoutState((s) => s.pushStackItem);
  const { basic } = useBasicConfig();
  const headerActionsTarget = useHeaderSlot((s) => s.headerActionsTarget);
  const { loggedIn: saasLoggedIn } = useSaasAuth();
  const appState = useAppState();

  // Quick launch: derive project context from tab chatParams.
  const quickLaunchProjectId = React.useMemo(() => {
    const params = appState?.chatParams as Record<string, unknown> | undefined;
    const pid = params?.projectId;
    return typeof pid === "string" ? pid.trim() : "";
  }, [appState?.chatParams]);
  /** Resolve icon tone classes for header actions. */
  const resolveActionIconClass = React.useCallback(
    (action: keyof typeof CHAT_HEADER_EMAIL_ICON_CLASS) =>
      iconPalette === "email" ? CHAT_HEADER_EMAIL_ICON_CLASS[action] : "",
    [iconPalette]
  );

  /** Resolve request leaf id from active branch leaf first, then fallback to latest user message. */
  const requestLeafMessageId = React.useMemo(() => {
    const activeLeafId =
      typeof activeLeafMessageId === "string" ? activeLeafMessageId.trim() : "";
    if (activeLeafId) return activeLeafId;

    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message?.role !== "user") continue;
      const id = typeof message.id === "string" ? message.id.trim() : "";
      if (id) return id;
    }
    return undefined;
  }, [activeLeafMessageId, messages]);

  // 逻辑：仅在存在历史消息时显示 Preface 查看按钮。
  const showPrefaceButton = Boolean(basic.chatPrefaceEnabled) && messages.length > 0;

  // 新建会话按钮显示条件：有历史消息 + 启用多会话模式
  const shouldShowNewSessionButton = messages.length > 0 && (enableMultiSession ?? Boolean(quickLaunchProjectId));

  const effectiveChatFeedbackOpen = chatFeedbackOpen && saasLoggedIn;

  /**
   * Open the current session preface in a markdown stack panel.
   */
  const handleViewPreface = React.useCallback(async () => {
    if (!activeSessionId) {
      toast.error("未找到当前会话");
      return;
    }
    if (prefaceLoading) return;

    setPrefaceLoading(true);
    try {
      const res = await trpcClient.chat.getSessionPreface.query({
        sessionId: activeSessionId,
        leafMessageId: requestLeafMessageId,
      });
      const content = typeof res?.content === "string" ? res.content : "";
      const jsonlPath = typeof res?.jsonlPath === "string" ? res.jsonlPath : "";
      const promptContent = typeof res?.promptContent === "string" ? res.promptContent : "";
      const panelKey = `preface:${activeSessionId}`;
      pushStackItem({
        id: panelKey,
        sourceKey: panelKey,
        component: "ai-debug-viewer",
        title: "AI调试",
        params: {
          prefaceContent: content,
          promptContent,
          sessionId: activeSessionId,
          jsonlPath: jsonlPath || undefined,
          __customHeader: true,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "读取调试信息失败";
      toast.error(message);
    } finally {
      setPrefaceLoading(false);
    }
  }, [activeSessionId, prefaceLoading, pushStackItem, requestLeafMessageId]);

  /** Resolve server endpoint for exporting current chat session zip. */
  const resolveSessionZipExportUrl = React.useCallback((sessionId: string) => {
    const encodedSessionId = encodeURIComponent(sessionId);
    const apiBase = resolveServerUrl();
    if (!apiBase) return `/chat/sessions/${encodedSessionId}/export-zip`;
    return `${apiBase}/chat/sessions/${encodedSessionId}/export-zip`;
  }, []);

  /** Build feedback context for SaaS submission. */
  const buildChatFeedbackContext = React.useCallback(async (zipInfo: {
    url: string;
    key: string;
    bytes: number;
    exportMode?: string;
    sourceBytes?: number;
  }) => {
    const appVersion = isElectronEnv()
      ? await window.openloafElectron?.getAppVersion?.().catch(() => null)
      : null;
    const context: Record<string, unknown> = {
      env: isElectronEnv() ? "electron" : "web",
      page: typeof window !== "undefined" ? window.location.pathname : undefined,
      appVersion: typeof appVersion === "string" ? appVersion : undefined,
      tabId: tabId || undefined,
      sessionId: activeSessionId || undefined,
      leafMessageId: requestLeafMessageId,
      projectId: quickLaunchProjectId || undefined,
      messageCount: messages.length,
      chatSessionZipUrl: zipInfo.url,
      chatSessionZipKey: zipInfo.key,
      chatSessionZipBytes: zipInfo.bytes,
      chatSessionZipExportMode: zipInfo.exportMode,
      chatSessionSourceBytes: zipInfo.sourceBytes,
    };
    return Object.fromEntries(
      Object.entries(context).filter(([, value]) => value !== undefined && value !== null),
    );
  }, [
    activeSessionId,
    messages.length,
    quickLaunchProjectId,
    requestLeafMessageId,
    tabId,
  ]);

  /** Submit feedback payload to SaaS. */
  const submitChatFeedbackPayload = React.useCallback(async (input: {
    baseUrl: string;
    content: string;
    context: Record<string, unknown>;
  }) => {
    const client = new SaaSClient({
      baseUrl: input.baseUrl,
      getAccessToken: async () => (await getAccessToken()) ?? "",
    });
    await client.feedback.submit({
      source: "openloaf",
      type: "chat",
      content: input.content,
      context: input.context,
    });
  }, []);

  /** Submit chat feedback with current session zip attachment. */
  const handleSubmitChatFeedback = React.useCallback(async () => {
    const sessionId = typeof activeSessionId === "string" ? activeSessionId.trim() : "";
    if (!sessionId) {
      toast.error(tAi("chatFeedback.sessionMissing"));
      return;
    }
    const content = chatFeedbackContent.trim();
    if (!content) {
      toast.error(tAi("chatFeedback.emptyError"));
      return;
    }
    const baseUrl = resolveSaasBaseUrl();
    if (!baseUrl) {
      toast.error(tAi("chatFeedback.saasNotConfigured"));
      return;
    }

    setChatFeedbackSubmitting(true);
    try {
      const exportUrl = resolveSessionZipExportUrl(sessionId);
      const exportResponse = await fetch(exportUrl, { method: "GET" });
      if (!exportResponse.ok) {
        const responseText = await exportResponse.text().catch(() => "");
        const message = responseText.trim() || `HTTP ${exportResponse.status}`;
        throw new Error(`export:${message}`);
      }
      const zipBlob = await exportResponse.blob();
      if (zipBlob.size <= 0) {
        toast.error(tAi("chatFeedback.zipEmpty"));
        return;
      }

      const client = new SaaSClient({
        baseUrl,
        getAccessToken: async () => (await getAccessToken()) ?? "",
      });
      const attachment = await client.feedback.uploadAttachment(
        zipBlob,
        `chat-session-${sessionId}.zip`,
      );
      const context = await buildChatFeedbackContext({
        url: attachment.url,
        key: attachment.key,
        bytes: zipBlob.size,
        exportMode: exportResponse.headers.get("X-OpenLoaf-Export-Mode") ?? undefined,
        sourceBytes: Number(exportResponse.headers.get("X-OpenLoaf-Source-Bytes") ?? 0) || undefined,
      });
      await submitChatFeedbackPayload({ baseUrl, content, context });

      toast.success(tAi("chatFeedback.success"));
      setChatFeedbackContent("");
      setChatFeedbackOpen(false);
    } catch (error) {
      if (error instanceof SaaSHttpError) {
        const payload = error.payload as { message?: unknown } | undefined;
        const message = typeof payload?.message === "string" ? payload.message : "";
        toast.error(
          message
            ? tAi("chatFeedback.failedWithMessage", { message })
            : tAi("chatFeedback.failed"),
        );
        return;
      }
      if (error instanceof Error && error.message.startsWith("export:")) {
        const message = error.message.slice("export:".length).trim();
        toast.error(
          message
            ? tAi("chatFeedback.exportFailedWithMessage", { message })
            : tAi("chatFeedback.exportFailed"),
        );
        return;
      }
      if (error instanceof Error && error.message.trim()) {
        toast.error(tAi("chatFeedback.failedWithMessage", { message: error.message.trim() }));
        return;
      }
      toast.error(tAi("chatFeedback.failed"));
    } finally {
      setChatFeedbackSubmitting(false);
    }
  }, [
    activeSessionId,
    buildChatFeedbackContext,
    chatFeedbackContent,
    resolveSessionZipExportUrl,
    submitChatFeedbackPayload,
    tAi,
  ]);

  const headerActions = (
    <MessageActions className="min-w-0 shrink-0 justify-end gap-0">
      {showPrefaceButton ? (
        <MessageAction
          aria-label="View Debug Context"
          onClick={handleViewPreface}
          disabled={prefaceLoading}
          className={cn("ml-0.5 shrink-0", resolveActionIconClass("debug"))}
          tooltip="查看上下文调试信息"
          label="查看上下文调试信息"
        >
          <Bug size={16} />
        </MessageAction>
      ) : null}
      {saasLoggedIn && messages.length > 0 ? (
        <MessageAction
          aria-label={tAi("chatFeedback.button")}
          onClick={() => setChatFeedbackOpen(true)}
          className={cn("shrink-0", resolveActionIconClass("feedback"))}
          disabled={chatFeedbackSubmitting || !activeSessionId}
          tooltip={tAi("chatFeedback.button")}
          label={tAi("chatFeedback.button")}
        >
          <Lightbulb size={16} />
        </MessageAction>
      ) : null}
      {messages.length > 0 && activeSessionId ? (
        <MessageAction
          aria-label={tAi("copyToCanvas.button")}
          onClick={() => setCopyToCanvasOpen(true)}
          className={cn("shrink-0", resolveActionIconClass("copyToCanvas"))}
          tooltip={tAi("copyToCanvas.button")}
          label={tAi("copyToCanvas.button")}
        >
          <Palette size={16} />
        </MessageAction>
      ) : null}
      {shouldShowNewSessionButton ? (
        <MessageAction
          aria-label="重新开始会话"
          className={resolveActionIconClass("clear")}
          onClick={() => {
            if (onNewSession) {
              onNewSession();
              return;
            }
            newSession();
          }}
          tooltip="重新开始会话"
          label="重新开始会话"
        >
          <MessageSquarePlus size={20} />
        </MessageAction>
      ) : null}
      {onCloseSession ? (
        <MessageAction
          aria-label="关闭会话"
          className={resolveActionIconClass("close")}
          onClick={onCloseSession}
          tooltip="关闭会话"
          label="关闭会话"
        >
          <X size={20} />
        </MessageAction>
      ) : null}
    </MessageActions>
  );

  return (
    <>
      {headerActionsTarget
        ? createPortal(
            <div
              className="flex min-w-0 items-center justify-end"
              data-no-drag="true"
            >
              {headerActions}
            </div>,
            headerActionsTarget,
          )
        : null}
      <Dialog
        open={effectiveChatFeedbackOpen}
        onOpenChange={(open) => {
          if (!chatFeedbackSubmitting) setChatFeedbackOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tAi("chatFeedback.title")}</DialogTitle>
            <DialogDescription>{tAi("chatFeedback.description")}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={chatFeedbackContent}
            onChange={(event) => setChatFeedbackContent(event.target.value)}
            placeholder={tAi("chatFeedback.placeholder")}
            className="min-h-[120px]"
            autoFocus
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                if (!chatFeedbackSubmitting && chatFeedbackContent.trim()) {
                  void handleSubmitChatFeedback();
                }
              }
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => setChatFeedbackOpen(false)}
              disabled={chatFeedbackSubmitting}
            >
              {tAi("chatFeedback.cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmitChatFeedback()}
              disabled={chatFeedbackSubmitting || chatFeedbackContent.trim().length === 0}
            >
              {chatFeedbackSubmitting
                ? tAi("chatFeedback.submitting")
                : tAi("chatFeedback.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CopyChatToCanvasDialog
        open={copyToCanvasOpen}
        onOpenChange={setCopyToCanvasOpen}
        sourceSessionId={activeSessionId ?? ""}
      />
    </>
  );
}
