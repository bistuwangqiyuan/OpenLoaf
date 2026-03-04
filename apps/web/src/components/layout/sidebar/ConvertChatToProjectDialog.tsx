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
import { useMutation, useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { useWorkspace } from "@/components/workspace/workspaceContext";
import { useNavigation } from "@/hooks/use-navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@openloaf/ui/dialog";
import { Button } from "@openloaf/ui/button";
import { Input } from "@openloaf/ui/input";
import { Label } from "@openloaf/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openloaf/ui/select";
import { toast } from "sonner";

interface ConvertChatToProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatSessionId: string;
}

export function ConvertChatToProjectDialog({
  open,
  onOpenChange,
  chatSessionId,
}: ConvertChatToProjectDialogProps) {
  const { t } = useTranslation("nav");
  const { workspace } = useWorkspace();
  const [projectTitle, setProjectTitle] = useState("");
  const [parentProjectId, setParentProjectId] = useState<string | undefined>();
  const [isConverting, setIsConverting] = useState(false);

  const removeWorkspaceChat = useNavigation((s) => s.removeWorkspaceChat);
  const setActiveView = useNavigation((s) => s.setActiveView);
  const workspaceChats = useNavigation((s) => s.workspaceChats);

  // 查询项目列表
  const projectsQuery = useQuery(trpc.project.list.queryOptions());
  const projects = projectsQuery.data ?? [];

  // 从本地状态获取对话标题
  const chats = workspace ? workspaceChats[workspace.id] ?? [] : [];
  const chat = chats.find((c) => c.chatSessionId === chatSessionId);
  const chatTitle = chat?.title || "";

  const convertMutation = useMutation(trpc.project.convertChatToProject.mutationOptions());

  const handleConvert = () => {
    if (!projectTitle.trim()) {
      toast.error(t("projectTitleRequired"));
      return;
    }

    setIsConverting(true);
    convertMutation.mutate(
      {
        chatSessionId,
        projectTitle: projectTitle.trim(),
        projectParentId: parentProjectId,
      },
      {
        onSuccess: (result) => {
          toast.success(t("convertSuccess"));
          if (workspace) {
            removeWorkspaceChat(workspace.id, chatSessionId);
          }
          // 切换到新创建的项目
          setActiveView({ type: "project", projectId: result.project.projectId });
          onOpenChange(false);
        },
        onError: (error) => {
          toast.error(t("convertFailed", { error: error.message }));
        },
        onSettled: () => {
          setIsConverting(false);
        },
      }
    );
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isConverting) {
      onOpenChange(newOpen);
      if (!newOpen) {
        setProjectTitle("");
        setParentProjectId(undefined);
      }
    }
  };

  // 当对话加载完成后，自动填充标题
  if (open && chatTitle && !projectTitle) {
    setProjectTitle(chatTitle);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("convertChatToProject")}</DialogTitle>
          <DialogDescription>
            {t("convertChatToProjectDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="project-title">{t("projectTitle")}</Label>
            <Input
              id="project-title"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              placeholder={t("projectTitlePlaceholder")}
              disabled={isConverting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="parent-project">{t("parentProject")}</Label>
            <Select
              value={parentProjectId}
              onValueChange={setParentProjectId}
              disabled={isConverting}
            >
              <SelectTrigger id="parent-project">
                <SelectValue placeholder={t("selectParentProject")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("noParent")}</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.projectId} value={project.projectId}>
                    {project.icon} {project.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isConverting}
          >
            {t("cancel")}
          </Button>
          <Button onClick={handleConvert} disabled={isConverting}>
            {isConverting ? t("converting") : t("convert")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
