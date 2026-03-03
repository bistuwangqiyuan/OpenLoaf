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

import * as React from "react";
import { cn } from "@/lib/utils";
import { Terminal } from "lucide-react";

type ClaudeCodeOptionProps = {
  /** Optional className for the container. */
  className?: string;
  /** Visual style variant. */
  variant?: "card" | "inline";
  /** Current model id (e.g. "sonnet" or "opus"). */
  modelId?: string;
};

const MODEL_LABELS: Record<string, string> = {
  "claude-sonnet-4-6": "Sonnet 4.6",
  "claude-opus-4-6": "Opus 4.6",
  "claude-haiku-4-5": "Haiku 4.5",
};

/** Resolve a human-readable label from a Claude Code model id. */
function resolveModelLabel(modelId?: string): string {
  if (!modelId) return "Claude Code";
  if (MODEL_LABELS[modelId]) return MODEL_LABELS[modelId]!;
  const lower = modelId.toLowerCase();
  if (lower.includes("opus")) return "Opus";
  if (lower.includes("sonnet")) return "Sonnet";
  if (lower.includes("haiku")) return "Haiku";
  return modelId;
}

/** Claude Code CLI info bar — shows which model and execution mode is active. */
export default function ClaudeCodeOption({
  className,
  variant = "card",
  modelId,
}: ClaudeCodeOptionProps) {
  const modelLabel = resolveModelLabel(modelId);

  const containerClassName =
    variant === "inline"
      ? "flex flex-wrap items-center gap-x-4 gap-y-1 px-2 py-2"
      : "flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-background px-3 py-2";

  return (
    <div className={cn(containerClassName, className)}>
      <div className="flex items-center gap-1.5">
        <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Claude Code</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">模型</span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground">
          {modelLabel}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">权限</span>
        <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          跳过确认
        </span>
      </div>
    </div>
  );
}
