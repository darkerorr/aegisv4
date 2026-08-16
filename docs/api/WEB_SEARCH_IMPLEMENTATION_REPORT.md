# Web Search implementation report

## Implementation

`WEB_SEARCH_PROVIDER=duckduckgo` works without an API key. The tool registry exposes implemented server executors for `web.search` and `web.readPage`; status never returns a key.

### Search

- Inputs: query, maxResults, freshness, language and country.
- Outputs: title, URL, snippet, published time when available, source and rank.
- DuckDuckGo HTML responses are checked for status and content type.
- Redirect wrappers are unwrapped.
- HTML entities are decoded.
- Invalid URLs and duplicates are removed.
- Maximum results and timeouts are enforced.
- Empty and malformed result sets stay empty rather than fabricating sources.

### Page reading / SSRF

The reader permits only HTTP/HTTPS, rejects credentials, localhost names, loopback, private/link-local/reserved IPv4, private/local/mapped IPv6 and cloud metadata targets. A and AAAA answers are validated before connection. Every redirect target is revalidated. Redirect count, response size, timeout and text-like content types are bounded. JavaScript is never executed.

This materially reduces DNS-rebinding exposure by validating resolved addresses and avoiding arbitrary browser execution; as with any hostname fetcher, infrastructure-level egress policy remains the strongest additional defense.

### Routes

- `GET /tools/web-search/status`
- `POST /tools/web-search/search`
- `POST /tools/web-search/read`

Authenticated sessions are required for search/read. Per-minute and per-day limits are applied. Errors are structured and keys are never returned.

### Chat integration

The intent classifier triggers current/public lookups and avoids greetings, translation, supplied-text rewriting and simple arithmetic. Chat emits `tool.requested`, `tool.started`, `tool.completed`/`tool.failed`, then `writing-answer`. The system guard forbids claiming a search unless a successful tool result is in context. Tool calls have an explicit 30-second deadline and return `TOOL_TIMEOUT`.

## Tests

The Tools suite passed 20/20 tests, including search parsing/deduplication, malformed/empty results, timeout behavior, localhost, private IPv4, private IPv6, metadata, private redirect, MIME and size limits. The agent-runtime suite passed 8/8 intent tests.