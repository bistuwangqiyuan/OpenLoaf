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
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Per-project layout preferences.
 * Saved when a project tab's layout changes, restored when re-opening the project.
 */
export type ProjectLayoutPrefs = {
  rightChatCollapsed?: boolean;
  leftWidthPercent?: number;
};

type ProjectLayoutState = {
  layoutByProjectId: Record<string, ProjectLayoutPrefs>;
  getProjectLayout: (projectId: string) => ProjectLayoutPrefs | undefined;
  saveProjectLayout: (projectId: string, prefs: Partial<ProjectLayoutPrefs>) => void;
};

const PROJECT_LAYOUT_STORAGE_KEY = "openloaf:project-layout";

export const useProjectLayout = create<ProjectLayoutState>()(
  persist(
    (set, get) => ({
      layoutByProjectId: {},

      getProjectLayout: (projectId) => get().layoutByProjectId[projectId],

      saveProjectLayout: (projectId, prefs) => {
        set((state) => ({
          layoutByProjectId: {
            ...state.layoutByProjectId,
            [projectId]: { ...state.layoutByProjectId[projectId], ...prefs },
          },
        }));
      },
    }),
    {
      name: PROJECT_LAYOUT_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
