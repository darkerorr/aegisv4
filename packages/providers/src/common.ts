import type { ApiError, ChatStreamEvent, Model, ProviderConfig } from "@aegis/types";

export class ProviderError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status?: number, details?: unknown) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export function providerHeaders(config: ProviderConfig, extra: Record<string, string> = {}): Record<string, string> {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    ...extra,
  };
}

export function abortSignal(value?: AbortSignal | ProviderConfig): AbortSignal | undefined {
  return value && typeof (value as AbortSignal).aborted === "boolean" ? value as AbortSignal : undefined;
}

function providerErrorMessage(status: number, body: string, providerName: string): string {
  if (body) {
    try {
      const parsed = JSON.parse(body) as { error?: unknown; message?: unknown; detail?: unknown; title?: unknown } | null;
      const raw = parsed?.error ?? parsed?.message ?? parsed?.detail;
      let reason = typeof raw === "string" ? raw : (typeof raw === "object" && raw && typeof (raw as { message?: unknown }).message === "string" ? (raw as { message: string }).message : "");
      // RFC 7807 problem-details bodies (e.g. NVIDIA NIM 429) carry the human
      // summary in `title` rather than `message`/`error`.
      if (!reason.trim() && typeof parsed?.title === "string") reason = parsed.title;
      if (reason.trim()) return `${providerName} (${status}): ${reason.trim().slice(0, 300)}`;
    } catch { /* Non-JSON error body; fall through to flat text. */ }
    const flat = body.replace(/\s+/g, " ").trim().slice(0, 200);
    if (flat) return `${providerName} (${status}): ${flat}`;
  }
  return `${providerName} returned HTTP ${status}.`;
}

/** Extracts the structured error fields providers include in their JSON body
 * (Mistral: { error: { code: "1300", type: "rate_limited" } }, OpenAI:
 * { error: { type: "rate_limit_exceeded", code: "429" } }, NVIDIA NIM
 * (RFC 7807): { status: 429, title: "Too Many Requests" }, ...). The key is
 * never part of the body and never surfaces here. */
export function parseProviderErrorBody(body: string): { providerCode?: string; errorType?: string } {
  if (!body) return {};
  try {
    const parsed = JSON.parse(body) as
      | { error?: unknown; message?: unknown; detail?: unknown; code?: unknown; type?: unknown; title?: unknown; status?: unknown }
      | null;
    if (!parsed) return {};
    const raw = parsed.error ?? parsed.message ?? parsed.detail ?? parsed;
    if (typeof raw === "string") return {};
    if (!raw || typeof raw !== "object") return {};
    const entry = raw as { message?: unknown; code?: unknown; type?: unknown };
    let providerCode: string | undefined;
    if (typeof entry.code === "string") providerCode = entry.code;
    else if (typeof entry.code === "number") providerCode = String(entry.code);
    let errorType = typeof entry.type === "string" ? entry.type : undefined;
    // RFC 7807 problem-details: the title is the closest thing to an error type.
    if (!errorType && typeof parsed.title === "string") errorType = parsed.title;
    return { ...(providerCode ? { providerCode } : {}), ...(errorType ? { errorType } : {}) };
  } catch {
    return {};
  }
}

export function normalizeProviderError(status: number, body: string, providerName: string, headers?: Headers | Record<string, string>): ProviderError {
  const message = providerErrorMessage(status, body, providerName);
  const retryAfter = retryAfterSeconds(headers);
  const structured = parseProviderErrorBody(body);
  const baseDetails: Record<string, unknown> = {
    status,
    ...(retryAfter !== undefined ? { retryAfter } : {}),
    ...structured,
    ...(body ? { body: body.slice(0, 500) } : {}),
  };
  // NVIDIA NIM reports inaccessible model functions as:
  //   {"status":404,"title":"Not Found","detail":"Function '<uuid>': Not found for account '...'"}
  // The function UUID is an internal NVIDIA identifier that cannot be fixed in Aegis;
  // surface a clear message pointing at the model selection instead of the raw UUID.
  const nvidiaFunctionMissing = status === 404 && /Function '[^']+':\s*Not found for account/.test(body);
  if (nvidiaFunctionMissing) {
    return new ProviderError(
      "PROVIDER_MODEL_UNAVAILABLE",
      `${providerName} does not expose the selected model for the configured API key. The model function was not found for your NVIDIA account, so the model is either retired, renamed, or requires access. Choose an available model, or verify the NVIDIA API key matches the account that owns this model.`,
      status,
      { provider: providerName, status, body },
    );
  }
  if (status === 401 || status === 403) return new ProviderError("PROVIDER_AUTH_FAILED", message, status, baseDetails);
  if (status === 404) return new ProviderError("PROVIDER_MODEL_NOT_FOUND", message, status, baseDetails);
  if (status === 429) return new ProviderError("PROVIDER_RATE_LIMITED", message, status, baseDetails);
  // 529 (Cloudflare "site overloaded") and 503 are transient service overload
  // conditions — retryable with backoff, never a permanent failure.
  if (status === 529 || status === 503) return new ProviderError("PROVIDER_OVERLOADED", message, status, baseDetails);
  if (status >= 500) return new ProviderError("PROVIDER_UPSTREAM_ERROR", message, status, baseDetails);
  return new ProviderError("PROVIDER_REQUEST_FAILED", message, status, baseDetails);
}

