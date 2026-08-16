import type { AIProvider, ChatRequest, ChatResponse, ChatStreamEvent, ModelInfo, ProviderConfig, ProviderStatus } from "@aegis/types";
import { abortSignal, fetchWithTimeout, joinUrl, normalizeProviderError, parseNdjson, providerHeaders } from "./common.js";

export class OllamaProvider implements AIProvider {
  readonly type = "ollama" as const;
  constructor(public readonly config: ProviderConfig) {}
  get id(): string { return this.config.id; }
  get name(): string { return this.config.name; }
  private phaseTimeout(key: string, fallback: number): number { const value = this.config.options?.[key]; return typeof value === "number" && Number.isFinite(value) ? Math.max(250, value) : fallback; }
  async testConnection(signal?: AbortSignal): Promise<ProviderStatus> {
    const started = Date.now();
    try { await this.listModels(signal); return { ok: true, providerId: this.id, latencyMs: Date.now() - started }; }
    catch (error) { return { ok: false, providerId: this.id, latencyMs: Date.now() - started, message: error instanceof Error ? error.message : "Connection failed." }; }
  }
  async listModels(signalOrConfig?: AbortSignal | ProviderConfig): Promise<ModelInfo[]> {
    const response = await fetchWithTimeout(joinUrl(this.config.baseUrl, "/api/tags"), { headers: providerHeaders(this.config) }, 15_000, abortSignal(signalOrConfig));
    if (!response.ok) throw normalizeProviderError(response.status, await response.text(), this.name);
    const data = await response.json() as { models?: Array<{ name: string; details?: { parameter_size?: string } }> };
    return (data.models ?? []).map((model) => ({ id: model.name, providerId: this.id, name: model.name, type: "chat" as const, active: true, local: true, capabilities: ["chat"], favorite: false, visible: true, available: true, ...(model.details ? { metadata: model.details } : {}) }));
  }
  async chat(request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    const response = await fetchWithTimeout(joinUrl(this.config.baseUrl, "/api/chat"), { method: "POST", headers: providerHeaders(this.config), body: JSON.stringify({ model: request.model, messages: request.messages, stream: false, options: request.temperature === undefined ? undefined : { temperature: request.temperature } }) }, this.phaseTimeout("totalTimeoutMs", 1_800_000), signal, "total");
    if (!response.ok) throw normalizeProviderError(response.status, await response.text(), this.name);
    const data = await response.json() as { message?: { content?: string } };
    if (!data.message?.content) throw new Error(`${this.name} returned an empty response.`);
    return { content: data.message.content, providerId: this.id, model: request.model, conversationId: request.conversationId };
  }
  async *streamChat(request: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatStreamEvent> {
    const connectMs = this.phaseTimeout("connectTimeoutMs", 15_000); const firstTokenMs = this.phaseTimeout("firstTokenTimeoutMs", 120_000); const idleMs = this.phaseTimeout("idleStreamTimeoutMs", 300_000); const totalMs = this.phaseTimeout("totalTimeoutMs", 1_800_000);
    const response = await fetchWithTimeout(joinUrl(this.config.baseUrl, "/api/chat"), { method: "POST", headers: providerHeaders(this.config), body: JSON.stringify({ model: request.model, messages: request.messages, stream: true }) }, connectMs, signal, "connect");
    if (!response.ok) throw normalizeProviderError(response.status, await response.text(), this.name);
    yield* parseNdjson(response, this.name, { firstTokenMs, idleMs, totalMs });
  }
}
