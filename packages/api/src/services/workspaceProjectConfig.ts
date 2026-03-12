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
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { z } from "zod";
import {
  getDefaultProjectStoragePath,
} from "./appConfigService";
import { normalizeFileUri, resolveFilePathFromUri, toFileUriWithoutEncoding } from "./fileUri";

/** Legacy project registry directory name. */
const WORKSPACE_PROJECT_CONFIG_DIR = ".openloaf";
/** Legacy project registry file name. */
const WORKSPACE_PROJECT_CONFIG_FILE = "workspace.json";

/** Legacy top-level project registry schema. */
export const workspaceProjectConfigSchema = z
  .object({
    schema: z.number().optional(),
    projects: z.record(z.string(), z.string()).optional(),
    order: z.array(z.string()).optional(),
  })
  .passthrough();

export type WorkspaceProjectConfig = z.infer<typeof workspaceProjectConfigSchema>;

type WorkspaceProjectContext = {
  /** Root path on disk. */
  rootPath: string;
  /** Raw config data. */
  config: WorkspaceProjectConfig;
};

/** Build legacy workspace.json path from the project storage root. */
function resolveWorkspaceProjectConfigPath(rootPath: string): string {
  return path.join(rootPath, WORKSPACE_PROJECT_CONFIG_DIR, WORKSPACE_PROJECT_CONFIG_FILE);
}

/** Read legacy workspace.json safely. */
function readWorkspaceProjectConfig(rootPath: string): WorkspaceProjectConfig | null {
  const filePath = resolveWorkspaceProjectConfigPath(rootPath);
  if (!existsSync(filePath)) return null;
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf-8")) as unknown;
    return workspaceProjectConfigSchema.parse(raw);
  } catch {
    return null;
  }
}

