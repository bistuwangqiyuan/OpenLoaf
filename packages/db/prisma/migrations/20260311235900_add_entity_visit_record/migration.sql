-- CreateTable
CREATE TABLE "EntityVisitRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "projectId" TEXT,
    "dateKey" TEXT NOT NULL,
    "firstTrigger" TEXT NOT NULL,
    "lastTrigger" TEXT NOT NULL,
    "firstVisitedAt" DATETIME NOT NULL,
    "lastVisitedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "EntityVisitRecord_entityType_entityId_dateKey_key"
ON "EntityVisitRecord"("entityType", "entityId", "dateKey");

-- CreateIndex
CREATE INDEX "EntityVisitRecord_lastVisitedAt_idx"
ON "EntityVisitRecord"("lastVisitedAt");

-- CreateIndex
CREATE INDEX "EntityVisitRecord_projectId_lastVisitedAt_idx"
ON "EntityVisitRecord"("projectId", "lastVisitedAt");
