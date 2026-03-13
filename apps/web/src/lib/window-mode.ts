"use client";

export type OpenLoafWindowMode = "default" | "project" | "board";

export type ProjectWindowBootstrapPayload = {
  projectId: string;
  rootUri: string;
  title: string;
  icon?: string | null;
};

export type BoardWindowBootstrapPayload = {
  boardId: string;
  boardFolderUri: string;
  boardFileUri: string;
  rootUri: string;
  title: string;
  projectId?: string;
};

/** Safely read the current location search string. */
function getLocationSearch() {
  if (typeof window === "undefined") return "";
  return window.location.search ?? "";
}

/** Parse window mode from a search string. */
export function parseWindowMode(search = getLocationSearch()): OpenLoafWindowMode {
  const params = new URLSearchParams(search);
  const mode = params.get("windowMode");
  if (mode === "project") return "project";
  if (mode === "board") return "board";
  return "default";
}

/** Return true when the current renderer is a dedicated project window. */
export function isProjectWindowMode(search = getLocationSearch()) {
  return parseWindowMode(search) === "project";
}

/** Return true when the current renderer is a dedicated board window. */
export function isBoardWindowMode(search = getLocationSearch()) {
  return parseWindowMode(search) === "board";
}

/** Return true when the current renderer is any dedicated (non-default) window. */
export function isDedicatedWindowMode(search = getLocationSearch()) {
  return parseWindowMode(search) !== "default";
}

/** Read project bootstrap payload from location search. */
export function getProjectWindowBootstrapPayload(
  search = getLocationSearch(),
): ProjectWindowBootstrapPayload | null {
  if (parseWindowMode(search) !== "project") return null;
  const params = new URLSearchParams(search);
  const projectId = params.get("projectId")?.trim() ?? "";
  const rootUri = params.get("rootUri")?.trim() ?? "";
  const title = params.get("title")?.trim() ?? "";
  const icon = params.get("icon")?.trim() ?? undefined;

  if (!projectId || !rootUri || !title) return null;
  return {
    projectId,
    rootUri,
    title,
    icon: icon || undefined,
  };
}

/** Build a project-window URL from the current web entry. */
export function buildProjectWindowUrl(
  baseUrl: string,
  payload: ProjectWindowBootstrapPayload,
) {
  const next = new URL("/", baseUrl);
  next.searchParams.set("windowMode", "project");
  next.searchParams.set("projectId", payload.projectId);
  next.searchParams.set("rootUri", payload.rootUri);
  next.searchParams.set("title", payload.title);
  if (payload.icon?.trim()) {
    next.searchParams.set("icon", payload.icon.trim());
  }
  return next.toString();
}

/** Read board bootstrap payload from location search. */
export function getBoardWindowBootstrapPayload(
  search = getLocationSearch(),
): BoardWindowBootstrapPayload | null {
  if (parseWindowMode(search) !== "board") return null;
  const params = new URLSearchParams(search);
  const boardId = params.get("boardId")?.trim() ?? "";
  const boardFolderUri = params.get("boardFolderUri")?.trim() ?? "";
  const boardFileUri = params.get("boardFileUri")?.trim() ?? "";
  const rootUri = params.get("rootUri")?.trim() ?? "";
  const title = params.get("title")?.trim() ?? "";
  const projectId = params.get("projectId")?.trim() || undefined;

  if (!boardId || !boardFolderUri || !boardFileUri || !rootUri) return null;
  return { boardId, boardFolderUri, boardFileUri, rootUri, title, projectId };
}

/** Build a board-window URL from the current web entry. */
export function buildBoardWindowUrl(
  baseUrl: string,
  payload: BoardWindowBootstrapPayload,
) {
  const next = new URL("/", baseUrl);
  next.searchParams.set("windowMode", "board");
  next.searchParams.set("boardId", payload.boardId);
  next.searchParams.set("boardFolderUri", payload.boardFolderUri);
  next.searchParams.set("boardFileUri", payload.boardFileUri);
  next.searchParams.set("rootUri", payload.rootUri);
  next.searchParams.set("title", payload.title || "");
  if (payload.projectId) {
    next.searchParams.set("projectId", payload.projectId);
  }
  return next.toString();
}
