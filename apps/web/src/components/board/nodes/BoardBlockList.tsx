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

import type { TListElement } from "platejs";
import type { PlateElementProps, RenderNodeWrapper } from "platejs/react";

import { isOrderedList } from "@platejs/list";
import {
  useTodoListElement,
  useTodoListElementState,
} from "@platejs/list/react";
import { useReadOnly } from "platejs/react";
import { cn } from "@udecode/cn";

import { Checkbox } from "@openloaf/ui/checkbox";

/** Render board text-node lists with layout tuned for the canvas note view. */
export const BoardBlockList: RenderNodeWrapper = (props) => {
  if (!props.element.listStyleType) return;

  return (nextProps) => <BoardList {...nextProps} />;
};

/** Render a single list wrapper emitted by Plate. */
function BoardList(props: PlateElementProps) {
  const element = props.element as TListElement;
  const listStyleType = element.listStyleType ?? "";

  if (listStyleType === "todo") {
    return <TodoBoardList {...props} />;
  }

  const ListTag = isOrderedList(element) ? "ol" : "ul";

  return (
    <ListTag
      className={cn(
        // 逻辑：白板文本节点空间更紧凑，列表整体向左回收一点，避免 marker 区域过宽。
        "my-0 -ml-2 pl-3",
        "marker:text-current/70 marker:font-medium"
      )}
      data-board-text-list={isOrderedList(element) ? "ordered" : "unordered"}
      style={{ listStyleType }}
      start={isOrderedList(element) ? element.listStart : undefined}
    >
      <li className="pl-0.5">{props.children}</li>
    </ListTag>
  );
}

/** Render todo list rows with inline checkbox layout instead of absolute marker overlay. */
function TodoBoardList(props: PlateElementProps) {
  const state = useTodoListElementState({ element: props.element });
  const { checkboxProps } = useTodoListElement(state);
  const readOnly = useReadOnly();

  return (
    <ul className="my-0 list-none p-0" data-board-text-list="todo">
      <li
        className={cn(
          "flex list-none items-start gap-2",
          (props.element.checked as boolean) &&
            "text-muted-foreground line-through"
        )}
        data-board-text-list-item="todo"
      >
        <div
          className="flex h-[1.4em] shrink-0 items-center"
          contentEditable={false}
        >
          <Checkbox
            className={cn(
              "rounded-[4px]",
              readOnly && "pointer-events-none"
            )}
            {...checkboxProps}
          />
        </div>
        <div className="min-w-0 flex-1">{props.children}</div>
      </li>
    </ul>
  );
}
