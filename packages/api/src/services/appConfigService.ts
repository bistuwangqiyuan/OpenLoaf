/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { getDefaultWorkspaceRootDir, getOpenLoafRootDir } from "@openloaf/config";
import type { AppConfig } from "../types/appConfig";
import { appConfigSchema } from "../types/appConfig";

/** Schema for config.json (global app config). */
const ConfigFileSchema = z.object({
  /** Global project map for backward compat. */
  projects: z.record(z.string(), z.string()).optional(),
  /** Skill folder names to ignore. */
  ignoreSkills: z.array(z.string()).optional(),
});

type ConfigFile = z.infer<typeof ConfigFileSchema>;

/** Cache the last valid config to avoid flapping. */
let cachedConfig: ConfigFile | null = null;

/** Resolve config directory. */
function getConfigDir(): string {
  return getOpenLoafRootDir();
}

/** Resolve config.json path. */
function getConfigPath(): string {
  return path.join(getConfigDir(), "config.json");
}

/** Build default root uri. */
function resolveDefaultRootUri(): string {
  const rootPath = getDefaultWorkspaceRootDir();
  mkdirSync(rootPath, { recursive: true });
  return pathToFileURL(rootPath).href;
}

/** Ensure config.json exists with defaults. */
function ensureDefaultConfig(): ConfigFile {
  const payload: ConfigFile = { projects: {}, ignoreSkills: [] };
  writeConfigFile(payload);
  return payload;
}

/** Read config.json payload safely. */
function readConfigFile(): ConfigFile {
  const filePath = getConfigPath();
  if (!existsSync(filePath)) {
    return ensureDefaultConfig();
  }
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf-8")) as unknown;
    const parsed = ConfigFileSchema.parse(raw);
    cachedConfig = parsed;
    return parsed;
  } catch {
    if (cachedConfig) return cachedConfig;
    return ensureDefaultConfig();
  }
}

/** Write config.json payload atomically. */
function writeConfigFile(payload: ConfigFile): void {
  const filePath = getConfigPath();
  const tmpPath = `${filePath}.${Date.now()}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(payload, null, 2), "utf-8");
  renameSync(tmpPath, filePath);
  cachedConfig = payload;
}

/** Return global app config. */
export function getAppConfig(): AppConfig {
  const config = readConfigFile();
  return appConfigSchema.parse(config);
}

/** Overwrite global app config. */
export function setAppConfig(config: AppConfig): void {
  writeConfigFile(config);
}

/** Get the global root path (always ~/.openloaf/). */
export function getGlobalRootPath(): string {
  const rootPath = getOpenLoafRootDir();
  mkdirSync(rootPath, { recursive: true });
  return rootPath;
}

/** Get the default workspace root path (for project storage). */
export function getDefaultProjectStoragePath(): string {
  const rootPath = getDefaultWorkspaceRootDir();
  mkdirSync(rootPath, { recursive: true });
  return rootPath;
}

/** Get the default project storage root URI (file://...). */
export function getDefaultProjectStorageRootUri(): string {
  return resolveDefaultRootUri();
}

// ============================================================
// Backward compatibility exports for workspaceConfig consumers
// ============================================================

import type { Workspace } from "../types/workspace";
import { fileURLToPath } from "node:url";
import { getLegacyWorkspaceRootDir } from "@openloaf/config";

function normalizeLegacyWorkspaceUri(value?: string): string | undefined {
  if (!value) return value;
  const legacyRoot = pathToFileURL(getLegacyWorkspaceRootDir()).href;
  const nextRoot = resolveDefaultRootUri();
  if (!value.startsWith(legacyRoot)) return value;
  return value.replace(legacyRoot, nextRoot);
}

/**
 * @deprecated Returns a synthetic Workspace object for backward compatibility.
 * The workspace concept has been removed; this creates a virtual workspace
 * from the global config.
 */
export function getActiveWorkspaceConfig(): Workspace {
  const config = getAppConfig();
  return {
    id: "default",
    name: "Default",
    type: "local",
    isActive: true,
    rootUri: resolveDefaultRootUri(),
    projects: config.projects ?? {},
    ignoreSkills: config.ignoreSkills ?? [],
  };
}

/** @deprecated Use getAppConfig() instead. */
export function getWorkspaceByIdConfig(_workspaceId: string): Workspace | null {
  // All workspace IDs resolve to the same global config
  return getActiveWorkspaceConfig();
}

/** @deprecated Use getGlobalRootPath() instead. */
export function resolveWorkspaceRootPath(rootUri: string): string {
  const rootPath = fileURLToPath(rootUri);
  mkdirSync(rootPath, { recursive: true });
  return rootPath;
}

/** @deprecated Use getAppConfig().ignoreSkills instead. */
export function getWorkspaces(): Workspace[] {
  return [getActiveWorkspaceConfig()];
}

/** @deprecated No-op in new architecture. */
export function setWorkspaces(_workspaces: Workspace[]): void {
  // No-op: workspace concept removed
}
