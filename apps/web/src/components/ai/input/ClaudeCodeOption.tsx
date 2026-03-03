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
import {
  DEFAULT_CC_EFFORT,
  normalizeClaudeCodeOptions,
  type ClaudeCodeEffort,
} from "@/lib/chat/claude-code-options";
import { useChatOptions, useChatSession } from "../context";
import { useMainAgentModel } from "../hooks/use-main-agent-model";
import {
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
} from "@/components/ai-elements/prompt-input";
import { buildCliModelOptions } from "@/lib/provider-models";
import { useInstalledCliProviderIds } from "@/hooks/use-cli-tools-installed";

type ClaudeCodeOptionProps = {
  className?: string;
  variant?: "card" | "inline";
};

const EFFORT_OPTIONS: Array<{ label: string; value: ClaudeCodeEffort }> = [
  { label: "低", value: "low" },
  { label: "中", value: "medium" },
  { label: "高", value: "high" },
];

/** Claude Code 模型 + 能力强度选择栏（header inline 区域）。 */
export default function ClaudeCodeOption({
  className,
  variant = "card",
}: ClaudeCodeOptionProps) {
  const { claudeCodeOptions, setClaudeCodeOptions } = useChatOptions();
  const { projectId } = useChatSession();
  const normalized = normalizeClaudeCodeOptions(claudeCodeOptions);
  const effortValue = normalized.effort ?? DEFAULT_CC_EFFORT;

  // 逻辑：读取当前已安装的 CLI tools，筛选 Claude Code 可用模型。
  const installedCliProviderIds = useInstalledCliProviderIds();
  const codeModels = React.useMemo(
    () =>
      buildCliModelOptions(installedCliProviderIds).filter((m) =>
        m.providerId === "claude-code-cli",
      ),
    [installedCliProviderIds],
  );

  // 逻辑：从 useMainAgentModel 获取/设置当前选择的 code model（与 ModelPreferencesPanel 同步）。
  const { detail, setCodeModelIds } = useMainAgentModel(projectId);
  const currentCodeModelId = detail?.codeModelIds?.[0] ?? "";

  // 逻辑：从完整 id（如 "claude-code-cli:claude-sonnet-4-6"）解析实际的 model id 部分。
  const resolvedModelId = React.useMemo(() => {
    const modelPart = currentCodeModelId.includes(":")
      ? currentCodeModelId.split(":").slice(1).join(":")
      : currentCodeModelId;
    return modelPart || (codeModels[0]?.modelId ?? "");
  }, [currentCodeModelId, codeModels]);

  // 逻辑：同步 claudeCodeOptions 默认值（首次渲染时确保 context 有初始值）。
  React.useEffect(() => {
    setClaudeCodeOptions((prev) => {
      const next = normalizeClaudeCodeOptions(prev);
      if (prev?.effort === next.effort) return prev;
      return next;
    });
  }, [setClaudeCodeOptions]);

  const handleModelChange = React.useCallback(
    (modelId: string) => {
      // modelId 是下拉框的 value（即 modelDefinition.id，如 "claude-sonnet-4-6"）
      const option = codeModels.find((m) => m.modelId === modelId);
      if (!option) return;
      setCodeModelIds([option.id]);
    },
    [codeModels, setCodeModelIds],
  );

  const containerClassName =
    variant === "inline"
      ? "flex flex-wrap gap-3 px-2 py-2"
      : "flex flex-wrap gap-3 rounded-lg border border-border bg-background px-3 py-2";

  if (codeModels.length === 0) return null;

  return (
    <div className={cn(containerClassName, className)}>
      {/* 模型选择 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">模型</span>
        <PromptInputSelect
          value={resolvedModelId}
          onValueChange={handleModelChange}
        >
          <PromptInputSelectTrigger className="h-7 min-w-[140px] rounded-md px-2 text-xs shadow-xs">
            <PromptInputSelectValue />
          </PromptInputSelectTrigger>
          <PromptInputSelectContent>
            {codeModels.map((m) => (
              <PromptInputSelectItem
                key={m.id}
                value={m.modelId}
                className="text-xs"
              >
                {m.modelDefinition?.name ?? m.modelId}
              </PromptInputSelectItem>
            ))}
          </PromptInputSelectContent>
        </PromptInputSelect>
      </div>

      {/* 能力强度 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">能力强度</span>
        <PromptInputSelect
          value={effortValue}
          onValueChange={(v) =>
            setClaudeCodeOptions((prev) => ({
              ...normalizeClaudeCodeOptions(prev),
              effort: v as ClaudeCodeEffort,
            }))
          }
        >
          <PromptInputSelectTrigger className="h-7 min-w-[80px] rounded-md px-2 text-xs shadow-xs">
            <PromptInputSelectValue />
          </PromptInputSelectTrigger>
          <PromptInputSelectContent>
            {EFFORT_OPTIONS.map((opt) => (
              <PromptInputSelectItem
                key={opt.value}
                value={opt.value}
                className="text-xs"
              >
                {opt.label}
              </PromptInputSelectItem>
            ))}
          </PromptInputSelectContent>
        </PromptInputSelect>
      </div>
    </div>
  );
}
