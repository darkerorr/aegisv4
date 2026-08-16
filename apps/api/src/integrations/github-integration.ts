import { randomBytes, randomUUID } from "node:crypto";
import type http from "node:http";
import { Prisma, type IntegrationAccount, type PrismaClient, type User } from "@prisma/client";
import { createGitHubAPI, getGitHubConfigurationStatus, GitHubIntegrationError, hashGitHubState, type GitHubAPI } from "./github/index.js";

type AuthResult = { user: User; sessionId: string } | null;

type GitHubAccount = IntegrationAccount;

function json(res: http.ServerResponse, status: number, value: unknown, requestId?: string): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(requestId ? { "X-Request-Id": requestId } : {}) });
  res.end(JSON.stringify(value));
}

function error(res: http.ServerResponse, status: number, code: string, message: string, requestId?: string): void {
  json(res, status, { code, message, ...(requestId ? { requestId } : {}) }, requestId);
}

function redirect(res: http.ServerResponse, location: string): void {
  res.writeHead(302, { Location: location, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  res.end();
}

async function requireAuth(currentUser: () => Promise<AuthResult>, res: http.ServerResponse): Promise<NonNullable<AuthResult> | null> {
  const auth = await currentUser();
  if (!auth) { error(res, 401, "AUTH_REQUIRED", "Authentication required."); return null; }
  return auth;
}

function parseScopes(value: string): string[] {
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((scope): scope is string => typeof scope === "string") : []; }
  catch { return []; }
}

function permissionView(scopes: string[]): Record<string, string> {
  const permissions: Record<string, string> = {};
  for (const scope of scopes) {
    const separator = scope.indexOf(":");
    if (separator <= 0 || scope.startsWith("repo:")) continue;
    const raw = scope.slice(0, separator);
    const key = raw === "pull_requests" ? "pullRequests" : raw;
    permissions[key] = scope.slice(separator + 1);
  }
  return permissions;
}

function accountView(account: GitHubAccount | null, configured: boolean, repositoryCount = 0) {
  const scopes = account ? parseScopes(account.grantedScopes) : [];
  return {
    provider: "github",
    configured,
    status: !configured ? "not_configured" : account?.status || "disconnected",
    account: account ? {
      login: account.displayName,
      type: account.email,
      avatarUrl: account.avatarUrl,
      installationId: Number(account.providerAccountId),
      repositorySelection: scopes.includes("repo:all") ? "all" : "selected",
      repositoryCount,
      permissions: permissionView(scopes),
      lastVerifiedAt: account.lastUsedAt?.toISOString() || null,
    } : null,
  };
}

async function getGitHubAccount(prisma: PrismaClient, userId: string, connectedOnly = false): Promise<GitHubAccount | null> {
  return prisma.integrationAccount.findFirst({
    where: { userId, provider: "github", ...(connectedOnly ? { status: "connected" } : {}) },
    orderBy: { updatedAt: "desc" },
  });
}

function getGitHubAPI(): GitHubAPI {
  const webUrl = process.env.AEGIS_WEB_URL?.trim() || "http://127.0.0.1:3000";
  const apiUrl = process.env.AEGIS_API_URL?.trim() || "http://127.0.0.1:4000";
  return createGitHubAPI(webUrl, apiUrl);
}

function upstreamStatus(cause: unknown): number | undefined {
  return typeof cause === "object" && cause !== null && "status" in cause ? Number((cause as { status?: number }).status) : undefined;
}

function normalizedGitHubError(cause: unknown): GitHubIntegrationError {
  if (cause instanceof GitHubIntegrationError) return cause;
  if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === "P2002") {
    return new GitHubIntegrationError("GITHUB_INSTALLATION_ALREADY_LINKED", "This GitHub installation is already linked to another Aegis account.", 409);
  }
  const status = upstreamStatus(cause);
  if (status === 401 || status === 404) return new GitHubIntegrationError("GITHUB_INSTALLATION_REVOKED", "The GitHub installation is no longer available. Reconnect GitHub to continue.", 410);
  if (status === 403 || status === 429) return new GitHubIntegrationError("GITHUB_RATE_LIMITED", "GitHub temporarily refused the request because of a permission or rate limit.", 429);
  return new GitHubIntegrationError("GITHUB_UPSTREAM_ERROR", "GitHub could not complete the request.", 502);
}

async function repositoryCount(api: GitHubAPI, installationId: number): Promise<number> {
  const octokit = await api.getInstallationOctokit(installationId) as any;
  const response = await octokit.rest.apps.listReposAccessibleToInstallation({ per_page: 1, page: 1 });
  return Number(response.data.total_count || 0);
}

