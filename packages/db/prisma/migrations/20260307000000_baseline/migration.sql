-- CreateTable
CREATE TABLE "CalendarItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
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
    FOREIGN KEY ("sourceId") REFERENCES "CalendarSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CalendarSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT '新对话',
    "isUserRename" BOOLEAN NOT NULL DEFAULT false,
    "isPin" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "sessionPreface" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "workspaceId" TEXT,
    "projectId" TEXT,
    "boardId" TEXT,
    "cliId" TEXT,
    "deletedAt" DATETIME,
    "messageCount" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "EmailDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "EmailMailbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "icon" TEXT,
    "rootUri" TEXT NOT NULL,
    "parentId" TEXT,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("parentId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SchedulerTaskRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "type" TEXT NOT NULL,
    "dates" JSONB,
    "payload" JSONB,
    "status" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "CalendarItem_workspaceId_sourceId_externalId_key" ON "CalendarItem"("workspaceId" ASC, "sourceId" ASC, "externalId" ASC);

-- CreateIndex
CREATE INDEX "CalendarItem_workspaceId_sourceId_idx" ON "CalendarItem"("workspaceId" ASC, "sourceId" ASC);

-- CreateIndex
CREATE INDEX "CalendarItem_workspaceId_startAt_idx" ON "CalendarItem"("workspaceId" ASC, "startAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CalendarSource_workspaceId_provider_kind_externalId_key" ON "CalendarSource"("workspaceId" ASC, "provider" ASC, "kind" ASC, "externalId" ASC);

-- CreateIndex
CREATE INDEX "CalendarSource_workspaceId_projectId_idx" ON "CalendarSource"("workspaceId" ASC, "projectId" ASC);

-- CreateIndex
CREATE INDEX "CalendarSource_workspaceId_idx" ON "CalendarSource"("workspaceId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ChatSession_cliId_key" ON "ChatSession"("cliId" ASC);

-- CreateIndex
CREATE INDEX "ChatSession_isPin_updatedAt_idx" ON "ChatSession"("isPin" ASC, "updatedAt" ASC);

-- CreateIndex
CREATE INDEX "ChatSession_deletedAt_createdAt_idx" ON "ChatSession"("deletedAt" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "ChatSession_deletedAt_idx" ON "ChatSession"("deletedAt" ASC);

-- CreateIndex
CREATE INDEX "EmailDraft_workspaceId_accountEmail_idx" ON "EmailDraft"("workspaceId" ASC, "accountEmail" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "EmailMailbox_workspaceId_accountEmail_path_key" ON "EmailMailbox"("workspaceId" ASC, "accountEmail" ASC, "path" ASC);

-- CreateIndex
CREATE INDEX "EmailMailbox_workspaceId_accountEmail_parentPath_idx" ON "EmailMailbox"("workspaceId" ASC, "accountEmail" ASC, "parentPath" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "EmailMessage_workspaceId_accountEmail_mailboxPath_externalId_key" ON "EmailMessage"("workspaceId" ASC, "accountEmail" ASC, "mailboxPath" ASC, "externalId" ASC);

-- CreateIndex
CREATE INDEX "EmailMessage_workspaceId_accountEmail_date_idx" ON "EmailMessage"("workspaceId" ASC, "accountEmail" ASC, "date" ASC);

-- CreateIndex
CREATE INDEX "Project_deletedAt_idx" ON "Project"("deletedAt" ASC);

-- CreateIndex
CREATE INDEX "Project_workspaceId_isDeleted_idx" ON "Project"("workspaceId" ASC, "isDeleted" ASC);

-- CreateIndex
CREATE INDEX "Project_workspaceId_isFavorite_idx" ON "Project"("workspaceId" ASC, "isFavorite" ASC);

-- CreateIndex
CREATE INDEX "Project_workspaceId_parentId_sortIndex_idx" ON "Project"("workspaceId" ASC, "parentId" ASC, "sortIndex" ASC);

-- CreateIndex
CREATE INDEX "Project_workspaceId_parentId_idx" ON "Project"("workspaceId" ASC, "parentId" ASC);

-- CreateIndex
CREATE INDEX "Project_workspaceId_idx" ON "Project"("workspaceId" ASC);
