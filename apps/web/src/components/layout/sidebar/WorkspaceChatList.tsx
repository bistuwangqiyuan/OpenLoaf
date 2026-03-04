/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquare, ChevronDown, ChevronRight, MoreHorizontal } from "lucide-react";
import { useNavigation, getViewKey } from "@/hooks/use-navigation";
import { useWorkspace } from "@/components/workspace/workspaceContext";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@openloaf/ui/sidebar";
import { Button } from "@openloaf/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@openloaf/ui/dropdown-menu";
import { ConvertChatToProjectDialog } from "./ConvertChatToProjectDialog";

const DEFAULT_DISPLAY_COUNT = 10;

export function WorkspaceChatList() {
  const { t } = useTranslation("nav");
  const { workspace } = useWorkspace();
  const [expanded, setExpanded] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const activeView = useNavigation((s) => s.activeView);
  const setActiveView = useNavigation((s) => s.setActiveView);
  const getWorkspaceChats = useNavigation((s) => s.getWorkspaceChats);
  const removeWorkspaceChat = useNavigation((s) => s.removeWorkspaceChat);

  if (!workspace) return null;

  const allChats = getWorkspaceChats(workspace.id);
  const displayChats = expanded ? allChats : allChats.slice(0, DEFAULT_DISPLAY_COUNT);
  const hasMore = allChats.length > DEFAULT_DISPLAY_COUNT;

  const isActive = (chatSessionId: string) => {
    return activeView?.type === "workspace-chat" && activeView.chatSessionId === chatSessionId;
  };

  const handleChatClick = (chatSessionId: string) => {
    setActiveView({ type: "workspace-chat", chatSessionId });
  };

  const handleConvertToProject = (chatSessionId: string) => {
    setSelectedChatId(chatSessionId);
    setConvertDialogOpen(true);
  };

  const handleDeleteChat = (chatSessionId: string) => {
    if (confirm(t("confirmDeleteChat"))) {
      removeWorkspaceChat(workspace.id, chatSessionId);
    }
  };

  if (allChats.length === 0) return null;

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          <span className="flex-1">{t("workspaceChats")}</span>
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {displayChats.map((chat) => (
              <SidebarMenuItem key={chat.chatSessionId}>
                <SidebarMenuButton
                  isActive={isActive(chat.chatSessionId)}
                  onClick={() => handleChatClick(chat.chatSessionId)}
                  className="group relative"
                >
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{chat.title || t("untitledChat")}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleConvertToProject(chat.chatSessionId)}>
                        {t("convertToProject")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteChat(chat.chatSessionId)}
                        className="text-destructive"
                      >
                        {t("delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  <ChevronDown className="h-4 w-4 mr-2" />
                  {t("showLess")}
                </>
              ) : (
                <>
                  <ChevronRight className="h-4 w-4 mr-2" />
                  {t("showMore", { count: allChats.length - DEFAULT_DISPLAY_COUNT })}
                </>
              )}
            </Button>
          )}
        </SidebarGroupContent>
      </SidebarGroup>

      {selectedChatId && (
        <ConvertChatToProjectDialog
          open={convertDialogOpen}
          onOpenChange={setConvertDialogOpen}
          chatSessionId={selectedChatId}
        />
      )}
    </>
  );
}
