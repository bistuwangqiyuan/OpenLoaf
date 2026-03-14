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

import { ProviderManagement as ProviderManagementInner } from "@/components/setting/menus/provider/ProviderManagement";

/** Model configuration page: providers. */
export function ProviderManagement() {
  return <ProviderManagementInner />;
}