/**
 * Whether a rate-limit error is bound to a single MODEL (persistent for that
 * model, e.g. Mistral hosting third-party models: code "1300", type
 * "rate_limited") or to the whole ACCOUNT/tier. Retrying a model-level limit is
 * wasteful and can make the provider tighten the limit — the caller should
 * switch to another model instead of hammering the same one.
 * Heuristic based on the provider's error code/type/body; falls back to
 * "unknown" (treated like an account-level limit by callers).
 */
export function providerRateLimitCategory(error: unknown): "model" | "account" | "unknown" {
  const details = (error as { details?: Record<string, unknown> } | null)?.details;
  if (!details || typeof details !== "object") return "unknown";
  const providerCode = typeof details.providerCode === "string" ? details.providerCode : "";
  const errorType = typeof details.errorType === "string" ? details.errorType : "";
  const body = typeof details.body === "string" ? details.body : "";
  const text = `${providerCode} ${errorType} ${body}`.toLowerCase();
  const accountHint = /account|workspace|organization|tier|org_|subscription|insufficient_quota|billing/.test(text);
  const modelHint = /model|per_model|model_usage|1300|model_not|rate_limit_by_model/.test(text);
  if (accountHint) return "account";
  if (modelHint) return "model";
  return "unknown";
}

// Upstream 5xx codes that are load-balancer/gateway blips and safe to retry.
const TRANSIENT_UPSTREAM_STATUSES = new Set([502, 504, 520, 521, 522, 523, 524, 525, 526, 527, 529]);

/** True when the error is a transient overload/rate-limit worth retrying with backoff. */
export function isTransientProviderError(error: unknown): boolean {
  const entry = error as { code?: unknown; status?: unknown; details?: { status?: unknown } } | null;
  if (!entry || typeof entry.code !== "string") return false;
  if (
    entry.code === "PROVIDER_RATE_LIMITED" ||
    entry.code === "PROVIDER_OVERLOADED" ||
    // Connect/first-token timeouts are usually transient (serverless cold start,
    // DNS hiccup, load balancer) — retry them before surfacing an error.
    entry.code === "PROVIDER_CONNECT_TIMEOUT" ||
    entry.code === "PROVIDER_FIRST_TOKEN_TIMEOUT"
  ) return true;
  if (entry.code !== "PROVIDER_UPSTREAM_ERROR") return false;
  const status = typeof entry.status === "number"
    ? entry.status
    : typeof entry.details?.status === "number"
      ? entry.details.status
      : undefined;
  return typeof status === "number" && TRANSIENT_UPSTREAM_STATUSES.has(status);
}

/** Retry-After (seconds) carried on a rate-limit/overload error, if the provider sent one. */
export function providerRetryAfter(error: unknown): number | undefined {
  const details = (error as { details?: { retryAfter?: unknown } } | null)?.details;
  if (!details || typeof details !== "object") return undefined;
  const retryAfter = (details as { retryAfter?: unknown }).retryAfter;
  return typeof retryAfter === "number" && Number.isFinite(retryAfter) ? retryAfter : undefined;
}

/** Exponential backoff (2s, 4s, 8s, 16s, capped at 30s) with jitter, or the
 * provider's Retry-After (also capped at 30s). */
export function transientBackoff(attempt: number, retryAfter?: number, maxMs = 30_000): number {
  if (typeof retryAfter === "number" && Number.isFinite(retryAfter)) return Math.min(retryAfter * 1000, maxMs);
  const base = 2_000 * 2 ** Math.max(0, attempt);
  return Math.min(base + Math.random() * base * 0.2, maxMs);
}

export function retryAfterSeconds(headers?: Headers | Record<string, string>): number | undefined {
  if (!headers) return undefined;
  const raw = typeof (headers as Headers).get === "function"
    ? (headers as Headers).get("retry-after")
    : (headers as Record<string, string>)["retry-after"];
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(raw);
  if (Number.isFinite(date)) return Math.max(0, Math.ceil((date - Date.now()) / 1000));
  return undefined;
}

