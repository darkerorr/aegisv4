# Product stabilization report

## Workspace and repository evidence

Workspace verified: `C:\Users\ROOT\Documents\Aegis-Cli`.

All requested top-level components were found except a root `prisma` directory; the actual Prisma schema/migrations are correctly located under `apps/api/prisma`. The unrelated Discord directory was never accessed.

The `.git` directory in this workspace is empty: it has no HEAD, index or config. Therefore `git status --short`, `git diff --stat` and `git diff` cannot identify DeepSeek's original delta. No reset, checkout or broad deletion was attempted. The list below is the exact set changed during this stabilization session, not a reconstructed claim about the prior agent.

## Root causes

1. Launcher/parser: the current initial file already parsed, so the historical quote error was not reproducible. The launcher still lacked a strong stop/wait/build invariant and canonical environment import.
2. Asset mismatch: an old `next start` could retain manifests while `.next` was rebuilt, leaving HTML that referenced removed chunk hashes. Stop/identity/port wait/build/BUILD_ID/start/MIME verification is now ordered.
3. GitHub 409: connection/configuration/state/conflict cases were collapsed. Current missing-secret behavior is explicit HTTP 503 `GITHUB_NOT_CONFIGURED`; only another user's installation is a real HTTP 409.
4. Environment: root and API env files contained duplicate/contradictory values and launch methods loaded them differently. Root `.env` is canonical; `apps/api/.env` only retains Prisma's database URL.
5. Prisma client: generation was considered present even when stale relative to the schema. A schema hash now controls regeneration.
6. GitHub tools: repository pagination could duplicate pages; installation ownership and normalized tool execution required consolidation.
7. Web Search: SSRF/DNS/redirect/MIME/size protections and DuckDuckGo parsing required hardening and direct tests.
8. Chat: ref-plus-render-counter model selection was non-reactive; terminal stream enforcement and timeout classification had gaps.
9. Desktop: the shared ChatRequest contract had evolved but Desktop omitted required tool/attachment fields.

## Environment priority

- Explicit process environment always wins.
- Launcher loads non-duplicate values from root `.env` and does not overwrite explicit process values.
- API direct execution loads explicit environment, then non-empty root `.env`, then non-empty legacy `apps/api/.env` only as fallback.
- Prisma CLI reads `apps/api/.env`, which now contains only `DATABASE_URL="file:./dev.db"` matching the root value.
- Next production launched by `start.bat` inherits the canonical root values. Public URL defaults remain safe for direct builds.
- `.env.example` contains placeholders only.

The compromised GitHub client secret was cleared, not reused. The root PEM remains in place, is ignored, readable and format-valid. The Git index cannot be checked or modified because `.git` is empty.

## Exact source/config files modified

