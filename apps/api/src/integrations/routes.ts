import { createHash, randomBytes, randomUUID } from "node:crypto";
import type http from "node:http";
import type { IntegrationAccount, PrismaClient, User } from "@prisma/client";
import { z } from "zod";
import {
  GOOGLE_INCREMENTAL_SCOPES,
  GOOGLE_INITIAL_SCOPES,
  GoogleIntegrationError,
  buildGoogleAuthorizationUrl,
  createIntegrationCipher,
  exchangeGoogleCode,
  fetchGoogleUserInfo,
  getGoogleOAuthConfig,
  googleNotConfigured,
  hasGoogleScope,
  normalizeRequestedScopes,
  parseGrantedScopes,
  refreshGoogleAccessToken,
  revokeGoogleToken,
} from "./google.js";

type AuthResult = { user: User; sessionId: string } | null;

export type IntegrationRouteContext = {
  request: http.IncomingMessage;
  response: http.ServerResponse;
  url: URL;
  method: string;
  requestId: string;
  prisma: PrismaClient;
  currentUser: () => Promise<AuthResult>;
};

const startSchema = z.object({
  returnTarget: z.enum(["web", "desktop"]).default("web"),
  scopes: z.array(z.string().min(1)).max(10).optional(),
}).default({ returnTarget: "web" });

function json(response: http.ServerResponse, status: number, value: unknown, requestId?: string): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...(requestId ? { "X-Request-Id": requestId } : {}),
  });
  response.end(JSON.stringify(value));
}

function error(response: http.ServerResponse, status: number, code: string, message: string, requestId?: string): void {
  json(response, status, { code, message, ...(requestId ? { requestId } : {}) }, requestId);
}

