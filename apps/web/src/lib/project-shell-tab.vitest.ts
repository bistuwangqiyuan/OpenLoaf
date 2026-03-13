import { describe, expect, it } from "vitest";
import {
  resolveProjectShellForNewTab,
  resolveProjectShellSectionFromBase,
} from "./project-shell-tab";

describe("project-shell-tab", () => {
  it("inherits canvas section for board tabs in the same project", () => {
    expect(
      resolveProjectShellForNewTab(
        {
          base: {
            id: "board:test",
            component: "board-viewer",
            params: {
              projectId: "project-1",
            },
          },
        },
        {
          projectId: "project-1",
          rootUri: "file:///project-space/project-1",
          title: "Project One",
          icon: "📁",
          section: "assistant",
        },
      ),
    ).toEqual({
      projectId: "project-1",
      rootUri: "file:///project-space/project-1",
      title: "Project One",
      icon: "📁",
      section: "canvas",
    });
  });

  it("keeps assistant section for chat tabs without a base panel", () => {
    expect(
      resolveProjectShellForNewTab(
        {},
        {
          projectId: "project-1",
          rootUri: "file:///project-space/project-1",
          title: "Project One",
          icon: "📁",
          section: "canvas",
        },
      ),
    ).toEqual({
      projectId: "project-1",
      rootUri: "file:///project-space/project-1",
      title: "Project One",
      icon: "📁",
      section: "assistant",
    });
  });

  it("does not inherit project shell when the target tab belongs to another project", () => {
    expect(
      resolveProjectShellForNewTab(
        {
          base: {
            id: "board:test",
            component: "board-viewer",
            params: {
              projectId: "project-2",
            },
          },
        },
        {
          projectId: "project-1",
          rootUri: "file:///project-space/project-1",
          title: "Project One",
          section: "assistant",
        },
      ),
    ).toBeUndefined();
  });

  it("maps plant page project tabs to project-shell sections", () => {
    expect(
      resolveProjectShellSectionFromBase({
        id: "project:1",
        component: "plant-page",
        params: {
          projectTab: "files",
        },
      }),
    ).toBe("files");
  });
});
