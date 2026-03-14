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

import { Dialog, DialogContent, DialogTitle } from "@openloaf/ui/dialog";
import { useGlobalOverlay } from "@/lib/globalShortcuts";
import SettingsPage from "./SettingsPage";

export function SettingsDialog() {
  const open = useGlobalOverlay((s) => s.settingsOpen);
  const menu = useGlobalOverlay((s) => s.settingsMenu);
  const setSettingsOpen = useGlobalOverlay((s) => s.setSettingsOpen);

  return (
    <Dialog open={open} onOpenChange={(v) => setSettingsOpen(v)}>
      <DialogContent
        className="w-[92vw] max-w-[92vw]! h-[90vh] p-0 gap-0 overflow-hidden"
        overlayClassName="bg-foreground/20"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        {open && <SettingsPage settingsMenu={menu as any} />}
      </DialogContent>
    </Dialog>
  );
}
