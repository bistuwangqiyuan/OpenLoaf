"use client";

import { startTransition } from "react";
import { PROJECT_LIST_TAB_INPUT } from "@openloaf/api/common";
import { useNavigation } from "@/hooks/use-navigation";
import { useProjectLayout } from "@/hooks/use-project-layout";
import { useTabs } from "@/hooks/use-tabs";
import { useTabRuntime } from "@/hooks/use-tab-runtime";

export const PROJECT_SHELL_SECTIONS = [
  "assistant",
  "canvas",
  "index",
  "files",
  "history",
  "settings",
] as const;

export type ProjectShellSection = (typeof PROJECT_SHELL_SECTIONS)[number];

export type ProjectShellState = {
  projectId: string;
  rootUri: string;
  title: string;
  icon?: string | null;
  section: ProjectShellSection;
};

type ProjectShellInput = Omit<ProjectShellState, "section"> & {
  section?: ProjectShellSection;
};

/** Return true when the value is a supported project-shell section. */
export function isProjectShellSection(value: unknown): value is ProjectShellSection {
  return (
    typeof value === "string" &&
    (PROJECT_SHELL_SECTIONS as readonly string[]).includes(value)
  );
}

/** Build the left-dock base item for one project-shell section. */
export function buildProjectShellBase(
  input: ProjectShellState,
): { id: string; component: string; params?: Record<string, unknown> } | undefined {
  switch (input.section) {
    case "assistant":
      return undefined;
    case "settings":
      return {
        id: `project-settings:${input.projectId}`,
        component: "project-settings-page",
        params: {
          projectId: input.projectId,
          rootUri: input.rootUri,
        },
      };
    case "history":
      return {
        id: `project:${input.projectId}`,
        component: "plant-page",
        params: {
          projectId: input.projectId,
          rootUri: input.rootUri,
          projectTab: "tasks",
        },
      };
    case "canvas":
    case "index":
    case "files":
      return {
        id: `project:${input.projectId}`,
        component: "plant-page",
        params: {
          projectId: input.projectId,
          rootUri: input.rootUri,
          projectTab: input.section,
        },
      };
    default:
      return undefined;
  }
}

/** Find an existing project-shell tab by project id. */
export function findProjectShellTab(projectId: string) {
  return useTabs
    .getState()
    .tabs.find((tab) => tab.projectShell?.projectId === projectId);
}

/** Apply one project-shell section onto an existing tab. */
export function applyProjectShellToTab(tabId: string, input: ProjectShellState) {
  const tabs = useTabs.getState();
  const runtime = useTabRuntime.getState();
  const currentRuntime = runtime.runtimeByTabId[tabId];
  const savedLayout = useProjectLayout
    .getState()
    .getProjectLayout(input.projectId);
  const base = buildProjectShellBase(input);

  tabs.setTabTitle(tabId, input.title);
  tabs.setTabIcon(tabId, input.icon ?? undefined);
  tabs.setTabProjectShell(tabId, input);
  tabs.setTabChatParams(tabId, { projectId: input.projectId });

  runtime.clearStack(tabId);
  runtime.setTabBase(tabId, base);

  if (base) {
    const nextLeftWidth =
      currentRuntime?.leftWidthPercent && currentRuntime.leftWidthPercent > 0
        ? currentRuntime.leftWidthPercent
        : savedLayout?.leftWidthPercent ?? 90;
    runtime.setTabLeftWidthPercent(tabId, nextLeftWidth);

    const nextRightCollapsed =
      currentRuntime?.base && typeof currentRuntime.rightChatCollapsed === "boolean"
        ? currentRuntime.rightChatCollapsed
        : savedLayout?.rightChatCollapsed ?? false;
    runtime.setTabRightChatCollapsed(tabId, nextRightCollapsed);
  }

  useNavigation.getState().setActiveProject(input.projectId);
}

/** Open or focus a project-shell tab in the current renderer. */
export function openProjectShell(input: ProjectShellInput) {
  const section = input.section ?? "assistant";
  const resolved: ProjectShellState = { ...input, section };
  const existingTab = findProjectShellTab(input.projectId);

  if (existingTab) {
    applyProjectShellToTab(existingTab.id, resolved);
    startTransition(() => {
      useTabs.getState().setActiveTab(existingTab.id);
    });
    return existingTab.id;
  }

  const savedLayout = useProjectLayout
    .getState()
    .getProjectLayout(input.projectId);
  const base = buildProjectShellBase(resolved);
  const leftWidthPercent = base
    ? savedLayout?.leftWidthPercent ?? 90
    : 0;

  useTabs.getState().addTab({
    createNew: true,
    title: input.title,
    icon: input.icon ?? undefined,
    base,
    leftWidthPercent,
    rightChatCollapsed: base ? savedLayout?.rightChatCollapsed ?? false : false,
    chatParams: { projectId: input.projectId },
    projectShell: resolved,
  });

  useNavigation.getState().setActiveProject(input.projectId);
  return useTabs.getState().activeTabId ?? "";
}

/** Exit the project-shell context and return to the project-space list in-place. */
export function exitProjectShellToProjectList(tabId: string, title: string, icon: string) {
  const tabs = useTabs.getState();
  const runtime = useTabRuntime.getState();

  tabs.setTabProjectShell(tabId, null);
  tabs.setTabChatParams(tabId, { projectId: null });
  tabs.setTabTitle(tabId, title);
  tabs.setTabIcon(tabId, icon);

  runtime.clearStack(tabId);
  runtime.setTabBase(tabId, {
    id: PROJECT_LIST_TAB_INPUT.baseId,
    component: PROJECT_LIST_TAB_INPUT.component,
  });
  runtime.setTabLeftWidthPercent(tabId, 100);
  runtime.setTabRightChatCollapsed(tabId, true);

  useNavigation.getState().setActiveView("project-list");
}
