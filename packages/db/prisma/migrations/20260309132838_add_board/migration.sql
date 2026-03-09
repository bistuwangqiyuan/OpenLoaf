-- CreateTable
CREATE TABLE "Board" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT '新画布',
    "isPin" BOOLEAN NOT NULL DEFAULT false,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "folderUri" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "Board_workspaceId_deletedAt_idx" ON "Board"("workspaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "Board_workspaceId_projectId_idx" ON "Board"("workspaceId", "projectId");

-- CreateIndex
CREATE INDEX "Board_deletedAt_updatedAt_idx" ON "Board"("deletedAt", "updatedAt");
