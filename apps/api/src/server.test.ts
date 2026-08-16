import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma, server } from "./server.js";
import { GOOGLE_INITIAL_SCOPES, getGoogleOAuthConfig } from "./integrations/google.js";

const googleConfigured = getGoogleOAuthConfig().configured;

let baseUrl = "";
let listener: ReturnType<typeof server.listen>;

beforeAll(async () => { listener = server.listen(0); await new Promise<void>((resolve) => listener.once("listening", () => resolve())); const address = listener.address(); if (address && typeof address !== "string") baseUrl = `http://127.0.0.1:${address.port}`; });
afterAll(async () => { await new Promise<void>((resolve, reject) => listener.close((error) => error ? reject(error) : resolve())); await prisma.$disconnect(); });

async function request(path: string, init: RequestInit = {}, cookie = ""): Promise<Response> { return fetch(`${baseUrl}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...(init.headers || {}) } }); }
function jsonBody(value: unknown): string { return JSON.stringify(value); }

describe("API contract", () => {
  it("exposes public health and neutral root routes", async () => {
    const health = await request("/health");
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toMatchObject({ ok: true, service: "aegis-api", status: "ready" });
    const root = await request("/");
    expect(root.status).toBe(200);
    await expect(root.json()).resolves.toMatchObject({ service: "Aegis API", status: "running", health: "/health" });
    const me = await request("/auth/me");
    expect(me.status).toBe(401);
    await expect(me.json()).resolves.toMatchObject({ code: "AUTH_REQUIRED" });
  });

  it("answers credentialed browser preflights before authentication", async () => {
    const preflight = await request("/auth/register", {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:3000");
    expect(preflight.headers.get("access-control-allow-credentials")).toBe("true");
    expect(preflight.headers.get("access-control-allow-headers")).toContain("Content-Type");
    expect(preflight.headers.get("access-control-allow-methods")).toContain("POST");
    expect(preflight.headers.get("vary")).toContain("Origin");
  });

  it("creates a development session cookie usable by auth/me", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const register = await request("/auth/register", {
      method: "POST",
      headers: { Origin: "http://127.0.0.1:3000" },
      body: jsonBody({ email: `cookie-${suffix}@example.test`, password: "Cookie-password-123!", displayName: "Cookie test" }),
    });
    expect(register.status).toBe(201);
    expect(register.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:3000");
    const setCookie = register.headers.get("set-cookie") || "";
    expect(setCookie).toContain("aegis_session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).not.toContain("Secure");
    expect(setCookie).not.toContain("Domain=");
    const cookie = setCookie.split(";")[0];
    const me = await request("/auth/me", { headers: { Origin: "http://127.0.0.1:3000" } }, cookie);
    expect(me.status).toBe(200);
    await expect(me.json()).resolves.toMatchObject({ user: { displayName: "Cookie test" } });
  });

  it("reports the Local Agent status as layered layers and never 502s on a missing token", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const register = await request("/auth/register", { method: "POST", body: jsonBody({ email: `work-status-${suffix}@example.test`, password: "Work-status-123!", displayName: "Work status" }) });
    expect(register.status).toBe(201);
    const cookie = register.headers.get("set-cookie")?.split(";")[0] || "";
    const response = await request("/work/status", {}, cookie);
    // Regression guard: without a local agent (or a token) the endpoint must
    // return a structured status, never a 502 LOCAL_AGENT_NOT_CONFIGURED.
    expect(response.status).toBe(200);
    const payload = await response.json() as {
      available: boolean;
      agent: { process: string; connection: string; authentication: string; lastHeartbeat: string };
      providers: { status: string; configured: number; enabled: number; ready: boolean };
      workspaces: unknown[];
    };
    expect(["online", "offline"]).toContain(payload.agent.process);
    expect(["connected", "auth_required", "unreachable"]).toContain(payload.agent.connection);
    expect(["authenticated", "required", "invalid"]).toContain(payload.agent.authentication);
    expect(payload.agent.lastHeartbeat).toBeTruthy();
    expect(payload.providers.status).toBe("not_configured");
    expect(payload.providers.configured).toBe(0);
    expect(payload.providers.ready).toBe(false);
    expect(payload.available).toBe(payload.agent.connection === "connected");
    // No AI provider may ever flip the agent to offline.
    if (payload.agent.process === "online") {
      expect(payload.agent.connection).not.toBe("unreachable");
    }
  });

  it("supports account, provider and conversation ownership contracts", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const password = "Old-password-123!";
    const register = await request("/auth/register", { method: "POST", body: jsonBody({ email: `route-${suffix}@example.test`, password, displayName: "Route test" }) });
    expect(register.status).toBe(201);
    const cookie = register.headers.get("set-cookie")?.split(";")[0] || "";
    expect((await request("/auth/account", { method: "PATCH", body: jsonBody({ displayName: "Updated route test" }) }, cookie)).status).toBe(200);
    const secondLogin = await request("/auth/login", { method: "POST", body: jsonBody({ email: `route-${suffix}@example.test`, password }) });
    const secondCookie = secondLogin.headers.get("set-cookie")?.split(";")[0] || "";
    const sessions = await (await request("/auth/sessions", {}, cookie)).json() as { sessions: Array<{ id: string; current: boolean }> };
    const secondary = sessions.sessions.find((session) => !session.current);
    expect(secondary).toBeDefined();
    expect(await (await request(`/auth/sessions/${secondary?.id}`, { method: "DELETE" }, cookie)).json()).toMatchObject({ ok: true, revoked: true });
    expect((await request("/auth/me", {}, secondCookie)).status).toBe(401);
    expect((await request("/auth/password", { method: "PUT", body: jsonBody({ currentPassword: password, newPassword: "New-password-123!", confirmPassword: "New-password-123!" }) }, cookie)).status).toBe(200);
    expect((await request("/auth/sessions", {}, cookie)).status).toBe(200);

    const created = await request("/providers", { method: "POST", body: jsonBody({ type: "custom", name: "Route provider", baseUrl: "http://127.0.0.1:1/v1", apiKey: "route-secret", defaultModel: "route-model" }) }, cookie);
    expect(created.status).toBe(201);
    const provider = await created.json() as { provider: { id: string; hasApiKey: boolean; maskedApiKey?: string } };
    expect(provider.provider.hasApiKey).toBe(true);
    expect(provider.provider.maskedApiKey).not.toBe("route-secret");
    const updated = await request(`/providers/${provider.provider.id}`, { method: "PATCH", body: jsonBody({ name: "Updated route provider" }) }, cookie);
    expect(updated.status).toBe(200);
    expect((await updated.json()).provider.name).toBe("Updated route provider");

    const conversationResponse = await request("/conversations", { method: "POST", body: jsonBody({ providerId: provider.provider.id, model: "route-model", title: "Before" }) }, cookie);
    expect(conversationResponse.status).toBe(201);
    const conversation = await conversationResponse.json() as { conversation: { id: string } };
    const renamed = await request(`/conversations/${conversation.conversation.id}`, { method: "PATCH", body: jsonBody({ title: "After" }) }, cookie);
    expect((await renamed.json()).conversation.title).toBe("After");
    expect((await request(`/providers/${provider.provider.id}`, { method: "DELETE" }, cookie)).status).toBe(200);
    const retained = await request(`/conversations/${conversation.conversation.id}`, {}, cookie);
    expect(retained.status).toBe(200);
    expect((await retained.json()).conversation.title).toBe("After");
    expect((await request(`/conversations/${conversation.conversation.id}`, { method: "DELETE" }, cookie)).status).toBe(200);
  });

  it("searches conversations across titles and message content", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const registered = await request("/auth/register", { method: "POST", body: jsonBody({ email: `search-${suffix}@example.test`, password: "Search-password-123!" }) });
    expect(registered.status).toBe(201);
    const cookie = registered.headers.get("set-cookie")?.split(";")[0] || "";
    const provider = await request("/providers", { method: "POST", body: jsonBody({ type: "custom", name: "Search provider", baseUrl: "http://127.0.0.1:1/v1", apiKey: "search-secret", defaultModel: "search-model" }) }, cookie);
    const providerId = (await provider.json() as { provider: { id: string } }).provider.id;
    const created = await request("/conversations", { method: "POST", body: jsonBody({ providerId, model: "search-model", title: "Launch narrative" }) }, cookie);
    const conversation = await created.json() as { conversation: { id: string } };
    await request(`/conversations/${conversation.conversation.id}/messages`, { method: "POST", body: jsonBody({ content: "Sharpen the positioning around privacy." }) }, cookie);

    const byContent = await request("/conversations/search?q=privacy", {}, cookie);
    expect(byContent.status).toBe(200);
    await expect(byContent.json()).resolves.toMatchObject({ conversations: [expect.objectContaining({ title: "Launch narrative" })] });

    const byTitle = await request("/conversations/search?q=launch", {}, cookie);
    await expect(byTitle.json()).resolves.toMatchObject({ conversations: [expect.objectContaining({ title: "Launch narrative" })] });

    const miss = await request("/conversations/search?q=zzzz-not-present", {}, cookie);
    await expect(miss.json()).resolves.toMatchObject({ conversations: [] });

    const invalid = await request("/conversations/search", {}, cookie);
    expect(invalid.status).toBe(400);

    const anonymous = await request("/conversations/search?q=privacy");
    expect(anonymous.status).toBe(401);
  });

  it("persists account language and timezone preferences across separate requests", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const registered = await request("/auth/register", { method: "POST", body: jsonBody({ email: `prefs-${suffix}@example.test`, password: "Prefs-password-123!", displayName: "Prefs test" }) });
    expect(registered.status).toBe(201);
    const cookie = registered.headers.get("set-cookie")?.split(";")[0] || "";

    const updated = await request("/auth/account", { method: "PATCH", body: jsonBody({ displayName: "Prefs renamed", preferences: { language: "fr", timezone: "Europe/Paris" } }) }, cookie);
    expect(updated.status).toBe(200);
    await expect(updated.json()).resolves.toMatchObject({ user: { displayName: "Prefs renamed", preferences: { language: "fr", timezone: "Europe/Paris" } } });

    const refetched = await request("/auth/me", {}, cookie);
    expect(refetched.status).toBe(200);
    await expect(refetched.json()).resolves.toMatchObject({ user: { displayName: "Prefs renamed", preferences: { language: "fr", timezone: "Europe/Paris" } } });

    const second = await request("/auth/account", { method: "PATCH", body: jsonBody({ preferences: { language: "en", timezone: "Europe/London" } }) }, cookie);
    expect(second.status).toBe(200);
    await expect((await request("/auth/me", {}, cookie)).json()).resolves.toMatchObject({ user: { preferences: { language: "en", timezone: "Europe/London" } } });
  });

  it("connects NVIDIA through the canonical route without returning or storing a raw secret", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const registered = await request("/auth/register", { method: "POST", body: jsonBody({ email: `nvidia-${suffix}@example.test`, password: "Provider-password-123!" }) });
    const cookie = registered.headers.get("set-cookie")?.split(";")[0] || "";
    const originalFetch = globalThis.fetch;
    const upstream = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith("https://integrate.api.nvidia.com/v1")) return new Response(JSON.stringify({ data: [{ id: "nvidia/test-model" }, { id: "nvidia/reasoning-model" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
      return originalFetch(input, init);
    });
    try {
      const secret = "nvapi-playwright-never-real";
      const connected = await request("/providers/nvidia-nim/connect", { method: "POST", body: jsonBody({ apiKey: secret }) }, cookie);
      expect(connected.status).toBe(200);
      const payload = await connected.json() as Record<string, unknown>;
      expect(JSON.stringify(payload)).not.toContain(secret);
      expect(payload).toMatchObject({ connection: { provider: "nvidia-nim", enabled: true, secretConfigured: true }, modelsDiscovered: 2 });
      const stored = await prisma.provider.findFirstOrThrow({ where: { providerKey: "nvidia-nim", user: { email: `nvidia-${suffix}@example.test` } } });
      expect(stored.apiKey).toMatch(/^v2:/);
      expect(stored.apiKey).not.toContain(secret);
      const listed = await request("/providers", {}, cookie);
      const listedText = await listed.text();
      expect(listedText).not.toContain(secret);
      expect(JSON.parse(listedText)).toMatchObject({ providers: expect.arrayContaining([expect.objectContaining({ providerKey: "nvidia-nim", secretConfigured: true, modelsCount: 2 })]) });
    } finally {
      upstream.mockRestore();
    }
  });

  it("does not save an OpenRouter key rejected by the upstream provider", { timeout: 20_000 }, async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const registered = await request("/auth/register", { method: "POST", body: jsonBody({ email: `router-${suffix}@example.test`, password: "Provider-password-123!" }) });
    const cookie = registered.headers.get("set-cookie")?.split(";")[0] || "";
    const originalFetch = globalThis.fetch;
    const upstream = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith("https://openrouter.ai/api/v1")) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
      return originalFetch(input, init);
    });
    try {
      const rejected = await request("/providers/openrouter/connect", { method: "POST", body: jsonBody({ apiKey: "sk-or-rejected-test-key" }) }, cookie);
      expect(rejected.status).toBe(401);
      await expect(rejected.json()).resolves.toMatchObject({ code: "PROVIDER_AUTH_FAILED" });
      const stored = await prisma.provider.findFirstOrThrow({ where: { providerKey: "openrouter", user: { email: `router-${suffix}@example.test` } } });
      expect(stored.apiKey).toBeNull();
      expect(stored.active).toBe(false);
    } finally {
      upstream.mockRestore();
    }
  });

  it("rejects a provider access from another account", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const first = await request("/auth/register", { method: "POST", body: jsonBody({ email: `owner-${suffix}@example.test`, password: "Owner-password-123!" }) });
    const firstCookie = first.headers.get("set-cookie")?.split(";")[0] || "";
    const created = await request("/providers", { method: "POST", body: jsonBody({ type: "custom", name: "Owned provider", baseUrl: "http://127.0.0.1:1/v1" }) }, firstCookie);
    const provider = await created.json() as { provider: { id: string } };
    const second = await request("/auth/register", { method: "POST", body: jsonBody({ email: `other-${suffix}@example.test`, password: "Other-password-123!" }) });
    const secondCookie = second.headers.get("set-cookie")?.split(";")[0] || "";
    expect((await request(`/providers/${provider.provider.id}`, { method: "PATCH", body: jsonBody({ name: "stolen" }) }, secondCookie)).status).toBe(404);
  });

  it.skipIf(!googleConfigured)("links Google with one-time state, encrypted tokens, scoped Gmail/Drive access and isolated polling", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const ownerResponse = await request("/auth/register", { method: "POST", body: jsonBody({ email: `google-owner-${suffix}@example.test`, password: "Google-owner-123!", displayName: "Google Owner" }) });
    const ownerCookie = ownerResponse.headers.get("set-cookie")?.split(";")[0] || "";
    const otherResponse = await request("/auth/register", { method: "POST", body: jsonBody({ email: `google-other-${suffix}@example.test`, password: "Google-other-123!" }) });
    const otherCookie = otherResponse.headers.get("set-cookie")?.split(";")[0] || "";

    const startedResponse = await request("/integrations/google/start", { method: "POST", body: jsonBody({ returnTarget: "desktop" }) }, ownerCookie);
    expect(startedResponse.status).toBe(201);
    const started = await startedResponse.json() as { connectionId: string; authorizationUrl: string; expiresAt: string };
    const authorizationUrl = new URL(started.authorizationUrl);
    expect(authorizationUrl.origin).toBe("https://accounts.google.com");
    expect(authorizationUrl.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:4000/integrations/google/callback");
    expect(authorizationUrl.searchParams.get("scope")).toContain("gmail.readonly");
    expect(authorizationUrl.searchParams.get("scope")).toContain("drive.metadata.readonly");
    const state = authorizationUrl.searchParams.get("state") || "";
    expect(state.length).toBeGreaterThan(20);
    const link = await prisma.oAuthLinkSession.findUnique({ where: { connectionId: started.connectionId } });
    expect(link?.stateHash).not.toBe(state);
    expect(link?.returnTarget).toBe("desktop");
    expect((await request(`/integrations/google/status?connectionId=${started.connectionId}`, {}, otherCookie)).status).toBe(404);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const target = String(input);
      if (target === "https://oauth2.googleapis.com/token") {
        const form = init?.body as URLSearchParams;
        if (form.get("grant_type") === "refresh_token") return new Response(JSON.stringify({ access_token: "refreshed-access-token", expires_in: 3600, scope: GOOGLE_INITIAL_SCOPES.join(" ") }), { status: 200, headers: { "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ access_token: "google-access-token", refresh_token: "google-refresh-token", expires_in: 3600, scope: GOOGLE_INITIAL_SCOPES.join(" ") }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (target === "https://openidconnect.googleapis.com/v1/userinfo") return new Response(JSON.stringify({ sub: `google-${suffix}`, email: `workspace-${suffix}@example.test`, name: "Workspace User", picture: "https://example.test/avatar.png" }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (target.startsWith("https://gmail.googleapis.com/gmail/v1/users/me/messages?")) return new Response(JSON.stringify({ messages: [{ id: "gmail-message-1" }], resultSizeEstimate: 1 }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (target.includes("/gmail/v1/users/me/messages/gmail-message-1")) return new Response(JSON.stringify({ id: "gmail-message-1", threadId: "gmail-thread-1", labelIds: ["INBOX", "UNREAD"], snippet: "Aegis Gmail preview", payload: { headers: [{ name: "From", value: "Sender <sender@example.test>" }, { name: "Subject", value: "Google integration test" }, { name: "Date", value: "Mon, 20 Jul 2026 10:00:00 +0200" }] } }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (target.startsWith("https://www.googleapis.com/drive/v3/files?")) return new Response(JSON.stringify({ files: [{ id: "drive-file-1", name: "Aegis brief.pdf", mimeType: "application/pdf", modifiedTime: "2026-07-20T08:00:00.000Z", size: "2048", owners: [{ displayName: "Workspace User" }], webViewLink: "https://drive.google.com/file/d/drive-file-1/view" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (target.startsWith("https://oauth2.googleapis.com/revoke?")) return new Response("", { status: 200 });
      return originalFetch(input, init);
    };
    try {
      const callback = await request(`/integrations/google/callback?code=authorization-code&state=${encodeURIComponent(state)}`, { redirect: "manual" });
      expect(callback.status).toBe(302);
      expect(callback.headers.get("location")).toBe("http://127.0.0.1:3000/connections?provider=google&status=connected");
      const repeated = await request(`/integrations/google/callback?code=reused-code&state=${encodeURIComponent(state)}`, { redirect: "manual" });
      expect(repeated.status).toBe(302);
      expect(repeated.headers.get("location")).toContain("status=error");

      const completed = await request(`/integrations/google/status?connectionId=${started.connectionId}`, {}, ownerCookie);
      await expect(completed.json()).resolves.toMatchObject({ status: "completed" });
      const integrationResponse = await request("/integrations/google", {}, ownerCookie);
      const integrationPayload = await integrationResponse.json() as { integration: { configured: boolean; status: string; account: { email: string }; services: { gmail: { available: boolean }; drive: { available: boolean; contentAvailable: boolean } } } };
      expect(integrationPayload.integration).toMatchObject({ configured: true, status: "connected", account: { email: `workspace-${suffix}@example.test` }, services: { gmail: { available: true }, drive: { available: true, contentAvailable: false } } });
      expect(JSON.stringify(integrationPayload)).not.toContain(process.env.GOOGLE_CLIENT_SECRET || "never-match");
      expect(JSON.stringify(integrationPayload)).not.toContain("google-access-token");
      const stored = await prisma.integrationAccount.findFirst({ where: { providerAccountId: `google-${suffix}` } });
      expect(stored?.accessTokenEncrypted).toMatch(/^v1:/);
      expect(stored?.accessTokenEncrypted).not.toContain("google-access-token");
      expect(stored?.refreshTokenEncrypted).not.toContain("google-refresh-token");

      await prisma.integrationAccount.update({ where: { id: stored?.id || "missing" }, data: { tokenExpiresAt: new Date(Date.now() - 1000) } });
      const gmail = await request("/integrations/google/gmail/messages?maxResults=5", {}, ownerCookie);
      expect(gmail.status).toBe(200);
      await expect(gmail.json()).resolves.toMatchObject({ messages: [{ id: "gmail-message-1", subject: "Google integration test", unread: true }] });
      expect((await prisma.integrationAccount.findUnique({ where: { id: stored?.id || "missing" } }))?.accessTokenEncrypted).not.toContain("refreshed-access-token");
      const drive = await request("/integrations/google/drive/files?pageSize=5", {}, ownerCookie);
      expect(drive.status).toBe(200);
      await expect(drive.json()).resolves.toMatchObject({ contentAvailable: false, permissionMessage: "Additional Google Drive permission required.", files: [{ id: "drive-file-1", name: "Aegis brief.pdf" }] });

      const diagnostics = await request("/integrations/google/diagnostics", {}, ownerCookie);
      const diagnosticPayload = await diagnostics.json() as Record<string, unknown>;
      expect(diagnosticPayload).toMatchObject({ googleOAuthConfigured: true, googleClientIdLoaded: true, googleClientSecretLoaded: true, googleConnectionActive: true, gmailPermissionAvailable: true, drivePermissionAvailable: true, tokenRefreshAvailable: true });
      expect(JSON.stringify(diagnosticPayload)).not.toContain(process.env.GOOGLE_CLIENT_SECRET || "never-match");

      const disconnected = await request("/integrations/google/disconnect", { method: "POST" }, ownerCookie);
      expect(disconnected.status).toBe(200);
      await expect(disconnected.json()).resolves.toMatchObject({ ok: true, revoked: true });
      const cleared = await prisma.integrationAccount.findUnique({ where: { id: stored?.id || "missing" } });
      expect(cleared).toMatchObject({ status: "disconnected", accessTokenEncrypted: null, refreshTokenEncrypted: null, grantedScopes: "[]" });
      expect(await prisma.integrationPermission.count({ where: { accountId: stored?.id, status: "granted" } })).toBe(0);
      expect(await prisma.integrationAuditEvent.count({ where: { accountId: stored?.id, provider: "google" } })).toBeGreaterThanOrEqual(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it.skipIf(!googleConfigured)("expires stale Google OAuth sessions and rejects invalid callback state", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const registered = await request("/auth/register", { method: "POST", body: jsonBody({ email: `google-expired-${suffix}@example.test`, password: "Google-expired-123!" }) });
    const cookie = registered.headers.get("set-cookie")?.split(";")[0] || "";
    const started = await (await request("/integrations/google/start", { method: "POST", body: jsonBody({}) }, cookie)).json() as { connectionId: string };
    await prisma.oAuthLinkSession.update({ where: { connectionId: started.connectionId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const status = await request(`/integrations/google/status?connectionId=${started.connectionId}`, {}, cookie);
    await expect(status.json()).resolves.toMatchObject({ status: "expired", errorCode: "OAUTH_SESSION_EXPIRED" });
    const invalid = await request("/integrations/google/callback?code=code&state=invalid-state", { redirect: "manual" });
    expect(invalid.status).toBe(302);
    expect(invalid.headers.get("location")).toContain("reason=oauth_failed");
  });

  it("streams named SSE events and stores the completed assistant message once", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const registered = await request("/auth/register", { method: "POST", body: jsonBody({ email: `stream-${suffix}@example.test`, password: "Stream-password-123!" }) });
    const cookie = registered.headers.get("set-cookie")?.split(";")[0] || "";
    const created = await request("/providers", { method: "POST", body: jsonBody({ type: "custom", name: "Stream provider", baseUrl: "http://mock-provider.test/v1" }) }, cookie);
    const provider = await created.json() as { provider: { id: string } };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      if (String(input).startsWith("http://mock-provider.test")) return new Response("data: {\"choices\":[{\"delta\":{\"content\":\"Hello\"}}]}\n\ndata: {\"choices\":[{\"delta\":{\"content\":\" world\"}}]}\n\ndata: [DONE]\n\n", { status: 200, headers: { "Content-Type": "text/event-stream" } });
      return originalFetch(input, init);
    };
    try {
      const response = await request("/chat/stream", { method: "POST", body: jsonBody({ providerId: provider.provider.id, model: "stream-model", messages: [{ role: "user", content: "Hi" }] }) }, cookie);
      const text = await response.text();
      expect(response.status).toBe(200);
      expect(text).toContain("event: message.started");
      expect(text).toContain('event: message.delta');
      expect(text).toContain('"delta":"Hello"');
      expect(text).toContain("event: message.completed");
      const conversations = await request("/conversations", {}, cookie);
      const data = await conversations.json() as { conversations: Array<{ id: string }> };
      expect(data.conversations.length).toBeGreaterThan(0);
      const latestId = data.conversations[0].id;
      const msgs = await request(`/conversations/${latestId}/messages`, {}, cookie);
      const msgData = await msgs.json() as { messages: Array<{ role: string; content: string }> };
      expect(msgData.messages.filter((m) => m.role === "assistant")).toHaveLength(1);
      expect(msgData.messages.some((m) => m.content === "Hello world")).toBe(true);
    } finally { globalThis.fetch = originalFetch; }
  });

  it("resumes a partially received generation after the client stream is closed", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const registered = await request("/auth/register", { method: "POST", body: jsonBody({ email: `refresh-${suffix}@example.test`, password: "Refresh-password-123!" }) });
    const cookie = registered.headers.get("set-cookie")?.split(";")[0] || "";
    const created = await request("/providers", { method: "POST", body: jsonBody({ type: "custom", name: "Refresh provider", baseUrl: "http://refresh-provider.test/v1" }) }, cookie);
    const provider = await created.json() as { provider: { id: string } };
    const originalFetch = globalThis.fetch;
    const encoder = new TextEncoder();
    globalThis.fetch = async (input, init) => {
      if (!String(input).startsWith("http://refresh-provider.test")) return originalFetch(input, init);
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Partial"}}]}\n\n'));
          setTimeout(() => controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":" answer"}}]}\n\n')), 250);
          setTimeout(() => { controller.enqueue(encoder.encode("data: [DONE]\n\n")); controller.close(); }, 350);
        },
      });
      return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
    };
    try {
      const clientMessageId = randomUUID();
      const first = await request("/chat/stream", { method: "POST", body: jsonBody({ clientMessageId, idempotencyKey: clientMessageId, providerId: provider.provider.id, model: "refresh-model", messages: [{ role: "user", content: "Refresh while generating" }] }) }, cookie);
      expect(first.status).toBe(200);
      const reader = first.body?.getReader();
      expect(reader).toBeDefined();
      const decoder = new TextDecoder();
      let partialEvents = "";
      while (!partialEvents.includes('"delta":"Partial"')) {
        const chunk = await reader!.read();
        if (chunk.done) break;
        partialEvents += decoder.decode(chunk.value, { stream: true });
      }
      const conversationId = /"conversationId":"([^\"]+)"/.exec(partialEvents)?.[1] || "";
      expect(partialEvents).toContain('"delta":"Partial"');
      expect(conversationId).not.toBe("");
      await reader!.cancel();
      const resumed = await request("/chat/resume", { method: "POST", body: jsonBody({ conversationId, clientMessageId }) }, cookie);
      const resumedText = await resumed.text();
      expect(resumed.status).toBe(200);
      expect(resumedText).toContain("Partial");
      expect(resumedText).toContain("answer");
      expect(resumedText).toContain("event: message.completed");
    } finally { globalThis.fetch = originalFetch; }
  }, 15000);

  it("keeps the partial answer on a mid-stream drop and continues into the SAME message via /chat/continue", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const registered = await request("/auth/register", { method: "POST", body: jsonBody({ email: `cut-${suffix}@example.test`, password: "Cut-password-123!" }) });
    const cookie = registered.headers.get("set-cookie")?.split(";")[0] || "";
    const created = await request("/providers", { method: "POST", body: jsonBody({ type: "custom", name: "Cut provider", baseUrl: "http://cut-provider.test/v1" }) }, cookie);
    const provider = await created.json() as { provider: { id: string } };
    const originalFetch = globalThis.fetch;
    const encoder = new TextEncoder();
    let calls = 0;
    globalThis.fetch = async (input, init) => {
      if (!String(input).startsWith("http://cut-provider.test")) return originalFetch(input, init);
      calls += 1;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          // Calls 1 (stream) and 2 (auto-resume): send a delta, then cut the
          // connection mid-stream so the partial answer is preserved.
          if (calls <= 2) {
            controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Partial"}}]}\n\n'));
            setTimeout(() => controller.error(new Error("mid-stream connection reset")), 150);
            return;
          }
          // Continuation call: finish normally.
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":" continued"}}]}\n\n'));
          setTimeout(() => { controller.enqueue(encoder.encode("data: [DONE]\n\n")); controller.close(); }, 150);
        },
      });
      return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
    };
    try {
      const clientMessageId = randomUUID();
      const first = await request("/chat/stream", { method: "POST", body: jsonBody({ clientMessageId, idempotencyKey: clientMessageId, providerId: provider.provider.id, model: "cut-model", messages: [{ role: "user", content: "Interrupt me" }] }) }, cookie);
      expect(first.status).toBe(200);
      const firstText = await first.text();
      const conversationId = /"conversationId":"([^"]+)"/.exec(firstText)?.[1] || "";
      const interruptedMessageId = /"messageId":"([^"]+)"/.exec(firstText)?.[1] || "";
      expect(conversationId).not.toBe("");
      expect(interruptedMessageId).not.toBe("");
      // The partial response is preserved and the message is marked interrupted
      // (the failed auto-resume appended one more "Partial").
      expect(firstText).toContain("Partial");
      expect(firstText).toContain("event: message.interrupted");
      const stored = await prisma.message.findUnique({ where: { id: interruptedMessageId } });
      expect(stored).toMatchObject({ status: "interrupted", content: "PartialPartial" });
      // Continue: streams into the SAME message and completes it.
      const continued = await request("/chat/continue", { method: "POST", body: jsonBody({ conversationId, messageId: interruptedMessageId, providerId: provider.provider.id, model: "cut-model" }) }, cookie);
      const continuedText = await continued.text();
      expect(continued.status).toBe(200);
      expect(continuedText).toContain("event: message.completed");
      const final = await prisma.message.findUnique({ where: { id: interruptedMessageId } });
      expect(final).toMatchObject({ status: "completed", content: "PartialPartial continued" });
      const assistantCount = await prisma.message.count({ where: { conversationId, role: "assistant" } });
      expect(assistantCount).toBe(1);
} finally { globalThis.fetch = originalFetch; }
  }, 15000);

  it("deduplicates a first-message submission and preserves its selected provider", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const registered = await request("/auth/register", { method: "POST", body: jsonBody({ email: `first-${suffix}@example.test`, password: "First-message-123!" }) });
    const cookie = registered.headers.get("set-cookie")?.split(";")[0] || "";
    const created = await request("/providers", { method: "POST", body: jsonBody({ type: "custom", name: "Immediate model", baseUrl: "http://first-message.test/v1" }) }, cookie);
    const provider = await created.json() as { provider: { id: string } };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => String(input).startsWith("http://first-message.test") ? new Response('data: {"choices":[{"delta":{"content":"Ready"}}]}\n\ndata: [DONE]\n\n', { status: 200 }) : originalFetch(input, init);
    try {
      const clientMessageId = randomUUID();
      const first = await request("/chat/stream", { method: "POST", body: jsonBody({ clientMessageId, idempotencyKey: clientMessageId, providerId: provider.provider.id, model: "chosen-model", messages: [{ role: "user", content: "Immediate prompt" }] }) }, cookie);
      const firstText = await first.text();
      const conversationId = /"conversationId":"([^"]+)"/.exec(firstText)?.[1] || "";
      expect(conversationId).not.toBe("");
      const second = await request("/chat/stream", { method: "POST", body: jsonBody({ conversationId, clientMessageId, idempotencyKey: clientMessageId, providerId: provider.provider.id, model: "chosen-model", messages: [{ role: "user", content: "Immediate prompt" }] }) }, cookie);
      expect(second.status).toBe(200); await second.text();
      expect(await prisma.message.count({ where: { id: clientMessageId, conversationId } })).toBe(1);
      expect(await prisma.conversation.findUnique({ where: { id: conversationId } })).toMatchObject({ providerId: provider.provider.id, model: "chosen-model" });
    } finally { globalThis.fetch = originalFetch; }
  }, 15000);

  it("creates real projects and validates text attachments", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const registered = await request("/auth/register", { method: "POST", body: jsonBody({ email: `project-${suffix}@example.test`, password: "Project-password-123!" }) });
    const cookie = registered.headers.get("set-cookie")?.split(";")[0] || "";
    const project = await request("/projects", { method: "POST", body: jsonBody({ name: "Aegis release", description: "Stabilization" }) }, cookie);
    expect(project.status).toBe(201); expect(await request("/projects", {}, cookie).then((response)=>response.json())).toMatchObject({ projects: [expect.objectContaining({ name: "Aegis release" })] });
    const text = Buffer.from("Attachment content");
    const uploaded = await request("/attachments", { method: "POST", body: jsonBody({ name: "notes.txt", mimeType: "text/plain", size: text.length, dataBase64: text.toString("base64") }) }, cookie);
    expect(uploaded.status).toBe(201);const attachment=await uploaded.json() as {attachment:{id:string}};
    const extracted=await request(`/attachments/${attachment.attachment.id}/extract`,{method:"POST"},cookie);expect(await extracted.json()).toMatchObject({text:"Attachment content"});
  });

  it("runs a provider diagnostic that never leaks the API key and detects an expired key", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const registered = await request("/auth/register", { method: "POST", body: jsonBody({ email: `diag-${suffix}@example.test`, password: "Diag-password-123!" }) });
    const cookie = registered.headers.get("set-cookie")?.split(";")[0] || "";
    const secret = `diag-secret-${suffix}`;
    const created = await request("/providers", { method: "POST", body: jsonBody({ type: "custom", name: "Diag provider", baseUrl: "http://diag-provider.test/v1", apiKey: secret, defaultModel: "diag-model" }) }, cookie);
    const provider = await created.json() as { provider: { id: string } };
    const originalFetch = globalThis.fetch;
    let modelsStatus = 200;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (!url.startsWith("http://diag-provider.test")) return originalFetch(input, init);
      if (url.endsWith("/models")) {
        if (modelsStatus === 401) return new Response(JSON.stringify({ error: { message: "Your API key expired on 2026-08-13.", type: "invalid_request_error" } }), { status: 401, headers: { "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ data: [{ id: "diag-model" }, { id: "diag-alt" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.endsWith("/chat/completions")) return new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
      return originalFetch(input, init);
    };
    try {
      const healthy = await request(`/providers/${provider.provider.id}/diagnose`, { method: "POST", body: jsonBody({ model: "diag-model" }) }, cookie);
      expect(healthy.status).toBe(200);
      const body = await healthy.json() as Record<string, unknown>;
      expect(body.overall).toBe("ok");
      expect(body.keyStatus).toBe("configured");
      expect(body.sampleModels).toEqual(expect.arrayContaining(["diag-model", "diag-alt"]));
      expect(body.checks).toEqual(expect.arrayContaining([expect.objectContaining({ name: "models", ok: true }), expect.objectContaining({ name: "chat-probe", ok: true })]));
      expect(JSON.stringify(body)).not.toContain(secret);

      modelsStatus = 401;
      const expired = await request(`/providers/${provider.provider.id}/diagnose`, { method: "POST", body: jsonBody({ model: "diag-model" }) }, cookie);
      expect(expired.status).toBe(200);
      const expiredBody = await expired.json() as Record<string, unknown>;
      expect(expiredBody.overall).toBe("auth");
      expect(expiredBody.keyStatus).toBe("expired");
      expect(String(expiredBody.summary)).toContain("expiré");
      expect(JSON.stringify(expiredBody)).not.toContain(secret);
    } finally { globalThis.fetch = originalFetch; }
  });

  it("routes a foreign model to its owning provider and falls back to the provider default", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const registered = await request("/auth/register", { method: "POST", body: jsonBody({ email: `guard-${suffix}@example.test`, password: "Guard-password-123!" }) });
    const cookie = registered.headers.get("set-cookie")?.split(";")[0] || "";
    const createdA = await request("/providers", { method: "POST", body: jsonBody({ type: "mistral", name: "Mistral A", baseUrl: "http://guard-a.test/v1", apiKey: "sk-guard-a", defaultModel: "mistral-medium-2505" }) }, cookie);
    const providerA = await createdA.json() as { provider: { id: string } };
    const createdB = await request("/providers", { method: "POST", body: jsonBody({ type: "custom", name: "Custom B", baseUrl: "http://guard-b.test/v1", apiKey: "sk-guard-b", defaultModel: "glm-5-2" }) }, cookie);
    const providerB = await createdB.json() as { provider: { id: string } };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.startsWith("http://guard-a.test")) {
        if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "mistral-medium-2505" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
        if (url.endsWith("/chat/completions")) return new Response('data: {"choices":[{"delta":{"content":"From A"}}]}\n\ndata: [DONE]\n\n', { status: 200, headers: { "Content-Type": "text/event-stream" } });
      }
      if (url.startsWith("http://guard-b.test")) {
        if (url.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "glm-5-2" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
        if (url.endsWith("/chat/completions")) return new Response('data: {"choices":[{"delta":{"content":"From B"}}]}\n\ndata: [DONE]\n\n', { status: 200, headers: { "Content-Type": "text/event-stream" } });
      }
      return originalFetch(input, init);
    };
    try {
      expect((await request(`/providers/${providerA.provider.id}/models`, {}, cookie)).status).toBe(200);
      expect((await request(`/providers/${providerB.provider.id}/models`, {}, cookie)).status).toBe(200);

      // glm-5-2 is only known to provider B: the request on A is re-routed to B.
      const rerouted = await request("/chat/stream", { method: "POST", body: jsonBody({ providerId: providerA.provider.id, model: "glm-5-2", messages: [{ role: "user", content: "Use glm" }] }) }, cookie);
      const reroutedText = await rerouted.text();
      expect(rerouted.status).toBe(200);
      expect(reroutedText).toContain('"kind":"model-unavailable"');
      expect(reroutedText).toContain("appartient à");
      const reroutedConversationId = /"conversationId":"([^"]+)"/.exec(reroutedText)?.[1] || "";
      expect(reroutedConversationId).not.toBe("");
      const reroutedRow = await prisma.conversation.findUnique({ where: { id: reroutedConversationId } });
      expect(reroutedRow).toMatchObject({ providerId: providerB.provider.id, model: "glm-5-2" });

      // An unknown model on A falls back to its default model with a notice.
      const fallback = await request("/chat/stream", { method: "POST", body: jsonBody({ providerId: providerA.provider.id, model: "unknown-model", messages: [{ role: "user", content: "Use fallback" }] }) }, cookie);
      const fallbackText = await fallback.text();
      expect(fallback.status).toBe(200);
      expect(fallbackText).toContain('"kind":"model-unavailable"');
      expect(fallbackText).toContain("n'est pas disponible sur");
      const fallbackConversationId = /"conversationId":"([^"]+)"/.exec(fallbackText)?.[1] || "";
      const fallbackRow = await prisma.conversation.findUnique({ where: { id: fallbackConversationId } });
      expect(fallbackRow).toMatchObject({ providerId: providerA.provider.id, model: "mistral-medium-2505" });
    } finally { globalThis.fetch = originalFetch; }
  }, 15000);
});

