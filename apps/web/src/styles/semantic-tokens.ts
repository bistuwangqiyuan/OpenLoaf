/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */

/**
 * Design token constants — pre-composed Tailwind class strings for the
 * OpenLoaf semantic color system.  All colors are backed by CSS custom
 * properties defined in `index.css` (`:root` / `.dark`), so changing
 * `:root { --ol-blue: ... }` will propagate everywhere these tokens are used.
 */

/* ── Semantic Color Tokens ── */

export const OL_BLUE = {
  text: 'text-ol-blue',
  bg: 'bg-ol-blue-bg',
  bgHover: 'hover:bg-ol-blue-bg-hover',
  badge: 'bg-ol-blue-bg text-ol-blue',
  button: 'bg-ol-blue-bg text-ol-blue hover:bg-ol-blue-bg-hover',
  dot: 'bg-ol-blue',
  cssVar: 'var(--ol-blue)',
} as const

export const OL_GREEN = {
  text: 'text-ol-green',
  bg: 'bg-ol-green-bg',
  bgHover: 'hover:bg-ol-green-bg-hover',
  badge: 'bg-ol-green-bg text-ol-green',
  button: 'bg-ol-green-bg text-ol-green hover:bg-ol-green-bg-hover',
  dot: 'bg-ol-green',
  cssVar: 'var(--ol-green)',
} as const

export const OL_AMBER = {
  text: 'text-ol-amber',
  bg: 'bg-ol-amber-bg',
  bgHover: 'hover:bg-ol-amber-bg-hover',
  badge: 'bg-ol-amber-bg text-ol-amber',
  button: 'bg-ol-amber-bg text-ol-amber hover:bg-ol-amber-bg-hover',
  dot: 'bg-ol-amber',
  cssVar: 'var(--ol-amber)',
} as const

export const OL_RED = {
  text: 'text-ol-red',
  bg: 'bg-ol-red-bg',
  bgHover: 'hover:bg-ol-red-bg-hover',
  badge: 'bg-ol-red-bg text-ol-red',
  button: 'bg-ol-red-bg text-ol-red hover:bg-ol-red-bg-hover',
  dot: 'bg-ol-red',
  cssVar: 'var(--ol-red)',
} as const

export const OL_PURPLE = {
  text: 'text-ol-purple',
  bg: 'bg-ol-purple-bg',
  bgHover: 'hover:bg-ol-purple-bg-hover',
  badge: 'bg-ol-purple-bg text-ol-purple',
  button: 'bg-ol-purple-bg text-ol-purple hover:bg-ol-purple-bg-hover',
  dot: 'bg-ol-purple',
  cssVar: 'var(--ol-purple)',
} as const

export const OL_NEUTRAL = {
  textPrimary: 'text-ol-text-primary',
  textSecondary: 'text-ol-text-secondary',
  textAuxiliary: 'text-ol-text-auxiliary',
  surfaceMuted: 'bg-ol-surface-muted',
  surfaceInset: 'bg-ol-surface-inset',
  surfaceInput: 'bg-ol-surface-input',
  divider: 'border-ol-divider',
  dividerBg: 'bg-ol-divider',
} as const

export const OL_COLORS = {
  blue: OL_BLUE,
  green: OL_GREEN,
  amber: OL_AMBER,
  red: OL_RED,
  purple: OL_PURPLE,
  neutral: OL_NEUTRAL,
} as const

/* ── Focus Ring ── */

export const OL_FOCUS = {
  ring: 'focus-visible:ring-ol-focus-ring',
  border: 'focus-visible:border-ol-focus-border',
  input: 'focus-visible:border-ol-focus-border focus-visible:ring-1 focus-visible:ring-ol-focus-ring',
} as const

/* ── Radius Standards ── */

/**
 * Radius standard — TE Industrial Minimal
 *
 * All radius values are controlled by CSS variables in index.css:
 *   --radius: 0.5rem (8px) → rounded-lg
 *   --radius-md: 6px, --radius-sm: 4px
 *   --radius-xl/2xl/3xl: all 0.5rem (8px) via --ol-radius-*
 *
 * Component → Radius mapping:
 *   Button / Badge / Tag / Chip → rounded-md (6px)
 *   Input / Dropdown / Popover  → rounded-md (6px)
 *   Card / Dialog content       → rounded-lg (8px)
 *   Large panels / Overlays     → rounded-lg (8px)
 */
export const OL_RADIUS = {
  /** Buttons, Badge, Tag, Chip */
  pill: 'rounded-md',
  /** Small controls: inputs, dropdown items */
  control: 'rounded-md',
  /** Cards, dialog content */
  card: 'rounded-lg',
  /** Large containers, panels */
  panel: 'rounded-lg',
  /** No rounding */
  none: 'rounded-none',
} as const

/* ── Shadow Tokens ── */

export const OL_SHADOW = {
  glass: 'shadow-ol-glass',
  toolbar: 'shadow-ol-toolbar',
  float: 'shadow-ol-float',
} as const

/* ── Glass Effect Presets ── */

/** Glass effect presets — now backed by CSS component classes in index.css */
export const OL_GLASS = {
  /** Toolbar overlays */
  toolbar: 'ol-glass-toolbar',
  /** Generation node containers */
  node: 'ol-glass-node',
  /** Floating panels */
  float: 'ol-glass-float',
  /** Inset areas (no shadow, no blur) */
  inset: 'bg-ol-surface-inset border border-ol-divider',
} as const

/* ── Transition Standards ── */

/** Standard transitions */
export const OL_TRANSITION = {
  /** Color changes (button hover, state toggle) */
  colors: 'transition-colors duration-150',
  /** All properties (expand/collapse, scale) */
  all: 'transition-all duration-150',
  /** Opacity (fade in/out) */
  opacity: 'transition-opacity duration-150',
} as const
