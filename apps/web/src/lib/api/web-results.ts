/**
 * View model for a web search result surfaced in the chat UI. This mirrors the
 * `web.results` SSE event emitted by the API so the frontend never fabricates
 * URLs — every entry comes from the provider's real response.
 */
export type WebSearchResultView = {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
  source?: string;
  rank: number;
  site?: string;
  domain?: string;
  score?: number;
  sourceType?: "official" | "primary" | "technical" | "news" | "community" | "other";
};
