/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import { isElectronEnv } from "@/utils/is-electron-env";

type DocxToSfdtResult = OpenLoafDocxToSfdtResult;

/** Resolve the Electron Office helper API from preload. */
function getOfficeApi() {
  if (typeof window === "undefined") return null;
  return window.openloafElectron?.office ?? null;
}

/** Convert a local DOCX file to SFDT through Electron main process. */
export async function convertElectronDocxToSfdt(payload: {
  uri: string;
}): Promise<DocxToSfdtResult> {
  if (!isElectronEnv() || !getOfficeApi()?.convertDocxToSfdt) {
    return {
      ok: false,
      reason: "当前仅支持桌面端本地 DOCX 转换。",
      code: "unsupported",
    };
  }
  return await getOfficeApi()!.convertDocxToSfdt(payload);
}
