"use client"

import * as React from "react"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

const TAB_COLORS = {
  sky: {
    text: "text-sky-700 dark:text-sky-300",
    bg: "bg-sky-100/80 dark:bg-sky-500/20",
  },
  amber: {
    text: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-100/80 dark:bg-amber-500/20",
  },
  violet: {
    text: "text-violet-700 dark:text-violet-300",
    bg: "bg-violet-100/80 dark:bg-violet-500/20",
  },
  emerald: {
    text: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-100/80 dark:bg-emerald-500/20",
  },
  rose: {
    text: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-100/80 dark:bg-rose-500/20",
  },
} as const

type TabColor = keyof typeof TAB_COLORS

interface TabProps {
  text: string
  selected: boolean
  setSelected: (text: string) => void
  color?: TabColor
  layoutId?: string
  className?: string
  children?: React.ReactNode
}

export function Tab({
  text,
  selected,
  setSelected,
  color = "sky",
  layoutId = "tab",
  className,
  children,
}: TabProps) {
  const palette = TAB_COLORS[color]

  return (
    <button
      type="button"
      onClick={() => setSelected(text)}
      className={cn(
        "relative flex-1 px-3 py-2 text-xs font-medium transition-colors duration-150 cursor-pointer",
        selected
          ? palette.text
          : "text-sidebar-foreground/50 hover:text-sidebar-foreground/70",
        className,
      )}
    >
      <span className="relative z-10 flex items-center justify-center gap-1.5">{children ?? text}</span>
      {selected && (
        <motion.span
          layoutId={layoutId}
          transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
          className={cn("absolute inset-0.5 z-0 rounded-full", palette.bg)}
        />
      )}
    </button>
  )
}
