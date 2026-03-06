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
import ProjectSettingsPage from "./ProjectSettingsPage";

export function ProjectSettingsDialog() {
  const open = useGlobalOverlay((s) => s.projectSettingsOpen);
  const projectId = useGlobalOverlay((s) => s.projectSettingsProjectId);
  const rootUri = useGlobalOverlay((s) => s.projectSettingsRootUri);
  const setOpen = useGlobalOverlay((s) => s.setProjectSettingsOpen);

  return (
    <Dialog open={open} onOpenChange={(v) => setOpen(v)}>
      <DialogContent
        className="w-[92vw] max-w-[92vw]! h-[90vh] p-0 gap-0 overflow-hidden"
        overlayClassName="backdrop-blur-sm bg-black/30"
      >
        <DialogTitle className="sr-only">Project Settings</DialogTitle>
        {open && (
          <ProjectSettingsPage projectId={projectId} rootUri={rootUri} />
        )}
      </DialogContent>
    </Dialog>
  );
}
