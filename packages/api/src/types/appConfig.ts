/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import { z } from "zod";

/**
 * Application configuration schema.
 * Replaces the old multi-project-space model with a single global config.
 */
export const appConfigSchema = z.object({
  /** Project map: { projectId: rootUri }. */
  projects: z
    .record(z.string(), z.string())
    .optional()
    .describe("Global project map: { projectId: rootUri }."),
  /** Skill folder names to ignore at global scope. */
  ignoreSkills: z
    .array(z.string())
    .optional()
    .describe("Skill folder names to ignore at global scope."),
});

export type AppConfig = z.infer<typeof appConfigSchema>;