function isAbortErrorWithCode(error: unknown): error is Error & { code: string } {
  return error instanceof Error && "code" in error && typeof (error as Record<string, unknown>).code === "string";
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ProviderError) {
    return {
      code: error.code,
      message: error.message,
      details: {
        ...(error.status ? { status: error.status } : {}),
        ...(typeof error.details === "object" && error.details ? error.details as Record<string, unknown> : {}),
      },
    };
  }
  // Handle AbortController.reason where ProviderError was attached as signal reason
  if (isAbortErrorWithCode(error)) {
    return { code: error.code, message: error.message };
  }
  // Handle abort errors without explicit code
  if (error instanceof DOMException && error.name === "AbortError") {
    return { code: "PROVIDER_ABORTED", message: "The request was cancelled." };
  }
  return { code: "PROVIDER_UNAVAILABLE", message: error instanceof Error ? error.message : "Provider request failed." };
}

export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number, signal?: AbortSignal, phase: "connect" | "first-token" | "total" = "connect"): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted && signal?.aborted) throw signal.reason ?? error;
    throw error;
  } finally {
    signal?.removeEventListener("abort", abort);
  }
}

function providerTimeoutMessage(phase: "connect" | "first-token" | "idle-stream" | "total"): string {
  if (phase === "connect") return "Aegis could not connect to the provider in time.";
  if (phase === "first-token") return "The model did not begin responding before the first-token deadline.";
  if (phase === "idle-stream") return "The provider stopped sending data while generating the response.";
  return "The model exceeded the configured total generation time.";
}

export type StreamTimeouts = { firstTokenMs: number; idleMs: number; totalMs: number };

async function readStreamChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  _timeoutMs: number,
  _phase: "first-token" | "idle-stream" | "total",
): Promise<ReadableStreamReadResult<Uint8Array>> {
  return reader.read();
}

export async function readError(response: Response, providerName: string): Promise<never> {
  throw normalizeProviderError(response.status, await response.text(), providerName, response.headers);
}

export function modelsFromOpenAi(config: ProviderConfig, data: unknown): Model[] {
  const entries = (data as { data?: Array<{ id?: string; name?: string; context_length?: number; pricing?: { prompt?: string; completion?: string; input_cache_read?: string }; architecture?: { input_modalities?: string[]; output_modalities?: string[] }; supported_parameters?: string[] }> }).data ?? [];
  return entries.filter((entry) => entry.id || entry.name).map((entry) => ({
    id: entry.id ?? entry.name ?? "unknown",
    providerId: config.id,
    name: entry.id ?? entry.name ?? "unknown",
    type: "chat" as const,
    active: true,
    local: false,
    capabilities: ["chat"],
    favorite: false,
    visible: true,
    available: true,
    contextLength: entry.context_length,
    ...(entry.pricing ? { pricing: {
      currency: "USD" as const, unit: "per_million_tokens" as const,
      ...(Number.isFinite(Number(entry.pricing.prompt)) ? { input: Number(entry.pricing.prompt) * 1_000_000 } : {}),
      ...(Number.isFinite(Number(entry.pricing.completion)) ? { output: Number(entry.pricing.completion) * 1_000_000 } : {}),
      ...(Number.isFinite(Number(entry.pricing.input_cache_read)) ? { cachedInput: Number(entry.pricing.input_cache_read) * 1_000_000 } : {}),
      source: config.kind === "openrouter" ? "OpenRouter model metadata" : `${config.name} model metadata`,
      lastUpdatedAt: new Date().toISOString(),
    } } : {}),
    ...(entry.architecture ? { modalities: { input: entry.architecture.input_modalities ?? ["text"], output: entry.architecture.output_modalities ?? ["text"] } } : {}),
    metadata: { ...(entry.pricing ? { pricing: { currency: "USD", unit: "per_million_tokens", input: Number(entry.pricing.prompt) * 1_000_000, output: Number(entry.pricing.completion) * 1_000_000, source: config.kind === "openrouter" ? "OpenRouter model metadata" : `${config.name} model metadata` } } : {}), ...(entry.architecture ? { modalities: entry.architecture } : {}), ...(entry.supported_parameters ? { supportedParameters: entry.supported_parameters } : {}) },
  }));
}

