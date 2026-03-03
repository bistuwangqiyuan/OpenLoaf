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

export type ClaudeCodeEffort = "low" | "medium" | "high";

export type ClaudeCodeOptions = {
  /** Claude Code SDK effort level. */
  effort?: ClaudeCodeEffort;
};

/** Default Claude Code effort level. */
export const DEFAULT_CC_EFFORT: ClaudeCodeEffort = "medium";

const CC_EFFORT_VALUES = new Set<ClaudeCodeEffort>(["low", "medium", "high"]);

/** Normalize Claude Code options with safe defaults. */
export function normalizeClaudeCodeOptions(
  value?: ClaudeCodeOptions,
): ClaudeCodeOptions {
  const effort =
    value?.effort && CC_EFFORT_VALUES.has(value.effort)
      ? value.effort
      : DEFAULT_CC_EFFORT;
  return { effort };
}
