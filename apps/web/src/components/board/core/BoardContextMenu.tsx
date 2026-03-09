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

import {
  LayoutGrid,
  RotateCw,
  Clipboard,
  Maximize2,
  Minimize2,
  Scan,
  Type,
  FileText,
  ImagePlus,
  Film,
} from "lucide-react";
import type { ReactElement, MouseEvent as ReactMouseEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@openloaf/ui/context-menu";

export type BoardContextMenuProps = {
  /** Trigger element for the context menu. */
  children: ReactElement;
  /** Whether the trigger is disabled. */
  triggerDisabled?: boolean;
  /** Auto layout handler. */
  onAutoLayout: () => void;
  /** Fullscreen toggle handler. */
  onToggleFullscreen: () => void;
  /** Whether the board is in fullscreen mode. */
  isFullscreen: boolean;
  /** Fit view handler. */
  onFitView: () => void;
  /** Refresh handler. */
  onRefresh: () => void;
  /** Paste handler. */
  onPaste: () => void;
  /** Whether paste action is available. */
  pasteAvailable: boolean;
  /** Whether paste action is disabled. */
  pasteDisabled?: boolean;
  /** Insert text node handler. */
  onInsertText?: () => void;
  /** Insert file handler. */
  onInsertFile?: () => void;
  /** Insert AI image generate node handler. */
  onInsertImageGenerate?: () => void;
  /** Insert AI video generate node handler. */
  onInsertVideoGenerate?: () => void;
  /** Whether insert actions are disabled (e.g. locked). */
  insertDisabled?: boolean;
  /** Context menu trigger handler. */
  onContextMenu?: (event: ReactMouseEvent) => void;
};

/** Render the board context menu. */
export function BoardContextMenu({
  children,
  triggerDisabled = false,
  onAutoLayout,
  onToggleFullscreen,
  onFitView,
  onRefresh,
  onPaste,
  pasteAvailable,
  pasteDisabled = false,
  onInsertText,
  onInsertFile,
  onInsertImageGenerate,
  onInsertVideoGenerate,
  insertDisabled = false,
  isFullscreen,
  onContextMenu,
}: BoardContextMenuProps) {
  const { t } = useTranslation('board');
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild disabled={triggerDisabled} onContextMenu={onContextMenu}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem
          icon={Type}
          disabled={insertDisabled}
          onSelect={() => {
            if (insertDisabled) return;
            onInsertText?.();
          }}
        >
          {t('contextMenu.insertText')}
        </ContextMenuItem>
        <ContextMenuItem
          icon={FileText}
          disabled={insertDisabled}
          onSelect={() => {
            if (insertDisabled) return;
            onInsertFile?.();
          }}
        >
          {t('contextMenu.insertFile')}
        </ContextMenuItem>
        <ContextMenuItem
          icon={ImagePlus}
          disabled={insertDisabled}
          onSelect={() => {
            if (insertDisabled) return;
            onInsertImageGenerate?.();
          }}
        >
          {t('contextMenu.aiImageGenerate')}
        </ContextMenuItem>
        <ContextMenuItem
          icon={Film}
          disabled={insertDisabled}
          onSelect={() => {
            if (insertDisabled) return;
            onInsertVideoGenerate?.();
          }}
        >
          {t('contextMenu.aiVideoGenerate')}
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem
          icon={Clipboard}
          disabled={pasteDisabled || !pasteAvailable}
          onSelect={() => {
            if (pasteDisabled || !pasteAvailable) return;
            onPaste();
          }}
        >
          {t('contextMenu.paste')}
        </ContextMenuItem>
        <ContextMenuItem
          icon={isFullscreen ? Minimize2 : Maximize2}
          onSelect={() => {
            onToggleFullscreen();
          }}
        >
          {isFullscreen ? t('contextMenu.exitFullscreen') : t('contextMenu.enterFullscreen')}
        </ContextMenuItem>
        <ContextMenuItem
          icon={Scan}
          onSelect={() => {
            onFitView();
          }}
        >
          {t('contextMenu.maximize')}
        </ContextMenuItem>
        <ContextMenuItem
          icon={LayoutGrid}
          onSelect={() => {
            onAutoLayout();
          }}
        >
          {t('contextMenu.autoLayout')}
        </ContextMenuItem>
        <ContextMenuItem
          icon={RotateCw}
          onSelect={() => {
            onRefresh();
          }}
        >
          {t('contextMenu.reload')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
