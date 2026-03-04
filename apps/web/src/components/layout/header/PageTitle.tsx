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

import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { useNavigation } from "@/hooks/use-navigation";

export function PageTitle() {
  const { t } = useTranslation("nav");
  const activeView = useNavigation((s) => s.activeView);
  const workspaceChats = useNavigation((s) => s.workspaceChats);
  const activeWorkspaceId = useNavigation((s) => s.activeWorkspaceId);

  // 根据不同的视图类型查询数据
  const projectQuery = useQuery({
    ...trpc.project.get.queryOptions({
      projectId: activeView?.type === "project" ? activeView.projectId : "",
    }),
    enabled: activeView?.type === "project",
  });

  if (!activeView) {
    return <span className="text-sm font-medium">{t("workbench")}</span>;
  }

  switch (activeView.type) {
    case "workbench":
      return <span className="text-sm font-medium">{t("workbench")}</span>;
    case "calendar":
      return <span className="text-sm font-medium">{t("calendar")}</span>;
    case "email":
      return <span className="text-sm font-medium">{t("email")}</span>;
    case "scheduled-tasks":
      return <span className="text-sm font-medium">{t("tasks")}</span>;
    case "project":
      return (
        <span className="text-sm font-medium">
          {projectQuery.data?.project.icon} {projectQuery.data?.project.title || t("project")}
        </span>
      );
    case "workspace-chat": {
      // 从本地状态获取对话标题
      const chats = activeWorkspaceId ? workspaceChats[activeWorkspaceId] ?? [] : [];
      const chat = chats.find((c) => c.chatSessionId === activeView.chatSessionId);
      return (
        <span className="text-sm font-medium">
          {chat?.title || t("chat")}
        </span>
      );
    }
    default:
      return <span className="text-sm font-medium">{t("workbench")}</span>;
  }
}
