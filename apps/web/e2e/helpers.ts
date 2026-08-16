import type { Page, Route } from "@playwright/test";

const testUser = { id: "u1", email: "design@aegis.local", displayName: "Aegis Studio", emailVerified: true, preferences: {} };
const models = { models: [
  { id: "llama-3.2", providerId: "ollama", name: "Llama 3.2", type: "chat", active: true, providerName: "Ollama", providerKind: "ollama", local: true, favorite: true, visible: true, available: true, contextLength: 131072, capabilities: ["chat", "tools"] },
  { id: "deepseek-r1", providerId: "nvidia", name: "DeepSeek R1", type: "chat", active: true, providerName: "NVIDIA", providerKind: "nvidia-nim", local: false, favorite: false, visible: true, available: true, contextLength: 128000, capabilities: ["reasoning", "tools"] },
] };
const providers = { providers: [
  { id: "ollama", providerKey: "ollama", kind: "ollama", name: "Ollama", baseUrl: "http://127.0.0.1:11434", active: true, hasApiKey: false, defaultModel: "llama-3.2" },
  { id: "nvidia", providerKey: "nvidia-nim", kind: "nvidia-nim", name: "NVIDIA", baseUrl: "https://integrate.api.nvidia.com/v1", active: true, hasApiKey: true, maskedApiKey: "nv••••••01", defaultModel: "deepseek-r1" },
] };
const conversations = { conversations: [{ id: "conv-1", title: "Launch narrative", providerId: "nvidia", model: "deepseek-r1", createdAt: "2026-07-20T10:00:00Z", updatedAt: "2026-07-22T10:00:00Z", messages: [{ id: "m1", role: "user", content: "Sharpen the positioning." }, { id: "m2", role: "assistant", content: "Lead with protected choice, not model count." }] }], hasMore: false };
const google = { integration: { provider: "google", configured: true, status: "connected", account: { id: "g1", email: "design@aegis.local", displayName: "Aegis Studio", status: "connected", createdAt: "2026-07-20", updatedAt: "2026-07-20" }, services: { gmail: { available: true, status: "connected" }, drive: { available: true, status: "connected", contentAvailable: true }, calendar: { available: false, status: "permission_required" }, contacts: { available: false, status: "permission_required" } }, grantedScopes: [] } };
const headers = { "content-type": "application/json", "access-control-allow-origin": "http://127.0.0.1:3000", "access-control-allow-credentials": "true", "access-control-allow-headers": "Content-Type, Accept", "access-control-allow-methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS" };

export type MockAuthState = "authenticated" | "anonymous" | "error";

export async function mockApi(page: Page, options: { auth?: MockAuthState } = {}) {
  const auth = options.auth ?? "authenticated";
  await page.route("http://127.0.0.1:4000/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (path === "/auth/me") {
      if (auth === "error") return route.abort("connectionrefused");
      if (auth === "anonymous") return route.fulfill({ status: 401, headers, body: JSON.stringify({ error: { code: "AUTH_REQUIRED", message: "Sign in required" } }) });
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ user: testUser }) });
    }
    if (path === "/auth/login" || path === "/auth/register") return route.fulfill({ status: 200, headers, body: JSON.stringify({ user: testUser }) });
    if (path === "/auth/logout") return route.fulfill({ status: 200, headers, body: JSON.stringify({ ok: true }) });

    let body: unknown = { ok: true };
    if (path === "/models" || path === "/models/refresh") body = models;
    else if (path === "/providers") body = providers;
    else if (path === "/conversations" && route.request().method() === "GET") body = conversations;
    else if (path === "/conversations" && route.request().method() === "POST") {
      // New conversation creation returns the created conversation
      const input = route.request().postDataJSON() as Record<string, unknown>;
      const createdConv = { id: `conv-${Date.now()}`, title: String(input.title || "New conversation"), providerId: String(input.providerId || ""), model: String(input.model || ""), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [] };
      return route.fulfill({ status: 201, headers, body: JSON.stringify({ conversation: createdConv }) });
    }
    else if (path === "/conversations/conv-1") body = { conversation: conversations.conversations[0] };
    else if (path === "/projects") body = { projects: [] };
    else if (path === "/integrations/google") body = google;
    else if (path.includes("/gmail/messages")) body = { messages: [], resultSizeEstimate: 0 };
    else if (path.includes("/drive/files")) body = { files: [], contentAvailable: true };
    else if (path === "/auth/sessions") body = { sessions: [{ id: "s1", current: true, deviceName: "Chrome on Windows", createdAt: "2026-07-20", lastSeenAt: "2026-07-22", expiresAt: "2026-08-22" }] };
    else if (path === "/chat/stream") return route.fulfill({ status: 200, headers: { ...headers, "content-type": "text/event-stream" }, body: "event: message.started\ndata: {\"conversationId\":\"conv-1\",\"providerId\":\"nvidia\",\"model\":\"deepseek-r1\"}\n\nevent: message.delta\ndata: {\"delta\":\"A protected, deliberate answer.\"}\n\nevent: message.completed\ndata: {\"conversationId\":\"conv-1\",\"messageId\":\"m3\"}\n\n" });
    return route.fulfill({ status: 200, headers, body: JSON.stringify(body) });
  });
}
