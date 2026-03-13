/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  getDefaultProjectStorageRootDir,
  getOpenLoafRootDir,
  migrateLegacyServerData,
  resolveOpenLoafDbPath,
  resolveOpenLoafPath,
  setDefaultProjectStorageRootOverride,
  setOpenLoafRootOverride,
} from "../openloaf-paths";

const tempRoot = mkdtempSync(path.join(tmpdir(), "openloaf-config-test-"));
setOpenLoafRootOverride(tempRoot);

const root = getOpenLoafRootDir();
assert.equal(root, tempRoot);
assert.ok(existsSync(root));

assert.equal(getDefaultProjectStorageRootDir(), tempRoot);

const projectStorageRoot = mkdtempSync(path.join(tmpdir(), "openloaf-project-storage-root-"));
setDefaultProjectStorageRootOverride(projectStorageRoot);
assert.equal(getDefaultProjectStorageRootDir(), projectStorageRoot);
assert.ok(existsSync(projectStorageRoot));
setDefaultProjectStorageRootOverride(null);

assert.equal(resolveOpenLoafDbPath(), path.join(tempRoot, "openloaf.db"));
assert.equal(resolveOpenLoafPath("settings.json"), path.join(tempRoot, "settings.json"));

const legacyRoot = mkdtempSync(path.join(tmpdir(), "openloaf-legacy-test-"));
mkdirSync(legacyRoot, { recursive: true });

const legacyFiles = ["settings.json", "providers.json", "auth.json", "local.db"];
for (const file of legacyFiles) {
  writeFileSync(path.join(legacyRoot, file), `legacy-${file}`, "utf-8");
}

const existingTarget = path.join(tempRoot, "providers.json");
writeFileSync(existingTarget, "current-providers", "utf-8");

const result = migrateLegacyServerData({
  legacyRoot,
  targetRoot: tempRoot,
});

assert.ok(result.moved.includes("settings.json"));
assert.ok(result.moved.includes("auth.json"));
assert.ok(result.moved.includes("openloaf.db"));
assert.ok(result.skipped.includes("providers.json"));

assert.equal(readFileSync(path.join(tempRoot, "settings.json"), "utf-8"), "legacy-settings.json");
assert.equal(readFileSync(path.join(tempRoot, "providers.json"), "utf-8"), "current-providers");
assert.equal(readFileSync(path.join(tempRoot, "openloaf.db"), "utf-8"), "legacy-local.db");
assert.ok(!existsSync(path.join(legacyRoot, "settings.json")));

setDefaultProjectStorageRootOverride(null);
setOpenLoafRootOverride(null);

console.log("openloaf path tests passed.");
