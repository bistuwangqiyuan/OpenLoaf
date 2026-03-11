/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import { t, shieldedProcedure } from "../../generated/routers/helpers/createRouter";
import { z } from "zod";
import { workspaceBase } from "../types/workspace";
import { getOpenLoafRootDir } from "@openloaf/config";
import { toFileUriWithoutEncoding } from "../services/fileUri";

/**
 * @deprecated Workspace concept removed. This router returns a single
 * default workspace pointing to ~/.openloaf/ for backward compatibility
 * with components that still call useWorkspace().
 */

const workspaceIdSchema = z.string();

export const workspaceSchemas = {
  getList: {
    output: z.array(workspaceBase),
  },
  getActive: {
    output: workspaceBase,
  },
  create: {
    input: z.object({
      name: z.string().trim(),
      rootUri: z.string().trim(),
    }),
    output: workspaceBase,
  },
  activate: {
    input: z.object({ id: workspaceIdSchema }),
    output: workspaceBase,
  },
  delete: {
    input: z.object({ id: workspaceIdSchema }),
    output: z.boolean(),
  },
  updateName: {
    input: z.object({
      id: workspaceIdSchema,
      name: z.string().trim(),
    }),
    output: workspaceBase,
  },
};

function getDefaultWorkspace() {
  const rootDir = getOpenLoafRootDir();
  return {
    id: "default",
    name: "OpenLoaf",
    type: "local" as const,
    isActive: true,
    rootUri: toFileUriWithoutEncoding(rootDir),
  };
}

export abstract class BaseWorkspaceRouter {
  public static routeName = "workspace";

  public static createRouter() {
    const defaultWs = () => getDefaultWorkspace();
    return t.router({
      getList: shieldedProcedure
        .output(workspaceSchemas.getList.output)
        .query(async () => [defaultWs()]),

      getActive: shieldedProcedure
        .output(workspaceSchemas.getActive.output)
        .query(async () => defaultWs()),

      create: shieldedProcedure
        .input(workspaceSchemas.create.input)
        .output(workspaceSchemas.create.output)
        .mutation(async () => defaultWs()),

      activate: shieldedProcedure
        .input(workspaceSchemas.activate.input)
        .output(workspaceSchemas.activate.output)
        .mutation(async () => defaultWs()),

      delete: shieldedProcedure
        .input(workspaceSchemas.delete.input)
        .output(workspaceSchemas.delete.output)
        .mutation(async () => true),

      updateName: shieldedProcedure
        .input(workspaceSchemas.updateName.input)
        .output(workspaceSchemas.updateName.output)
        .mutation(async () => defaultWs()),
    });
  }
}

export const workspaceRouter = BaseWorkspaceRouter.createRouter();

export type WorkspaceRouter = typeof workspaceRouter;
