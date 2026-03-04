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

  // 根据不同的视图类型查询数据
  const projectQuery = useQuery(
    trpc.project.get.queryOptions(
      activeView?.type === "project" ? { projectId: activeView.projectId } : { projectId: "" },
      { enabled: activeView?.type === "project" }
    )
  );

  const chatQuery = useQuery(
    trpc.chat.getSession.queryOptions(
      activeView?.type === "workspace-chat" ? { sessionId: activeView.chatSessionId } : { sessionId: "" },
      { enabled: activeView?.type === "workspace-chat" }
    )
  );

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
    case "workspace-chat":
      return (
        <span className="text-sm font-medium">
          {chatQuery.data?.title || t("chat")}
        </span>
      );
    default:
      return <span className="text-sm font-medium">{t("workbench")}</span>;
  }
}