function redirect(response: http.ServerResponse, location: string): void {
  response.writeHead(302, { Location: location, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  response.end();
}

async function readJson(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const value = Buffer.from(chunk);
    size += value.length;
    if (size > 64 * 1024) throw new GoogleIntegrationError("PAYLOAD_TOO_LARGE", "The request is too large.", 413);
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function hashState(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function parseScopes(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((scope): scope is string => typeof scope === "string") : [];
  } catch {
    return [];
  }
}

function accountView(account: IntegrationAccount | null, configured: boolean) {
  const scopes = account ? parseScopes(account.grantedScopes) : [];
  return {
    provider: "google",
    configured,
    status: !configured ? "not_configured" : account?.status || "disconnected",
    account: account ? {
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      avatarUrl: account.avatarUrl,
      status: account.status,
      tokenExpiresAt: account.tokenExpiresAt,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      lastUsedAt: account.lastUsedAt,
    } : null,
    services: {
      gmail: { available: hasGoogleScope(scopes, "https://www.googleapis.com/auth/gmail.readonly"), status: hasGoogleScope(scopes, "https://www.googleapis.com/auth/gmail.readonly") ? "connected" : "permission_required" },
      drive: { available: hasGoogleScope(scopes, "https://www.googleapis.com/auth/drive.metadata.readonly"), contentAvailable: hasGoogleScope(scopes, "https://www.googleapis.com/auth/drive.readonly"), status: hasGoogleScope(scopes, "https://www.googleapis.com/auth/drive.metadata.readonly") ? "connected" : "permission_required" },
      calendar: { available: hasGoogleScope(scopes, "https://www.googleapis.com/auth/calendar.readonly"), status: hasGoogleScope(scopes, "https://www.googleapis.com/auth/calendar.readonly") ? "connected" : "permission_required" },
      contacts: { available: hasGoogleScope(scopes, "https://www.googleapis.com/auth/contacts.readonly"), status: hasGoogleScope(scopes, "https://www.googleapis.com/auth/contacts.readonly") ? "connected" : "permission_required" },
    },
    grantedScopes: scopes,
  };
}

async function requireAuth(context: IntegrationRouteContext): Promise<NonNullable<AuthResult> | null> {
  const auth = await context.currentUser();
  if (!auth) error(context.response, 401, "AUTH_REQUIRED", "Authentication required.", context.requestId);
  return auth;
}

async function googleAccount(prisma: PrismaClient, userId: string): Promise<IntegrationAccount | null> {
  return prisma.integrationAccount.findFirst({
    where: { userId, provider: "google", status: { in: ["connected", "reconnection_required"] } },
    orderBy: { updatedAt: "desc" },
  });
}

async function markReconnectionRequired(prisma: PrismaClient, accountId: string): Promise<void> {
  await prisma.integrationAccount.update({ where: { id: accountId }, data: { status: "reconnection_required" } });
}

async function accessToken(
  prisma: PrismaClient,
  account: IntegrationAccount,
  forceRefresh = false,
): Promise<string> {
  const config = getGoogleOAuthConfig();
  if (!config.configured || !config.encryptionKey) throw googleNotConfigured(config);
  const cipher = createIntegrationCipher(config.encryptionKey);
  const current = account.accessTokenEncrypted ? cipher.decrypt(account.accessTokenEncrypted) : "";
  const stillValid = account.tokenExpiresAt && account.tokenExpiresAt.getTime() > Date.now() + 60_000;
  if (!forceRefresh && current && stillValid) return current;
  if (!account.refreshTokenEncrypted) {
    await markReconnectionRequired(prisma, account.id);
    throw new GoogleIntegrationError("TOKEN_EXPIRED", "The Google connection expired. Please try again.", 401);
  }
  try {
    const refreshed = await refreshGoogleAccessToken(config, cipher.decrypt(account.refreshTokenEncrypted));
    const expiresAt = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000);
    await prisma.integrationAccount.update({
      where: { id: account.id },
      data: {
        accessTokenEncrypted: cipher.encrypt(refreshed.access_token),
        tokenExpiresAt: expiresAt,
        status: "connected",
        lastUsedAt: new Date(),
      },
    });
    return refreshed.access_token;
  } catch (cause) {
    await markReconnectionRequired(prisma, account.id);
    throw cause;
  }
}

async function googleRequest<T>(
  prisma: PrismaClient,
  account: IntegrationAccount,
  url: string,
  requiredScope: string,
): Promise<T> {
  const scopes = parseScopes(account.grantedScopes);
  if (!hasGoogleScope(scopes, requiredScope)) {
    throw new GoogleIntegrationError("MISSING_SCOPE", "Aegis needs an additional permission for this feature.", 403);
  }
  let token = await accessToken(prisma, account);
  let response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  if (response.status === 401 && account.refreshTokenEncrypted) {
    token = await accessToken(prisma, account, true);
    response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  }
  if (!response.ok) {
    if (response.status === 401) {
      await markReconnectionRequired(prisma, account.id);
      throw new GoogleIntegrationError("TOKEN_EXPIRED", "The Google connection expired. Please try again.", 401);
    }
    if (response.status === 403) throw new GoogleIntegrationError("MISSING_SCOPE", "Aegis needs an additional permission for this feature.", 403);
    throw new GoogleIntegrationError("GOOGLE_API_UNAVAILABLE", "Google is temporarily unavailable.", 502);
  }
  await prisma.integrationAccount.update({ where: { id: account.id }, data: { lastUsedAt: new Date() } });
  return response.json() as Promise<T>;
}

type GmailHeader = { name?: string; value?: string };
type GmailPart = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailPart[];
};
type GmailMessagePayload = {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart & { headers?: GmailHeader[] };
};

function gmailHeader(message: GmailMessagePayload, name: string): string {
  return message.payload?.headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

function decodeGoogleData(value?: string): string {
  if (!value) return "";
  try { return Buffer.from(value, "base64url").toString("utf8"); } catch { return ""; }
}

function collectGmailParts(part: GmailPart | undefined, attachments: Array<Record<string, unknown>>, bodies: string[]): void {
  if (!part) return;
  if (part.filename && part.body?.attachmentId) {
    attachments.push({
      filename: part.filename,
      mimeType: part.mimeType || "application/octet-stream",
      size: part.body.size || 0,
      attachmentId: part.body.attachmentId,
    });
  }
  if (part.mimeType === "text/plain" && part.body?.data) bodies.push(decodeGoogleData(part.body.data));
  for (const child of part.parts || []) collectGmailParts(child, attachments, bodies);
}

function gmailMessageView(message: GmailMessagePayload, includeBody = false) {
  const attachments: Array<Record<string, unknown>> = [];
  const bodies: string[] = [];
  collectGmailParts(message.payload, attachments, bodies);
  return {
    id: message.id,
    threadId: message.threadId,
    labels: message.labelIds || [],
    unread: message.labelIds?.includes("UNREAD") || false,
    from: gmailHeader(message, "From"),
    to: gmailHeader(message, "To"),
    subject: gmailHeader(message, "Subject") || "(No subject)",
    date: gmailHeader(message, "Date") || (message.internalDate ? new Date(Number(message.internalDate)).toISOString() : null),
    snippet: message.snippet || "",
    attachments,
    ...(includeBody ? { bodyText: bodies.join("\n\n").slice(0, 200_000) } : {}),
  };
}

async function listGmailMessages(context: IntegrationRouteContext, account: IntegrationAccount, query: string | null): Promise<void> {
  const maxResults = Math.max(1, Math.min(25, Number(context.url.searchParams.get("maxResults") || 15)));
  const params = new URLSearchParams({ maxResults: String(maxResults) });
  const pageToken = context.url.searchParams.get("pageToken");
  if (pageToken) params.set("pageToken", pageToken);
  if (query) params.set("q", query);
  const list = await googleRequest<{ messages?: Array<{ id: string }>; nextPageToken?: string; resultSizeEstimate?: number }>(
    context.prisma,
    account,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
    "https://www.googleapis.com/auth/gmail.readonly",
  );
  const messages = await Promise.all((list.messages || []).map((entry) => googleRequest<GmailMessagePayload>(
    context.prisma,
    account,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(entry.id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
    "https://www.googleapis.com/auth/gmail.readonly",
  )));
  json(context.response, 200, {
    messages: messages.map((message) => gmailMessageView(message)),
    nextPageToken: list.nextPageToken,
    resultSizeEstimate: list.resultSizeEstimate || 0,
  }, context.requestId);
}

type DriveFile = {
  id: string;
  name: string;
  mimeType?: string;
  modifiedTime?: string;
  size?: string;
  owners?: Array<{ displayName?: string; emailAddress?: string }>;
  webViewLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
};

function driveFileView(file: DriveFile, contentAvailable: boolean) {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime,
    size: file.size ? Number(file.size) : null,
    owners: file.owners || [],
    webViewLink: file.webViewLink,
    iconLink: file.iconLink,
    thumbnailLink: file.thumbnailLink,
    contentAvailable,
    ...(contentAvailable ? {} : { permissionMessage: "Additional Google Drive permission required." }),
  };
}

function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function listDriveFiles(context: IntegrationRouteContext, account: IntegrationAccount, search: string | null): Promise<void> {
  const maxResults = Math.max(1, Math.min(50, Number(context.url.searchParams.get("pageSize") || 25)));
  const scopes = parseScopes(account.grantedScopes);
  const params = new URLSearchParams({
    pageSize: String(maxResults),
    orderBy: "modifiedTime desc",
    spaces: "drive",
    fields: "nextPageToken,files(id,name,mimeType,modifiedTime,size,owners(displayName,emailAddress),webViewLink,iconLink,thumbnailLink)",
  });
  const pageToken = context.url.searchParams.get("pageToken");
  if (pageToken) params.set("pageToken", pageToken);
  params.set("q", search ? `name contains '${escapeDriveQuery(search)}' and trashed = false` : "trashed = false");
  const list = await googleRequest<{ files?: DriveFile[]; nextPageToken?: string }>(
    context.prisma,
    account,
    `https://www.googleapis.com/drive/v3/files?${params}`,
    "https://www.googleapis.com/auth/drive.metadata.readonly",
  );
  const contentAvailable = hasGoogleScope(scopes, "https://www.googleapis.com/auth/drive.readonly");
  json(context.response, 200, {
    files: (list.files || []).map((file) => driveFileView(file, contentAvailable)),
    nextPageToken: list.nextPageToken,
    contentAvailable,
    ...(contentAvailable ? {} : { permissionMessage: "Additional Google Drive permission required." }),
  }, context.requestId);
}

async function handleCallback(context: IntegrationRouteContext): Promise<void> {
  const config = getGoogleOAuthConfig();
  const success = `${config.webUrl}/connections?provider=google&status=connected`;
  const failure = `${config.webUrl}/connections?provider=google&status=error&reason=oauth_failed`;
  const state = context.url.searchParams.get("state") || "";
  const oauthError = context.url.searchParams.get("error");
  const code = context.url.searchParams.get("code") || "";
  const link = state ? await context.prisma.oAuthLinkSession.findUnique({ where: { stateHash: hashState(state) } }) : null;
  if (!link || link.provider !== "google" || link.status !== "pending") {
    redirect(context.response, failure);
    return;
  }
  if (link.expiresAt <= new Date()) {
    await context.prisma.oAuthLinkSession.update({ where: { id: link.id }, data: { status: "expired", errorCode: "OAUTH_SESSION_EXPIRED", completedAt: new Date() } });
    redirect(context.response, failure);
    return;
  }
  const claimed = await context.prisma.oAuthLinkSession.updateMany({ where: { id: link.id, status: "pending" }, data: { status: "processing" } });
  if (claimed.count !== 1) {
    redirect(context.response, failure);
    return;
  }
  if (oauthError || !code) {
    const errorCode = oauthError === "access_denied" ? "ACCESS_DENIED" : "OAUTH_FAILED";
    await context.prisma.$transaction([
      context.prisma.oAuthLinkSession.update({ where: { id: link.id }, data: { status: "error", errorCode, completedAt: new Date() } }),
      context.prisma.integrationAuditEvent.create({ data: { userId: link.userId, provider: "google", action: "oauth.callback", outcome: "denied", metadataJson: JSON.stringify({ code: errorCode }) } }),
    ]);
    redirect(context.response, failure);
    return;
  }
  try {
    if (!config.configured || !config.encryptionKey) throw googleNotConfigured(config);
    const tokens = await exchangeGoogleCode(config, code);
    const profile = await fetchGoogleUserInfo(tokens.access_token);
    const requestedScopes = parseScopes(link.requestedScopes);
    const grantedScopes = parseGrantedScopes(tokens.scope, requestedScopes);
    const cipher = createIntegrationCipher(config.encryptionKey);
    const existing = await context.prisma.integrationAccount.findUnique({
      where: { userId_provider_providerAccountId: { userId: link.userId, provider: "google", providerAccountId: profile.sub } },
    });
    const account = await context.prisma.$transaction(async (transaction) => {
      const saved = await transaction.integrationAccount.upsert({
        where: { userId_provider_providerAccountId: { userId: link.userId, provider: "google", providerAccountId: profile.sub } },
        create: {
          userId: link.userId,
          provider: "google",
          providerAccountId: profile.sub,
          email: profile.email,
          displayName: profile.name,
          avatarUrl: profile.picture,
          accessTokenEncrypted: cipher.encrypt(tokens.access_token),
          refreshTokenEncrypted: tokens.refresh_token ? cipher.encrypt(tokens.refresh_token) : null,
          tokenExpiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
          grantedScopes: JSON.stringify(grantedScopes),
          status: "connected",
          lastUsedAt: new Date(),
        },
        update: {
          email: profile.email,
          displayName: profile.name,
          avatarUrl: profile.picture,
          accessTokenEncrypted: cipher.encrypt(tokens.access_token),
          refreshTokenEncrypted: tokens.refresh_token ? cipher.encrypt(tokens.refresh_token) : existing?.refreshTokenEncrypted,
          tokenExpiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
          grantedScopes: JSON.stringify(grantedScopes),
          status: "connected",
          lastUsedAt: new Date(),
        },
      });
      await transaction.integrationPermission.deleteMany({ where: { accountId: saved.id } });
      for (const scope of grantedScopes) {
        await transaction.integrationPermission.create({ data: { accountId: saved.id, scope, status: "granted" } });
      }
      await transaction.oAuthLinkSession.update({ where: { id: link.id }, data: { status: "completed", errorCode: null, completedAt: new Date() } });
      await transaction.integrationAuditEvent.create({ data: { userId: link.userId, accountId: saved.id, provider: "google", action: existing ? "oauth.reconnect" : "oauth.connect", outcome: "success", metadataJson: JSON.stringify({ scopeCount: grantedScopes.length }) } });
      return saved;
    });
    if (!account.accessTokenEncrypted || !account.accessTokenEncrypted.includes(":")) throw new GoogleIntegrationError("TOKEN_ENCRYPTION_FAILED", "The Google credential could not be secured.", 500);
    redirect(context.response, success);
  } catch (cause) {
    const codeValue = cause instanceof GoogleIntegrationError ? cause.code : "OAUTH_FAILED";
    await context.prisma.$transaction([
      context.prisma.oAuthLinkSession.update({ where: { id: link.id }, data: { status: "error", errorCode: codeValue, completedAt: new Date() } }),
      context.prisma.integrationAuditEvent.create({ data: { userId: link.userId, provider: "google", action: "oauth.callback", outcome: "error", metadataJson: JSON.stringify({ code: codeValue }) } }),
    ]).catch(() => undefined);
    redirect(context.response, failure);
  }
}

async function handleAuthorizedGoogleRoute(context: IntegrationRouteContext): Promise<void> {
  const auth = await requireAuth(context);
  if (!auth) return;
  const config = getGoogleOAuthConfig();

  if (context.url.pathname === "/integrations/google/start" && context.method === "POST") {
    if (!config.configured) throw googleNotConfigured(config);
    const input = startSchema.parse(await readJson(context.request));
    const scopes = normalizeRequestedScopes(input.scopes);
    const state = randomBytes(32).toString("base64url");
    const connectionId = randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    await context.prisma.oAuthLinkSession.create({ data: {
      userId: auth.user.id,
      provider: "google",
      connectionId,
      stateHash: hashState(state),
      returnTarget: input.returnTarget,
      requestedScopes: JSON.stringify(scopes),
      expiresAt,
    } });
    json(context.response, 201, {
      connectionId,
      authorizationUrl: buildGoogleAuthorizationUrl(config, state, scopes),
      expiresAt: expiresAt.toISOString(),
    }, context.requestId);
    return;
  }

  if (context.url.pathname === "/integrations/google/status" && context.method === "GET") {
    const connectionId = context.url.searchParams.get("connectionId");
    if (connectionId) {
      const link = await context.prisma.oAuthLinkSession.findFirst({ where: { connectionId, userId: auth.user.id, provider: "google" } });
      if (!link) throw new GoogleIntegrationError("OAUTH_SESSION_NOT_FOUND", "The Google connection request was not found.", 404);
      const expired = link.status === "pending" && link.expiresAt <= new Date();
      if (expired) await context.prisma.oAuthLinkSession.update({ where: { id: link.id }, data: { status: "expired", errorCode: "OAUTH_SESSION_EXPIRED", completedAt: new Date() } });
      json(context.response, 200, { connectionId, status: expired ? "expired" : link.status, errorCode: expired ? "OAUTH_SESSION_EXPIRED" : link.errorCode, expiresAt: link.expiresAt }, context.requestId);
      return;
    }
    json(context.response, 200, accountView(await googleAccount(context.prisma, auth.user.id), config.configured), context.requestId);
    return;
  }

  if ((context.url.pathname === "/integrations" || context.url.pathname === "/integrations/google") && context.method === "GET") {
    const view = accountView(await googleAccount(context.prisma, auth.user.id), config.configured);
    json(context.response, 200, context.url.pathname === "/integrations" ? { integrations: [view] } : { integration: view }, context.requestId);
    return;
  }

  if (context.url.pathname === "/integrations/google/account" && context.method === "GET") {
    const account = await googleAccount(context.prisma, auth.user.id);
    if (!account) throw new GoogleIntegrationError("GOOGLE_ACCOUNT_NOT_CONNECTED", "Google is not connected.", 404);
    json(context.response, 200, { integration: accountView(account, config.configured) }, context.requestId);
    return;
  }

  if (context.url.pathname === "/integrations/google/diagnostics" && context.method === "GET") {
    const account = await googleAccount(context.prisma, auth.user.id);
    const scopes = account ? parseScopes(account.grantedScopes) : [];
    json(context.response, 200, {
      googleOAuthConfigured: config.configured,
      googleClientIdLoaded: Boolean(config.clientId),
      googleClientSecretLoaded: Boolean(config.clientSecret),
      googleRedirectUriValid: !config.missing.includes("GOOGLE_REDIRECT_URI"),
      googleRedirectUri: config.redirectUri,
      googleConnectionActive: account?.status === "connected",
      gmailPermissionAvailable: hasGoogleScope(scopes, "https://www.googleapis.com/auth/gmail.readonly"),
      drivePermissionAvailable: hasGoogleScope(scopes, "https://www.googleapis.com/auth/drive.metadata.readonly"),
      tokenRefreshAvailable: Boolean(account?.refreshTokenEncrypted),
    }, context.requestId);
    return;
  }

  if (context.url.pathname === "/integrations/google/disconnect" && context.method === "POST") {
    const account = await googleAccount(context.prisma, auth.user.id);
    if (!account) throw new GoogleIntegrationError("GOOGLE_ACCOUNT_NOT_CONNECTED", "Google is not connected.", 404);
    let revoked = false;
    if (config.configured && config.encryptionKey) {
      const cipher = createIntegrationCipher(config.encryptionKey);
      const encrypted = account.refreshTokenEncrypted || account.accessTokenEncrypted;
      if (encrypted) revoked = await revokeGoogleToken(cipher.decrypt(encrypted));
    }
    await context.prisma.$transaction([
      context.prisma.integrationPermission.updateMany({ where: { accountId: account.id }, data: { status: "revoked", revokedAt: new Date() } }),
      context.prisma.integrationAccount.update({ where: { id: account.id }, data: { accessTokenEncrypted: null, refreshTokenEncrypted: null, tokenExpiresAt: null, status: "disconnected", grantedScopes: "[]" } }),
      context.prisma.oAuthLinkSession.updateMany({ where: { userId: auth.user.id, provider: "google", status: { in: ["pending", "processing"] } }, data: { status: "cancelled", errorCode: "DISCONNECTED", completedAt: new Date() } }),
      context.prisma.integrationAuditEvent.create({ data: { userId: auth.user.id, accountId: account.id, provider: "google", action: "oauth.disconnect", outcome: revoked ? "revoked" : "local_tokens_removed", metadataJson: JSON.stringify({ remoteRevocation: revoked }) } }),
    ]);
    json(context.response, 200, { ok: true, revoked }, context.requestId);
    return;
  }

  const account = await googleAccount(context.prisma, auth.user.id);
  if (!account || account.status !== "connected") throw new GoogleIntegrationError("GOOGLE_ACCOUNT_NOT_CONNECTED", "Google is not connected.", 409);

  if (context.url.pathname === "/integrations/google/gmail/messages" && context.method === "GET") {
    await listGmailMessages(context, account, context.url.searchParams.get("q"));
    return;
  }
  if (context.url.pathname === "/integrations/google/gmail/search" && context.method === "GET") {
    const query = context.url.searchParams.get("q")?.trim();
    if (!query) throw new GoogleIntegrationError("VALIDATION_ERROR", "A Gmail search query is required.", 400);
    await listGmailMessages(context, account, query);
    return;
  }
  const gmailMessageMatch = context.url.pathname.match(/^\/integrations\/google\/gmail\/messages\/([^/]+)$/);
  if (gmailMessageMatch && context.method === "GET") {
    const message = await googleRequest<GmailMessagePayload>(context.prisma, account, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(gmailMessageMatch[1])}?format=full`, "https://www.googleapis.com/auth/gmail.readonly");
    json(context.response, 200, { message: gmailMessageView(message, true) }, context.requestId);
    return;
  }
  const gmailThreadMatch = context.url.pathname.match(/^\/integrations\/google\/gmail\/threads\/([^/]+)$/);
  if (gmailThreadMatch && context.method === "GET") {
    const thread = await googleRequest<{ id: string; messages?: GmailMessagePayload[] }>(context.prisma, account, `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(gmailThreadMatch[1])}?format=full`, "https://www.googleapis.com/auth/gmail.readonly");
    json(context.response, 200, { thread: { id: thread.id, messages: (thread.messages || []).map((message) => gmailMessageView(message, true)) } }, context.requestId);
    return;
  }
  if (context.url.pathname === "/integrations/google/drive/files" && context.method === "GET") {
    await listDriveFiles(context, account, null);
    return;
  }
  if (context.url.pathname === "/integrations/google/drive/search" && context.method === "GET") {
    const query = context.url.searchParams.get("q")?.trim();
    if (!query) throw new GoogleIntegrationError("VALIDATION_ERROR", "A Drive search query is required.", 400);
    await listDriveFiles(context, account, query);
    return;
  }
  const driveFileMatch = context.url.pathname.match(/^\/integrations\/google\/drive\/files\/([^/]+)$/);
  if (driveFileMatch && context.method === "GET") {
    const params = new URLSearchParams({ fields: "id,name,mimeType,modifiedTime,size,owners(displayName,emailAddress),webViewLink,iconLink,thumbnailLink" });
    const file = await googleRequest<DriveFile>(context.prisma, account, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileMatch[1])}?${params}`, "https://www.googleapis.com/auth/drive.metadata.readonly");
    const contentAvailable = hasGoogleScope(parseScopes(account.grantedScopes), "https://www.googleapis.com/auth/drive.readonly");
    json(context.response, 200, { file: driveFileView(file, contentAvailable) }, context.requestId);
    return;
  }
  throw new GoogleIntegrationError("NOT_FOUND", "Integration route not found.", 404);
}

