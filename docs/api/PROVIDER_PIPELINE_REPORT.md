# Provider Pipeline Report

## Root Cause: Provider Timeout

### Phase that reached 120 000 ms

The previous code used a single `timeoutMs` of 120 000 ms applied indiscriminately to:

1. HTTP connection
2. First token arrival
3. Full stream duration
4. Non-streaming chat
5. Tool execution
6. Database persistence

When a reasoning model (e.g. DeepSeek R1 on NVIDIA) thinks for 90 seconds before emitting the first token, the original code would keep the connection open until the 120 s limit, then return `Provider request timed out` — a message that conflated "no first token yet" with "connection failed".

### New timeouts

| Timeout | Default | Used for |
|---------|---------|----------|
| `PROVIDER_CONNECT_TIMEOUT_MS` | 15 000 | TCP/TLS handshake |
| `PROVIDER_FIRST_TOKEN_TIMEOUT_MS` | 60 000 | Time to first token after request sent |
| `PROVIDER_IDLE_STREAM_TIMEOUT_MS` | 45 000 | Silence between stream chunks |
| `PROVIDER_TOTAL_TIMEOUT_MS` | 600 000 | Total wall-clock generation time |
| `TOOL_TIMEOUT_MS` | 30 000 | Agent tool execution |

Each timeout generates a distinct error code:

- `PROVIDER_CONNECT_TIMEOUT`
- `PROVIDER_FIRST_TOKEN_TIMEOUT`
- `PROVIDER_IDLE_STREAM_TIMEOUT`
- `PROVIDER_TOTAL_TIMEOUT`

The UI displays a human-readable message for each phase instead of a single generic "timed out".

### Tracing

Every request now logs structured traces:

```
[req_abc] [Chat] Request received
[req_abc] [Chat] Conversation loaded: 34 ms · conversation=conv_123
[req_abc] [Agent] Intent classified: 3 ms · kind=general_chat confidence=0.00
[req_abc] [Provider] Request started: 156 ms
[req_abc] [Provider] First token received: 8 432 ms
[req_abc] [Provider] Stream completed: 16 234 ms
[req_abc] [Chat] Assistant message persisted: 44 ms
[req_abc] [Chat] SSE completed: 16 345 ms
```

Abort reasons are logged distinctly:
- `user-stop` — user clicked Stop
- `user-leave` — client disconnected
- `timeout` — phase timeout triggered
- `component-unmount` — React unmounted mid-stream (fixed)

### Fast path

Messages that do not require tools (no attachments, no explicit tools, low intent confidence) bypass the agent planner entirely and go directly to the provider. The "Tool not needed" guard is still injected to prevent the model from claiming it used tools it didn't.

## Fix: First prompt cancellation

**Root cause** was a race condition:

1. User sends message on `/chat` (no conversationId)
2. Server creates conversation, starts streaming, emits `message.started` with `conversationId`
3. Client calls `window.history.replaceState` to change URL to `/chat/{id}`
4. Next.js detects URL change, **unmounts** ChatView component
5. AbortController is destroyed, submission snapshot is lost
6. New ChatView mounts without the in-flight request, model selection resets

**Fix:**

- Conversation is created **before** streaming starts via `POST /conversations`
- URL is navigated **before** the stream begins
- The stream always operates on a stable `conversationId`
- Model selection uses a `useRef` as single source of truth, never reset by route changes

## Provider Adapter Audit

Verified for NVIDIA NIM, OpenRouter, Ollama, LM Studio:

- endpoint, body, streaming flag all correct
- SSE parser handles `data: [DONE]`, empty lines, fragmented chunks
- NDJSON parser handles Ollama format
- `AbortSignal` propagated through `fetchWithTimeout`
- Reader closed correctly in `finally`
- Event `done` or `completed` always emitted at stream end

## Remaining

- LM Studio pricing will always show "Pricing unavailable" (no metadata endpoint)
- Ollama pricing shows "No provider token fee"
- DOCX parsing is not yet implemented
