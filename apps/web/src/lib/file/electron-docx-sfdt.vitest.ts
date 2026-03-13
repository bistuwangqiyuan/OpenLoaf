/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { convertElectronDocxToSfdt } from "@/lib/file/electron-docx-sfdt";

describe("convertElectronDocxToSfdt", () => {
  const originalElectron = window.openloafElectron;

  afterEach(() => {
    if (originalElectron) {
      window.openloafElectron = originalElectron;
    } else {
      delete window.openloafElectron;
    }
    vi.restoreAllMocks();
  });

  it("returns unsupported when preload API is unavailable", async () => {
    delete window.openloafElectron;

    await expect(
      convertElectronDocxToSfdt({ uri: "file:///tmp/demo.docx" }),
    ).resolves.toEqual({
      ok: false,
      reason: "当前仅支持桌面端本地 DOCX 转换。",
      code: "unsupported",
    });
  });

  it("delegates conversion to the preload Office API", async () => {
    const result: OpenLoafDocxToSfdtResult = {
      ok: true,
      data: { sfdt: '{"sections":[]}' },
    };
    const convertDocxToSfdt = vi.fn().mockResolvedValue(result);

    window.openloafElectron = {
      ...(originalElectron ?? {}),
      office: {
        convertDocxToSfdt,
      },
    } as Window["openloafElectron"];

    await expect(
      convertElectronDocxToSfdt({ uri: "file:///tmp/demo.docx" }),
    ).resolves.toEqual(result);
    expect(convertDocxToSfdt).toHaveBeenCalledWith({ uri: "file:///tmp/demo.docx" });
  });
});
