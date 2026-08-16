-- Web account/provider contract additions for existing SQLite databases.
ALTER TABLE "User" ADD COLUMN "preferencesJson" TEXT;
ALTER TABLE "Session" ADD COLUMN "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Session" ADD COLUMN "deviceName" TEXT;
ALTER TABLE "Session" ADD COLUMN "ipAddress" TEXT;
ALTER TABLE "Provider" ADD COLUMN "defaultModel" TEXT;
ALTER TABLE "Provider" ADD COLUMN "optionsJson" TEXT;

PRAGMA foreign_keys=OFF;
CREATE TABLE "Conversation_new" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "providerId" TEXT,
  "model" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Conversation_new_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Conversation_new_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "Conversation_new" ("id", "title", "userId", "providerId", "model", "createdAt", "updatedAt")
  SELECT "id", "title", "userId", "providerId", "model", "createdAt", "updatedAt" FROM "Conversation";
DROP TABLE "Conversation";
ALTER TABLE "Conversation_new" RENAME TO "Conversation";
CREATE INDEX "Conversation_userId_updatedAt_idx" ON "Conversation" ("userId", "updatedAt");
PRAGMA foreign_keys=ON;
