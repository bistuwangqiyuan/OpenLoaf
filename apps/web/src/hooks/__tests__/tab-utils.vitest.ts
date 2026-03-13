import { describe, expect, it } from "vitest";
import {
  getTabForegroundComponent,
  isSettingsForegroundPage,
  shouldDisableRightChat,
} from "@/hooks/tab-utils";

describe("tab-utils", () => {
  it("prefers the active stack component as the foreground component", () => {
    expect(getTabForegroundComponent({
      base: { id: "project", component: "plant-page" },
      stack: [
        { id: "stack_settings", component: "settings-page" },
        { id: "stack_canvas", component: "board-viewer" },
      ],
      activeStackItemId: "stack_settings",
    } as never)).toBe("settings-page");
  });

  it("disables the right chat for settings and sidebar primary pages", () => {
    expect(shouldDisableRightChat({
      base: { id: "settings", component: "settings-page" },
      stack: [],
      activeStackItemId: "",
    } as never)).toBe(true);

    expect(shouldDisableRightChat({
      base: { id: "project-list", component: "project-list-page" },
      stack: [],
      activeStackItemId: "",
    } as never)).toBe(true);

    expect(shouldDisableRightChat({
      base: { id: "workbench", component: "global-desktop" },
      stack: [],
      activeStackItemId: "",
    } as never)).toBe(true);

    expect(shouldDisableRightChat({
      base: { id: "canvas-list", component: "canvas-list-page" },
      stack: [],
      activeStackItemId: "",
    } as never)).toBe(true);
  });

  it("marks only the foreground settings page as the active settings page", () => {
    expect(isSettingsForegroundPage({
      base: { id: "settings", component: "settings-page" },
      stack: [],
      activeStackItemId: "",
    } as never)).toBe(true);

    expect(isSettingsForegroundPage({
      base: { id: "workbench", component: "global-desktop" },
      stack: [],
      activeStackItemId: "",
    } as never)).toBe(false);

    expect(isSettingsForegroundPage({
      base: { id: "project", component: "plant-page", params: { projectTab: "files" } },
      stack: [],
      activeStackItemId: "",
    } as never)).toBe(false);
  });

  it("disables the right chat for project index/canvas/files/history sections", () => {
    expect(shouldDisableRightChat({
      base: { id: "project", component: "plant-page", params: { projectTab: "index" } },
      stack: [],
      activeStackItemId: "",
    } as never)).toBe(true);

    expect(shouldDisableRightChat({
      base: { id: "project", component: "plant-page", params: { projectTab: "canvas" } },
      stack: [],
      activeStackItemId: "",
    } as never)).toBe(true);

    expect(shouldDisableRightChat({
      base: { id: "project", component: "plant-page", params: { projectTab: "files" } },
      stack: [],
      activeStackItemId: "",
    } as never)).toBe(true);

    expect(shouldDisableRightChat({
      base: { id: "project", component: "plant-page", params: { projectTab: "tasks" } },
      stack: [],
      activeStackItemId: "",
    } as never)).toBe(true);
  });

  it("disables the right chat when file viewers are the foreground page", () => {
    expect(shouldDisableRightChat({
      base: { id: "project", component: "plant-page", params: { projectTab: "index" } },
      stack: [
        { id: "stack_file", component: "markdown-viewer" },
      ],
      activeStackItemId: "stack_file",
    } as never)).toBe(true);
  });

  it("disables the right chat for project canvas board-viewer tabs", () => {
    expect(shouldDisableRightChat({
      base: { id: "board", component: "board-viewer" },
      projectShell: {
        projectId: "project_alpha",
        rootUri: "file:///workspace/project_alpha",
        title: "Alpha",
        section: "canvas",
      },
      stack: [],
      activeStackItemId: "",
    } as never)).toBe(true);
  });

  it("keeps the right chat available for non-disabled foreground pages", () => {
    expect(shouldDisableRightChat({
      base: { id: "board", component: "board-viewer" },
      stack: [],
      activeStackItemId: "",
    } as never)).toBe(false);
  });
});
