import { WebSearchError, WEB_SEARCH_ERRORS } from "./providers/web-search-provider.js";

const rateLimitStore = new Map<string, { count: number; windowStart: number; dailyCount: number; dailyDate: string }>();
const today = () => new Date().toISOString().slice(0, 10);

export function checkWebSearchRateLimit(userId: string): void {
  const perMinute = Math.max(1, Number(process.env.WEB_SEARCH_REQUESTS_PER_MINUTE) || 10);
  const perDay = Math.max(1, Number(process.env.WEB_SEARCH_REQUESTS_PER_DAY) || 200);
  const now = Date.now();
  const date = today();
  const entry = rateLimitStore.get(userId) || { count: 0, windowStart: now, dailyCount: 0, dailyDate: date };
  if (entry.dailyDate !== date) { entry.dailyCount = 0; entry.dailyDate = date; }
  if (now - entry.windowStart >= 60_000) { entry.count = 0; entry.windowStart = now; }
  if (entry.dailyCount >= perDay) throw new WebSearchError(WEB_SEARCH_ERRORS.QUOTA_EXCEEDED.code, WEB_SEARCH_ERRORS.QUOTA_EXCEEDED.message);
  if (entry.count >= perMinute) throw new WebSearchError(WEB_SEARCH_ERRORS.RATE_LIMITED.code, WEB_SEARCH_ERRORS.RATE_LIMITED.message);
  entry.count += 1;
  entry.dailyCount += 1;
  rateLimitStore.set(userId, entry);
}

export function resetWebSearchRateLimitsForTests(): void { rateLimitStore.clear(); }