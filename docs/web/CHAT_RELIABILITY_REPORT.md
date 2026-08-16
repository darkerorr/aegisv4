# Chat reliability report

## Correctness changes

The model selection store now uses React state as the reactive source of truth and a synchronized ref only for asynchronous submission snapshots. It persists selection and `lastValidSelection` in local storage. Empty/transient model refetches no longer clear a valid selection; a fallback is selected only when a non-empty authoritative model list proves the old model is gone.

Submission captures an immutable snapshot containing messages, model, provider connection, attachment IDs, enabled tools, `clientMessageId`, idempotency key and generation ID. The first-message URL is updated with `history.replaceState` only after a successful terminal stream event, avoiding the historical route-remount abort.

The Web client rejects a stream that closes without `message.completed` or `message.error`, restores the prompt on failure, keeps the user message visible, exposes an error and releases the send lock. Stop produces a client-cancelled state rather than an infinite loader.

The Desktop client was repaired to send the complete shared contract (`attachmentIds`, `toolMode`, `enabledTools`) and now treats an empty local response or remote close without a terminal event as an explicit error.

## Timeouts

- Connect: 15 seconds, `PROVIDER_CONNECT_TIMEOUT`.
- First token: 60 seconds, `PROVIDER_FIRST_TOKEN_TIMEOUT`.
- Idle stream: 45 seconds, `PROVIDER_IDLE_STREAM_TIMEOUT`.
- Total generation: 600 seconds, `PROVIDER_TOTAL_TIMEOUT`.
- Tool: 30 seconds, `TOOL_TIMEOUT`.

A misclassification bug was fixed: if the total deadline is shorter than the active phase deadline, the emitted code is now `PROVIDER_TOTAL_TIMEOUT`. The former generic `Provider request timed out after 120000ms` path is absent.

## Executed tests

- Provider streaming/timeouts: 7 passed, including fragmented SSE, close without `[DONE]`, first-token timeout and total-timeout classification.
- API SSE/idempotency: included in 32/32 passed API tests.
- Web Playwright: 36/36 passed.
- First-message stress: 30 attempts, 30 responses, 0 lost prompts, 0 deselected models.
- Existing-conversation stress: 30 attempts, 30 responses, one consistent model/provider, all client message IDs present.
- Additional sequential-send test: 10/10 streams.
- Conversation open/reload: passed.
- Tools/attachment first-prompt snapshot: passed.

## Not claimed

Reloading a genuinely in-flight remote provider generation and resuming by generation ID is not implemented as a cross-page persisted stream. Navigation is delayed to prevent the first stream from being destroyed; a browser reload during generation still cannot resume an already-open HTTP stream. A real local Ollama prompt returned content, but a long streamed Aegis chat was not run. NVIDIA/OpenRouter live tests remain unavailable because their canonical API keys are absent.