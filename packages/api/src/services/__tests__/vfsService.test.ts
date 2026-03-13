/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { setOpenLoafRootOverride } from "@openloaf/config";

import { resolveScopedPath } from "../vfsService";

const TEST_GLOBAL_ROOT = "/tmp/openloaf-vfs-global-root";

afterEach(() => {
  setOpenLoafRootOverride(null);
});

describe("resolveScopedPath", () => {
  it("resolves global .openloaf paths under the OpenLoaf root without duplicating the prefix", () => {
    setOpenLoafRootOverride(TEST_GLOBAL_ROOT);

    expect(
      resolveScopedPath({
        target: ".openloaf/boards/board_alpha/index.tnboard",
      })
    ).toBe(path.resolve(TEST_GLOBAL_ROOT, "boards/board_alpha/index.tnboard"));
  });

  it("keeps ordinary global relative paths scoped under the OpenLoaf root", () => {
    setOpenLoafRootOverride(TEST_GLOBAL_ROOT);

    expect(
      resolveScopedPath({
        target: "chat-history/chat_alpha/messages.jsonl",
      })
    ).toBe(
      path.resolve(TEST_GLOBAL_ROOT, "chat-history/chat_alpha/messages.jsonl")
    );
  });
});
