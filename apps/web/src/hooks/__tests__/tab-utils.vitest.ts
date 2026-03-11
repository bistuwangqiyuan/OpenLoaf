import { describe, expect, it } from "vitest";
import { getTabForegroundComponent, shouldDisableRightChat } from "@/hooks/tab-utils";

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

  it("disables the right chat only when settings is the foreground page", () => {
    expect(shouldDisableRightChat({
      base: { id: "settings", component: "settings-page" },
      stack: [],
      activeStackItemId: "",
    } as never)).toBe(true);

    expect(shouldDisableRightChat({
      base: { id: "project", component: "plant-page" },
      stack: [],
      activeStackItemId: "",
    } as never)).toBe(false);
  });
});
