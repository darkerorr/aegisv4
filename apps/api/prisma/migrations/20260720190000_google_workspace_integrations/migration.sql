PRAGMA foreign_keys=OFF;

CREATE TABLE "IntegrationAccount" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "email" TEXT,
  "displayName" TEXT,
  "avatarUrl" TEXT,
  "accessTokenEncrypted" TEXT,
  "refreshTokenEncrypted" TEXT,
  "tokenExpiresAt" DATETIME,
  "grantedScopes" TEXT NOT NULL DEFAULT '[]',
  "status" TEXT NOT NULL DEFAULT 'connected',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "lastUsedAt" DATETIME,
  CONSTRAINT "IntegrationAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "OAuthLinkSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "stateHash" TEXT NOT NULL,
  "returnTarget" TEXT NOT NULL DEFAULT 'web',
  "requestedScopes" TEXT NOT NULL DEFAULT '[]',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "errorCode" TEXT,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" DATETIME,
  CONSTRAINT "OAuthLinkSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "IntegrationPermission" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'granted',
  "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" DATETIME,
  CONSTRAINT "IntegrationPermission_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "IntegrationAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "IntegrationAuditEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "accountId" TEXT,
  "provider" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "metadataJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationAuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "IntegrationAuditEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "IntegrationAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "IntegrationAccount_userId_provider_providerAccountId_key" ON "IntegrationAccount"("userId", "provider", "providerAccountId");
CREATE INDEX "IntegrationAccount_userId_provider_status_idx" ON "IntegrationAccount"("userId", "provider", "status");
CREATE UNIQUE INDEX "OAuthLinkSession_connectionId_key" ON "OAuthLinkSession"("connectionId");
CREATE UNIQUE INDEX "OAuthLinkSession_stateHash_key" ON "OAuthLinkSession"("stateHash");
CREATE INDEX "OAuthLinkSession_userId_provider_status_idx" ON "OAuthLinkSession"("userId", "provider", "status");
CREATE INDEX "OAuthLinkSession_expiresAt_idx" ON "OAuthLinkSession"("expiresAt");
CREATE UNIQUE INDEX "IntegrationPermission_accountId_scope_key" ON "IntegrationPermission"("accountId", "scope");
CREATE INDEX "IntegrationPermission_accountId_status_idx" ON "IntegrationPermission"("accountId", "status");
CREATE INDEX "IntegrationAuditEvent_userId_provider_createdAt_idx" ON "IntegrationAuditEvent"("userId", "provider", "createdAt");
CREATE INDEX "IntegrationAuditEvent_accountId_idx" ON "IntegrationAuditEvent"("accountId");

PRAGMA foreign_keys=ON;
