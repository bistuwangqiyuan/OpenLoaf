/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */

import { LayoutDashboard, CalendarDays, Mail, Clock, Folder, Palette, Settings } from "lucide-react"

export const QUICK_LAUNCH_ITEMS = [
  {
    baseId: "base:workbench", component: "global-desktop", labelKey: "quickLaunch.workbench", icon: LayoutDashboard, titleKey: "quickLaunch.workbench", tabIcon: "bot",
    iconColor: "text-amber-700/70 dark:text-amber-300/70 group-hover:text-amber-700 dark:group-hover:text-amber-200",
    bgColor: "bg-amber-500/10 dark:bg-amber-400/10 group-hover:bg-amber-500/20 dark:group-hover:bg-amber-400/20",
  },
  {
    baseId: "base:calendar", component: "calendar-page", labelKey: "quickLaunch.calendar", icon: CalendarDays, titleKey: "quickLaunch.calendar", tabIcon: "🗓️",
    iconColor: "text-sky-700/70 dark:text-sky-300/70 group-hover:text-sky-700 dark:group-hover:text-sky-200",
    bgColor: "bg-sky-500/10 dark:bg-sky-400/10 group-hover:bg-sky-500/20 dark:group-hover:bg-sky-400/20",
  },
  {
    baseId: "base:mailbox", component: "email-page", labelKey: "quickLaunch.mailbox", icon: Mail, titleKey: "quickLaunch.mailbox", tabIcon: "📧",
    iconColor: "text-emerald-700/70 dark:text-emerald-300/70 group-hover:text-emerald-700 dark:group-hover:text-emerald-200",
    bgColor: "bg-emerald-500/10 dark:bg-emerald-400/10 group-hover:bg-emerald-500/20 dark:group-hover:bg-emerald-400/20",
  },
  {
    baseId: "base:scheduled-tasks", component: "scheduled-tasks-page", labelKey: "quickLaunch.tasks", icon: Clock, titleKey: "quickLaunch.tasks", tabIcon: "⏰",
    iconColor: "text-rose-700/70 dark:text-rose-300/70 group-hover:text-rose-700 dark:group-hover:text-rose-200",
    bgColor: "bg-rose-500/10 dark:bg-rose-400/10 group-hover:bg-rose-500/20 dark:group-hover:bg-rose-400/20",
  },
] as const

/** Project-level quick launch items – aligned with PROJECT_TABS in ProjectTabs.tsx / ExpandableDockTabs. */
export const PROJECT_QUICK_LAUNCH_ITEMS = [
  {
    value: "index", icon: LayoutDashboard, labelKey: "project.tabHome", featureGated: true,
    iconColor: "text-sky-700/70 dark:text-sky-300/70 group-hover:text-sky-700 dark:group-hover:text-sky-200",
    bgColor: "bg-sky-500/10 dark:bg-sky-400/10 group-hover:bg-sky-500/20 dark:group-hover:bg-sky-400/20",
  },
  {
    value: "files", icon: Folder, labelKey: "project.tabFiles", featureGated: false,
    iconColor: "text-emerald-700/70 dark:text-emerald-300/70 group-hover:text-emerald-700 dark:group-hover:text-emerald-200",
    bgColor: "bg-emerald-500/10 dark:bg-emerald-400/10 group-hover:bg-emerald-500/20 dark:group-hover:bg-emerald-400/20",
  },
  {
    value: "tasks", icon: CalendarDays, labelKey: "project.tabHistory", featureGated: true,
    iconColor: "text-amber-700/70 dark:text-amber-300/70 group-hover:text-amber-700 dark:group-hover:text-amber-200",
    bgColor: "bg-amber-500/10 dark:bg-amber-400/10 group-hover:bg-amber-500/20 dark:group-hover:bg-amber-400/20",
  },
  {
    value: "scheduled", icon: Clock, labelKey: "project.tabScheduled", featureGated: false,
    iconColor: "text-amber-700/70 dark:text-amber-300/70 group-hover:text-amber-700 dark:group-hover:text-amber-200",
    bgColor: "bg-amber-500/10 dark:bg-amber-400/10 group-hover:bg-amber-500/20 dark:group-hover:bg-amber-400/20",
  },
  {
    value: "canvas", icon: Palette, labelKey: "project.tabCanvas", featureGated: false,
    iconColor: "text-teal-700/70 dark:text-teal-300/70 group-hover:text-teal-700 dark:group-hover:text-teal-200",
    bgColor: "bg-teal-500/10 dark:bg-teal-400/10 group-hover:bg-teal-500/20 dark:group-hover:bg-teal-400/20",
  },
  {
    value: "settings", icon: Settings, labelKey: "project.tabSettings", featureGated: false,
    iconColor: "text-slate-600/70 dark:text-slate-300/70 group-hover:text-slate-700 dark:group-hover:text-slate-200",
    bgColor: "bg-slate-500/10 dark:bg-slate-400/10 group-hover:bg-slate-500/20 dark:group-hover:bg-slate-400/20",
  },
] as const
