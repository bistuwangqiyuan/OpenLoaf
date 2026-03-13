-- 架构迁移：从工作空间中心切换为项目中心。
-- 说明：保留现有 projectId / sourceId / accountEmail 关联，移除已废弃的 workspaceId 列。

-- CreateTable
CREATE TABLE "ProjectLink" (
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("sourceId", "targetId"),
    CONSTRAINT "ProjectLink_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectLink_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "projectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Board" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT '新画布',
    "isPin" BOOLEAN NOT NULL DEFAULT false,
    "projectId" TEXT,
    "folderUri" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

INSERT INTO "new_Board" ("createdAt", "deletedAt", "folderUri", "id", "isPin", "projectId", "title", "updatedAt")
SELECT "createdAt", "deletedAt", "folderUri", "id", "isPin", "projectId", "title", "updatedAt"
FROM "Board";

DROP TABLE "Board";
ALTER TABLE "new_Board" RENAME TO "Board";
CREATE INDEX "Board_deletedAt_idx" ON "Board"("deletedAt");
CREATE INDEX "Board_projectId_idx" ON "Board"("projectId");
CREATE INDEX "Board_deletedAt_updatedAt_idx" ON "Board"("deletedAt", "updatedAt");

CREATE TABLE "new_CalendarItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRule" JSONB,
    "completedAt" DATETIME,
    "externalId" TEXT,
    "sourceUpdatedAt" DATETIME,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CalendarItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CalendarSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_CalendarItem" ("allDay", "completedAt", "createdAt", "deletedAt", "description", "endAt", "externalId", "id", "kind", "location", "recurrenceRule", "sourceId", "sourceUpdatedAt", "startAt", "title", "updatedAt")
SELECT "allDay", "completedAt", "createdAt", "deletedAt", "description", "endAt", "externalId", "id", "kind", "location", "recurrenceRule", "sourceId", "sourceUpdatedAt", "startAt", "title", "updatedAt"
FROM "CalendarItem";

DROP TABLE "CalendarItem";
ALTER TABLE "new_CalendarItem" RENAME TO "CalendarItem";
CREATE INDEX "CalendarItem_startAt_idx" ON "CalendarItem"("startAt");
CREATE INDEX "CalendarItem_sourceId_idx" ON "CalendarItem"("sourceId");
CREATE UNIQUE INDEX "CalendarItem_sourceId_externalId_key" ON "CalendarItem"("sourceId", "externalId");

CREATE TABLE "new_CalendarSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "color" TEXT,
    "projectId" TEXT,
    "readOnly" BOOLEAN NOT NULL DEFAULT false,
    "isSubscribed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_CalendarSource" ("color", "createdAt", "externalId", "id", "isSubscribed", "kind", "projectId", "provider", "readOnly", "title", "updatedAt")
SELECT "color", "createdAt", "externalId", "id", "isSubscribed", "kind", "projectId", "provider", "readOnly", "title", "updatedAt"
FROM "CalendarSource";

DROP TABLE "CalendarSource";
ALTER TABLE "new_CalendarSource" RENAME TO "CalendarSource";
CREATE INDEX "CalendarSource_projectId_idx" ON "CalendarSource"("projectId");
CREATE UNIQUE INDEX "CalendarSource_provider_kind_externalId_key" ON "CalendarSource"("provider", "kind", "externalId");

CREATE TABLE "new_ChatSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT '新对话',
    "isUserRename" BOOLEAN NOT NULL DEFAULT false,
    "isPin" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "sessionPreface" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "projectId" TEXT,
    "boardId" TEXT,
    "cliId" TEXT,
    "deletedAt" DATETIME,
    "messageCount" INTEGER NOT NULL DEFAULT 0
);

INSERT INTO "new_ChatSession" ("boardId", "cliId", "createdAt", "deletedAt", "errorMessage", "id", "isPin", "isUserRename", "messageCount", "projectId", "sessionPreface", "title", "updatedAt")
SELECT "boardId", "cliId", "createdAt", "deletedAt", "errorMessage", "id", "isPin", "isUserRename", "messageCount", "projectId", "sessionPreface", "title", "updatedAt"
FROM "ChatSession";

DROP TABLE "ChatSession";
ALTER TABLE "new_ChatSession" RENAME TO "ChatSession";
CREATE INDEX "ChatSession_deletedAt_idx" ON "ChatSession"("deletedAt");
CREATE INDEX "ChatSession_deletedAt_createdAt_idx" ON "ChatSession"("deletedAt", "createdAt");
CREATE INDEX "ChatSession_isPin_updatedAt_idx" ON "ChatSession"("isPin", "updatedAt");
CREATE INDEX "ChatSession_projectId_idx" ON "ChatSession"("projectId");
CREATE UNIQUE INDEX "ChatSession_cliId_key" ON "ChatSession"("cliId");