/** Write legacy workspace.json atomically. */
function writeWorkspaceProjectConfig(rootPath: string, payload: WorkspaceProjectConfig): void {
  const filePath = resolveWorkspaceProjectConfigPath(rootPath);
  const dirPath = path.dirname(filePath);
  mkdirSync(dirPath, { recursive: true });
  const tmpPath = `${filePath}.${Date.now()}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(payload, null, 2), "utf-8");
  renameSync(tmpPath, filePath);
}

/** Normalize legacy top-level project mapping and order. */
function normalizeWorkspaceProjectConfig(
  raw: WorkspaceProjectConfig,
): { projects: Record<string, string>; order: string[] } {
  const projects: Record<string, string> = {};
  for (const [projectId, value] of Object.entries(raw.projects ?? {})) {
    const trimmedId = projectId.trim();
    const trimmedValue = value?.trim();
    if (!trimmedId || !trimmedValue) continue;
    projects[trimmedId] = trimmedValue;
  }
  const seen = new Set<string>();
  const order: string[] = [];
  for (const id of raw.order ?? []) {
    const trimmed = typeof id === "string" ? id.trim() : "";
    if (!trimmed || seen.has(trimmed) || !projects[trimmed]) continue;
    seen.add(trimmed);
    order.push(trimmed);
  }
  for (const id of Object.keys(projects)) {
    if (seen.has(id)) continue;
    order.push(id);
    seen.add(id);
  }
  return { projects, order };
}

/** Check whether target path is inside the root. */
function isPathInside(rootPath: string, targetPath: string): boolean {
  const normalizedRoot = path.resolve(rootPath);
  const normalizedTarget = path.resolve(targetPath);
  if (normalizedRoot === normalizedTarget) return true;
  const relative = path.relative(normalizedRoot, normalizedTarget);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

/** Convert a stored project entry into a file:// root URI. */
function resolveWorkspaceProjectEntry(rootPath: string, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("file://")) return trimmed;
  const candidatePath = path.isAbsolute(trimmed)
    ? trimmed
    : path.resolve(rootPath, trimmed);
  return toFileUriWithoutEncoding(candidatePath);
}

/** Convert a project root URI into a legacy workspace.json entry. */
function toWorkspaceProjectEntry(rootPath: string, rootUri: string): string {
  const cleanedRootUri = (() => {
    const trimmed = rootUri.trim();
    const fileIndex = trimmed.indexOf("file://");
    if (fileIndex > 0) return trimmed.slice(fileIndex);
    return trimmed;
  })();
  const normalizedUri = normalizeFileUri(cleanedRootUri);
  const projectRootPath = resolveFilePathFromUri(normalizedUri);
  if (!isPathInside(rootPath, projectRootPath)) {
    return toFileUriWithoutEncoding(projectRootPath);
  }
  const relativePath = path.relative(rootPath, projectRootPath);
  return relativePath || ".";
}

/** Ensure legacy workspace.json exists for top-level project registry. */
function ensureProjectRegistryConfig(): WorkspaceProjectContext | null {
  const rootPath = getDefaultProjectStoragePath();
  let config = readWorkspaceProjectConfig(rootPath);
  let shouldWrite = false;

  if (!config) {
    config = { schema: 1, projects: {}, order: [] };
    shouldWrite = true;
  }

  if (shouldWrite) {
    writeWorkspaceProjectConfig(rootPath, config);
  }

  return {
    rootPath,
    config,
  };
}

/** Get ordered top-level project entries from the legacy registry file. */
export function getProjectRegistryEntries(): Array<[string, string]> {
  const context = ensureProjectRegistryConfig();
  if (!context) return [];
  const { projects, order } = normalizeWorkspaceProjectConfig(context.config);
  const entries: Array<[string, string]> = [];
  for (const projectId of order) {
    const raw = projects[projectId];
    if (!raw) continue;
    const rootUri = resolveWorkspaceProjectEntry(context.rootPath, raw);
    if (!rootUri) continue;
    entries.push([projectId, rootUri]);
  }
  return entries;
}

/** Get project map from the legacy registry file. */
export function getProjectRegistryMap(): Map<string, string> {
  return new Map(getProjectRegistryEntries());
}

/** Upsert a project entry into the legacy registry file. */
export function upsertProjectRegistryEntry(
  projectId: string,
  rootUri: string,
): void {
  const context = ensureProjectRegistryConfig();
  if (!context) return;
  const normalized = normalizeWorkspaceProjectConfig(context.config);
  const nextProjects = { ...normalized.projects };
  const nextOrder = [...normalized.order];
  const trimmedId = projectId.trim();
  const trimmedUri = rootUri.trim();
  if (!trimmedId || !trimmedUri) return;
  nextProjects[trimmedId] = toWorkspaceProjectEntry(context.rootPath, trimmedUri);
  if (!nextOrder.includes(trimmedId)) {
    nextOrder.push(trimmedId);
  }
  writeWorkspaceProjectConfig(context.rootPath, {
    ...context.config,
    schema: 1,
    projects: nextProjects,
    order: nextOrder,
  });
}

/** Remove a project entry from the legacy registry file. */
export function removeProjectRegistryEntry(projectId: string): void {
  const context = ensureProjectRegistryConfig();
  if (!context) return;
  const normalized = normalizeWorkspaceProjectConfig(context.config);
  const trimmedId = projectId.trim();
  if (!trimmedId || !normalized.projects[trimmedId]) return;
  const nextProjects = { ...normalized.projects };
  delete nextProjects[trimmedId];
  const nextOrder = normalized.order.filter((id) => id !== trimmedId);
  writeWorkspaceProjectConfig(context.rootPath, {
    ...context.config,
    schema: 1,
    projects: nextProjects,
    order: nextOrder,
  });
}

/** Replace legacy registry project entries in order. */
export function setProjectRegistryEntries(
  entries: Array<[string, string]>,
): void {
  const context = ensureProjectRegistryConfig();
  if (!context) return;
  const projects: Record<string, string> = {};
  const order: string[] = [];
  for (const [projectId, rootUri] of entries) {
    const trimmedId = projectId?.trim();
    const trimmedUri = rootUri?.trim();
    if (!trimmedId || !trimmedUri) continue;
    projects[trimmedId] = toWorkspaceProjectEntry(context.rootPath, trimmedUri);
    order.push(trimmedId);
  }
  writeWorkspaceProjectConfig(context.rootPath, {
    ...context.config,
    schema: 1,
    projects,
    order,
  });
}
