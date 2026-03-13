import { describe, expect, it } from "vitest";
import { isWorkbenchDockContextComponent } from "./global-entry-dock";

describe("global-entry-dock", () => {
  it("treats workbench dock pages as one shared context", () => {
    expect(isWorkbenchDockContextComponent("global-desktop")).toBe(true);
    expect(isWorkbenchDockContextComponent("calendar-page")).toBe(true);
    expect(isWorkbenchDockContextComponent("email-page")).toBe(true);
    expect(isWorkbenchDockContextComponent("scheduled-tasks-page")).toBe(true);
  });

  it("does not treat smart canvas as workbench dock context", () => {
    expect(isWorkbenchDockContextComponent("canvas-list-page")).toBe(false);
    expect(isWorkbenchDockContextComponent("")).toBe(false);
  });
});
