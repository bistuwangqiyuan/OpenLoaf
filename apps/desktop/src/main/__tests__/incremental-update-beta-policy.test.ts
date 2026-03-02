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

import {
  compareVersions,
  gateBetaManifest,
  isRemoteNewer,
  shouldUseBundled,
} from "../incrementalUpdatePolicy";

const stableManifest = {
  schemaVersion: 1,
  server: { version: "1.1.0" },
  web: { version: "1.1.0" },
};

// beta 无组件 + stable 有组件 → 回退到 stable
{
  const betaMissing = { schemaVersion: 1 };
  const result = gateBetaManifest({ beta: betaMissing, stable: stableManifest });
  assert.equal(result.skipped, false);
  assert.equal(result.reason, "beta-empty-fallback-to-stable");
  assert.equal(result.manifest.server?.version, "1.1.0");
  assert.equal(result.manifest.web?.version, "1.1.0");
}

// beta server 落后 → 取 stable server，beta web 相同 → 取 beta web
{
  const betaOlder = {
    schemaVersion: 1,
    server: { version: "1.0.0" },
    web: { version: "1.1.0" },
  };
  const result = gateBetaManifest({ beta: betaOlder, stable: stableManifest });
  assert.equal(result.skipped, false);
  assert.equal(result.reason, "beta-merged-with-stable");
  assert.equal(result.manifest.server?.version, "1.1.0");
  assert.equal(result.manifest.web?.version, "1.1.0");
}

// beta 全部领先 → 取 beta
{
  const betaNewer = {
    schemaVersion: 1,
    server: { version: "1.2.0" },
    web: { version: "1.1.1" },
  };
  const result = gateBetaManifest({ beta: betaNewer, stable: stableManifest });
  assert.equal(result.skipped, false);
  assert.equal(result.reason, "beta-merged-with-stable");
  assert.equal(result.manifest.server?.version, "1.2.0");
  assert.equal(result.manifest.web?.version, "1.1.1");
}

// beta server 新 + web 旧 → 混合取高
{
  const betaMixed = {
    schemaVersion: 1,
    server: { version: "1.2.0" },
    web: { version: "1.0.0" },
  };
  const result = gateBetaManifest({ beta: betaMixed, stable: stableManifest });
  assert.equal(result.skipped, false);
  assert.equal(result.reason, "beta-merged-with-stable");
  assert.equal(result.manifest.server?.version, "1.2.0");
  assert.equal(result.manifest.web?.version, "1.1.0");
}

// 双方都无组件 → skipped
{
  const betaEmpty = { schemaVersion: 1 };
  const stableEmpty = { schemaVersion: 1 };
  const result = gateBetaManifest({ beta: betaEmpty, stable: stableEmpty });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "beta-not-found");
  assert.equal(result.manifest.server, undefined);
  assert.equal(result.manifest.web, undefined);
}

// 无 stable 可比 → 直接用 beta
{
  const betaOnly = {
    schemaVersion: 1,
    server: { version: "1.0.0-beta.1" },
    web: { version: "1.0.0-beta.1" },
  };
  const result = gateBetaManifest({ beta: betaOnly, stable: null });
  assert.equal(result.skipped, false);
  assert.equal(result.reason, "beta-only");
  assert.equal(result.manifest.server?.version, "1.0.0-beta.1");
  assert.equal(result.manifest.web?.version, "1.0.0-beta.1");
}

// beta 缺 server 但 stable 有 → 从 stable 补 server
{
  const betaPartial = {
    schemaVersion: 1,
    web: { version: "1.2.0" },
  };
  const result = gateBetaManifest({ beta: betaPartial, stable: stableManifest });
  assert.equal(result.skipped, false);
  assert.equal(result.reason, "beta-merged-with-stable");
  assert.equal(result.manifest.server?.version, "1.1.0");
  assert.equal(result.manifest.web?.version, "1.2.0");
}

// 混合组件时 electron.minVersion 取较高者
{
  const betaLowMin = {
    schemaVersion: 1,
    server: { version: "1.0.0" },
    web: { version: "1.2.0" },
    electron: { minVersion: "0.2.0" },
  };
  const stableHighMin = {
    schemaVersion: 1,
    server: { version: "1.1.0" },
    web: { version: "1.1.0" },
    electron: { minVersion: "0.3.0" },
  };
  const result = gateBetaManifest({ beta: betaLowMin, stable: stableHighMin });
  assert.equal(result.reason, "beta-merged-with-stable");
  // server 取 stable (1.1.0 > 1.0.0)，web 取 beta (1.2.0 > 1.1.0)
  assert.equal(result.manifest.server?.version, "1.1.0");
  assert.equal(result.manifest.web?.version, "1.2.0");
  // electron.minVersion 取较高者 0.3.0（来自 stable）
  assert.equal(result.manifest.electron?.minVersion, "0.3.0");
}

// beta 有 minVersion 但 stable 无 → 保留 beta 的
{
  const betaWithMin = {
    schemaVersion: 1,
    server: { version: "1.2.0" },
    web: { version: "1.2.0" },
    electron: { minVersion: "0.2.0" },
  };
  const stableNoMin = {
    schemaVersion: 1,
    server: { version: "1.1.0" },
    web: { version: "1.1.0" },
  };
  const result = gateBetaManifest({ beta: betaWithMin, stable: stableNoMin });
  assert.equal(result.manifest.electron?.minVersion, "0.2.0");
}

console.log("incremental update beta policy tests passed.");

{
  assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
  assert.equal(compareVersions("1.0.1", "1.0.0"), 1);
  assert.equal(compareVersions("1.0.0", "1.0.1"), -1);
  assert.equal(compareVersions("1.0.0-beta.1", "1.0.0"), -1);
  assert.equal(compareVersions("1.0.0-beta.2", "1.0.0-beta.1"), 1);
}

{
  assert.equal(isRemoteNewer("1.0.0", "1.0.0"), false);
  assert.equal(isRemoteNewer("1.0.0", "1.0.1"), true);
  assert.equal(isRemoteNewer("1.0.1", "1.0.0"), false);
  assert.equal(isRemoteNewer(undefined, "1.0.0"), true);
  assert.equal(isRemoteNewer("1.0.0", undefined), false);
}

{
  assert.equal(shouldUseBundled("1.3.0", "1.2.0"), true);
  assert.equal(shouldUseBundled("1.2.0", "1.2.0"), false);
  assert.equal(shouldUseBundled("1.1.0", "1.2.0"), false);
  assert.equal(shouldUseBundled("1.0.0", "1.0.0-beta.1"), true);
  assert.equal(shouldUseBundled(undefined, "1.2.0"), false);
  assert.equal(shouldUseBundled("1.2.0", undefined), false);
}
