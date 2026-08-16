import type http from "node:http";
import { randomBytes } from "node:crypto";
import { DuckDuckGoProvider, registerWebSearchProvider, getConfiguredProvider, isWebSearchConfigured, checkWebSearchRateLimit, WebSearchError, WEB_SEARCH_ERRORS } from "@aegis/tools";
import { readPageContent } from "@aegis/tools";
import type { User } from "@prisma/client";

// Register the DuckDuckGo provider on first import
registerWebSearchProvider(new DuckDuckGoProvider());

type AuthResult = { user: User; sessionId: string } | null;

function json(res: http.ServerResponse, status: number, value: unknown, requestId?: string): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(requestId ? { "X-Request-Id": requestId } : {}) });
  res.end(JSON.stringify(value));
}

function error(res: http.ServerResponse, status: number, code: string, message: string, requestId?: string): void {
  json(res, status, { code, message, ...(requestId ? { requestId } : {}) }, requestId);
}

async function readJson(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const value = Buffer.from(chunk);
    size += value.length;
    if (size > 64 * 1024) throw new WebSearchError("PAYLOAD_TOO_LARGE", "The request is too large.");
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function requireAuth(currentUser: () => Promise<AuthResult>, res: http.ServerResponse): Promise<NonNullable<AuthResult> | null> {
  const auth = await currentUser();
  if (!auth) error(res, 401, "AUTH_REQUIRED", "Authentication required.");
  return auth;
}

export async function handleWebSearchRoute(
  request: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  method: string,
  requestId: string,
  currentUser: () => Promise<AuthResult>,
): Promise<boolean> {
  if (!url.pathname.startsWith("/tools/web-search")) return false;

  const auth = await requireAuth(currentUser, res);
  if (!auth) return true;

  try {
    if (url.pathname === "/tools/web-search/status" && method === "GET") {
      const configured = isWebSearchConfigured();
      const provider = getConfiguredProvider();
      json(res, 200, {
        configured,
        provider: provider?.id || null,
        available: configured,
      }, requestId);
      return true;
    }

    if (url.pathname === "/tools/web-search/search" && method === "POST") {
      checkWebSearchRateLimit(auth.user.id);
      const body = await readJson(request) as { query?: string; maxResults?: number; freshness?: string; language?: string; country?: string };
      if (!body.query?.trim()) {
        error(res, 400, "VALIDATION_ERROR", "A search query is required.", requestId);
        return true;
      }
      const provider = getConfiguredProvider();
      if (!provider) {
        error(res, 503, WEB_SEARCH_ERRORS.NOT_CONFIGURED.code, WEB_SEARCH_ERRORS.NOT_CONFIGURED.message, requestId);
        return true;
      }
      const freshness = body.freshness as "day" | "week" | "month" | "year" | "any" | undefined;
      const results = await provider.search({
        query: body.query,
        maxResults: Math.min(body.maxResults ?? (Number(process.env.WEB_SEARCH_MAX_RESULTS) || 8), (Number(process.env.WEB_SEARCH_MAX_RESULTS) || 8)),
        freshness: freshness || "any",
        language: body.language,
        country: body.country,
      });
      json(res, 200, { query: body.query, results, resultCount: results.length }, requestId);
      return true;
    }

    if (url.pathname === "/tools/web-search/read" && method === "POST") {
      checkWebSearchRateLimit(auth.user.id);
      const body = await readJson(request) as { url?: string };
      if (!body.url?.trim()) {
        error(res, 400, "VALIDATION_ERROR", "A URL is required.", requestId);
        return true;
      }
      const { content, title, contentType } = await readPageContent(body.url);
      json(res, 200, { url: body.url, title, content: content.slice(0, 100_000), contentType }, requestId);
      return true;
    }
  } catch (err) {
    if (err instanceof WebSearchError) {
      const status = err.code === "WEB_SEARCH_RATE_LIMITED" || err.code === "WEB_SEARCH_QUOTA_EXCEEDED" ? 429
        : err.code === "URL_BLOCKED" ? 403
        : err.code === "PAGE_TOO_LARGE" ? 413
        : err.code === "WEB_SEARCH_TIMEOUT" ? 504
        : 502;
      error(res, status, err.code, err.message, requestId);
    } else {
      error(res, 502, "WEB_SEARCH_ERROR", "Web search encountered an error.", requestId);
    }
    return true;
  }
  return false;
}