async function handleCallback(res: http.ServerResponse, url: URL, requestId: string, prisma: PrismaClient): Promise<void> {
  let api: GitHubAPI;
  try { api = getGitHubAPI(); }
  catch (cause) {
    const githubError = normalizedGitHubError(cause);
    error(res, githubError.status, githubError.code, githubError.message, requestId);
    return;
  }
  const failure = (reason: string) => `${api.config.webUrl}/connections?provider=github&status=error&reason=${encodeURIComponent(reason)}`;
  const state = url.searchParams.get("state") || "";
  const installationValue = url.searchParams.get("installation_id") || "";
  const installationId = Number(installationValue);
  if (!Number.isSafeInteger(installationId) || installationId <= 0) { redirect(res, failure("installation_missing")); return; }

  const link = state ? await prisma.oAuthLinkSession.findUnique({ where: { stateHash: hashGitHubState(state) } }) : null;
  if (!link || link.provider !== "github" || link.status !== "pending") { redirect(res, failure("state_invalid")); return; }
  if (link.expiresAt <= new Date()) {
    await prisma.oAuthLinkSession.update({ where: { id: link.id }, data: { status: "expired", errorCode: "OAUTH_SESSION_EXPIRED", completedAt: new Date() } });
    redirect(res, failure("state_expired"));
    return;
  }
  const claimed = await prisma.oAuthLinkSession.updateMany({ where: { id: link.id, status: "pending" }, data: { status: "processing" } });
  if (claimed.count !== 1) { redirect(res, failure("state_used")); return; }

  try {
    const info = await api.getInstallationInfo(installationId);
    const conflict = await prisma.integrationAccount.findFirst({
      where: { provider: "github", providerAccountId: String(info.installationId), NOT: { userId: link.userId } },
    });
    if (conflict) throw new GitHubIntegrationError("GITHUB_INSTALLATION_ALREADY_LINKED", "This GitHub installation is already linked to another Aegis account.", 409);
    const grantedScopes = Object.entries(info.permissions).map(([permission, level]) => `${permission}:${level}`);
    if (info.repositorySelection === "all") grantedScopes.push("repo:all");
    const existing = await prisma.integrationAccount.findUnique({
      where: { userId_provider_providerAccountId: { userId: link.userId, provider: "github", providerAccountId: String(info.installationId) } },
    });
    await prisma.$transaction(async (transaction) => {
      const saved = await transaction.integrationAccount.upsert({
        where: { userId_provider_providerAccountId: { userId: link.userId, provider: "github", providerAccountId: String(info.installationId) } },
        create: { userId: link.userId, provider: "github", providerAccountId: String(info.installationId), email: info.accountType, displayName: info.accountLogin, avatarUrl: info.avatarUrl, grantedScopes: JSON.stringify(grantedScopes), status: "connected", lastUsedAt: new Date() },
        update: { email: info.accountType, displayName: info.accountLogin, avatarUrl: info.avatarUrl, grantedScopes: JSON.stringify(grantedScopes), status: "connected", lastUsedAt: new Date() },
      });
      await transaction.integrationPermission.deleteMany({ where: { accountId: saved.id } });
      for (const scope of grantedScopes.filter((scope) => !scope.startsWith("repo:"))) {
        await transaction.integrationPermission.create({ data: { accountId: saved.id, scope, status: "granted" } });
      }
      await transaction.oAuthLinkSession.update({ where: { id: link.id }, data: { status: "completed", errorCode: null, completedAt: new Date() } });
      await transaction.integrationAuditEvent.create({ data: { userId: link.userId, accountId: saved.id, provider: "github", action: existing ? "github.reconnect" : "github.connect", outcome: "success", metadataJson: JSON.stringify({ permissionCount: grantedScopes.length, repositorySelection: info.repositorySelection }) } });
    });
    redirect(res, `${api.config.webUrl}/connections?provider=github&status=connected`);
  } catch (cause) {
    const githubError = normalizedGitHubError(cause);
    await prisma.$transaction([
      prisma.oAuthLinkSession.update({ where: { id: link.id }, data: { status: "error", errorCode: githubError.code, completedAt: new Date() } }),
      prisma.integrationAuditEvent.create({ data: { userId: link.userId, provider: "github", action: "github.callback", outcome: "error", metadataJson: JSON.stringify({ code: githubError.code }) } }),
    ]).catch(() => undefined);
    redirect(res, failure(githubError.code.toLowerCase()));
  }
}

