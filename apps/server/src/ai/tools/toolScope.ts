/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import path from "node:path";
import { getProjectId } from "@/ai/shared/context/requestContext";
import {
  getProjectRootPath,
  resolveScopedPath,
} from "@openloaf/api/services/vfsService";
import { getOpenLoafRootDir } from "@openloaf/config";

type ToolRoots = {
  /** Global root path (~/.openloaf/). */
  globalRoot: string;
  /** Project root path if available. */
  projectRoot?: string;
};

/** Resolve global/project roots for current request context. */
export function resolveToolRoots(): ToolRoots {
  const globalRoot = getOpenLoafRootDir();
  const projectId = getProjectId();
  const projectRoot = projectId ? getProjectRootPath(projectId) ?? undefined : undefined;
  return {
    globalRoot: path.resolve(globalRoot),
    projectRoot: projectRoot ? path.resolve(projectRoot) : undefined,
  };
}

/** Check whether a target path stays inside a root path. */
function isPathInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/** Resolve a tool path (always allows outside scope; caller handles approval). */
export function resolveToolPath(input: {
  target: string;
}): { absPath: string; rootLabel: "project" | "external" } {
  const projectId = getProjectId();
  const { projectRoot } = resolveToolRoots();
  const absPath = path.resolve(
    resolveScopedPath({ projectId, target: input.target }),
  );
  const insideProject = projectRoot ? isPathInside(projectRoot, absPath) : false;
  const rootLabel = insideProject ? "project" : "external";
  return { absPath, rootLabel };
}

/** Check whether a path target is outside project scope (no-throw, for approval gates). */
export function isTargetOutsideScope(target: string): boolean {
  try {
    const projectId = getProjectId();
    const { projectRoot } = resolveToolRoots();
    const absPath = path.resolve(resolveScopedPath({ projectId, target }));
    const insideProject = projectRoot ? isPathInside(projectRoot, absPath) : false;
    return !insideProject;
  } catch {
    return false;
  }
}

/** Resolve a working directory (always allows outside scope; caller handles approval). */
export function resolveToolWorkdir(input: {
  workdir?: string;
}): { cwd: string; rootLabel: "project" | "external" } {
  if (input.workdir) {
    const resolved = resolveToolPath({ target: input.workdir });
    return { cwd: resolved.absPath, rootLabel: resolved.rootLabel };
  }
  const { globalRoot, projectRoot } = resolveToolRoots();
  const cwd = projectRoot ?? globalRoot;
  return {
    cwd,
    rootLabel: projectRoot ? "project" : "external",
  };
}
