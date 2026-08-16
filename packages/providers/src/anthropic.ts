import type { AIProvider, ChatMessage, ChatRequest, ChatResponse, ChatStreamEvent, ModelInfo, ProviderConfig, ProviderStatus } from "@aegis/types";
import { abortSignal, fetchWithTimeout, joinUrl, normalizeProviderError } from "./common.js";

const FALLBACK_MODELS = [
  "claude-sonnet-4-20250514",
  "claude-opus-4-20250514",
  "claude-haiku-4-20250514",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022",
];

const SYSTEM_PROMPT_VERSION = "2023-06-01";

export class AnthropicProvider implements AIProvider {
  readonly type = "anthropic" as const;
  constructor(public readonly config: ProviderConfig) {}
  get id(): string { return this.config.id; }
  get name(): string { return "Anthropic Claude"; }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-api-key": this.config.apiKey ?? "",
      "anthropic-version": SYSTEM_PROMPT_VERSION,
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
    try {
      const response = await fetchWithTimeout(
        joinUrl(this.config.baseUrl, "/messages"),
        {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify({ model: FALLBACK_MODELS[0], max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
        },
        this.timeout(15_000),
        signal,
      );
      if (!response.ok) throw normalizeProviderError(response.status, await response.text(), this.name);
      return { ok: true, providerId: this.id, latencyMs: Date.now() - started };
    } catch (error) {
      return { ok: false, providerId: this.id, latencyMs: Date.now() - started, message: error instanceof Error ? error.message : "Connection failed." };
    }
  }

  async listModels(signalOrConfig?: AbortSignal | ProviderConfig): Promise<ModelInfo[]> {
    const response = await fetchWithTimeout(joinUrl(this.config.baseUrl, "/models"), { headers: this.headers() }, this.timeout(15_000), abortSignal(signalOrConfig));
    if (response.ok) {
      const data = await response.json() as { data?: Array<{ id?: string }> };
      const ids = (data.data ?? []).map((model) => model.id).filter((id): id is string => Boolean(id));
      if (ids.length) {
        return ids.map((name) => ({ id: name, providerId: this.config.id, name, type: "chat" as const, active: true, local: false, capabilities: ["chat"], favorite: false, visible: true, available: true }));
      }
    }
    return FALLBACK_MODELS.map((name) => ({ id: name, providerId: this.config.id, name, type: "chat" as const, active: true, local: false, capabilities: ["chat"], favorite: false, visible: true, available: true }));
  }

  async chat(request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    const totalMs = this.phaseTimeout("totalTimeoutMs", 1_800_000);
    const body = toAnthropicBody(request);
    body.stream = false;
    const response = await fetchWithTimeout(joinUrl(this.config.baseUrl, "/messages"), { method: "POST", headers: this.headers(), body: JSON.stringify(body) }, totalMs, signal, "total");
    if (!response.ok) throw normalizeProviderError(response.status, await response.text(), this.name);
    const data = await response.json() as { content?: Array<{ type?: string; text?: string; id?: string; name?: string; input?: unknown }> };
    const text = (data.content ?? []).filter((block) => block.type === "text").map((block) => block.text ?? "").join("");
    const toolCalls = (data.content ?? [])
      .filter((block) => block.type === "tool_use")
      .map((block) => ({ id: block.id, name: block.name ?? "", arguments: JSON.stringify(block.input ?? {}) }))
      .filter((call) => call.name);
    if (!text && !toolCalls.length) throw new Error(`${this.name} returned an empty response.`);
    return { content: text, providerId: this.id, model: request.model, conversationId: request.conversationId, toolCalls: toolCalls.length ? toolCalls : undefined };
  }

  async *streamChat(request: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatStreamEvent> {
    const connectMs = this.phaseTimeout("connectTimeoutMs", 15_000);
    const firstTokenMs = this.phaseTimeout("firstTokenTimeoutMs", 120_000);
    const idleMs = this.phaseTimeout("idleStreamTimeoutMs", 300_000);
    const totalMs = this.phaseTimeout("totalTimeoutMs", 1_800_000);
    const body = toAnthropicBody(request);
    body.stream = true;
    const response = await fetchWithTimeout(joinUrl(this.config.baseUrl, "/messages"), { method: "POST", headers: this.headers(), body: JSON.stringify(body) }, connectMs, signal, "connect");
    if (!response.ok) throw normalizeProviderError(response.status, await response.text(), this.name);
    if (!response.body) throw new Error(`${this.name} returned no stream body.`);
    yield* parseAnthropicSse(response.body, firstTokenMs, idleMs, totalMs);
  }
}

function toAnthropicBody(request: ChatRequest): Record<string, unknown> {
  const { system, messages } = toAnthropicMessages(request.messages);
  const body: Record<string, unknown> = {
    model: request.model,
    max_tokens: 8192,
    messages,
    ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
    ...(system ? { system } : {}),
  };
  return body;
}

function toAnthropicMessages(messages: ChatMessage[]): { system: string; messages: Array<Record<string, unknown>> } {
  const system: string[] = [];
  const out: Array<Record<string, unknown>> = [];
  for (const message of messages) {
    if (message.role === "system") {
      system.push(message.content);
      continue;
    }
    if (message.role === "tool") {
      const last = out[out.length - 1];
      const block = { type: "tool_result", tool_use_id: message.toolCallId ?? "", content: message.content };
      if (last?.role === "user" && Array.isArray(last.content)) {
        last.content.push(block);
      } else {
        out.push({ role: "user", content: [block] });
      }
      continue;
    }
    if (message.role === "assistant" && message.toolCalls?.length) {
      const content: Array<Record<string, unknown>> = [];
      if (message.content) content.push({ type: "text", text: message.content });
      for (const call of message.toolCalls) {
        let input: unknown = {};
        try { input = call.arguments ? JSON.parse(call.arguments) : {}; } catch { input = {}; }
        content.push({ type: "tool_use", id: call.id ?? `call_${Math.random().toString(36).slice(2, 10)}`, name: call.name, input });
      }
      out.push({ role: "assistant", content });
      continue;
    }
    const content = message.content.trim();
    if (!content) continue;
    const last = out[out.length - 1];
    if (last?.role === message.role && message.role === "user") {
      last.content = `${last.content}\n\n${content}`;
    } else {
      out.push({ role: message.role, content });
    }
  }
  return { system: system.join("\n\n"), messages: out };
}

async function* parseAnthropicSse(
  stream: ReadableStream<Uint8Array>,
  firstTokenMs: number,
  idleMs: number,
  totalMs: number,
): AsyncIterable<ChatStreamEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let receivedChunk = false;
  try {
    while (true) {
      const waitMs = receivedChunk ? idleMs : firstTokenMs;
      const chunk = await readWithTimeout(reader, waitMs, receivedChunk ? "idle-stream" : "first-token");
      if (chunk?.value?.byteLength) receivedChunk = true;
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const event = frame.split(/\r?\n/).find((line) => line.startsWith("event:"))?.slice(6).trim() ?? "";
        const data = frame.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("");
        if (!data) continue;
        let payload: { type?: string; delta?: { type?: string; text?: string; thinking?: string }; error?: { message?: string } };
        try { payload = JSON.parse(data) as typeof payload; } catch { continue; }
        if (event === "content_block_delta") {
          if (payload.delta?.type === "text_delta" && payload.delta.text) {
            yield { type: "delta", content: payload.delta.text };
          } else if ((payload.delta?.type === "thinking_delta" || payload.delta?.type === "thinking") && payload.delta.thinking) {
            yield { type: "reasoning", content: payload.delta.thinking };
          }
        } else if (event === "error" && payload.error?.message) {
          yield { type: "error", error: { code: "PROVIDER_REQUEST_FAILED", message: payload.error.message } };
          return;
        } else if (event === "message_stop") {
          break;
        }
      }
    }
  } catch (error) {
    await reader.cancel(error).catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  yield { type: "done" };
}

async function readWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  _timeoutMs: number,
  _phase: "first-token" | "idle-stream",
): Promise<ReadableStreamReadResult<Uint8Array>> {
  return reader.read();
}
