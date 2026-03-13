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
import {
  listSidebarHistoryInputSchema,
  recordEntityVisitInputSchema,
} from "../types/entityVisit";
import {
  listSidebarHistoryPage,
  recordEntityVisit,
} from "../services/entityVisitRecordService";

export const visitRouter = t.router({
  /** Record a unified entity visit in the daily visit table. */
  record: shieldedProcedure
    .input(recordEntityVisitInputSchema)
    .mutation(async ({ ctx, input }) => {
      await recordEntityVisit(ctx.prisma, input);
      return { ok: true };
    }),
  /** List paginated sidebar history items. */
  listSidebarHistory: shieldedProcedure
    .input(listSidebarHistoryInputSchema)
    .query(async ({ ctx, input }) => {
      return listSidebarHistoryPage(ctx.prisma, input);
    }),
});
