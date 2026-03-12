"use client";

import { FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

type ProjectSidebarProjectCardProps = {
  /** Current project title. */
  title: string;
  /** Current project icon when available. */
  icon?: string | null;
  /** Optional project subtitle. */
  subtitle?: string | null;
  /** Extra wrapper class name. */
  className?: string;
};

/** Static project summary shown in the project sidebar footer. */
export function ProjectSidebarProjectCard({
  title,
  icon,
  subtitle,
  className,
}: ProjectSidebarProjectCardProps) {
  const trimmedIcon = icon?.trim() ?? "";

  return (
    <div
      className={cn(
        "flex min-h-12 items-center gap-3 rounded-lg px-1.5 py-2 text-sidebar-foreground",
        className,
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-accent/70 text-sidebar-accent-foreground">
        {trimmedIcon ? (
          <span className="text-base leading-none">{trimmedIcon}</span>
        ) : (
          <FolderOpen className="h-4 w-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium leading-5">{title}</div>
        {subtitle ? (
          <div className="truncate text-xs leading-4 text-sidebar-foreground/60">
            {subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}
