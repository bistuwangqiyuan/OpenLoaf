import type { DockItem } from "@openloaf/api/common";
import type { ProjectShellSection, ProjectShellState } from "./project-shell";

const FILE_VIEWER_COMPONENTS = new Set([
  "file-viewer",
  "image-viewer",
  "code-viewer",
  "markdown-viewer",
  "pdf-viewer",
  "doc-viewer",
  "sheet-viewer",
  "video-viewer",
  "plate-doc-viewer",
  "streaming-plate-viewer",
  "streaming-code-viewer",
]);

export type ProjectShellTabInput = {
  base?: DockItem;
  chatParams?: Record<string, unknown>;
  projectShell?: ProjectShellState;
};

/** Resolve the project-shell section represented by one tab base item. */
export function resolveProjectShellSectionFromBase(
  base?: DockItem,
): ProjectShellSection | undefined {
  if (!base) return "assistant";

  if (base.component === "project-settings-page") {
    return "settings";
  }

  if (base.component === "board-viewer") {
    return "canvas";
  }

  if (FILE_VIEWER_COMPONENTS.has(base.component)) {
    return "files";
  }

  if (base.component !== "plant-page") {
    return undefined;
  }

  const projectTab =
    typeof base.params?.projectTab === "string" ? base.params.projectTab.trim() : "";
  if (projectTab === "canvas") return "canvas";
  if (projectTab === "index") return "index";
  if (projectTab === "files") return "files";
  if (projectTab === "tasks") return "history";
  return undefined;
}

/** Resolve one explicit project id from tab payload when available. */
export function resolveTabProjectId(input: Pick<ProjectShellTabInput, "base" | "chatParams">) {
  const baseProjectId =
    typeof input.base?.params?.projectId === "string"
      ? input.base.params.projectId.trim()
      : "";
  if (baseProjectId) return baseProjectId;

  const chatProjectId =
    typeof input.chatParams?.projectId === "string"
      ? input.chatParams.projectId.trim()
      : "";
  if (chatProjectId) return chatProjectId;

  return undefined;
}

/** Derive project-shell metadata for a new tab created inside one project renderer. */
export function resolveProjectShellForNewTab(
  input: ProjectShellTabInput,
  currentProjectShell?: ProjectShellState | null,
) {
  if (input.projectShell) return input.projectShell;
  if (!currentProjectShell) return undefined;

  const section = resolveProjectShellSectionFromBase(input.base);
  if (!section) return undefined;

  const targetProjectId = resolveTabProjectId(input);
  // 中文注释：目标 tab 显式绑定了其他项目时，不继承当前项目壳，避免把跨项目内容误判为当前项目。
  if (targetProjectId && targetProjectId !== currentProjectShell.projectId) {
    return undefined;
  }

  return {
    ...currentProjectShell,
    section,
  };
}