export async function* parseSse(response: Response, providerName: string, timeouts: StreamTimeouts = { firstTokenMs: 120_000, idleMs: 300_000, totalMs: 1_800_000 }): AsyncIterable<ChatStreamEvent> {
  if (!response.body) throw new ProviderError("PROVIDER_EMPTY_STREAM", `${providerName} returned no stream body.`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let receivedChunk = false;
  let sawDone = false;
  let sawFinishReason = false;
  let streamedContent = false;
  const toolAccumulator = new Map<number, { id?: string; name?: string; arguments: string }>();
  try {
    while (true) {
      const phaseTimeout = receivedChunk ? timeouts.idleMs : timeouts.firstTokenMs;
      const waitMs = Math.min(phaseTimeout, timeouts.totalMs);
      const { done, value } = await readStreamChunk(reader, waitMs, receivedChunk ? "idle-stream" : "first-token");
      if (value?.byteLength) receivedChunk = true;
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
const data = line.startsWith("data:") ? line.slice(5).trim() : "";
        if (data === "[DONE]") { sawDone = true; continue; }
        if (!data) continue;
        let payload: { choices?: Array<{ delta?: { content?: string; reasoning_content?: string; thinking?: string; thinking_content?: string; reasoning?: string; tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }> }; message?: { content?: string; reasoning_content?: string; thinking?: string; tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }> }; finish_reason?: string | null }> };
        try { payload = JSON.parse(data) as typeof payload; } catch { continue; }
        const choice = payload.choices?.[0];
        if (choice?.finish_reason) sawFinishReason = true;
        const delta = choice?.delta;
        const message = choice?.message;
        const reasoning = delta?.reasoning_content ?? delta?.thinking ?? delta?.thinking_content ?? delta?.reasoning ?? message?.reasoning_content ?? message?.thinking;
        if (reasoning) { streamedContent = true; yield { type: "reasoning", content: reasoning }; }
        const toolCalls = delta?.tool_calls ?? message?.tool_calls;
        if (toolCalls?.length) {
          for (const call of toolCalls) {
            const index = call.index ?? 0;
            const current = toolAccumulator.get(index) ?? { arguments: "" };
            if (call.id) current.id = call.id;
            if (call.function?.name) current.name = call.function.name;
            if (call.function?.arguments) current.arguments += call.function.arguments;
            toolAccumulator.set(index, current);
          }
          streamedContent = true;
        }
        const content = delta?.content ?? message?.content;
        if (content) { streamedContent = true; yield { type: "delta", content }; }
      }
      if (done) break;
    }
  } catch (error) {
    await reader.cancel(error).catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  if (toolAccumulator.size) {
    const calls = [...toolAccumulator.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, call]) => ({ id: call.id, name: call.name ?? "", arguments: call.arguments }))
      .filter((call) => call.name);
    if (calls.length) { streamedContent = true; yield { type: "tool_calls", calls }; }
  }
  // The provider closed the connection (EOF) without signalling completion:
  // no `data: [DONE]`, no `finish_reason`. If content had already started this
  // is a premature drop — the caller must keep the partial answer and treat the
  // message as interrupted instead of a completed response.
  if (!sawDone && !sawFinishReason && streamedContent) {
    throw new ProviderError(
      "PROVIDER_STREAM_CUT",
      `${providerName} stopped sending data before completing the response (the connection closed without a completion signal).`,
      undefined,
      { phase: "stream-cut" },
    );
  }
  yield { type: "done" };
}

export async function* parseNdjson(response: Response, providerName: string, timeouts: StreamTimeouts = { firstTokenMs: 120_000, idleMs: 300_000, totalMs: 1_800_000 }): AsyncIterable<ChatStreamEvent> {
  if (!response.body) throw new ProviderError("PROVIDER_EMPTY_STREAM", `${providerName} returned no stream body.`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let receivedChunk = false;
  try {
    while (true) {
      const phaseTimeout = receivedChunk ? timeouts.idleMs : timeouts.firstTokenMs;
      const waitMs = Math.min(phaseTimeout, timeouts.totalMs);
      const { done, value } = await readStreamChunk(reader, waitMs, receivedChunk ? "idle-stream" : "first-token");
      if (value?.byteLength) receivedChunk = true;
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines.filter(Boolean)) {
        try {
          const payload = JSON.parse(line) as { message?: { content?: string; reasoning?: string; reasoning_content?: string; thinking?: string }; response?: string; done?: boolean };
          const reasoning = payload.message?.reasoning ?? payload.message?.reasoning_content ?? payload.message?.thinking;
          if (reasoning) yield { type: "reasoning", content: reasoning };
          const content = payload.message?.content ?? payload.response;
          if (content) yield { type: "delta", content };
        } catch { /* Ignore incomplete provider frames. */ }
      }
      if (done) break;
    }
  } catch (error) {
    await reader.cancel(error).catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  yield { type: "done" };
}
