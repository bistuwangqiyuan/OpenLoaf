/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import type { AuthRefreshResponse } from "@openloaf-saas/sdk";
import { getSaasClient } from "../../client";
import { logger } from "../../../../common/logger";

/** Refresh access token via SaaS SDK. */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<AuthRefreshResponse> {
  logger.info("[auth] refreshing access token via SaaS SDK");
  // 逻辑：统一走 SDK 并复用缓存 client。
  const client = getSaasClient();
  try {
    const result = await client.auth.refresh(refreshToken);
    logger.info("[auth] access token refreshed successfully");
    return result;
  } catch (error) {
    logger.error({ err: error instanceof Error ? error.message : String(error) }, "[auth] access token refresh failed");
    throw error;
  }
}
