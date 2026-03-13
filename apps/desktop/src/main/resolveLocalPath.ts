/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Normalize file:// URI for cross-platform parsing. */
export function normalizeFileUri(raw: string): string {
  let normalized = raw.trim();
  if (normalized.startsWith('file:/') && !normalized.startsWith('file://')) {
    normalized = `file:///${normalized.slice('file:/'.length)}`;
  } else if (normalized.startsWith('file://') && !normalized.startsWith('file:///')) {
    normalized = `file:///${normalized.slice('file://'.length)}`;
  }
  return normalized.replace(/\\/g, '/');
}

/** Return whether the path is an absolute local filesystem path. */
export function isAbsoluteLocalPath(filePath: string): boolean {
  return path.isAbsolute(filePath) || /^[a-zA-Z]:[\\/]/.test(filePath) || filePath.startsWith('\\\\');
}

/** Resolve a local filesystem path from a file:// URI or raw path. */
export function resolveLocalPath(input: string): string | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  if (raw.startsWith('file:')) {
    const normalized = normalizeFileUri(raw);
    try {
      return fileURLToPath(normalized);
    } catch {
      // 中文注释：处理非标准 file:// 路径，避免主进程崩溃。
      const stripped = normalized.replace(/^file:\/\//, '');
      const decoded = decodeURIComponent(stripped);
      const withoutHost = decoded.startsWith('localhost/')
        ? decoded.slice('localhost/'.length)
        : decoded;
      let candidate = withoutHost;
      if (candidate.startsWith('/') && /^[a-zA-Z]:/.test(candidate.slice(1))) {
        candidate = candidate.slice(1);
      }
      candidate = candidate.replace(/\//g, path.sep);
      if (isAbsoluteLocalPath(candidate)) {
        return candidate;
      }
      return null;
    }
  }
  return raw;
}
