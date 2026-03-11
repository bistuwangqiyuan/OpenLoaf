"use client";

export type OpenLoafWindowMode = "default" | "project";

export type ProjectWindowBootstrapPayload = {
  projectId: string;
  rootUri: string;
  title: string;
  icon?: string | null;
};

/** Safely read the current location search string. */
function getLocationSearch() {
  if (typeof window === "undefined") return "";
  return window.location.search ?? "";
}

/** Parse window mode from a search string. */
export function parseWindowMode(search = getLocationSearch()): OpenLoafWindowMode {
  const params = new URLSearchParams(search);
  return params.get("windowMode") === "project" ? "project" : "default";
}

/** Return true when the current renderer is a dedicated project window. */
export function isProjectWindowMode(search = getLocationSearch()) {
  return parseWindowMode(search) === "project";
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