export async function handleGitHubIntegrationRoute(
  request: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  method: string,
  requestId: string,
  prisma: PrismaClient,
  currentUser: () => Promise<AuthResult>,
): Promise<boolean> {
  if (!url.pathname.startsWith("/integrations/github")) return false;
  const base = "/integrations/github";

  if ((url.pathname === `${base}/callback` || url.pathname === `${base}/setup`) && method === "GET") {
    await handleCallback(res, url, requestId, prisma);
    return true;
  }

  const auth = await requireAuth(currentUser, res);
  if (!auth) return true;

  if (url.pathname === `${base}/status` && method === "GET") {
    const configuration = getGitHubConfigurationStatus();
    let account = await getGitHubAccount(prisma, auth.user.id);
    let count = 0;
    if (configuration.configured && account?.status === "connected") {
      try {
        const api = getGitHubAPI();
        await api.testInstallation(Number(account.providerAccountId));
        count = await repositoryCount(api, Number(account.providerAccountId));
        account = await prisma.integrationAccount.update({ where: { id: account.id }, data: { lastUsedAt: new Date() } });
      } catch (cause) {
        const githubError = normalizedGitHubError(cause);
        if (githubError.code === "GITHUB_INSTALLATION_REVOKED") {
          account = await prisma.integrationAccount.update({ where: { id: account.id }, data: { status: "revoked" } });
        }
      }
    }
    json(res, 200, accountView(account, configuration.configured, count), requestId);
    return true;
  }

  let api: GitHubAPI;
  try { api = getGitHubAPI(); }
  catch (cause) {
    const githubError = normalizedGitHubError(cause);
    if (url.pathname === `${base}/connect` && method === "GET") {
      const existing = await getGitHubAccount(prisma, auth.user.id);
      const pendingState = await prisma.oAuthLinkSession.findFirst({
        where: { userId: auth.user.id, provider: "github", status: "pending", expiresAt: { gt: new Date() } },
      });
      console.info(`[GitHub Connect]\nuserId=${auth.user.id}\nconfigured=false\nexistingConnection=${Boolean(existing)}\nconnectionStatus=${existing?.status || "none"}\npendingState=${Boolean(pendingState)}\ninstallationIdPresent=${Boolean(existing?.providerAccountId)}`);
    }
    error(res, githubError.status, githubError.code, githubError.message, requestId);
    return true;
  }

  try {
    if (url.pathname === `${base}/connect` && method === "GET") {
      await prisma.oAuthLinkSession.updateMany({
        where: { userId: auth.user.id, provider: "github", status: "pending", expiresAt: { lte: new Date() } },
        data: { status: "expired", errorCode: "OAUTH_SESSION_EXPIRED", completedAt: new Date() },
      });
      let existing = await getGitHubAccount(prisma, auth.user.id);
      const pendingState = await prisma.oAuthLinkSession.findFirst({ where: { userId: auth.user.id, provider: "github", status: "pending", expiresAt: { gt: new Date() } } });
      console.info(`[GitHub Connect]\nuserId=${auth.user.id}\nconfigured=true\nexistingConnection=${Boolean(existing)}\nconnectionStatus=${existing?.status || "none"}\npendingState=${Boolean(pendingState)}\ninstallationIdPresent=${Boolean(existing?.providerAccountId)}`);
      if (existing?.status === "connected") {
        try {
          await api.testInstallation(Number(existing.providerAccountId));
          json(res, 200, { status: "already_connected", authorizationUrl: `${api.config.webUrl}/connections?github=already-connected` }, requestId);
          return true;
        } catch (cause) {
          const githubError = normalizedGitHubError(cause);
          if (githubError.code !== "GITHUB_INSTALLATION_REVOKED") throw githubError;
          existing = await prisma.integrationAccount.update({ where: { id: existing.id }, data: { status: "revoked" } });
        }
      }
      if (pendingState) {
        await prisma.oAuthLinkSession.update({ where: { id: pendingState.id }, data: { status: "cancelled", errorCode: "REPLACED", completedAt: new Date() } });
      }
      const state = randomBytes(32).toString("base64url");
      const connectionId = randomUUID();
      const expiresAt = new Date(Date.now() + 10 * 60_000);
      await prisma.oAuthLinkSession.create({ data: { userId: auth.user.id, provider: "github", connectionId, stateHash: hashGitHubState(state), returnTarget: "web", requestedScopes: "[]", expiresAt } });
      json(res, 201, { status: existing?.status === "revoked" ? "reconnect" : "pending", connectionId, authorizationUrl: api.getAuthorizationUrl(state), expiresAt: expiresAt.toISOString() }, requestId);
      return true;
    }

    if (url.pathname === `${base}/repositories` && method === "GET") {
      const account = await getGitHubAccount(prisma, auth.user.id, true);
      if (!account) throw new GitHubIntegrationError("GITHUB_NOT_CONNECTED", "GitHub is not connected.", 404);
      const octokit = await api.getInstallationOctokit(Number(account.providerAccountId)) as any;
      const repositories: any[] = [];
      for (let page = 1; page <= 20; page += 1) {
        const response = await octokit.rest.apps.listReposAccessibleToInstallation({ per_page: 100, page });
        const batch = response.data.repositories || [];
        repositories.push(...batch);
        if (batch.length < 100) break;
      }
      await prisma.integrationAccount.update({ where: { id: account.id }, data: { lastUsedAt: new Date() } });
      json(res, 200, { repositories: repositories.map((repository) => ({
        id: repository.id,
        owner: repository.owner?.login,
        name: repository.name,
        fullName: repository.full_name,
        private: repository.private,
        description: repository.description,
        defaultBranch: repository.default_branch,
        language: repository.language,
        updatedAt: repository.updated_at,
        htmlUrl: repository.html_url,
      })) }, requestId);
      return true;
    }

    if (url.pathname === `${base}/test` && method === "POST") {
      const account = await getGitHubAccount(prisma, auth.user.id, true);
      if (!account) throw new GitHubIntegrationError("GITHUB_NOT_CONNECTED", "GitHub is not connected.", 404);
      await api.testInstallation(Number(account.providerAccountId));
      await prisma.integrationAccount.update({ where: { id: account.id }, data: { lastUsedAt: new Date() } });
      json(res, 200, { ok: true, status: "connected", lastVerifiedAt: new Date().toISOString() }, requestId);
      return true;
    }

    if ((url.pathname === `${base}/disconnect` && method === "POST") || (url.pathname === base && method === "DELETE")) {
      const account = await getGitHubAccount(prisma, auth.user.id);
      if (!account) throw new GitHubIntegrationError("GITHUB_NOT_CONNECTED", "GitHub is not connected.", 404);
      await prisma.$transaction([
        prisma.integrationPermission.updateMany({ where: { accountId: account.id }, data: { status: "revoked", revokedAt: new Date() } }),
        prisma.integrationAccount.update({ where: { id: account.id }, data: { status: "disconnected", lastUsedAt: new Date() } }),
        prisma.oAuthLinkSession.updateMany({ where: { userId: auth.user.id, provider: "github", status: { in: ["pending", "processing"] } }, data: { status: "cancelled", errorCode: "DISCONNECTED", completedAt: new Date() } }),
        prisma.integrationAuditEvent.create({ data: { userId: auth.user.id, accountId: account.id, provider: "github", action: "github.disconnect", outcome: "local" } }),
      ]);
      json(res, 200, { ok: true }, requestId);
      return true;
    }

    error(res, 404, "NOT_FOUND", "GitHub integration route not found.", requestId);
  } catch (cause) {
    const githubError = normalizedGitHubError(cause);
    error(res, githubError.status, githubError.code, githubError.message, requestId);
  }
  return true;
}

export async function getGitHubOctokitForAgent(prisma: PrismaClient, userId: string): Promise<{ octokit: any; installationId: number; accountLogin: string; permissions: Record<string, string> }> {
  const account = await getGitHubAccount(prisma, userId, true);
  if (!account) throw new GitHubIntegrationError("GITHUB_NOT_CONNECTED", "GitHub is not connected.", 404);
  const api = getGitHubAPI();
  try {
    const octokit = await api.getInstallationOctokit(Number(account.providerAccountId));
    await api.testInstallation(Number(account.providerAccountId));
    return { octokit, installationId: Number(account.providerAccountId), accountLogin: account.displayName || "unknown", permissions: permissionView(parseScopes(account.grantedScopes)) };
  } catch (cause) {
    const githubError = normalizedGitHubError(cause);
    if (githubError.code === "GITHUB_INSTALLATION_REVOKED") await prisma.integrationAccount.update({ where: { id: account.id }, data: { status: "revoked" } });
    throw githubError;
  }
}

export const githubIntegrationTestExports = { accountView, permissionView, normalizedGitHubError };
