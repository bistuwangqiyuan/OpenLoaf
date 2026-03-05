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

import * as React from "react";
import { useNavigation, getViewKey } from "./use-navigation";
import type { TabView } from "./tab-types";

/**
 * 适配器：将 View 数据转换为 TabView 格式
 * 让 LeftDock 组件可以在新导航系统中工作
 *
 * 注意：这是一个临时适配方案，LeftDock 应该最终重构为使用 Navigation 系统
 */
export function useViewAsTabView(): TabView | undefined {
  const activeWorkspaceId = useNavigation((s) => s.activeWorkspaceId);
  const activeView = useNavigation((s) => s.activeView);
  const getViewRuntime = useNavigation((s) => s.getViewRuntime);

  const viewKey = activeView ? getViewKey(activeView) : null;
  const viewRuntime = viewKey ? getViewRuntime(viewKey) : null;

  // 只支持功能页面（workbench、calendar、email、scheduled-tasks）
  const supportedTypes = new Set(["workbench", "calendar", "email", "scheduled-tasks"]);
  const isSupported = activeView?.type && supportedTypes.has(activeView.type);

  if (!isSupported || !viewRuntime) {
    return undefined;
  }

  // 转换 LeftDock 需要的字段
  return {
    // Meta 字段（LeftDock 可能用到）
    id: viewKey || "",
    workspaceId: activeWorkspaceId || "",
    title: "",
    icon: "",

    // Runtime 字段（LeftDock 主要使用这些）
    base: viewRuntime.leftDock || undefined,
    stack: viewRuntime.stack || [],
    leftWidthPercent: viewRuntime.leftWidthPercent ?? 0,
    minLeftWidth: viewRuntime.minLeftWidth,
    rightChatCollapsed: viewRuntime.rightChatCollapsed ?? false,
    stackHidden: viewRuntime.stackHidden ?? false,
    activeStackItemId: viewRuntime.activeStackItemId || "",

    // 其他字段（LeftDock 可能不使用，但需要提供以匹配类型）
    rightChatCollapsedSnapshot: undefined,
    chatSessionId: undefined,
    chatSessionIds: undefined,
    activeSessionIndex: undefined,
    chatSessionTitles: undefined,
    chatParams: undefined,
    chatLoadHistory: undefined,
    isPin: false,
    createdAt: undefined,
    lastActiveAt: undefined,
  };
}
