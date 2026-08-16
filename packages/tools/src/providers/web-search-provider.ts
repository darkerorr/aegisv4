export type WebSearchQuery = {
  query: string;
  maxResults?: number;
  freshness?: "day" | "week" | "month" | "year" | "any";
  language?: string;
  country?: string;
};

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
  source?: string;
  rank: number;
  domain?: string;
  site?: string;
  score?: number;
  sourceType?: "official" | "primary" | "technical" | "news" | "community" | "other";
};

export interface WebSearchProvider {
  id: string;
  search(input: WebSearchQuery): Promise<WebSearchResult[]>;
}

const providers = new Map<string, WebSearchProvider>();

export function registerWebSearchProvider(provider: WebSearchProvider): void {
  providers.set(provider.id, provider);
}

export function getWebSearchProvider(id: string): WebSearchProvider | undefined {
  return providers.get(id);
}

export function getConfiguredProvider(): WebSearchProvider | undefined {
  const configuredId = process.env.WEB_SEARCH_PROVIDER || "duckduckgo";
  return providers.get(configuredId);
}

export function isWebSearchConfigured(): boolean {
  return getConfiguredProvider() !== undefined;
}

export const WEB_SEARCH_ERRORS = {
  NOT_CONFIGURED: { code: "WEB_SEARCH_NOT_CONFIGURED", message: "Web search has not been configured on this Aegis instance." },
  TIMEOUT: { code: "WEB_SEARCH_TIMEOUT", message: "Web search timed out." },
  PROVIDER_ERROR: { code: "WEB_SEARCH_PROVIDER_ERROR", message: "The search provider returned an error." },
  RATE_LIMITED: { code: "WEB_SEARCH_RATE_LIMITED", message: "Web search rate limit exceeded. Try again later." },
  QUOTA_EXCEEDED: { code: "WEB_SEARCH_QUOTA_EXCEEDED", message: "Daily web search quota exceeded." },
  URL_BLOCKED: { code: "URL_BLOCKED", message: "This URL cannot be accessed for security reasons." },
  PAGE_TOO_LARGE: { code: "PAGE_TOO_LARGE", message: "The page is too large to read." },
  PAGE_UNREADABLE: { code: "PAGE_UNREADABLE", message: "Could not read the page content." },
} as const;

export type WebSearchErrorCode = keyof typeof WEB_SEARCH_ERRORS;

export class WebSearchError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "WebSearchError";
  }
}

/**
 * Keep the provider's exact URL while removing duplicate result pages and
 * ranking the small set of useful sources. This is deliberately deterministic
 * and metadata-only: it never invents a URL or claims a page was opened.
 */
export function rankWebResults(query: string, results: WebSearchResult[]): WebSearchResult[] {
  const terms = query.toLowerCase().split(/[^a-z0-9]+/i).filter((term) => term.length > 2);
  const seen = new Set<string>();
  const scored = results.filter((result) => {
    try {
      const parsed = new URL(result.url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
      parsed.hash = "";
      for (const key of [...parsed.searchParams.keys()]) {
        if (/^(utm_|fbclid$|gclid$|ref$)/i.test(key)) parsed.searchParams.delete(key);
      }
      const canonical = parsed.toString().replace(/\/$/, "");
      if (seen.has(canonical)) return false;
      seen.add(canonical);
      return Boolean(result.title.trim() && result.snippet.trim());
    } catch {
      return false;
    }
  }).map((result, index) => {
    const parsed = new URL(result.url);
    const domain = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const haystack = `${result.title} ${result.snippet} ${domain}`.toLowerCase();
    const termMatches = terms.filter((term) => haystack.includes(term)).length;
    const official = /(^|\.)((gov|edu)|github\.com|developer\.mozilla\.org|nodejs\.org|nextjs\.org|react\.dev|typescriptlang\.org|docs\.python\.org)$/.test(domain);
    const technical = /(^|\.)(github\.com|stackoverflow\.com|npmjs\.com|pypi\.org|readthedocs\.io)$/.test(domain) || /docs?|api|reference|issue|release/i.test(result.title);
    const sourceType: NonNullable<WebSearchResult["sourceType"]> = official ? "official" : technical ? "technical" : /news|reuters|bbc|apnews/i.test(domain) ? "news" : /reddit|stackoverflow|github/i.test(domain) ? "community" : "other";
    const score = Math.min(1, (termMatches / Math.max(terms.length, 1)) * 0.55 + (official ? 0.3 : technical ? 0.18 : 0) + Math.max(0, 0.15 - index * 0.01));
    return { ...result, rank: index + 1, domain, site: domain, score, sourceType };
  });
  return scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map((result, index) => ({ ...result, rank: index + 1 }));
}
