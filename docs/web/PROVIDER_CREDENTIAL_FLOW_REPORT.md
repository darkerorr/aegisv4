# Provider credential flow — 23 July 2026

## Exact cause

`apps/web/src/features/providers/providers-grid.tsx` rendered only two actions. `Test connection` called the provider test mutation unconditionally. `Enable` called `PATCH /providers/:databaseId` with `active: true`.

There was no dialog state, no credential input, no Radix Dialog instance and no call to either existing connect method. The click was not blocked by CSS, a portal or an overlay: the handler performed the wrong action by design. Consequently an empty NVIDIA NIM or OpenRouter record could be enabled without ever receiving a credential.

## Web correction

- Added `features/providers/components/ProviderCredentialDialog.tsx`.
- Radix Dialog provides portal, overlay, focus trap, Escape, outside click, scroll containment and focus restoration.
- The only action without a credential is now `Connect`; `Enable` is reserved for a configured but disabled provider.
- `Test connection` is disabled without a credential and exposes the tooltip “Add an API key before testing this provider.”
- The password field supports paste, Show/Hide, Enter, validation and `autocomplete="off"`.
- Configure never receives or reveals the stored key. It first presents `A credential is already configured`, then accepts a replacement.
- The explicit states are idle, submitting, testing, discovering models, success, invalid key, network error and provider error.
- A failed replacement keeps the dialog and typed correction value open. A successful request clears the secret before closing.
- Providers and Models TanStack Query caches are invalidated together; the chat ModelSelector sees the discovered model without a page reload.
- Test, refresh, enable, disable, configure and disconnect are distinct actions.

## Canonical identifiers

Shared `ProviderId` values are `nvidia-nim`, `openrouter`, `ollama` and `lm-studio`. The API contains an explicit compatibility adapter for legacy `nvidia`, `nvidia_nim`, `nim` and `lmstudio` values. New browser requests use only canonical IDs.

## Browser security

The secret exists only in the controlled password input while the dialog is open and in the one connect request body. It is not written to URL, localStorage, sessionStorage or Query cache. The provider list returns `secretConfigured`, not the raw or masked secret. The Playwright assertion serializes DOM, localStorage and sessionStorage after success and verifies that the submitted placeholder is absent.

## Automated evidence

- Web lint: passed.
- Web unit tests: 2/2 passed.
- Production Next build: passed, 58 pages generated.
- Playwright: 26/26 passed.
- NVIDIA scenario: dialog opened, password field focused, connect completed, card changed to Connected and `nvidia/deepseek-r1` appeared in the chat selector.
- OpenRouter scenario: Escape closed the dialog; invalid-key submission kept it open with a readable error and preserved the editable field.

Screenshots:

- `apps/web/test-results/screenshots/provider-nvidia-connected.png`
- `apps/web/test-results/screenshots/provider-openrouter-invalid.png`

## Live-provider limitation

No `NVIDIA_NIM_API_KEY` or `OPENROUTER_API_KEY` was present in the local environment. No live external model count is therefore claimed. Controlled API tests discovered 2 NVIDIA models; browser mocks exposed 1 NVIDIA and 1 OpenRouter model to exercise cache and selector behavior. A real-key smoke test remains environment-dependent and must never place a credential in Git, logs, reports or screenshots.