CREATE TABLE "new_EmailDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountEmail" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "to" TEXT NOT NULL DEFAULT '',
    "cc" TEXT NOT NULL DEFAULT '',
    "bcc" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL DEFAULT '',
    "inReplyTo" TEXT,
    "references" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_EmailDraft" ("accountEmail", "bcc", "cc", "createdAt", "id", "inReplyTo", "mode", "references", "subject", "to", "updatedAt")
SELECT "accountEmail", "bcc", "cc", "createdAt", "id", "inReplyTo", "mode", "references", "subject", "to", "updatedAt"
FROM "EmailDraft";

DROP TABLE "EmailDraft";
ALTER TABLE "new_EmailDraft" RENAME TO "EmailDraft";
CREATE INDEX "EmailDraft_accountEmail_idx" ON "EmailDraft"("accountEmail");

CREATE TABLE "new_EmailMailbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountEmail" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentPath" TEXT,
    "delimiter" TEXT,
    "attributes" JSONB,
    "sort" INTEGER NOT NULL DEFAULT 999,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_EmailMailbox" ("accountEmail", "attributes", "createdAt", "delimiter", "id", "name", "parentPath", "path", "sort", "updatedAt")
SELECT "accountEmail", "attributes", "createdAt", "delimiter", "id", "name", "parentPath", "path", "sort", "updatedAt"
FROM "EmailMailbox";

DROP TABLE "EmailMailbox";
ALTER TABLE "new_EmailMailbox" RENAME TO "EmailMailbox";
CREATE INDEX "EmailMailbox_accountEmail_parentPath_idx" ON "EmailMailbox"("accountEmail", "parentPath");
CREATE UNIQUE INDEX "EmailMailbox_accountEmail_path_key" ON "EmailMailbox"("accountEmail", "path");

CREATE TABLE "new_EmailMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountEmail" TEXT NOT NULL,
    "mailboxPath" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "messageId" TEXT,
    "subject" TEXT,
    "from" JSONB NOT NULL,
    "to" JSONB NOT NULL,
    "cc" JSONB,
    "bcc" JSONB,
    "date" DATETIME,
    "flags" JSONB,
    "snippet" TEXT,
    "attachments" JSONB,
    "size" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_EmailMessage" ("accountEmail", "attachments", "bcc", "cc", "createdAt", "date", "externalId", "flags", "from", "id", "mailboxPath", "messageId", "size", "snippet", "subject", "to", "updatedAt")
SELECT "accountEmail", "attachments", "bcc", "cc", "createdAt", "date", "externalId", "flags", "from", "id", "mailboxPath", "messageId", "size", "snippet", "subject", "to", "updatedAt"
FROM "EmailMessage";

DROP TABLE "EmailMessage";
ALTER TABLE "new_EmailMessage" RENAME TO "EmailMessage";
CREATE INDEX "EmailMessage_accountEmail_date_idx" ON "EmailMessage"("accountEmail", "date");
CREATE UNIQUE INDEX "EmailMessage_accountEmail_mailboxPath_externalId_key" ON "EmailMessage"("accountEmail", "mailboxPath", "externalId");

CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "icon" TEXT,
    "rootUri" TEXT NOT NULL,
    "type" TEXT,
    "parentId" TEXT,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "lastOpenedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Project" ("createdAt", "deletedAt", "icon", "id", "isDeleted", "isFavorite", "parentId", "rootUri", "sortIndex", "title", "updatedAt")
SELECT "createdAt", "deletedAt", "icon", "id", "isDeleted", "isFavorite", "parentId", "rootUri", "sortIndex", "title", "updatedAt"
FROM "Project";

DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE INDEX "Project_parentId_idx" ON "Project"("parentId");
CREATE INDEX "Project_parentId_sortIndex_idx" ON "Project"("parentId", "sortIndex");
CREATE INDEX "Project_isFavorite_idx" ON "Project"("isFavorite");
CREATE INDEX "Project_isDeleted_idx" ON "Project"("isDeleted");
CREATE INDEX "Project_deletedAt_idx" ON "Project"("deletedAt");
CREATE INDEX "Project_type_idx" ON "Project"("type");
CREATE INDEX "Project_lastOpenedAt_idx" ON "Project"("lastOpenedAt");

CREATE TABLE "new_SchedulerTaskRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "dates" JSONB,
    "payload" JSONB,
    "status" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_SchedulerTaskRecord" ("createdAt", "dates", "error", "id", "payload", "projectId", "status", "triggeredBy", "type", "updatedAt")
SELECT "createdAt", "dates", "error", "id", "payload", "projectId", "status", "triggeredBy", "type", "updatedAt"
FROM "SchedulerTaskRecord";

DROP TABLE "SchedulerTaskRecord";
ALTER TABLE "new_SchedulerTaskRecord" RENAME TO "SchedulerTaskRecord";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ProjectLink_targetId_idx" ON "ProjectLink"("targetId");

-- CreateIndex
CREATE INDEX "ActivityRecord_createdAt_idx" ON "ActivityRecord"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityRecord_type_idx" ON "ActivityRecord"("type");

-- CreateIndex
CREATE INDEX "ActivityRecord_projectId_idx" ON "ActivityRecord"("projectId");
