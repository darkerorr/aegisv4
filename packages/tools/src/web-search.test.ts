import { afterEach, describe, expect, it, vi } from "vitest";
import { DuckDuckGoProvider } from "./providers/duckduckgo.js";
import { WebSearchError, rankWebResults } from "./providers/web-search-provider.js";
import { checkWebSearchRateLimit, resetWebSearchRateLimitsForTests } from "./rate-limiter.js";
import { readPageContent, validateUrl } from "./ssrf.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.WEB_SEARCH_TIMEOUT_MS;
  delete process.env.WEB_SEARCH_MAX_PAGE_SIZE_KB;
  delete process.env.WEB_SEARCH_REQUESTS_PER_MINUTE;
  delete process.env.WEB_SEARCH_REQUESTS_PER_DAY;
  resetWebSearchRateLimitsForTests();
});

describe("web reader SSRF policy", () => {
  it.each([
    "file:///etc/passwd",
    "http://localhost:4000/health",
    "http://127.1.2.3/",
    "http://10.2.3.4/",
    "http://172.31.4.5/",
    "http://192.168.1.2/",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/",
    "http://[fc00::1]/",
    "http://[fe80::1]/",
    "http://[::ffff:127.0.0.1]/",
  ])("blocks %s", async (url) => {
    await expect(validateUrl(url)).resolves.toMatchObject({ ok: false, code: "URL_BLOCKED" });
  });

  it("blocks a redirect from a public address to a private address", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 302, headers: { Location: "http://127.0.0.1/private" } })));
    await expect(readPageContent("http://8.8.8.8/start")).rejects.toMatchObject({ code: "URL_BLOCKED" });
  });

  it("rejects a declared body larger than the configured maximum", async () => {
    process.env.WEB_SEARCH_MAX_PAGE_SIZE_KB = "1";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("small", { status: 200, headers: { "Content-Type": "text/html", "Content-Length": "2048" } })));
    await expect(readPageContent("http://8.8.8.8/page")).rejects.toMatchObject({ code: "PAGE_TOO_LARGE" });
  });

  it("rejects non-text content without executing it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array([0, 1, 2]), { status: 200, headers: { "Content-Type": "application/octet-stream" } })));
    await expect(readPageContent("http://8.8.8.8/file")).rejects.toMatchObject({ code: "PAGE_UNREADABLE" });
  });
});

describe("DuckDuckGo provider", () => {
  it("parses real result markup, resolves redirect links and deduplicates URLs", async () => {
    const target = encodeURIComponent("https://example.com/node-release");
    const html = `<div class="result"><a class="result__a" href="//duckduckgo.com/l/?uddg=${target}">Node &amp; release</a><a class="result__snippet">Stable &lt;release&gt;</a></div><div class="result"><a class="result__a" href="//duckduckgo.com/l/?uddg=${target}">Duplicate</a></div>`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=UTF-8" } })));
    await expect(new DuckDuckGoProvider().search({ query: "node release" })).resolves.toEqual([
      expect.objectContaining({ title: "Node & release", url: "https://example.com/node-release", snippet: "Stable <release>", source: "duckduckgo", rank: 1 }),
    ]);
  });

  it("returns an empty list for a valid no-results page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html><body>No results.</body></html>", { status: 200, headers: { "Content-Type": "text/html" } })));
    await expect(new DuckDuckGoProvider().search({ query: "nothing" })).resolves.toEqual([]);
  });
});

describe("web search rate limits", () => {
  it("enforces per-user minute limits with a structured error", () => {
    process.env.WEB_SEARCH_REQUESTS_PER_MINUTE = "1";
    process.env.WEB_SEARCH_REQUESTS_PER_DAY = "10";
    checkWebSearchRateLimit("rate-user");
    expect(() => checkWebSearchRateLimit("rate-user")).toThrowError(WebSearchError);
    try { checkWebSearchRateLimit("rate-user"); } catch (error) { expect(error).toMatchObject({ code: "WEB_SEARCH_RATE_LIMITED" }); }
  });
});

describe("web result quality", () => {
  it("deduplicates tracking variants and prioritizes relevant official sources", () => {
    const results = rankWebResults("Next.js webpack error", [
      { title: "Generic article", url: "https://example.com/webpack?utm_source=x", snippet: "webpack error guide", rank: 1 },
      { title: "Next.js documentation", url: "https://nextjs.org/docs?utm_source=x", snippet: "Webpack configuration and errors", rank: 2 },
      { title: "Copy", url: "https://example.com/webpack#copy", snippet: "webpack error guide", rank: 3 },
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ domain: "nextjs.org", sourceType: "official" });
    expect(results.every((result) => result.url.startsWith("http"))).toBe(true);
  });
});
