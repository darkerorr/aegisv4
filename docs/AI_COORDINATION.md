# Aegis AI coordination

This document is the shared contract between Codex (core/API/security), Claude Opus (desktop UX) and DeepSeek (Web UX).

## Current ownership

- Codex: `apps/api`, `packages/types`, `packages/providers`, `packages/api-client`, `packages/security`, `packages/project-engine`, `src`, Rust native commands, and Windows build scripts.
- Claude Opus: `apps/desktop/src/App.tsx` and desktop visual assets/styles. Codex adds native/service contracts without changing the visual component structure unless explicitly coordinated.
- DeepSeek: `apps/web/src` and Web visual/navigation work. Codex does not rewrite Web pages; the Web consumes the API client and routes below.

## API contract

The development API listens on `http://127.0.0.1:4000` by default. The Web origin is `http://localhost:3000`; CORS allows configured origins with credentials. Browser sessions use an HttpOnly `aegis_session` cookie. Device and CLI clients use a bearer access token.

All errors use:

```ts
type ApiError = { code: string; message: string; details?: unknown; requestId?: string };
```

JSON request/response bodies are documented by `@aegis/types` and `@aegis/api-client`. Authentication routes:

```text
POST /auth/register
POST /auth/login
POST /auth/logout
GET  /auth/me
POST /auth/refresh
POST /auth/forgot-password
POST /auth/reset-password
PATCH /auth/account
PUT  /auth/password
GET  /auth/sessions
DELETE /auth/sessions/:id
POST /auth/device/start
POST /auth/device/approve
GET  /auth/device/status
POST /auth/device/token
```

`REQUIRE_EMAIL_VERIFICATION=false` (the development default) creates a verified account and opens the cookie session immediately. When true, registration returns `emailVerificationRequired: true`; the one-time token is hashed at rest, expires, and is sent by the configured mail adapter.

Provider and chat routes:

```text
GET    /providers
POST   /providers
PATCH  /providers/:id
DELETE /providers/:id
POST   /providers/:id/test
GET    /providers/:id/models
GET    /models
POST   /chat
POST   /chat/stream
GET    /conversations
POST   /conversations
GET    /conversations/:id
PATCH  /conversations/:id
DELETE /conversations/:id
GET    /conversations/:id/messages
```

Streaming is Server-Sent Events (`Content-Type: text/event-stream`). Canonical named events are `message.started`, `message.delta`, `message.completed`, and `message.error`; each `data:` payload is JSON. The payloads remain backwards-compatible with `{ type: "delta", content }` / `{ type: "done", ... }` where a client only reads the data field.

DeepSeek Web account/security calls use `PATCH /auth/account`, `PUT /auth/password`, `GET /auth/sessions`, and `DELETE /auth/sessions/:id`. Legacy `/sessions` and the legacy password body are accepted temporarily but are not part of the canonical contract. Provider creation accepts `type`/`enabled`/`defaultModel` as aliases for `kind`/`active`/`defaultModel`, and responses never contain `apiKey`.

Provider API keys are encrypted at rest by the API with `AEGIS_SESSION_SECRET`; the browser receives only `hasApiKey` and a masked value. Existing legacy plaintext rows are read for migration compatibility and are re-encrypted on the next write.

## Provider contract

`@aegis/providers` exposes `AIProvider` plus `createProvider`. Provider kinds are `ollama`, `lmstudio`, `nvidia-nim`, `openrouter`, `openai-compatible`, and `custom`. Keys are server-side only for Web/API storage and are never returned; provider views expose only `hasApiKey` and masked metadata.

NVIDIA NIM defaults to `https://integrate.api.nvidia.com/v1` and OpenRouter to `https://openrouter.ai/api/v1`. OpenRouter requests include `HTTP-Referer` and `X-Title` when configured. Both use model discovery from `/models`, chat completions, streaming, abort signals, timeouts, and normalized errors.

## Desktop contract

Claude can build against `@aegis/api-client` for auth/providers/chat. Desktop-native commands are named `open_workspace`, `scan_workspace`, `read_workspace_file`, `workspace_trust`, `detect_cli`, `run_cli_doctor`, `start_cli_session`, `detect_ollama`, `detect_lm_studio`, and `delete_secret`. Native commands must keep secrets in the OS keychain and must not log values.

## Windows script contract

- `start.bat` starts API/Web separately, waits for `http://127.0.0.1:4000/health` and `http://localhost:3000`, records service PIDs under `.aegis/run/`, and opens the Web.
- `stop.bat` only targets the recorded API/Web PIDs; it never uses an image-wide `node.exe` kill and leaves Ollama running.
- `start-app.bat` runs the verified workspace script `pnpm.cmd --filter @aegis/desktop tauri:dev`.
- `build-app.bat` and `build-all.bat` use the project Tauri target and verify `apps/desktop/src-tauri/target/release/aegis-app.exe`, NSIS and MSI outputs.
- `install.bat` remains the CLI-only installer and is not used to start services or build the desktop app.

