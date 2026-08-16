import { WebSearchProvider, WebSearchQuery, WebSearchResult, WebSearchError, WEB_SEARCH_ERRORS, rankWebResults } from "./web-search-provider.js";

function decodeHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/\s+/g, " ").trim();
}

function resultUrl(raw: string): string | null {
  try {
    const parsed = new URL(decodeHtml(raw), "https://html.duckduckgo.com");
    const redirected = parsed.searchParams.get("uddg");
    const target = redirected ? new URL(redirected) : parsed;
    return target.protocol === "http:" || target.protocol === "https:" ? target.href : null;
  } catch { return null; }
}

export class DuckDuckGoProvider implements WebSearchProvider {
  id = "duckduckgo";

  async search(input: WebSearchQuery): Promise<WebSearchResult[]> {
    const configured = Math.max(1, Number(process.env.WEB_SEARCH_MAX_RESULTS) || 8);
    const maxResults = Math.max(1, Math.min(input.maxResults ?? configured, configured, 20));
    try {
      const url = new URL("https://html.duckduckgo.com/html/");
      url.searchParams.set("q", input.query.trim());
      const freshness = input.freshness && input.freshness !== "any" ? { day: "d", week: "w", month: "m", year: "y" }[input.freshness] : undefined;
      if (freshness) url.searchParams.set("df", freshness);
      if (input.country || input.language) url.searchParams.set("kl", `${input.country || "wt"}-${input.language || "en"}`.toLowerCase());
      const response = await fetch(url, { headers: { "User-Agent": "Aegis/0.3 (+local search connector)", Accept: "text/html" } });
      if (!response.ok) throw new WebSearchError(WEB_SEARCH_ERRORS.PROVIDER_ERROR.code, `DuckDuckGo returned HTTP ${response.status}.`);
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.toLowerCase().includes("text/html")) throw new WebSearchError(WEB_SEARCH_ERRORS.PROVIDER_ERROR.code, "DuckDuckGo returned an unexpected content type.");
      const html = await response.text();
      const linkPattern = /<a\b(?=[^>]*\bclass=["'][^"']*\bresult__a\b[^"']*["'])[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      const matches = [...html.matchAll(linkPattern)];
      const results: WebSearchResult[] = [];
      const seen = new Set<string>();
      for (let index = 0; index < matches.length && results.length < maxResults; index += 1) {
        const urlValue = resultUrl(matches[index][1]);
        const title = decodeHtml(matches[index][2]);
        if (!urlValue || !title || seen.has(urlValue)) continue;
        const tail = html.slice((matches[index].index || 0) + matches[index][0].length, matches[index + 1]?.index ?? html.length);
        const snippetMatch = /<(?:a|div)\b(?=[^>]*\bclass=["'][^"']*\bresult__snippet\b[^"']*["'])[^>]*>([\s\S]*?)<\/(?:a|div)>/i.exec(tail);
        const dateMatch = /<span\b(?=[^>]*\bclass=["'][^"']*\bresult__date\b[^"']*["'])[^>]*>([^<]+)<\/span>/i.exec(tail);
        seen.add(urlValue);
        results.push({ title, url: urlValue, snippet: decodeHtml(snippetMatch?.[1] || ""), publishedAt: this.parseDate(dateMatch?.[1]), source: "duckduckgo", rank: results.length + 1 });
      }
      return rankWebResults(input.query, results);
    } catch (cause) {
      if (cause instanceof WebSearchError) throw cause;
      throw new WebSearchError(WEB_SEARCH_ERRORS.PROVIDER_ERROR.code, WEB_SEARCH_ERRORS.PROVIDER_ERROR.message);
    }
  }

  private parseDate(value?: string): string | undefined {
    if (!value) return undefined;
    const date = new Date(decodeHtml(value));
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
}
