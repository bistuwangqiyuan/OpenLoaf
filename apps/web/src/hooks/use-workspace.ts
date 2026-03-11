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

import type { Workspace } from "@openloaf/api/types/workspace";
import { useProjectStorageRootQuery } from "@/hooks/use-project-storage-root-uri";

/**
 * Read the compatibility workspace from the settings router.
 */
export function useWorkspace(): {
  workspace: Workspace;
  isLoading: boolean;
} {
  const { data, isLoading } = useProjectStorageRootQuery();
  const workspace: Workspace = {
    id: "default",
    name: "Default",
    type: "local",
    isActive: true,
    rootUri: data?.rootUri ?? "",
    projects: {},
    ignoreSkills: [],
  };

  return {
    // 逻辑：compat hook 继续暴露 workspace 形状，但底层改为由项目存储根合成默认对象。
    workspace,
    isLoading,
  };
}
