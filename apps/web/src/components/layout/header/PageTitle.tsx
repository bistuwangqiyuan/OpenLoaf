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

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@/hooks/use-navigation";
import { useTabs } from "@/hooks/use-tabs";
import { useTabView } from "@/hooks/use-tab-view";

/**
 * PageTitle 组件
 *
 * 在 Header 中显示当前页面的标题
 * 根据导航状态和当前 Tab 信息动态显示标题
 */
export const PageTitle = () => {
  const { t } = useTranslation('nav');
  const viewType = useNavigation((s) => s.activeViewType);
  const activeTabId = useTabs((s) => s.activeTabId);
  const activeTab = useTabView(activeTabId ?? undefined);

  const title = useMemo(() => {
    if (viewType === 'project') {
      return activeTab?.title ?? t('project');
    }
    if (viewType === 'workspace-chat') {
      return activeTab?.title ?? t('aiAssistant');
    }
    if (viewType === 'workbench') return t('workbench');
    if (viewType === 'calendar') return t('calendar');
    if (viewType === 'email') return t('email');
    if (viewType === 'scheduled-tasks') return t('scheduledTasks');
    if (viewType === 'ai-assistant') return t('aiAssistant');
    return '';
  }, [viewType, activeTab, t]);

  if (!title) return null;

  return (
    <div className="flex items-center min-w-0">
      <h1 className="text-sm font-medium text-foreground/80 truncate">
        {title}
      </h1>
    </div>
  );
};
