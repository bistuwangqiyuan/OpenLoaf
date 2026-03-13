"use client";

import type { PlateElementProps } from "platejs/react";

import { type VariantProps, cva } from "class-variance-authority";
import { PlateElement } from "platejs/react";

const boardHeadingVariants = cva(
  "relative m-0 text-current font-semibold tracking-tight",
  {
    variants: {
      variant: {
        h1: "text-[1.8em] leading-[1.12]",
        h2: "text-[1.5em] leading-[1.16]",
        h3: "text-[1.28em] leading-[1.2]",
        h4: "text-[1.14em] leading-[1.24]",
        h5: "text-[1.02em] leading-[1.28]",
        h6: "text-[0.96em] leading-[1.3] uppercase tracking-[0.08em] text-current/78",
      },
    },
  },
);

/** Render a compact heading element tuned for board text nodes. */
export function BoardHeadingElement({
  variant = "h1",
  ...props
}: PlateElementProps & VariantProps<typeof boardHeadingVariants>) {
  return (
    <PlateElement
      as={variant!}
      className={boardHeadingVariants({ variant })}
      data-board-text-heading={variant ?? "h1"}
      {...props}
    >
      {props.children}
    </PlateElement>
  );
}

/** Render a board heading level 1 element. */
export function BoardH1Element(props: PlateElementProps) {
  return <BoardHeadingElement variant="h1" {...props} />;
}

/** Render a board heading level 2 element. */
export function BoardH2Element(props: PlateElementProps) {
  return <BoardHeadingElement variant="h2" {...props} />;
}

/** Render a board heading level 3 element. */
export function BoardH3Element(props: PlateElementProps) {
  return <BoardHeadingElement variant="h3" {...props} />;
}

/** Render a board heading level 4 element. */
export function BoardH4Element(props: PlateElementProps) {
  return <BoardHeadingElement variant="h4" {...props} />;
}

/** Render a board heading level 5 element. */
export function BoardH5Element(props: PlateElementProps) {
  return <BoardHeadingElement variant="h5" {...props} />;
}

/** Render a board heading level 6 element. */
export function BoardH6Element(props: PlateElementProps) {
  return <BoardHeadingElement variant="h6" {...props} />;
}
