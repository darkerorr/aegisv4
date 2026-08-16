import type { ApiChatStreamEvent, ApiError, Attachment, ChatRequest, ChatResponse, ChatStreamEvent, Conversation, Model, Project, ProviderConfig, ProviderCreateInput, ProviderDiagnostic, ProviderId, User, WorkAgentEvent, WorkSession, WorkSessionCreateInput, WorkSessionPatchInput, WorkspaceEntry } from "@aegis/types";
import { DEFAULT_API_URL, normalizeApiUrl } from "./config.js";

export type ApiClientOptions = { baseUrl?: string; fetch?: typeof globalThis.fetch; credentials?: RequestCredentials; timeoutMs?: number; retries?: number; debug?: boolean };

export type GoogleServiceStatus = { available: boolean; status: "connected" | "permission_required"; contentAvailable?: boolean };
export type GoogleIntegration = {
  provider: "google";
  configured: boolean;
  status: "not_configured" | "disconnected" | "connected" | "reconnection_required" | "error";
  account: null | { id: string; email?: string | null; displayName?: string | null; avatarUrl?: string | null; status: string; tokenExpiresAt?: string | null; createdAt: string; updatedAt: string; lastUsedAt?: string | null };
  services: { gmail: GoogleServiceStatus; drive: GoogleServiceStatus; calendar: GoogleServiceStatus; contacts: GoogleServiceStatus };
  grantedScopes: string[];
};
export type GoogleOAuthStart = { connectionId: string; authorizationUrl: string; expiresAt: string };
export type GoogleOAuthStatus = { connectionId: string; status: "pending" | "processing" | "completed" | "error" | "expired" | "cancelled"; errorCode?: string | null; expiresAt: string };
export type GmailMessage = { id: string; threadId?: string; labels: string[]; unread: boolean; from: string; to: string; subject: string; date?: string | null; snippet: string; attachments: Array<{ filename: string; mimeType: string; size: number; attachmentId: string }>; bodyText?: string };
export type DriveFile = { id: string; name: string; mimeType?: string; modifiedTime?: string; size?: number | null; owners: Array<{ displayName?: string; emailAddress?: string }>; webViewLink?: string; iconLink?: string; thumbnailLink?: string; contentAvailable: boolean; permissionMessage?: string };
export type ProviderSummary = ProviderConfig & { providerKey: string; hasApiKey: boolean; secretConfigured: boolean; maskedApiKey?: string; modelsCount?: number };
export type CloudProviderKey = Extract<ProviderId, "nvidia-nim" | "openrouter" | "x-ai" | "anthropic" | "gemini" | "openai" | "mistral" | "groq" | "deepseek" | "qwen" | "meta" | "together" | "fireworks" | "perplexity" | "sambanova" | "hyperbolic" | "zhipu" | "moonshot" | "minimax" | "novita" | "huggingface">;
export type ProviderConnectResult = { connection: { id: string; provider: ProviderId; status: "connected"; enabled: boolean; secretConfigured: true }; modelsDiscovered: number; defaultModelId?: string; health: { ok: true; latencyMs?: number } };

export class AegisApiError extends Error {
  constructor(public readonly status: number, public readonly apiError: ApiError) {
    super(apiError.message);
    this.name = "AegisApiError";
  }
}