export async function handleIntegrationRoute(context: IntegrationRouteContext): Promise<boolean> {
  if (!context.url.pathname.startsWith("/integrations")) return false;
  try {
    // GitHub routes (callback doesn't need auth)
    if (context.url.pathname.startsWith("/integrations/github")) {
      const { handleGitHubIntegrationRoute } = await import("./github-integration.js");
      return handleGitHubIntegrationRoute(context.request, context.response, context.url, context.method, context.requestId, context.prisma, context.currentUser);
    }
    if (context.url.pathname === "/integrations/google/callback" && context.method === "GET") {
      await handleCallback(context);
      return true;
    }
    await handleAuthorizedGoogleRoute(context);
  } catch (cause) {
    if (cause instanceof z.ZodError) {
      error(context.response, 400, "VALIDATION_ERROR", "Request validation failed.", context.requestId);
    } else if (cause instanceof GoogleIntegrationError) {
      error(context.response, cause.status, cause.code, cause.message, context.requestId);
    } else {
      error(context.response, 500, "INTEGRATION_ERROR", "The integration request could not be completed.", context.requestId);
    }
  }
  return true;
}

export const googleIntegrationTestExports = {
  hashState,
  accountView,
  GOOGLE_INITIAL_SCOPES,
  GOOGLE_INCREMENTAL_SCOPES,
};

/** Server-only agent tool. Returns bounded Gmail metadata and never exposes OAuth credentials. */
export async function getLatestGmailMessageForAgent(prisma: PrismaClient, userId: string) {
  const account = await googleAccount(prisma, userId);
  if (!account || account.status !== "connected") throw new GoogleIntegrationError("GOOGLE_ACCOUNT_NOT_CONNECTED", "Google is not connected.", 409);
  const list = await googleRequest<{ messages?: Array<{ id: string }> }>(prisma, account, "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1", "https://www.googleapis.com/auth/gmail.readonly");
  const id = list.messages?.[0]?.id;
  if (!id) return null;
  const message = await googleRequest<GmailMessagePayload>(prisma, account, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`, "https://www.googleapis.com/auth/gmail.readonly");
  return gmailMessageView(message);
}
