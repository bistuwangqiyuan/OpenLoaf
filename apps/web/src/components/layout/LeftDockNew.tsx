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
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { ComponentMap, getPanelTitle } from "@/utils/panel-utils";
import type { DockItem } from "@openloaf/api/common";
import { Skeleton } from "@openloaf/ui/skeleton";

const GLOBAL_ENTRY_COMPONENTS = new Set([
  "calendar-page",
  "email-page",
  "scheduled-tasks-page",
  "global-desktop",
]);

/**
 * Returns true when event target is an editable element. */
function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    target.isContentEditable ||
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.getAttribute("role") === "textbox"
  );
}

/**
 * Fallback UI while lazy-loaded panels are initializing. */
function PanelFallback() {
  return (
    <div className="h-full w-full p-3">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-[40%]" />
        <Skeleton className="h-4 w-[72%]" />
        <Skeleton className="h-4 w-[56%]" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}

function renderDockItem(
  itemId: string,
  item: DockItem,
  refreshKey = 0
): React.ReactNode {
  const Component = ComponentMap[item.component];
  if (!Component) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        Component not found: {item.component}
      </div>
    );
  }

  const title = getPanelTitle(item.component);

  return (
    <React.Suspense fallback={<PanelFallback />}>
      <Component panelKey={itemId} tabId={itemId} {...item.params} />
    </React.Suspense>
  );
}

/**
 * 新的 LeftDock 组件，支持通过 props 传入数据
 * 兼容新旧导航系统
 */
export interface LeftDockNewProps {
  /** 基础面板（Left Dock 主内容） */
  base?: DockItem;
  /** 堆栈面板（覆盖层） */
  stack: DockItem[];
  /** 堆栈是否隐藏 */
  stackHidden: boolean;
  /** 当前激活的堆栈项 ID */
  activeStackItemId?: string;
  /** 移除堆栈项的回调 */
  onRemoveStackItem?: (item: DockItem) => void;
}

export function LeftDockNew({
  base,
  stack = [],
  stackHidden = false,
  activeStackItemId = "",
  onRemoveStackItem,
}: LeftDockNewProps) {
  const hasOverlay = Boolean(base) && stack.length > 0 && !stackHidden;
  const floating = Boolean(base);
  const showGlobalEntryDock = Boolean(
    base?.component && GLOBAL_ENTRY_COMPONENTS.has(base.component),
  );
  const showBottomDockGap = base?.component === "plant-page" || showGlobalEntryDock;

  const activeStackId = activeStackItemId || stack.at(-1)?.id || "";

  return (
    <div
      className={cn(
        "relative flex h-full w-full overflow-hidden",
        floating && "rounded-lg bg-background shadow-sm",
        hasOverlay && "ring-1 ring-border"
      )}
      onMouseDown={(e) => {
        // 阻止拖拽
        if (e.target === e.currentTarget) {
          e.preventDefault();
        }
      }}
    >
      {/* Base 面板 */}
      {base && (
        <div className="flex h-full w-full">
          {renderDockItem("base", base)}
        </div>
      )}

      {/* 堆栈覆盖层 */}
      {hasOverlay && (
        <div className="absolute inset-0 z-10 flex flex-col">
          {/* 堆栈面板 */}
          <div className="flex h-full w-full flex-1 overflow-hidden">
            {stack.map((item) => (
              <div key={item.id} className="flex h-full w-full">
                {renderDockItem(item.id, item)}
              </div>
            ))}
          </div>

          {/* 关闭按钮 */}
          {onRemoveStackItem && (
            <div className="absolute top-2 right-2 z-20">
              <button
                onClick={() => onRemoveStackItem(stack.at(-1)!)}
                className="flex h-6 w-6 items-center justify-center rounded-md bg-background/80 backdrop-blur-sm text-foreground shadow-sm hover:bg-background"
                title="关闭"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}

      {/* 底部间距（用于 GlobalEntryDockTabs） */}
      {showBottomDockGap && (
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      )}
    </div>
  );
}