export class AegisApiClient {
  private baseUrl: string;
  private readonly requestFetch: typeof globalThis.fetch;
  private readonly credentials: RequestCredentials;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly debug: boolean;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = normalizeApiUrl(options.baseUrl, DEFAULT_API_URL);
    this.requestFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.credentials = options.credentials ?? "include";
    this.timeoutMs = options.timeoutMs ?? 12_000;
    this.retries = options.retries ?? 1;
    this.debug = options.debug ?? false;
  }

  setBaseUrl(value: string): void { this.baseUrl = normalizeApiUrl(value, DEFAULT_API_URL); }
  getBaseUrl(): string { return this.baseUrl; }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const method = (init.method ?? "GET").toUpperCase();
    const attempts = method === "GET" || method === "HEAD" ? this.retries + 1 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      const onAbort = () => controller.abort();
      init.signal?.addEventListener("abort", onAbort, { once: true });
      try {
        if (this.debug) console.debug(`[Aegis API] ${method} ${path}`);
        const response = await this.requestFetch(`${this.baseUrl}${path}`, {
          ...init, signal: controller.signal, credentials: this.credentials,
          headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
        });
        const data = await response.json().catch(() => ({})) as T | ApiError;
        if (!response.ok) {
          const apiError = typeof data === "object" && data !== null && "code" in data && "message" in data
            ? data as ApiError
            : { code: "HTTP_ERROR", message: `Request failed with ${response.status}.` };
          throw new AegisApiError(response.status, apiError);
        }
        return data as T;
      } catch (error) {
        if (error instanceof AegisApiError || init.signal?.aborted || attempt === attempts - 1) {
          if (error instanceof AegisApiError) throw error;
          const timedOut = controller.signal.aborted;
          throw new AegisApiError(0, {
            code: timedOut ? "API_TIMEOUT" : "API_UNREACHABLE",
            message: timedOut ? `Aegis API timed out at ${this.baseUrl}.` : `Unable to connect to Aegis API at ${this.baseUrl}.`,
            details: { baseUrl: this.baseUrl },
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      } finally {
        clearTimeout(timeout);
        init.signal?.removeEventListener("abort", onAbort);
      }
    }
    throw new Error("Unreachable API client state");
  }

  // Auth
  register(input: { email: string; password: string; displayName?: string }) {
    return this.request<{ user: User; emailVerificationRequired?: boolean; message?: string }>("/auth/register", { method: "POST", body: JSON.stringify(input) });
  }
  login(input: { email: string; password: string }) {
    return this.request<{ user: User }>("/auth/login", { method: "POST", body: JSON.stringify(input) });
  }
  logout() { return this.request<{ ok: boolean }>("/auth/logout", { method: "POST" }); }
  me(signal?: AbortSignal) { return this.request<{ user: User }>("/auth/me", { signal }); }
  refresh() { return this.request<{ user: User }>("/auth/refresh", { method: "POST" }); }
  verifyEmail(token: string) { return this.request<{ user: User; message?: string }>("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) }); }
  forgotPassword(email: string) { return this.request<{ message: string }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }); }
  resetPassword(token: string, password: string) { return this.request<{ message: string }>("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) }); }

  // Google Sign-In
  googleSignInStart() { return this.request<{ authorizationUrl: string; state: string }>("/auth/google/start", { method: "POST" }); }

  // Health
  health(signal?: AbortSignal) { return this.request<{ ok: boolean; status: string; service: string; version: string; timestamp: string }>("/health", { signal }); }
  ready(signal?: AbortSignal) { return this.request<{ ok: boolean; service: string; status: string; version: string; timestamp: string; db: string }>("/ready", { signal }); }

  // Providers
  listProviders() { return this.request<{ providers: ProviderSummary[] }>("/providers"); }
  createProvider(input: ProviderConfig | ProviderCreateInput) { return this.request<{ provider: ProviderConfig }>("/providers", { method: "POST", body: JSON.stringify(input) }); }
  updateProvider(id: string, input: Partial<ProviderConfig>) { return this.request<{ provider: ProviderConfig }>(`/providers/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }); }
  deleteProvider(id: string) { return this.request<{ ok: boolean }>(`/providers/${encodeURIComponent(id)}`, { method: "DELETE" }); }
  testProvider(id: string) { return this.request<{ ok: boolean; latencyMs?: number; message?: string }>(`/providers/${encodeURIComponent(id)}/test`, { method: "POST" }); }
  listProviderModels(id: string) { return this.request<{ models: Model[] }>(`/providers/${encodeURIComponent(id)}/models`); }
  diagnoseProvider(id: string, model?: string) { return this.request<ProviderDiagnostic>(`/providers/${encodeURIComponent(id)}/diagnose`, { method: "POST", body: JSON.stringify(model ? { model } : {}) }); }

  connectCloudProvider(provider: CloudProviderKey, input: { apiKey: string; displayName?: string; baseUrl?: string; timeoutMs?: number }) { return this.request<ProviderConnectResult>(`/providers/${provider}/connect`, { method: "POST", body: JSON.stringify(input) }); }
  testCloudProvider(provider: CloudProviderKey) { return this.request<{ ok: true; latencyMs?: number; message: string }>(`/providers/${provider}/test`, { method: "POST" }); }
  refreshCloudProviderModels(provider: CloudProviderKey) { return this.request<{ modelsDiscovered: number; models: Model[] }>(`/providers/${provider}/refresh-models`, { method: "POST" }); }
  disconnectCloudProvider(provider: CloudProviderKey) { return this.request<{ ok: true; provider: ProviderId; secretConfigured: false }>(`/providers/${provider}`, { method: "DELETE" }); }

  // Compatibility methods delegate to the canonical provider routes.
  connectNvidia(apiKey: string, displayName?: string) { return this.connectCloudProvider("nvidia-nim", { apiKey, displayName }); }
  testNvidia() { return this.testCloudProvider("nvidia-nim"); }
  disconnectNvidia() { return this.disconnectCloudProvider("nvidia-nim"); }
  connectOpenRouter(apiKey: string, displayName?: string) { return this.connectCloudProvider("openrouter", { apiKey, displayName }); }
  connectXAI(apiKey: string, displayName?: string) { return this.connectCloudProvider("x-ai", { apiKey, displayName }); }
  testXAI() { return this.testCloudProvider("x-ai"); }
  disconnectXAI() { return this.disconnectCloudProvider("x-ai"); }

  // Models
  listModels() { return this.request<{ models: Model[] }>("/models"); }
  listModelsRefresh() { return this.request<{ models: Model[]; refreshedAt: string }>("/models/refresh", { method: "POST" }); }
  updateModel(id: string, input: { favorite?: boolean; visible?: boolean; active?: boolean; defaultForProvider?: boolean }) {
    return this.request<{ model: Model }>(`/models/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
  }

  // Chat
  chat(input: ChatRequest) { return this.request<ChatResponse>("/chat", { method: "POST", body: JSON.stringify(input) }); }

  /** POST an SSE endpoint, read the streamed named events and yield them raw. */
  private async *postSse(path: string, input: unknown, signal?: AbortSignal): AsyncGenerator<{ eventName: string; data: Record<string, unknown> }> {
    let response: Response;
    try {
      response = await this.requestFetch(`${this.baseUrl}${path}`, {
        method: "POST", credentials: this.credentials, signal,
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(input),
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new AegisApiError(0, { code: "API_UNREACHABLE", message: `Unable to connect to Aegis API at ${this.baseUrl}.`, details: { baseUrl: this.baseUrl } });
    }
    if (!response.ok) { const data = await response.json().catch(() => ({})) as ApiError; throw new AegisApiError(response.status, data.code ? data : { code: "HTTP_ERROR", message: `Request failed with ${response.status}.` }); }
    if (!response.body) throw new Error("The API returned an empty stream.");
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read(); buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split(/\r?\n/); buffer = lines.pop() ?? "";
        let eventName = "message.delta";
        for (const line of lines) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          yield { eventName, data: JSON.parse(payload) as Record<string, unknown> };
        }
        if (done) break;
      }
    } finally { reader.releaseLock(); }
  }

  /** Map a raw SSE chat event onto the typed ApiChatStreamEvent union. */
  private mapChatEvent(eventName: string, data: Record<string, unknown>): ApiChatStreamEvent | null {
    const statuses = ["provider-active", "model-reasoning", "persisting", "writing-answer", "provider-waiting", "streaming"];
    if (eventName === "message.delta") return { type: eventName, delta: String(data.delta ?? "") };
    if (eventName === "message.reasoning") return { type: eventName, delta: String(data.delta ?? "") };
    if (eventName === "message.started") return { type: eventName, conversationId: String(data.conversationId), providerId: String(data.providerId), model: String(data.model), requestId: data.requestId ? String(data.requestId) : undefined, generationId: data.generationId ? String(data.generationId) : undefined, messageId: data.messageId ? String(data.messageId) : undefined };
    if (eventName === "generation.status") return { type: eventName, status: statuses.includes(String(data.status)) ? String(data.status) as "provider-active" | "model-reasoning" | "persisting" | "writing-answer" | "provider-waiting" | "streaming" : "streaming", elapsedMs: typeof data.elapsedMs === "number" ? data.elapsedMs : undefined, message: data.message ? String(data.message) : undefined, retryInMs: typeof data.retryInMs === "number" ? data.retryInMs : undefined };
    if (eventName === "message.notice") return { type: eventName, kind: (["provider-limited", "provider-fallback", "info"].includes(String(data.kind)) ? String(data.kind) : "info") as "provider-limited" | "provider-fallback" | "info", message: String(data.message ?? ""), providerId: data.providerId ? String(data.providerId) : undefined, model: data.model ? String(data.model) : undefined, retryInMs: typeof data.retryInMs === "number" ? data.retryInMs : undefined };
    if (eventName === "message.interrupted") return { type: eventName, messageId: String(data.messageId), content: String(data.content ?? ""), reasoning: data.reasoning ? String(data.reasoning) : undefined, generationId: data.generationId ? String(data.generationId) : undefined, canResume: data.canResume !== false };
    if (eventName === "message.resync") return { type: eventName, content: String(data.content ?? ""), reasoning: data.reasoning ? String(data.reasoning) : undefined, status: String(data.status ?? "streaming") as "streaming" | "completed" | "error" | "cancelled", messageId: data.messageId ? String(data.messageId) : undefined, generationId: data.generationId ? String(data.generationId) : undefined, error: data.error ? data.error as ApiError : undefined };
    if (eventName === "message.completed") return { type: eventName, conversationId: String(data.conversationId), messageId: String(data.messageId) };
    if (eventName === "message.error") return { type: eventName, error: data as unknown as ApiError };
    if (eventName === "tool.requested") return { type: eventName, tool: String(data.tool), label: data.label ? String(data.label) : undefined, query: data.query ? String(data.query) : undefined, activityId: data.activityId ? String(data.activityId) : undefined, url: data.url ? String(data.url) : undefined, title: data.title ? String(data.title) : undefined, domain: data.domain ? String(data.domain) : undefined, site: data.site ? String(data.site) : undefined };
    if (eventName === "tool.started") return { type: eventName, tool: String(data.tool), label: data.label ? String(data.label) : undefined, query: data.query ? String(data.query) : undefined, activityId: data.activityId ? String(data.activityId) : undefined, url: data.url ? String(data.url) : undefined, title: data.title ? String(data.title) : undefined, domain: data.domain ? String(data.domain) : undefined, site: data.site ? String(data.site) : undefined };
    if (eventName === "tool.completed") return { type: eventName, tool: String(data.tool), sourceCount: Number(data.sourceCount || 0), label: data.label ? String(data.label) : undefined, query: data.query ? String(data.query) : undefined, activityId: data.activityId ? String(data.activityId) : undefined, url: data.url ? String(data.url) : undefined, title: data.title ? String(data.title) : undefined, domain: data.domain ? String(data.domain) : undefined, site: data.site ? String(data.site) : undefined };
    if (eventName === "tool.failed") return { type: eventName, tool: String(data.tool), code: String(data.code), label: data.label ? String(data.label) : undefined, query: data.query ? String(data.query) : undefined, activityId: data.activityId ? String(data.activityId) : undefined, url: data.url ? String(data.url) : undefined, title: data.title ? String(data.title) : undefined, domain: data.domain ? String(data.domain) : undefined, site: data.site ? String(data.site) : undefined };
    if (eventName === "web.results") return { type: eventName, query: String(data.query ?? ""), results: (Array.isArray(data.results) ? data.results : []).map((raw) => { const item = raw as Record<string, unknown>; return { title: String(item.title ?? ""), url: String(item.url ?? ""), snippet: String(item.snippet ?? ""), publishedAt: item.publishedAt ? String(item.publishedAt) : undefined, source: item.source ? String(item.source) : undefined, rank: Number(item.rank ?? 0), site: item.site ? String(item.site) : undefined, domain: item.domain ? String(item.domain) : undefined, score: typeof item.score === "number" ? item.score : undefined, sourceType: item.sourceType ? String(item.sourceType) as "official" | "primary" | "technical" | "news" | "community" | "other" : undefined }; }) };
    return null;
  }

  /** Re-attach to a generation that is still running on the API after a page
   * refresh or a dropped connection. Replays the content persisted so far via
   * `message.resync`, then keeps streaming deltas until completion. */
  async *resumeChat(input: { conversationId: string; clientMessageId?: string }, signal?: AbortSignal): AsyncIterable<ApiChatStreamEvent> {
    for await (const { eventName, data } of this.postSse("/chat/resume", input, signal)) {
      const event = this.mapChatEvent(eventName, data);
      if (event) yield event;
    }
  }

  /** Stream a new generation, mirroring the named SSE events to the UI. */
  async *streamChat(input: ChatRequest, signal?: AbortSignal): AsyncIterable<ApiChatStreamEvent> {
    for await (const { eventName, data } of this.postSse("/chat/stream", input, signal)) {
      const event = this.mapChatEvent(eventName, data);
      if (event) yield event;
    }
  }

  /** Resume an interrupted generation INTO THE SAME message. The partial answer
   * already displayed is preserved; new deltas extend it until completion. */
  async *continueChat(input: { conversationId: string; messageId: string; providerId?: string; model?: string; fallbackProviderIds?: string[] }, signal?: AbortSignal): AsyncIterable<ApiChatStreamEvent> {
    for await (const { eventName, data } of this.postSse("/chat/continue", input, signal)) {
      const event = this.mapChatEvent(eventName, data);
      if (event) yield event;
    }
  }

  uploadAttachment(input: { name: string; mimeType: string; size: number; dataBase64: string }) {
    return this.request<{ attachment: Attachment }>("/attachments", { method: "POST", body: JSON.stringify(input) });
  }
  deleteAttachment(id: string) { return this.request<{ ok: true }>(`/attachments/${encodeURIComponent(id)}`, { method: "DELETE" }); }
  extractAttachment(id: string) { return this.request<{ attachment: Attachment; text: string }>(`/attachments/${encodeURIComponent(id)}/extract`, { method: "POST" }); }

  listProjects() { return this.request<{ projects: Project[] }>("/projects"); }
  createProject(input: { name: string; description?: string; color?: string; defaultModel?: string; instructions?: string; githubRepository?: string }) { return this.request<{ project: Project }>("/projects", { method: "POST", body: JSON.stringify(input) }); }
  getProject(id: string) { return this.request<{ project: Project & { conversations: Conversation[] } }>(`/projects/${encodeURIComponent(id)}`); }
  updateProject(id: string, input: Partial<{ name: string; description: string; color: string; defaultModel: string; instructions: string; githubRepository: string }>) { return this.request<{ project: Project }>(`/projects/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }); }
  deleteProject(id: string) { return this.request<{ ok: true }>(`/projects/${encodeURIComponent(id)}`, { method: "DELETE" }); }
  linkConversationToProject(projectId: string, conversationId: string) { return this.request<{ ok: true }>(`/projects/${encodeURIComponent(projectId)}/conversations/${encodeURIComponent(conversationId)}`, { method: "POST" }); }
  unlinkConversationFromProject(projectId: string, conversationId: string) { return this.request<{ ok: true }>(`/projects/${encodeURIComponent(projectId)}/conversations/${encodeURIComponent(conversationId)}`, { method: "DELETE" }); }

  // Conversations
  listConversations(cursor?: string) {
    const query = cursor ? new URLSearchParams({ cursor }) : new URLSearchParams();
    return this.request<{ conversations: Conversation[]; cursor?: string; hasMore: boolean }>(`/conversations${query}`);
  }
  searchConversations(q: string, limit?: number) {
    const query = new URLSearchParams({ q });
    if (limit) query.set("limit", String(limit));
    return this.request<{ conversations: Conversation[]; hasMore: boolean }>(`/conversations/search?${query}`);
  }
  createConversation(input: { title?: string; providerId: string; model: string; idempotencyKey?: string }) {
    return this.request<{ conversation: Conversation }>("/conversations", { method: "POST", body: JSON.stringify(input) });
  }
  getConversation(id: string) { return this.request<{ conversation: Conversation }>(`/conversations/${encodeURIComponent(id)}`); }
  updateConversation(id: string, input: { title?: string }) {
    return this.request<{ conversation: Conversation }>(`/conversations/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
  }
  deleteConversation(id: string) { return this.request<{ ok: boolean }>(`/conversations/${encodeURIComponent(id)}`, { method: "DELETE" }); }
  archiveConversation(id: string) { return this.request<{ conversation: Conversation }>(`/conversations/${encodeURIComponent(id)}/archive`, { method: "POST" }); }
  pinConversation(id: string) { return this.request<{ conversation: Conversation }>(`/conversations/${encodeURIComponent(id)}/pin`, { method: "POST" }); }
  listMessages(id: string, cursor?: string) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return this.request<{ messages: Conversation["messages"]; cursor?: string; hasMore: boolean }>(`/conversations/${encodeURIComponent(id)}/messages${query}`);
  }
  sendMessage(conversationId: string, content: string) {
    return this.request<{ message: { role: string; content: string; id?: string } }>(`/conversations/${encodeURIComponent(conversationId)}/messages`, { method: "POST", body: JSON.stringify({ content }) });
  }

  // Account
  updateAccount(input: { displayName?: string; preferences?: Record<string, unknown> }) { return this.request<{ user: User }>("/auth/account", { method: "PATCH", body: JSON.stringify(input) }); }
  changePassword(input: { currentPassword: string; newPassword: string; confirmPassword: string }) { return this.request<{ ok: boolean }>("/auth/password", { method: "PUT", body: JSON.stringify(input) }); }
  listSessions() { return this.request<{ sessions: Array<{ id: string; current: boolean; deviceName: string; ipMasked?: string; createdAt: string; lastSeenAt: string; expiresAt: string }> }>("/auth/sessions"); }
  revokeSession(id: string) { return this.request<{ ok: boolean; revoked: boolean }>(`/auth/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }); }
  exportAccountData() { return this.request<Record<string, unknown>>("/auth/export"); }
  deleteConversationHistory() { return this.request<{ ok: true; deleted: number }>("/auth/conversations", { method: "DELETE" }); }
  deleteAccount(input: { confirmation: string; password?: string }) { return this.request<{ ok: true }>("/auth/account", { method: "DELETE", body: JSON.stringify(input) }); }

  // Integrations
  listIntegrations() { return this.request<{ integrations: GoogleIntegration[] }>("/integrations"); }
  getGoogleIntegration() { return this.request<{ integration: GoogleIntegration }>("/integrations/google"); }
  startGoogleIntegration(input: { returnTarget?: "web" | "desktop"; scopes?: string[] } = {}) { return this.request<GoogleOAuthStart>("/integrations/google/start", { method: "POST", body: JSON.stringify(input) }); }
  getGoogleIntegrationStatus(connectionId?: string) { return this.request<GoogleOAuthStatus | GoogleIntegration>(`/integrations/google/status${connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : ""}`); }
  disconnectGoogle() { return this.request<{ ok: boolean; revoked: boolean }>("/integrations/google/disconnect", { method: "POST" }); }
  getGoogleDiagnostics() { return this.request<Record<string, boolean | string>>("/integrations/google/diagnostics"); }

  // Gmail
  listGmailMessages(input: { q?: string; pageToken?: string; maxResults?: number } = {}) { const query = new URLSearchParams(); if (input.q) query.set("q", input.q); if (input.pageToken) query.set("pageToken", input.pageToken); if (input.maxResults) query.set("maxResults", String(input.maxResults)); return this.request<{ messages: GmailMessage[]; nextPageToken?: string; resultSizeEstimate: number }>(`/integrations/google/gmail/messages${query.size ? `?${query}` : ""}`); }
  searchGmail(q: string, pageToken?: string) { const query = new URLSearchParams({ q }); if (pageToken) query.set("pageToken", pageToken); return this.request<{ messages: GmailMessage[]; nextPageToken?: string; resultSizeEstimate: number }>(`/integrations/google/gmail/search?${query}`); }
  getGmailMessage(id: string) { return this.request<{ message: GmailMessage }>(`/integrations/google/gmail/messages/${encodeURIComponent(id)}`); }
  getGmailThread(id: string) { return this.request<{ thread: { id: string; messages: GmailMessage[] } }>(`/integrations/google/gmail/threads/${encodeURIComponent(id)}`); }

  // Drive
  listDriveFiles(input: { pageToken?: string; pageSize?: number } = {}) { const query = new URLSearchParams(); if (input.pageToken) query.set("pageToken", input.pageToken); if (input.pageSize) query.set("pageSize", String(input.pageSize)); return this.request<{ files: DriveFile[]; nextPageToken?: string; contentAvailable: boolean; permissionMessage?: string }>(`/integrations/google/drive/files${query.size ? `?${query}` : ""}`); }
  searchDrive(q: string, pageToken?: string) { const query = new URLSearchParams({ q }); if (pageToken) query.set("pageToken", pageToken); return this.request<{ files: DriveFile[]; nextPageToken?: string; contentAvailable: boolean; permissionMessage?: string }>(`/integrations/google/drive/search?${query}`); }
  getDriveFile(id: string) { return this.request<{ file: DriveFile }>(`/integrations/google/drive/files/${encodeURIComponent(id)}`); }

  // GitHub
  getGitHubStatus() { return this.request<{ provider: string; configured: boolean; status: string; account?: { installationId: number; login: string | null; avatarUrl: string | null; type: string | null; repositorySelection: "all" | "selected"; permissions: Record<string, string>; repositoryCount: number; lastVerifiedAt: string | null } | null }>("/integrations/github/status"); }
  startGitHubConnect() { return this.request<{ status: "pending" | "reconnect" | "already_connected"; connectionId?: string; authorizationUrl: string; expiresAt?: string }>("/integrations/github/connect"); }
  testGitHubConnection() { return this.request<{ ok: boolean; status: string; lastVerifiedAt: string }>("/integrations/github/test", { method: "POST" }); }
  disconnectGitHub() { return this.request<{ ok: boolean }>("/integrations/github", { method: "DELETE" }); }
  listGitHubRepositories() { return this.request<{ repositories: Array<{ id: number; owner?: string; name: string; fullName: string; private: boolean; description: string | null; defaultBranch: string; language: string | null; updatedAt: string; htmlUrl: string }> }>("/integrations/github/repositories"); }

  // Web Search
  getWebSearchStatus() { return this.request<{ configured: boolean; provider: string | null; available: boolean }>("/tools/web-search/status"); }
  webSearch(input: { query: string; maxResults?: number; freshness?: string }) { return this.request<{ query: string; results: Array<{ title: string; url: string; snippet: string; publishedAt?: string; source?: string; rank: number; domain?: string; site?: string; score?: number; sourceType?: "official" | "primary" | "technical" | "news" | "community" | "other" }>; resultCount: number }>("/tools/web-search/search", { method: "POST", body: JSON.stringify(input) }); }
  webSearchRead(input: { url: string }) { return this.request<{ url: string; title: string; content: string; contentType: string }>("/tools/web-search/read", { method: "POST", body: JSON.stringify(input) }); }

  // Work Mode (Local Agent, proxied through the API so provider secrets stay server-side)
  workStatus() { return this.request<{
    available: boolean;
    service: string;
    health: { service: string; version?: string; port?: number } | null;
    workspaces: WorkspaceEntry[];
    agent: {
      process: "online" | "offline";
      connection: "connected" | "auth_required" | "unreachable";
      authentication: "authenticated" | "required" | "invalid";
      version?: string;
      port?: number;
      lastHeartbeat: string;
    };
    providers: {
      status: "ready" | "invalid" | "not_configured";
      configured: number;
      enabled: number;
      ready: boolean;
      list: Array<{ id: string; providerKey: string; kind: string; name: string; enabled: boolean; configured: boolean; defaultModel: string | null }>;
    };
  }>("/work/status"); }
  workConnect() { return this.request<{ ok: boolean; tokenConfigured: boolean; tokenAccepted: boolean; workspaces: WorkspaceEntry[] }>("/work/connect", { method: "POST", body: "{}" }); }
  workWorkspaces() { return this.request<{ workspaces: WorkspaceEntry[] }>("/work/workspaces"); }
  workPickWorkspace() { return this.request<{ cancelled: boolean; root: string | null }>("/work/workspaces/pick", { method: "POST" }); }
  workTrust(input: { root: string; mode: "trusted" | "restricted" }) { return this.request<{ workspace: WorkspaceEntry }>("/work/workspaces", { method: "POST", body: JSON.stringify(input) }); }
  workUntrust(id: string) { return this.request<{ ok: boolean }>(`/work/workspaces/${encodeURIComponent(id)}`, { method: "DELETE" }); }
  workSetMode(id: string, mode: "trusted" | "restricted") { return this.request<{ workspace: WorkspaceEntry }>(`/work/workspaces/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ mode }) }); }
  workTree(id: string) { return this.request<{ tree: Array<{ name: string; relativePath: string; type: "file" | "directory"; size?: number }> }>(`/work/workspaces/${encodeURIComponent(id)}/tree`); }
  workReadFile(id: string, filePath: string) { return this.request<{ path: string; content: string; size: number }>(`/work/workspaces/${encodeURIComponent(id)}/file?path=${encodeURIComponent(filePath)}`); }
  workWriteFile(id: string, filePath: string, content: string) { return this.request<{ ok: boolean }>(`/work/workspaces/${encodeURIComponent(id)}/file`, { method: "POST", body: JSON.stringify({ path: filePath, content }) }); }
  workDeleteFile(id: string, filePath: string) { return this.request<{ ok: boolean; deleted: string }>(`/work/workspaces/${encodeURIComponent(id)}/file?path=${encodeURIComponent(filePath)}`, { method: "DELETE" }); }
  workMove(id: string, from: string, to: string) { return this.request<{ ok: boolean; from: string; to: string }>(`/work/workspaces/${encodeURIComponent(id)}/move`, { method: "POST", body: JSON.stringify({ from, to }) }); }
  workReveal(id: string, path?: string) { return this.request<{ ok: boolean }>(`/work/workspaces/${encodeURIComponent(id)}/reveal`, { method: "POST", body: JSON.stringify({ path }) }); }
  workUndo(id: string) { return this.request<{ ok: boolean; relativePath: string }>(`/work/workspaces/${encodeURIComponent(id)}/undo`, { method: "POST", body: "{}" }); }
  workSearch(id: string, query: string, path?: string) { const filter = path ? `&path=${encodeURIComponent(path)}` : ""; return this.request<{ matches: Array<{ relativePath: string; line: number; content: string }> }>(`/work/workspaces/${encodeURIComponent(id)}/search?query=${encodeURIComponent(query)}${filter}`); }
  workGit(id: string) { return this.request<{ available: boolean; branch: string | null; changes: number; staged: number; behind?: number; ahead?: number; error?: string }>(`/work/workspaces/${encodeURIComponent(id)}/git`); }
  workRunCommand(id: string, command: string, cwd?: string) { return this.request<{ command: string; risk: string; exitCode: number | null; stdout: string; stderr: string }>(`/work/workspaces/${encodeURIComponent(id)}/command`, { method: "POST", body: JSON.stringify({ command, cwd }) }); }
  workResolveApproval(id: string, approved: boolean) { return this.request<{ ok: boolean; approved: boolean }>(`/work/approvals/${encodeURIComponent(id)}`, { method: "POST", body: JSON.stringify({ approved }) }); }
  workListSessions() { return this.request<{ sessions: WorkSession[] }>("/work/sessions"); }
  workCreateSession(input: WorkSessionCreateInput) { return this.request<{ session: WorkSession }>("/work/sessions", { method: "POST", body: JSON.stringify(input) }); }
  workGetSession(id: string) { return this.request<{ session: WorkSession }>(`/work/sessions/${encodeURIComponent(id)}`); }
  workUpdateSession(id: string, input: WorkSessionPatchInput) { return this.request<{ session: WorkSession }>(`/work/sessions/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }); }
  workDeleteSession(id: string) { return this.request<{ ok: boolean; deletedSessionId: string }>(`/work/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }); }
  async *workStreamAgent(input: { workspaceId: string; providerId: string; model: string; messages: ChatRequest["messages"]; instructions?: string; maxTurns?: number; budget?: { total?: number; hardTurns?: number; stallRepeats?: number; warnAtFraction?: number }; resume?: { messages: ChatRequest["messages"]; changedFiles?: string[] }; team?: { enabled?: boolean; mode?: "auto" | "custom"; roles?: Array<"dev" | "design" | "marketing" | "content" | "seo" | "qa" | "security" | "data"> } }, signal?: AbortSignal): AsyncIterable<WorkAgentEvent> {
    let response: Response;
    try {
      response = await this.requestFetch(`${this.baseUrl}/work/agent`, {
        method: "POST", credentials: this.credentials, signal,
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(input),
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new AegisApiError(0, { code: "API_UNREACHABLE", message: `Unable to connect to Aegis API at ${this.baseUrl}.`, details: { baseUrl: this.baseUrl } });
    }
    if (!response.ok) { const data = await response.json().catch(() => ({})) as ApiError; throw new AegisApiError(response.status, data.code ? data : { code: "HTTP_ERROR", message: `Request failed with ${response.status}.` }); }
    if (!response.body) throw new Error("The API returned an empty stream.");
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read(); buffer += decoder.decode(value, { stream: !done });
        const blocks = buffer.split(/\r?\n\r?\n/); buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          if (!block.trim()) continue;
          let eventName = "agent.delta";
          const dataLines: string[] = [];
          for (const line of block.split(/\r?\n/)) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
          }
          if (!dataLines.length) continue;
          const payload = JSON.parse(dataLines.join("\n")) as WorkAgentEvent;
          yield payload;
        }
        if (done) break;
      }
    } finally { reader.releaseLock(); }
  }
}

export { DEFAULT_API_URL, normalizeApiUrl } from "./config.js";
export type { ApiChatStreamEvent, ApiError, ChatRequest, ChatResponse, ChatStreamEvent, Conversation, Model, Project, ProviderConfig, ProviderCreateInput, ProviderId, User, WorkAgentEvent, WorkAgentRole, WorkSession, WorkSessionCreateInput, WorkSessionPatchInput, WorkspaceEntry } from "@aegis/types";