## Files changed by Codex

This section is updated before Codex changes shared files. Existing Claude/DeepSeek files are listed for awareness, not ownership transfer.

- `docs/AI_COORDINATION.md` (this contract)
- `packages/types/src/index.ts` (shared schemas and API types)
- `packages/providers/src/index.ts` and provider adapters (provider runtime)
- `packages/api-client/src/index.ts` (Web/desktop/CLI client)
- `packages/config/src/index.ts`, `.env.example` (runtime configuration)
- `apps/api/prisma/schema.prisma`, `apps/api/src/server.ts`, `apps/api/src/auth.ts` (API/auth)
- `apps/api/prisma/migrations/20260719160000_web_account_provider_contract/migration.sql` (SQLite schema additions for account preferences, session metadata, provider defaults/options and safe conversation deletion)
- `apps/api/src/server.test.ts`, `apps/api/src/auth.test.ts` (API contract/security tests)
- `apps/web/src/app/security/page.tsx`, `apps/web/src/lib/api.ts` (minimal contract adaptation: current/new password fields and normalized API errors)
- `apps/desktop/src-tauri/Cargo.toml`, `apps/desktop/src-tauri/src/lib.rs` (native bridge)
- `start.bat`, `stop.bat`, `start-app.bat`, `build-app.bat`, `build-all.bat` and `scripts/windows/*.ps1` (Windows service, development and build entry points; `install.bat` remains the CLI-only installer)
- `scripts/ensure-prisma-client.mjs`, `apps/api/package.json` (reproducible API build when a valid generated Prisma client is already present)
- `packages/shared-ui/src/components.tsx` (shared `AegisLogo` className contract required by existing Web usage)
- `packages/ai-runtime/src/index.ts` (compatibility facade updated to the shared provider chat response contract)
- `apps/desktop/src/config/api.ts`, `apps/desktop/src/api/client.ts`, `apps/desktop/src/contexts/AuthContext.tsx` (single desktop API configuration, shared client and actionable connection errors)
- `apps/desktop/src/App.tsx`, `apps/desktop/src/styles.css`, desktop auth/navigation/chat pages and components (desktop connected shell, local/offline state and Liquid Glass visual system)
- `apps/desktop/src/components/AuthShell.tsx`, `apps/desktop/src/pages/LoginPage.tsx`, `apps/desktop/src/pages/RegisterPage.tsx`, `apps/desktop/src/pages/WelcomePage.tsx` (shared authentication composition and local-mode entry)
- `apps/desktop/src/api/local.ts`, `apps/desktop/src/contexts/ChatContext.tsx` (direct Ollama/LM Studio local chat path and streamed remote chat state)
- `packages/shared-ui/src/theme/tokens.css` (shared Aegis surface, glass, glow, radius and motion tokens)
- `apps/web/src/lib/config.ts`, `apps/web/src/lib/api.ts`, `apps/web/src/app/globals.css`, `apps/web/src/app/page.tsx` (single Web API configuration and shared visual tokens)
- `apps/web/src/components/AuthForm.tsx`, `apps/web/src/components/Protected.tsx`, `apps/web/src/components/AppShell.tsx`, `apps/web/src/components/SiteNav.tsx` (real Web auth state, public/app navigation and route guards)
- `apps/web/src/app/(app)/layout.tsx`, `apps/web/src/app/projects/page.tsx` and Web account/auth/chat pages (multi-page application routes and functional form/navigation flows)
- `apps/api/src/server.ts`, `packages/config/src/index.ts`, `apps/desktop/src-tauri/tauri.conf.json` (desktop WebView CORS, API origin and CSP alignment)

## Validation status

Run package builds/tests from the repository root. External NVIDIA NIM/OpenRouter calls require keys; without keys, tests must cover validation, normalized authentication errors, and secret redaction.

Current desktop/Web connection contract: development clients use `http://127.0.0.1:4000`; the API allows Web (`http://localhost:3000`) and Tauri (`http://localhost:1420`, `http://127.0.0.1:1420`, `http://tauri.localhost`) origins. Desktop uses `@aegis/api-client`, credentials include the API session cookie, and reports `API_UNREACHABLE`/`API_TIMEOUT` with the configured URL instead of exposing raw `Failed to fetch`.

Current validation: `pnpm build`, `pnpm test`, Web production build, desktop Vite build and `pnpm --filter @aegis/desktop tauri:build` pass. A live register/login/me flow passed against `http://127.0.0.1:4000`; CORS returned `http://tauri.localhost`; Ollama provider testing and a real SSE chat returned `message.started` and `message.completed`. Claude should use the desktop auth shell/status classes and shared API client; DeepSeek should keep `NEXT_PUBLIC_API_URL` pointed at the same API and use the existing normalized API client/error contract.
