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

import { useQuery } from "@tanstack/react-query";
import type { Workspace } from "@openloaf/api/types/workspace";
import { trpc } from "@/utils/trpc";

/**
 * Read the compatibility workspace from the settings router.
 */
export function useWorkspace(): {
  workspace: Workspace;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    ...trpc.settings.getWorkspaceCompat.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });

  return {
    workspace: (data ?? ({} as Workspace)),
    isLoading,
  };
}
