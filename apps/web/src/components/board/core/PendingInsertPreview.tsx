/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import { memo, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus, Film, ScanEye, Sparkles } from "lucide-react";
import type { CanvasEngine } from "../engine/CanvasEngine";
import type { CanvasInsertRequest, CanvasPoint } from "../engine/types";
import { IMAGE_GENERATE_NODE_TYPE } from "../nodes/imageGenerate/constants";
import { VIDEO_GENERATE_NODE_TYPE } from "../nodes/videoGenerate/constants";
import { IMAGE_PROMPT_GENERATE_NODE_TYPE } from "../nodes/imagePromptGenerate/constants";
import {
  BOARD_GENERATE_NODE_BASE_IMAGE,
  BOARD_GENERATE_NODE_BASE_VIDEO,
  BOARD_GENERATE_NODE_BASE_PROMPT,
  BOARD_GENERATE_BORDER_IMAGE,
  BOARD_GENERATE_BORDER_VIDEO,
  BOARD_GENERATE_BORDER_PROMPT,
  BOARD_GENERATE_BTN_IMAGE,
  BOARD_GENERATE_BTN_VIDEO,
  BOARD_GENERATE_BTN_PROMPT,
  BOARD_GENERATE_PILL_IMAGE,
  BOARD_GENERATE_PILL_VIDEO,
} from "../ui/board-style-system";

/** Node types that have a DOM-based pending insert preview. */
export const PENDING_INSERT_DOM_TYPES = new Set([
  IMAGE_GENERATE_NODE_TYPE,
  VIDEO_GENERATE_NODE_TYPE,
  IMAGE_PROMPT_GENERATE_NODE_TYPE,
]);

type NodePreviewConfig = {
  base: string;
  border: string;
  btnClass: string;
  pillClass?: string;
  iconColor: string;
  icon: typeof ImagePlus;
  titleKey: string;
  pillKey?: string;
  btnKey: string;
  showPrompt: boolean;
};

const NODE_PREVIEW_MAP: Record<string, NodePreviewConfig> = {
  [IMAGE_GENERATE_NODE_TYPE]: {
    base: BOARD_GENERATE_NODE_BASE_IMAGE,
    border: BOARD_GENERATE_BORDER_IMAGE,
    btnClass: BOARD_GENERATE_BTN_IMAGE,
    pillClass: BOARD_GENERATE_PILL_IMAGE,
    iconColor: "text-[#1a73e8] dark:text-sky-400",
    icon: ImagePlus,
    titleKey: "imageGenerate.title",
    pillKey: "imageGenerate.mode.textToImage",
    btnKey: "imageGenerate.generate",
    showPrompt: true,
  },
  [VIDEO_GENERATE_NODE_TYPE]: {
    base: BOARD_GENERATE_NODE_BASE_VIDEO,
    border: BOARD_GENERATE_BORDER_VIDEO,
    btnClass: BOARD_GENERATE_BTN_VIDEO,
    pillClass: BOARD_GENERATE_PILL_VIDEO,
    iconColor: "text-[#9334e6] dark:text-violet-400",
    icon: Film,
    titleKey: "videoGenerate.title",
    pillKey: "videoGenerate.status.idle",
    btnKey: "videoGenerate.generate",
    showPrompt: true,
  },
  [IMAGE_PROMPT_GENERATE_NODE_TYPE]: {
    base: BOARD_GENERATE_NODE_BASE_PROMPT,
    border: BOARD_GENERATE_BORDER_PROMPT,
    btnClass: BOARD_GENERATE_BTN_PROMPT,
    iconColor: "text-[#f9ab00] dark:text-amber-400",
    icon: ScanEye,
    titleKey: "imagePromptGenerate.title",
    btnKey: "imagePromptGenerate.run",
    showPrompt: false,
  },
};

type PendingInsertPreviewProps = {
  engine: CanvasEngine;
  pendingInsert: CanvasInsertRequest;
  pendingInsertPoint: CanvasPoint;
};

/** Render a DOM-based preview for pending AI node insertion. */
function PendingInsertPreviewBase({
  engine,
  pendingInsert,
  pendingInsertPoint,
}: PendingInsertPreviewProps) {
  const { t } = useTranslation("board");
  const layerRef = useRef<HTMLDivElement | null>(null);

  const applyTransform = useCallback(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const { zoom, offset } = engine.getViewState().viewport;
    layer.style.transform = `translate(${offset[0]}px, ${offset[1]}px) scale(${zoom})`;
  }, [engine]);

  useEffect(() => {
    applyTransform();
    const unsubscribe = engine.subscribeView(() => applyTransform());
    return unsubscribe;
  }, [engine, applyTransform]);

  const config = NODE_PREVIEW_MAP[pendingInsert.type];
  if (!config) return null;

  const [w, h] = pendingInsert.size ?? [320, 240];
  const previewH = config.showPrompt ? h : undefined;
  const x = pendingInsertPoint[0] - w / 2;
  const y = pendingInsertPoint[1] - (previewH ?? h) / 2;
  const Icon = config.icon;

  return (
    <div
      ref={layerRef}
      className="pointer-events-none absolute inset-0 origin-top-left"
    >
      <div
        className="absolute"
        style={{ left: x, top: y, width: w, height: previewH, opacity: 0.82 }}
      >
        <div
          className={[
            "relative flex w-full flex-col gap-3 rounded-xl border p-3 text-[#202124] dark:text-slate-100",
            previewH ? "h-full" : "",
            config.base,
            config.border,
          ].join(" ")}
        >
          {/* Header */}
          <div className="flex items-center gap-2">
            <Icon size={16} className={`shrink-0 ${config.iconColor}`} />
            <div className="text-[13px] font-semibold leading-5">
              {t(config.titleKey)}
            </div>
            {config.pillClass && config.pillKey ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] leading-3 ${config.pillClass}`}
              >
                {t(config.pillKey)}
              </span>
            ) : null}
            <div className="flex-1" />
            <span
              className={`inline-flex h-7 items-center justify-center rounded-full px-3 text-[12px] leading-none ${config.btnClass}`}
            >
              <Sparkles size={14} className="mr-1" />
              {t(config.btnKey)}
            </span>
          </div>

          {/* Model skeleton */}
          <div className="flex items-center gap-3">
            <div className="text-[12px] text-[#5f6368] dark:text-slate-400">
              {t("imageGenerate.model")}
            </div>
            <div className="h-7 flex-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.06]" />
          </div>

          {/* Prompt skeleton (only for image/video generate) */}
          {config.showPrompt ? (
            <div className="flex flex-1 flex-col gap-2">
              <div className="text-[12px] text-[#5f6368] dark:text-slate-400">
                {t("imageGenerate.prompt")}
              </div>
              <div className="flex-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.06]" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export const PendingInsertPreview = memo(PendingInsertPreviewBase);