- `.env` (local canonical normalization; ignored)
- `.env.example`
- `.gitignore`
- `apps/api/.env`
- `scripts/ensure-prisma-client.mjs`
- `scripts/config/normalize-env.mjs`
- `scripts/config/check-integration-duplicates.mjs`
- `scripts/web/ensure-web-build.mjs`
- `scripts/web/verify-next-assets.mjs`
- `scripts/web/validate-web-search.mjs`
- `scripts/windows/aegis-common.ps1`
- `scripts/windows/start.ps1`
- `apps/api/src/config/environment.ts`
- `apps/api/src/server.ts`
- `apps/api/src/integrations/github/index.ts`
- `apps/api/src/integrations/github/index.test.ts`
- `apps/api/src/integrations/github-integration.ts`
- `apps/api/src/integrations/github-tools.ts`
- `apps/api/src/integrations/github-tools.test.ts`
- `apps/api/src/integrations/web-search.ts`
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260729230000_unique_integration_provider_account/migration.sql`
- `apps/web/src/components/feedback/state-panel.tsx`
- `apps/web/src/app/(workspace)/github/page.tsx`
- `apps/web/src/lib/api/integrations.ts`
- `apps/web/src/features/connections/connections-grid.tsx`
- `apps/web/src/features/chat/chat-view.tsx`
- `apps/web/src/features/chat/model-selection-store.tsx`
- `apps/web/src/lib/config/attachments.ts`
- `apps/web/src/features/projects/project-detail-view.tsx`
- `apps/web/playwright.config.ts`
- `apps/web/e2e/production-assets.spec.ts`
- `apps/web/e2e/projects.spec.ts`
- `packages/types/src/index.ts`
- `packages/api-client/src/index.ts`
- `packages/providers/src/common.ts`
- `packages/providers/src/openai-compatible.ts`
- `packages/providers/src/ollama.ts`
- `packages/providers/src/index.test.ts`
- `packages/tools/src/index.ts`
- `packages/tools/src/ssrf.ts`
- `packages/tools/src/rate-limiter.ts`
- `packages/tools/src/providers/duckduckgo.ts`
- `packages/tools/src/web-search.test.ts`
- `packages/agent-runtime/src/index.ts`
- `packages/agent-runtime/src/index.test.ts`
- `apps/desktop/src/contexts/ChatContext.tsx`
- the nine requested reports under `docs/launcher`, `docs/api`, `docs/web`, and `docs/desktop`.

Runtime artifacts also changed as expected: generated `.next`, package `dist` directories, Prisma client/cache/database state, logs, Playwright results and Tauri `target`/bundle output.

## Automated tests executed

| Command/group | Passed | Failed | Skipped | Duration/result |
|---|---:|---:|---:|---|
| `pnpm.cmd install` | dependency verification | 0 | 0 | 2.1 s, lockfile current |
| five required package builds | 5 | 0 | 0 | 2.8–4.3 s each |
| Providers tests | 7 | 0 | 0 | 0.857 s |
| Tools tests | 20 | 0 | 0 | 0.856 s |
| Agent runtime tests | 8 | 0 | 0 | 1.33 s |
| API lint/test/build | 32 tests + lint/build | 0 | 0 | tests 6.57 s; full sequence 18.1 s |
| Web lint/test/build | 2 tests + lint/build | 0 | 0 | tests 1.59 s; full sequence 65.8 s |
| Playwright Chromium | 36 | 0 | 0 | 1.4 min |
| Desktop lint/test/build | 14 tests + lint/build | 0 | 0 | tests 1.08 s; sequence 17.4 s |
| Tauri release/bundles | build | 0 | 0 | 150.2 s |
| Real DuckDuckGo validation | 5 sources | 0 | 0 | 1.2 s |
| Next asset validator | 7 routes / 39 assets | 0 | 0 | 0.8 s |

An earlier Playwright attempt had 34 passes and one infrastructure failure because its intentionally bounded background launcher expired. It was not counted as success; the complete rerun passed 36/36.

## Functional status

- Projects CRUD and project/conversation link/unlink API routes exist and ownership is checked. A duplicated fallback route block was removed. The project detail UI exposes Overview, Chats, Files, Instructions, GitHub and Settings; Start chat, Move existing conversation and Remove from project passed Chromium. Files explicitly reports that project-scoped storage is unavailable.
- Attachments validate configurable size and only advertise implemented text/image formats. PDF and DOCX are not advertised as parseable.
- Tools popup honestly disables unimplemented/unconnected tools.
- Model pricing UI uses provider metadata or `Pricing unavailable`; local models say no provider token fee and mention hardware cost.
- Account delete/export/session controls exist and use API data.
- Docs/privacy/download passed existing Chromium scenarios and do not fabricate registry availability or legal identity.

## Unavailable / not verified

- Real GitHub authorization/install/callback/repositories/chat: blocked by the intentionally blank rotated `GITHUB_CLIENT_SECRET`.
- Interactive private-window browser check: no integrated browser tab was available; Chromium automation passed.
- Gmail latest-mail: real Aegis integration read succeeded; output was restricted to booleans and exposed no message data.
- Ollama: local runtime reachable with one model; a real prompt returned a non-empty two-character answer. Adapter streaming/timeouts are additionally unit-tested.
- NVIDIA and OpenRouter live prompts: unavailable because both API keys are absent in the canonical `.env`.
- In-flight stream resume after a hard page reload: not implemented.
- Native Desktop interactive login/provider/tool/settings workflow: not manually exercised; native builds and process smoke tests passed.