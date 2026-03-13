/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
"use client";

import { useEffect, useMemo } from "react";
import { handleGlobalKeyDown } from "@/lib/globalShortcuts";
import { isElectronEnv } from "@/utils/is-electron-env";

/** 绑定全局快捷键监听器（仅在客户端运行）。 */
export default function GlobalShortcuts() {
  const isElectron = useMemo(() => isElectronEnv(), []);
  const isMac = useMemo(
    () =>
      typeof navigator !== "undefined" &&
      (navigator.platform.includes("Mac") || navigator.userAgent.includes("Mac")),
    [],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) =>
      handleGlobalKeyDown(event, {
        isElectron,
        isMac,
      });

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isElectron, isMac]);

  return null;
}
