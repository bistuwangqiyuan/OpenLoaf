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
import os from "node:os";
import path from "node:path";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { setDefaultProjectStorageRootOverride, setOpenLoafRootOverride } from "@openloaf/config";
import { getProjectRegistryEntries, resolveFilePathFromUri } from "@openloaf/api/services/vfsService";
import { ensureMicroAiCompany } from "../ensureMicroAiCompany";

const tempRoot = mkdtempSync(path.join(os.tmpdir(), "openloaf-microai-bootstrap-"));
const openloafRoot = path.join(tempRoot, "openloaf-root");

setOpenLoafRootOverride(openloafRoot);
setDefaultProjectStorageRootOverride(openloafRoot);

const result = await ensureMicroAiCompany();

assert.equal(result.reason, "created");
assert.equal(result.projectId, "proj_microai_company");

const registryEntries = getProjectRegistryEntries();
assert.equal(registryEntries.length, 1);
assert.equal(registryEntries[0]?.[0], "proj_microai_company");

const rootPath = resolveFilePathFromUri(result.rootUri);
const metaPath = path.join(rootPath, ".openloaf", "project.json");
const briefPath = path.join(rootPath, "MICROAI_COMPANY.md");

assert.ok(existsSync(metaPath), "project.json should be created");
assert.ok(existsSync(briefPath), "company brief should be created");

const metaRaw = JSON.parse(readFileSync(metaPath, "utf-8")) as {
  title?: string;
  projectId?: string;
};
assert.equal(metaRaw.projectId, "proj_microai_company");
assert.equal(metaRaw.title, "microai");

const second = await ensureMicroAiCompany();
assert.equal(second.reason, "has-existing-projects");

rmSync(tempRoot, { recursive: true, force: true });
setOpenLoafRootOverride(null);
setDefaultProjectStorageRootOverride(null);

console.log("ensure microai company bootstrap test passed.");
