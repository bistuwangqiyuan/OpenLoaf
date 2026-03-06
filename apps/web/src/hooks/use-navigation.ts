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

import { create } from "zustand";

/**
 * 导航状态管理
 *
 * 用于管理用户可见的导航状态（Sidebar 高亮、Header 标题等）
 * 与 useTabs 配合使用：
 * - use-navigation 管理"用户看到的导航状态"
 * - useTabs 管理"后台的 Tab 状态"
 */

export type NavigationViewType =
  | "workbench"
  | "calendar"
  | "email"
  | "scheduled-tasks"
  | "project"
  | "workspace-chat"
  | "ai-assistant"
  | null;

export interface NavigationState {
  /** 当前激活的视图类型（用于 Sidebar 高亮） */
  activeViewType: NavigationViewType;

  /** 当前激活的项目 ID（用于项目导航） */
  activeProjectId: string | null;

  /** 当前激活的 Workspace Chat Session ID */
  activeWorkspaceChatSessionId: string | null;

  /** 设置激活的视图 */
  setActiveView: (viewType: NavigationViewType) => void;

  /** 设置激活的项目 */
  setActiveProject: (projectId: string | null) => void;

  /** 设置激活的 Workspace Chat */
  setActiveWorkspaceChat: (sessionId: string | null) => void;

  /** 获取当前激活的视图信息 */
  getActiveView: () => {
    viewType: NavigationViewType;
    projectId: string | null;
    workspaceChatSessionId: string | null;
  };
}

export const useNavigation = create<NavigationState>((set, get) => ({
  activeViewType: null,
  activeProjectId: null,
  activeWorkspaceChatSessionId: null,

  setActiveView: (viewType) => {
    set({ activeViewType: viewType });
  },

  setActiveProject: (projectId) => {
    set({
      activeViewType: "project",
      activeProjectId: projectId,
    });
  },

  setActiveWorkspaceChat: (sessionId) => {
    set({
      activeViewType: "workspace-chat",
      activeWorkspaceChatSessionId: sessionId,
    });
  },

  getActiveView: () => {
    const state = get();
    return {
      viewType: state.activeViewType,
      projectId: state.activeProjectId,
      workspaceChatSessionId: state.activeWorkspaceChatSessionId,
    };
  },
}));
