import type { ModelInfo, ProviderConfig, ProviderStatus } from "@aegis/types";
import { OpenAICompatibleProvider } from "./openai-compatible.js";
import { abortSignal, joinUrl, providerHeaders } from "./common.js";

// NVIDIA's /v1/models endpoint returns the public catalogue (every model NVIDIA
// hosts) regardless of the account that owns the API key. Only a real chat call
// reveals whether the account can invoke a given model. Candidates that are
// clearly not chat-capable are skipped so the probe budget goes to chat models.
const NON_CHAT_PATTERN = /embed|rerank|clip|bge-|nemoretriever|vila|deplot|kosmos|fuyu|diffusiongemma|video-detector|neva|segmentation|audio|speech|tts|asr|whisper/i;

// NVIDIA NIM rate-limits aggressively at the account/IP level (HTTP 429 "Too
// Many Requests" with no Retry-After). Probing the whole catalogue with a high
// concurrency guaranteeably trips it, so the probe budget is kept small and
// staggered: a bounded number of candidates, low concurrency, and a delay that
// grows with each probe so the account never sees a burst of requests.
const MAX_PROBE_CANDIDATES = 24;
const PROBE_CONCURRENCY = 2;
const PROBE_STAGGER_MS = 150;
const PROBE_RATE_LIMIT_BACKOFF_MS = 2_000;

function isChatCandidate(id: string): boolean {
  return !NON_CHAT_PATTERN.test(id);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type ProbeResult = "ok" | "unavailable" | "rate-limited";

async function probeModel(config: ProviderConfig, model: string, signal?: AbortSignal, _timeoutMs = 12_000): Promise<ProbeResult> {
  // NVIDIA NIM cold-starts serverless functions, so a model can take 10-20s on
  // its first call even though the account can invoke it. A 429 is a rate
  // limit, not an availability signal: back off once and retry, then report
  // "rate-limited" so the caller stops probing instead of hammering.
  let rateLimited = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const onOuterAbort = () => controller.abort();
    signal?.addEventListener("abort", onOuterAbort, { once: true });
    try {
      const response = await fetch(joinUrl(config.baseUrl, "/chat/completions"), {
        method: "POST",
        headers: providerHeaders(config, { "X-Model-Provider": "aegis" }),
        body: JSON.stringify({ model, messages: [{ role: "user", content: "hi" }], max_tokens: 1, stream: false }),
        signal: controller.signal,
      });
      if (response.status === 200) return "ok";
      if (response.status === 429) {
        rateLimited = true;
        await sleep(PROBE_RATE_LIMIT_BACKOFF_MS);
        continue;
      }
      return "unavailable";
    } catch {
      // Network error: retry once before declaring the model unusable.
    } finally {
      signal?.removeEventListener("abort", onOuterAbort);
    }
  }
  return rateLimited ? "rate-limited" : "unavailable";
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

export class NvidiaNimProvider extends OpenAICompatibleProvider {
  readonly type = "nvidia-nim" as const;
  constructor(config: ProviderConfig) { super(config, "NVIDIA NIM", { Accept: "application/json", "X-Model-Provider": "aegis" }); }

  async listModels(signalOrConfig?: AbortSignal | ProviderConfig): Promise<ModelInfo[]> {
    const catalog = await super.listModels(signalOrConfig);
    if (!this.config.apiKey) return catalog;
    const signal = abortSignal(signalOrConfig);
    const candidates = catalog.filter((model) => isChatCandidate(model.name)).slice(0, MAX_PROBE_CANDIDATES);
    const probeTimeoutMs = Math.min(Number(this.config.options?.connectTimeoutMs) || Number(this.config.options?.timeoutMs) || 12_000, 12_000);
    const results = await mapLimit(candidates, PROBE_CONCURRENCY, async (model, index) => {
      await sleep(PROBE_STAGGER_MS * index);
      return { model, result: await probeModel(this.config, model.name, signal, probeTimeoutMs) };
    });
    // Rate-limited models are unverifiable (not unavailable): exclude them from
    // the accessible list so the account is never probed again for them right
    // now, and let the caller decide whether to surface the rate limit.
    return results
      .filter(({ result }) => result === "ok")
      .map(({ model }) => model);
  }

  async testConnection(signalOrConfig?: AbortSignal | ProviderConfig): Promise<ProviderStatus> {
    const started = Date.now();
    const signal = abortSignal(signalOrConfig);
    const probeTimeoutMs = Math.min(Number(this.config.options?.connectTimeoutMs) || Number(this.config.options?.timeoutMs) || 12_000, 12_000);
    try {
      const catalog = await super.listModels(signal);
      const candidates = catalog.filter((model) => isChatCandidate(model.name)).slice(0, 8);
      if (!candidates.length) return { ok: false, providerId: this.id, latencyMs: Date.now() - started, message: "No chat models were found for this NVIDIA account." };
      // NVIDIA's model catalogue is public, so prove the credential with a real
      // authenticated chat call against models the account can actually invoke.
      let lastFailure: string | null = null;
      let sawRateLimit = false;
      for (let index = 0; index < candidates.length; index += 1) {
        if (index > 0) await sleep(PROBE_STAGGER_MS);
        const candidate = candidates[index];
        const probeOk = await probeModel(this.config, candidate.name, signal, probeTimeoutMs);
        if (probeOk === "ok") return { ok: true, providerId: this.id, latencyMs: Date.now() - started };
        if (probeOk === "rate-limited") {
          sawRateLimit = true;
          break;
        }
        lastFailure = candidate.name;
      }
      if (sawRateLimit) {
        return { ok: false, providerId: this.id, latencyMs: Date.now() - started, message: "NVIDIA NIM est temporairement limité (HTTP 429 Too Many Requests). Réessayez dans quelques minutes, et réduisez le nombre de rafraîchissements de modèles simultanés." };
      }
      return { ok: false, providerId: this.id, latencyMs: Date.now() - started, message: `The NVIDIA API key was rejected, or no model is currently accessible for this account (tried ${candidates.length} models, last: ${lastFailure}). Enable a model on build.nvidia.com or use another API key.` };
    } catch (error) {
      return { ok: false, providerId: this.id, latencyMs: Date.now() - started, message: error instanceof Error ? error.message : "Connection failed." };
    }
  }
}
