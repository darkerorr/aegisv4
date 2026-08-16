import type { AIProvider, ChatMessage, ChatRequest, ChatResponse, ChatStreamEvent, ModelInfo, ProviderCapabilities, ProviderConfig, ProviderStatus, ProviderType } from "@aegis/types";
import { abortSignal, fetchWithTimeout, joinUrl, modelsFromOpenAi, normalizeProviderError, parseSse, providerHeaders } from "./common.js";

export class OpenAICompatibleProvider implements AIProvider {
  readonly type: ProviderType = "openai-compatible";
  constructor(public readonly config: ProviderConfig, private readonly displayName = config.name, private readonly extraHeaders: Record<string, string> = {}) {}
  get id(): string { return this.config.id; }
  get name(): string { return this.displayName; }
  supportsTools(): boolean { return true; }
  supportsVision(): boolean { return false; }
  supportsReasoning(): boolean { return false; }
  supportsStructuredOutput(): boolean { return false; }
  capabilities(): ProviderCapabilities {
    return {
      tools: this.supportsTools(),
      vision: this.supportsVision(),
      reasoning: this.supportsReasoning(),
      structuredOutput: this.supportsStructuredOutput(),
    };
  }
  private timeout(fallback: number): number {
    const configured = this.config.options?.timeoutMs;
    return typeof configured === "number" && Number.isFinite(configured) ? Math.min(60_000, Math.max(1_000, configured)) : fallback;
  }
  private phaseTimeout(key: string, fallback: number): number {
    const configured = this.config.options?.[key];
    return typeof configured === "number" && Number.isFinite(configured) ? Math.max(250, configured) : fallback;
  }

  async testConnection(signal?: AbortSignal): Promise<ProviderStatus> {
    const started = Date.now();
    try { await this.listModels(signal); return { ok: true, providerId: this.id, latencyMs: Date.now() - started }; }
    catch (error) { return { ok: false, providerId: this.id, latencyMs: Date.now() - started, message: error instanceof Error ? error.message : "Connection failed." }; }
  }

  async listModels(signalOrConfig?: AbortSignal | ProviderConfig): Promise<ModelInfo[]> {
    const response = await fetchWithTimeout(joinUrl(this.config.baseUrl, "/models"), { headers: providerHeaders(this.config, this.extraHeaders) }, this.timeout(30_000), abortSignal(signalOrConfig));
    if (!response.ok) throw normalizeProviderError(response.status, await response.text(), this.name, response.headers);
    return modelsFromOpenAi(this.config, await response.json());
  }

  async chat(request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    const totalMs = this.phaseTimeout("totalTimeoutMs", 1_800_000);
    const body: Record<string, unknown> = { model: request.model, messages: toWireMessages(request.messages), temperature: request.temperature, stream: false };
    if (request.tools?.length) body.tools = request.tools;
    const response = await fetchWithTimeout(joinUrl(this.config.baseUrl, "/chat/completions"), { method: "POST", headers: providerHeaders(this.config, this.extraHeaders), body: JSON.stringify(body) }, totalMs, signal, "total");
    if (!response.ok) throw normalizeProviderError(response.status, await response.text(), this.name, response.headers);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }> } }> };
    const message = data.choices?.[0]?.message;
    const content = message?.content;
    if (!content && !message?.tool_calls?.length) throw new Error(`${this.name} returned an empty response.`);
    const toolCalls = (message?.tool_calls ?? [])
      .map((call) => ({ id: call.id, name: call.function?.name ?? "", arguments: call.function?.arguments ?? "" }))
      .filter((call) => call.name);
    return { content: content ?? "", providerId: this.id, model: request.model, conversationId: request.conversationId, toolCalls: toolCalls.length ? toolCalls : undefined };
  }

  async *streamChat(request: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatStreamEvent> {
    const connectMs = this.phaseTimeout("connectTimeoutMs", 30_000);
    const firstTokenMs = this.phaseTimeout("firstTokenTimeoutMs", 120_000);
    const idleMs = this.phaseTimeout("idleStreamTimeoutMs", 300_000);
    const totalMs = this.phaseTimeout("totalTimeoutMs", 1_800_000);
    const body: Record<string, unknown> = { model: request.model, messages: toWireMessages(request.messages), temperature: request.temperature, stream: true };
    if (request.tools?.length) body.tools = request.tools;
    const response = await fetchWithTimeout(joinUrl(this.config.baseUrl, "/chat/completions"), { method: "POST", headers: providerHeaders(this.config, this.extraHeaders), body: JSON.stringify(body) }, connectMs, signal, "connect");
    if (!response.ok) throw normalizeProviderError(response.status, await response.text(), this.name, response.headers);
    yield* parseSse(response, this.name, { firstTokenMs, idleMs, totalMs });
  }
}

function toWireMessages(messages: ChatMessage[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  // OpenAI-compatible endpoints require strict pairing: a `tool` message must
  // reference a tool_call emitted by the immediately preceding assistant
  // message. Aegis embeds most tool results in the system prompt instead, so
  // orphan tool messages are common and MUST be dropped — sending one makes
  // strict providers (Mistral) reject the whole request with
  // "Unexpected tool call id ... in tool results".
  let pendingToolCallIds = new Set<string>();
  for (const message of messages) {
    if (message.role === "tool") {
      const id = message.toolCallId ?? "";
      if (!id || !pendingToolCallIds.has(id)) continue;
      out.push({ role: "tool", tool_call_id: id, content: message.content });
      continue;
    }
    const wire = toWireMessage(message);
    if (wire === null) continue;
    out.push(wire);
    if (message.role === "assistant") {
      pendingToolCallIds = new Set(
        (wire.tool_calls as Array<{ id?: string }> | undefined)
          ?.map((call) => call.id)
          .filter((id): id is string => Boolean(id)) ?? [],
      );
    } else if (message.role === "user") {
      pendingToolCallIds.clear();
    }
  }
  return out;
}

function toWireMessage(message: ChatMessage): Record<string, unknown> | null {
  if (message.role === "tool") {
    return { role: "tool", tool_call_id: message.toolCallId ?? "", content: message.content };
  }
  if (message.role === "assistant" && message.toolCalls?.length) {
    // Strict providers (Mistral in particular) reject an assistant message that
    // carries tool_calls alongside a non-null content string: mistral_common
    // parses it as a plain text turn and then flags every tool result as
    // "Unexpected tool call id ... in tool results". Tool-call turns have no
    // text, so always send content: null.
    return {
      role: "assistant",
      content: null,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id ?? `call_${Math.random().toString(36).slice(2, 10)}`,
        type: "function",
        function: { name: call.name, arguments: call.arguments || "{}" },
      })),
    };
  }
  // An assistant (or user) message with no content at all — e.g. an assistant
  // message persisted after a stream that failed before producing a token —
  // would be sent as {"role":"assistant"} and rejected by strict providers
  // (Mistral 400: "Assistant message must have either content or tool_calls").
  // Drop it instead of poisoning the whole request.
  const content = message.content ?? "";
  if (!content.trim()) return null;
  return { role: message.role, content };
}
