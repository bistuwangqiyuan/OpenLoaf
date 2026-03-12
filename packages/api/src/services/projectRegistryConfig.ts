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
  type Dirent,
  existsSync,
  readdirSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { z } from "zod";
import { resolveScopedOpenLoafPath } from "@openloaf/config";
import {
  getAppConfig,
  getDefaultProjectStoragePath,
} from "./appConfigService";
import { normalizeFileUri, resolveFilePathFromUri, toFileUriWithoutEncoding } from "./fileUri";

const PROJECT_REGISTRY_CONFIG_FILE = "project-registry.json";
const PROJECT_META_DIR = ".openloaf";
const PROJECT_META_FILE = "project.json";

/** Top-level project registry schema. */
export const projectRegistryConfigSchema = z
  .object({
    schema: z.number().optional(),
    projects: z.record(z.string(), z.string()).optional(),
    order: z.array(z.string()).optional(),
  })
  .passthrough();

export type ProjectRegistryConfig = z.infer<typeof projectRegistryConfigSchema>;

type ProjectRegistryContext = {
  /** Root path on disk. */
  rootPath: string;
  /** Raw config data. */
  config: ProjectRegistryConfig;
};

/** Build the project registry path from the project storage root. */
function resolveProjectRegistryConfigPath(rootPath: string): string {
  return resolveScopedOpenLoafPath(rootPath, PROJECT_REGISTRY_CONFIG_FILE);
}

/** Read project-registry.json safely. */
function readProjectRegistryConfig(rootPath: string): ProjectRegistryConfig | null {
  const filePath = resolveProjectRegistryConfigPath(rootPath);
  if (!existsSync(filePath)) return null;
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf-8")) as unknown;
    return projectRegistryConfigSchema.parse(raw);
  } catch {
    return null;
  }
}

/** Write project-registry.json atomically. */
function writeProjectRegistryConfig(rootPath: string, payload: ProjectRegistryConfig): void {
  const filePath = resolveProjectRegistryConfigPath(rootPath);
  const dirPath = path.dirname(filePath);
  mkdirSync(dirPath, { recursive: true });
  const tmpPath = `${filePath}.${Date.now()}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(payload, null, 2), "utf-8");
  renameSync(tmpPath, filePath);
}

/** Normalize top-level project mapping and order. */
function normalizeProjectRegistryConfig(
  raw: ProjectRegistryConfig,
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
function resolveProjectRegistryEntry(rootPath: string, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("file://")) return trimmed;
  const candidatePath = path.isAbsolute(trimmed)
    ? trimmed
    : path.resolve(rootPath, trimmed);
  return toFileUriWithoutEncoding(candidatePath);
}

/** Convert a project root URI into a stored registry entry. */
function toProjectRegistryEntry(rootPath: string, rootUri: string): string {
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

/** Discover top-level projects directly under the storage root. */
function discoverStorageRootProjects(rootPath: string): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  let children: Dirent[] = [];
  try {
    children = readdirSync(rootPath, { withFileTypes: true });
  } catch {
    return entries;
  }

  for (const child of children) {
    if (!child.isDirectory()) continue;
    const projectRootPath = path.join(rootPath, child.name);
    const metaPath = path.join(projectRootPath, PROJECT_META_DIR, PROJECT_META_FILE);
    if (!existsSync(metaPath)) continue;
    try {
      const raw = JSON.parse(readFileSync(metaPath, "utf-8")) as { projectId?: string };
      const projectId = typeof raw.projectId === "string" ? raw.projectId.trim() : "";
      if (!projectId) continue;
      entries.push([projectId, toFileUriWithoutEncoding(projectRootPath)]);
    } catch {
      // ignore invalid project metadata
    }
  }

  return entries;
}

/** Build initial registry entries from existing config and on-disk projects. */
function resolveInitialProjectRegistryEntries(rootPath: string): Array<[string, string]> {
  const nextEntries = new Map<string, string>();
  const configProjects = getAppConfig().projects ?? {};

  for (const [projectId, value] of Object.entries(configProjects)) {
    const trimmedId = projectId.trim();
    const trimmedValue = value?.trim();
    if (!trimmedId || !trimmedValue) continue;
    const rootUri = resolveProjectRegistryEntry(rootPath, trimmedValue);
    if (!rootUri) continue;
    nextEntries.set(trimmedId, rootUri);
  }

  for (const [projectId, rootUri] of discoverStorageRootProjects(rootPath)) {
    if (nextEntries.has(projectId)) continue;
    nextEntries.set(projectId, rootUri);
  }

  return Array.from(nextEntries.entries());
}

/** Ensure project-registry.json exists for top-level project registry. */
function ensureProjectRegistryConfig(): ProjectRegistryContext | null {
  const rootPath = getDefaultProjectStoragePath();
  let config = readProjectRegistryConfig(rootPath);
  let shouldWrite = false;

  if (!config) {
    const entries = resolveInitialProjectRegistryEntries(rootPath);
    const projects = Object.fromEntries(
      entries.map(([projectId, rootUri]) => [projectId, toProjectRegistryEntry(rootPath, rootUri)]),
    );
    const order = entries.map(([projectId]) => projectId);
    config = { schema: 1, projects, order };
    shouldWrite = true;
  }

  if (shouldWrite) {
    writeProjectRegistryConfig(rootPath, config);
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
  const { projects, order } = normalizeProjectRegistryConfig(context.config);
  const entries: Array<[string, string]> = [];
  for (const projectId of order) {
    const raw = projects[projectId];
    if (!raw) continue;
    const rootUri = resolveProjectRegistryEntry(context.rootPath, raw);
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
  const normalized = normalizeProjectRegistryConfig(context.config);
  const nextProjects = { ...normalized.projects };
  const nextOrder = [...normalized.order];
  const trimmedId = projectId.trim();
  const trimmedUri = rootUri.trim();
  if (!trimmedId || !trimmedUri) return;
  nextProjects[trimmedId] = toProjectRegistryEntry(context.rootPath, trimmedUri);
  if (!nextOrder.includes(trimmedId)) {
    nextOrder.push(trimmedId);
  }
  writeProjectRegistryConfig(context.rootPath, {
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
  const normalized = normalizeProjectRegistryConfig(context.config);
  const trimmedId = projectId.trim();
  if (!trimmedId || !normalized.projects[trimmedId]) return;
  const nextProjects = { ...normalized.projects };
  delete nextProjects[trimmedId];
  const nextOrder = normalized.order.filter((id) => id !== trimmedId);
  writeProjectRegistryConfig(context.rootPath, {
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
    projects[trimmedId] = toProjectRegistryEntry(context.rootPath, trimmedUri);
    order.push(trimmedId);
  }
  writeProjectRegistryConfig(context.rootPath, {
    ...context.config,
    schema: 1,
    projects,
    order,
  });
}
