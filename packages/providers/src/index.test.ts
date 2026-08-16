import { describe, expect, it } from "vitest";
import { createProvider } from "./index.js";
import { isTransientProviderError, normalizeProviderError, parseSse, providerRateLimitCategory, retryAfterSeconds, transientBackoff } from "./common.js";

describe("providers", () => {
  it("creates an Ollama driver", () => {
    expect(
      createProvider({
        id: "ollama",
        kind: "ollama",
        name: "Ollama",
        baseUrl: "http://127.0.0.1:11434",
        active: true,
      }),
    ).toBeDefined();
  });
  it.each([
    ["meta", "Meta Llama"],
    ["together", "Together AI"],
    ["fireworks", "Fireworks AI"],
    ["perplexity", "Perplexity"],
    ["sambanova", "SambaNova"],
    ["hyperbolic", "Hyperbolic"],
    ["zhipu", "Zhipu AI"],
    ["moonshot", "Moonshot AI"],
    ["minimax", "MiniMax"],
    ["novita", "Novita AI"],
    ["huggingface", "Hugging Face"],
  ])("creates an OpenAI-compatible driver for %s", (kind, name) => {
    const provider = createProvider({
      id: kind,
      kind: kind as never,
      name,
      baseUrl: "https://example.test/v1",
      apiKey: "test-key",
      active: true,
    });
    expect(provider).toBeDefined();
    expect(provider.type).toBe(kind);
  });
  it("sends the Bearer key for a new cloud provider and maps models", async () => {
    const originalFetch = globalThis.fetch;
    let captured: HeadersInit | undefined;
    globalThis.fetch = async (_url, init) => {
      captured = init?.headers;
      return new Response(
        JSON.stringify({ data: [{ id: "Meta-Llama-4-Maverick-17B-128E-Instruct" }] }),
        { status: 200 },
      );
    };
    try {
      const provider = createProvider({
        id: "meta",
        kind: "meta",
        name: "Meta Llama",
        baseUrl: "https://api.llama.com/compat/v1",
        apiKey: "meta-test-key",
        active: true,
      });
      const models = await provider.listModels();
      expect(new Headers(captured).get("Authorization")).toBe("Bearer meta-test-key");
      expect(models.map((m) => m.name)).toEqual(["Meta-Llama-4-Maverick-17B-128E-Instruct"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
  it("lists Ollama models through its local HTTP contract", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ models: [{ name: "qwen2.5-coder" }] }), { status: 200 });
    try {
      const driver = createProvider({
        id: "ollama",
        kind: "ollama",
        name: "Ollama",
        baseUrl: "http://127.0.0.1:11434",
        active: true,
      });
      await expect(
        driver.listModels({
          id: "ollama",
          kind: "ollama",
          name: "Ollama",
          baseUrl: "http://127.0.0.1:11434",
          active: true,
        }),
      ).resolves.toEqual([
        {
          id: "qwen2.5-coder",
          providerId: "ollama",
          name: "qwen2.5-coder",
          type: "chat",
          active: true,
          local: true,
          capabilities: ["chat"],
          favorite: false,
          visible: true,
          available: true,
        },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
  it("normalizes remote authentication failures without exposing the key", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response("invalid key", { status: 401 });
    try {
      const provider = createProvider({
        id: "nim",
        kind: "nvidia-nim",
        name: "NVIDIA NIM",
        baseUrl: "https://example.test/v1",
        active: true,
      });
      await expect(provider.testConnection()).resolves.toMatchObject({
        ok: false,
        message: expect.stringContaining("401"),
      });
      await expect(provider.listModels()).rejects.toMatchObject({ code: "PROVIDER_AUTH_FAILED" });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
  it("turns NVIDIA's Function-not-found 404 into a clear model availability error", () => {
    const body = JSON.stringify({
      status: 404,
      title: "Not Found",
      detail:
        "Function 'e503b15c-62b0-4d69-b532-a88f0bfa2656': Not found for account 'some-account-id'",
    });
    const error = normalizeProviderError(404, body, "NVIDIA NIM");
    expect(error.code).toBe("PROVIDER_MODEL_UNAVAILABLE");
    expect(error.message).toContain("does not expose the selected model");
    expect(error.details).toMatchObject({ status: 404 });
  });
  it.each([
    [529, "Service temporarily overloaded"],
    [503, "Service Unavailable"],
  ])("classifies HTTP %s overload as a retryable PROVIDER_OVERLOADED", (status, body) => {
    const error = normalizeProviderError(status, body, "NVIDIA NIM");
    expect(error.code).toBe("PROVIDER_OVERLOADED");
    expect(isTransientProviderError(error)).toBe(true);
  });
  it("classifies 429 as retryable and 502/504 gateway blips as transient upstream errors", () => {
    const rateLimited = normalizeProviderError(429, "too many requests", "NVIDIA NIM");
    expect(rateLimited.code).toBe("PROVIDER_RATE_LIMITED");
    expect(isTransientProviderError(rateLimited)).toBe(true);
    const gateway = normalizeProviderError(502, "Bad gateway", "NVIDIA NIM");
    expect(gateway.code).toBe("PROVIDER_UPSTREAM_ERROR");
    expect(isTransientProviderError(gateway)).toBe(true);
    const genuine = normalizeProviderError(500, "internal error", "NVIDIA NIM");
    expect(isTransientProviderError(genuine)).toBe(false);
  });
  it("treats a 5xx ApiError (status nested in details) as transient only for retryable codes", () => {
    expect(isTransientProviderError({ code: "PROVIDER_OVERLOADED", details: { status: 529 } })).toBe(true);
    expect(isTransientProviderError({ code: "PROVIDER_UPSTREAM_ERROR", details: { status: 504 } })).toBe(true);
    expect(isTransientProviderError({ code: "PROVIDER_UPSTREAM_ERROR", details: { status: 500 } })).toBe(false);
    expect(isTransientProviderError({ code: "PROVIDER_AUTH_FAILED", details: { status: 401 } })).toBe(false);
  });
  it("treats connect and first-token timeouts as transient but not total timeouts", () => {
    expect(isTransientProviderError({ code: "PROVIDER_CONNECT_TIMEOUT" })).toBe(true);
    expect(isTransientProviderError({ code: "PROVIDER_FIRST_TOKEN_TIMEOUT" })).toBe(true);
    expect(isTransientProviderError({ code: "PROVIDER_IDLE_STREAM_TIMEOUT" })).toBe(false);
    expect(isTransientProviderError({ code: "PROVIDER_TOTAL_TIMEOUT" })).toBe(false);
  });
  it("honors Retry-After in backoff and keeps exponential backoff bounded", () => {
    expect(transientBackoff(0, 5)).toBe(5000);
    expect(transientBackoff(3, 120)).toBe(30000);
    expect(transientBackoff(5)).toBe(30000);
    const delay = transientBackoff(1);
    expect(delay).toBeGreaterThanOrEqual(4000);
    expect(delay).toBeLessThanOrEqual(4800);
  });
  it("adds OpenRouter identification headers to model discovery", async () => {
    const originalFetch = globalThis.fetch;
    let captured: HeadersInit | undefined;
    globalThis.fetch = async (_url, init) => {
      captured = init?.headers;
      return new Response(JSON.stringify({ data: [{ id: "openai/gpt-4o-mini" }] }), {
        status: 200,
      });
    };
    try {
      const provider = createProvider({
        id: "router",
        kind: "openrouter",
        name: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1",
        active: true,
      });
      await provider.listModels();
      expect(new Headers(captured).get("X-Title")).toBe("Aegis");
      expect(new Headers(captured).get("HTTP-Referer")).toBe("http://127.0.0.1:3000");
      expect(new Headers(captured).get("Authorization")).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
  it("authenticates xAI model discovery with the Bearer key", async () => {
    const originalFetch = globalThis.fetch;
    let captured: HeadersInit | undefined;
    globalThis.fetch = async (_url, init) => {
      captured = init?.headers;
      return new Response(JSON.stringify({ data: [{ id: "grok-3" }] }), { status: 200 });
    };
    try {
      const provider = createProvider({
        id: "xai",
        kind: "x-ai",
        name: "xAI",
        baseUrl: "https://api.x.ai/v1",
        apiKey: "xai-test-key",
        active: true,
      });
      const models = await provider.listModels();
      expect(new Headers(captured).get("Authorization")).toBe("Bearer xai-test-key");
      expect(models.map((m) => m.name)).toEqual(["grok-3"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("filters NVIDIA NIM models to those the API key can actually invoke", async () => {
    const originalFetch = globalThis.fetch;
    const catalog = {
      data: [
        { id: "deepseek-ai/deepseek-v4-flash-0731" },
        { id: "01-ai/yi-large" },
        { id: "deepseek-ai/deepseek-coder-6.7b-instruct" },
      ],
    };
    globalThis.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith("/models")) return new Response(JSON.stringify(catalog), { status: 200 });
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (body.model === "deepseek-ai/deepseek-v4-flash-0731")
        return new Response("{}", { status: 200 });
      if (body.model === "01-ai/yi-large")
        return new Response(
          JSON.stringify({
            detail: "Function '23bd454d-b225-49a3-8118-582a62fc51b8': Not found for account 'x'",
          }),
          { status: 404 },
        );
      if (body.model === "deepseek-ai/deepseek-coder-6.7b-instruct")
        return new Response(
          JSON.stringify({
            detail: "Function 'e503b15c-62b0-4d69-b532-a88f0bfa2656': Not found for account 'x'",
          }),
          { status: 404 },
        );
      return new Response("{}", { status: 500 });
    };
    try {
      const provider = createProvider({
        id: "nim",
        kind: "nvidia-nim",
        name: "NVIDIA NIM",
        baseUrl: "https://example.test/v1",
        apiKey: "nvapi-test",
        active: true,
      });
      const models = await provider.listModels();
      expect(models.map((m) => m.name)).toEqual(["deepseek-ai/deepseek-v4-flash-0731"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("detects a premature provider cut: EOF with partial content but no [DONE]/finish_reason throws PROVIDER_STREAM_CUT", async () => {
    const encoder = new TextEncoder();
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"con'));
          controller.enqueue(encoder.encode('tent":"Hello"}}]}\n\n'));
          controller.close();
        },
      }),
    );
    const collect = async () => {
      for await (const _event of parseSse(response, "Mock", {
        firstTokenMs: 100,
        idleMs: 100,
        totalMs: 1_000,
      })) {
        /* consume */
      }
    };
    await expect(collect()).rejects.toMatchObject({ code: "PROVIDER_STREAM_CUT" });
  });

  it("accepts a clean stream end signalled by data: [DONE]", async () => {
    const response = new Response(
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: [DONE]\n\n',
      { status: 200 },
    );
    const events = [];
    for await (const event of parseSse(response, "Mock", {
      firstTokenMs: 100,
      idleMs: 100,
      totalMs: 1_000,
    }))
      events.push(event);
    expect(events).toEqual([{ type: "delta", content: "Hello" }, { type: "done" }]);
  });

  it("accepts a clean close via a finish_reason chunk", async () => {
    const response = new Response(
      'data: {"choices":[{"delta":{"content":"Bye"},"finish_reason":"stop"}]}\n\n',
      { status: 200 },
    );
    const events = [];
    for await (const event of parseSse(response, "Mock", {
      firstTokenMs: 100,
      idleMs: 100,
      totalMs: 1_000,
    }))
      events.push(event);
    expect(events).toEqual([{ type: "delta", content: "Bye" }, { type: "done" }]);
  });

  it("marks 429 as rate limited and carries the provider Retry-After seconds", () => {
    const error = normalizeProviderError(
      429,
      '{"error":"Rate limit exceeded"}',
      "Mistral",
      new Headers({ "retry-after": "7" }),
    );
    expect(error.code).toBe("PROVIDER_RATE_LIMITED");
    expect(error.status).toBe(429);
    expect(error.details).toMatchObject({ retryAfter: 7 });
    expect(error.message).toContain("Mistral (429)");
  });
  it("keeps structured 429 details (status/code/type/body) when no Retry-After header is sent", () => {
    const error = normalizeProviderError(
      429,
      '{"error":{"message":"Rate limit exceeded","type":"rate_limited","code":"1300"}}',
      "Mistral",
    );
    expect(error.code).toBe("PROVIDER_RATE_LIMITED");
    expect(error.details).toMatchObject({
      status: 429,
      providerCode: "1300",
      errorType: "rate_limited",
    });
    expect(providerRateLimitCategory(error)).toBe("model");
  });
  it("parses NVIDIA NIM RFC 7807 problem-details 429 bodies cleanly", () => {
    const error = normalizeProviderError(
      429,
      JSON.stringify({ status: 429, title: "Too Many Requests" }),
      "NVIDIA NIM",
    );
    expect(error.code).toBe("PROVIDER_RATE_LIMITED");
    expect(isTransientProviderError(error)).toBe(true);
    expect(error.details).toMatchObject({
      status: 429,
      errorType: "Too Many Requests",
    });
    expect(error.message).toBe("NVIDIA NIM (429): Too Many Requests");
    expect(providerRateLimitCategory(error)).toBe("unknown");
  });
  it("parses RFC 7807 titles as the error reason for non-429 problem-details bodies", () => {
    const error = normalizeProviderError(
      400,
      JSON.stringify({ status: 400, title: "Bad Request" }),
      "Mistral",
    );
    expect(error.code).toBe("PROVIDER_REQUEST_FAILED");
    expect(error.details).toMatchObject({ errorType: "Bad Request" });
    expect(error.message).toBe("Mistral (400): Bad Request");
  });
  it("drops empty assistant messages from the wire body (Mistral 400 tool_calls guard)", async () => {
    const originalFetch = globalThis.fetch;
    let sentBody: Record<string, unknown> = {};
    globalThis.fetch = async (_url, init) => {
      sentBody = JSON.parse(String(init?.body ?? "{}"));
      return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "hi" } }] }), { status: 200 });
    };
    try {
      const provider = createProvider({
        id: "mistral",
        kind: "mistral",
        name: "Mistral",
        baseUrl: "https://example.test/v1",
        apiKey: "test-key",
        active: true,
      });
      await provider.chat({
        providerId: "mistral",
        model: "codestral-latest",
        conversationId: "c1",
        messages: [
          { role: "user", content: "salut" },
          { role: "assistant", content: "" },
          { role: "user", content: "comment vas-tu" },
        ],
        privacyMode: "remote-provider",
        attachmentIds: [],
        toolMode: "auto",
        enabledTools: [],
      });
      const wire = sentBody.messages as Array<{ role: string; content?: string }>;
      expect(wire).toHaveLength(2);
      expect(wire.map((message) => message.role)).toEqual(["user", "user"]);
      expect(wire.every((message) => message.content !== undefined && message.content !== null)).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
  it("pairs tool results with the tool_calls actually sent and drops orphans (Mistral unexpected tool call id)", async () => {
    const originalFetch = globalThis.fetch;
    const sentBodies: Array<{ messages: Array<{ role: string; tool_call_id?: string; tool_calls?: Array<{ id: string }>; content?: unknown }> }> = [];
    globalThis.fetch = async (_url, init) => {
      sentBodies.push(JSON.parse(String(init?.body ?? "{}")));
      return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "hi" } }] }), { status: 200 });
    };
    try {
      const provider = createProvider({
        id: "mistral",
        kind: "mistral",
        name: "Mistral",
        baseUrl: "https://example.test/v1",
        apiKey: "test-key",
        active: true,
      });
      const request = {
        providerId: "mistral",
        model: "codestral-latest",
        conversationId: "c1",
        privacyMode: "remote-provider" as const,
        attachmentIds: [],
        toolMode: "auto" as const,
        enabledTools: [],
        messages: [
          { role: "user" as const, content: "Cherche" },
          { role: "assistant" as const, content: "", toolCalls: [{ id: "e6h2hGsTp", name: "web.search", arguments: "{}" }] },
          { role: "tool" as const, content: "resultat", toolCallId: "e6h2hGsTp" },
          { role: "user" as const, content: "Et maintenant" },
          { role: "assistant" as const, content: "" },
          { role: "tool" as const, content: "orphan result", toolCallId: "call_orphan" },
        ],
      };
      await provider.chat(request);
      const wire = sentBodies[0].messages;
      expect(wire.map((message) => message.role)).toEqual(["user", "assistant", "tool", "user"]);
      expect(wire[1]).toMatchObject({ role: "assistant", content: null, tool_calls: [{ id: "e6h2hGsTp" }] });
      expect(wire[2]).toMatchObject({ role: "tool", tool_call_id: "e6h2hGsTp" });
      // The orphan tool result (no matching assistant tool_call) must never reach the wire.
      expect(wire.some((message) => message.tool_call_id === "call_orphan")).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
  it("classifies 403 as auth failure and 404 model bodies as PROVIDER_MODEL_NOT_FOUND", () => {
    const forbidden = normalizeProviderError(403, "forbidden", "Mistral");
    expect(forbidden.code).toBe("PROVIDER_AUTH_FAILED");
    const missingModel = normalizeProviderError(
      404,
      '{"error":{"message":"The model `glm-5-2` does not exist","type":"invalid_request_error","code":"model_not_found"}}',
      "Mistral",
    );
    expect(missingModel.code).toBe("PROVIDER_MODEL_NOT_FOUND");
    expect(missingModel.details).toMatchObject({ providerCode: "model_not_found" });
  });
  it("classifies account-level rate limits as quota, not model-level", () => {
    const account = normalizeProviderError(
      429,
      '{"error":{"message":"You have exceeded your quota","type":"insufficient_quota","code":"insufficient_quota"}}',
      "OpenAI",
    );
    expect(providerRateLimitCategory(account)).toBe("account");
    const unknown = normalizeProviderError(429, "Rate limit exceeded", "Mistral");
    expect(providerRateLimitCategory(unknown)).toBe("unknown");
  });
  it("parses Retry-After as HTTP-date and as raw seconds", () => {
    expect(retryAfterSeconds(new Headers({ "retry-after": "3" }))).toBe(3);
    const later = new Date(Date.now() + 5_000).toUTCString();
    expect(retryAfterSeconds(new Headers({ "retry-after": later }))).toBeGreaterThanOrEqual(4);
    expect(retryAfterSeconds(new Headers({ "retry-after": later }))).toBeLessThanOrEqual(6);
    expect(retryAfterSeconds(undefined)).toBeUndefined();
    expect(retryAfterSeconds({ "retry-after": "1" })).toBe(1);
  });
});
