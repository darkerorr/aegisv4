# Aegis Web — Black & White Rebuild Report

Date: 23 July 2026  
Result: production build successful; unit and critical E2E tests successful.

## Scope and preservation

`apps/web` was created from a blank directory. No former visual shell, navigation, composer, layout, Tailwind class set, stylesheet, card system or animation was reused.

At audit time, `apps/web-old` was not present in the supplied workspace, including `apps/web-old/.env.local`. It was therefore neither read, moved nor deleted. No secret was copied. The only public environment value documented in the new frontend is `NEXT_PUBLIC_API_URL`; provider credentials and integration secrets remain server-side.

The official 1254×1254 Aegis logo was preserved from `design/logo/a5b5b67b-01f8-4e8e-b9e0-6200fb158b54.png` and copied to `apps/web/public/brand/aegis-logo.png`. Local Geist and Geist Mono WOFF2 files are loaded through `next/font/local`, with no blocking font request.

## Sources consulted

Only non-visual contracts and official assets were inspected:

- `apps/api/src/server.ts`: auth, sessions, providers, models, chat/SSE, conversations and account routes;
- `apps/api/src/integrations/routes.ts` and `google.ts`: OAuth, Gmail, Drive and permission states;
- `packages/api-client/src/index.ts`: credentials, timeout, retry, pagination and SSE parsing;
- `packages/types/src/index.ts`: strict shared request/response types;
- `apps/desktop/src/api/client.ts`: validated client-side contract coverage;
- `.env.example`: environment variable names only, with values never logged;
- `design/logo/...png`: official Aegis mark.

## Architecture created

The rebuild contains 159 source, configuration, asset and test files under `apps/web`.

- `src/app`: 29 concrete pages plus root, marketing, auth and workspace layouts;
- `src/components`: brand, marketing, navigation, motion, Three.js, UI and feedback layers;
- `src/features`: auth, chat, models, providers, connections, Gmail, Drive, search, account and settings;
- `src/lib/api`: central client plus auth, conversations, models, providers and integrations façades;
- `src/styles`: tokens, typography, motion, effects and utilities;
- `public/brand/providers`: local official SVG marks for NVIDIA, OpenRouter, Ollama, LM Studio, OpenAI, Anthropic, Gemini, Mistral, Groq, DeepSeek, Qwen and Hugging Face;
- `e2e`: the ten requested Playwright specification files and an API interception helper used only in tests.

Next route groups cannot expose both a public marketing page and an authenticated workspace page at the exact same `/models` pathname. The commercial catalog remains `/models`; the connected, API-backed model manager is `/workspace/models`. This prevents an App Router collision while preserving both experiences.

## Design system

The palette is based on black, white, thin translucent borders and restrained semantic accents. The required tokens are defined in `src/styles/tokens.css`, including `#000`, `#050505`, `#0a0a0a`, `#101010`, white foregrounds, muted greys, success, warning and danger.

Depth comes from controlled light falloff, 1px separators, inset highlights, grain, perspective and shadow—not blue surfaces or large coloured gradients. Accent colour is limited to icons, active indicators, status dots and small halos.

All requested primitives exist in `components/ui`: Button, AegisIconButton, Input, Textarea, Select, Checkbox, Switch, Tabs, Card, Dialog, AlertDialog, DropdownMenu, ContextMenu, Popover, Tooltip, Toast, Badge, Avatar, Skeleton, Loader, Progress and CommandPalette. Dialog, AlertDialog, DropdownMenu, ContextMenu, Popover, Tooltip and Tabs use Radix portals, focus management, Escape handling and keyboard semantics.

Lucide is imported by named icon only. Navigation uses the requested semantic icons. `ProviderIcon` and `IntegrationIcon` supply 16/18/20/24/32/48 sizes and colour/monochrome/light/dark variants. Brand marks come from local Lobe Icons or Simple Icons SVG data, never a Lucide approximation. Hover light is implemented with CSS variables, opacity, pseudo-elements and small box shadows. Copy changes to Check after success; Send changes to Stop during streaming; connection and error states use distinct semantic icons.

## Marketing experience

The landing includes:

1. floating, scroll-reactive navbar with product dropdown and mobile drawer;
2. near-viewport cinematic hero;
3. animated product chat demonstration, visually separate from authenticated chat;
4. intelligence convergence visual;
5. orbital local/cloud model network;
6. Web, desktop and CLI surfaces;
7. integrations line-up;
8. permission-boundary privacy visual;
9. final CTA and structured footer.

The navbar is horizontally aligned at every captured desktop width. The mobile menu is a real drawer control, with no raw or stacked HTML.

## 3D scene and fallback

The hero scene is built locally with Three.js, React Three Fiber and Drei. It combines a reflective faceted core, five independently tilted metallic arcs, a transmission shell, asymmetric white/cyan lighting and sparse particles. Pointer input changes the core orientation; its slow movement represents provider orbits converging on the protected core.

Performance controls:

- client-only dynamic import with `ssr: false`;
- content renders before the scene is enabled;
- `frameloop="demand"`;
- DPR capped at 1.5;
- bounded geometry and particle count;
- no video, remote Spline or remote texture;
- CSS fallback for reduced motion, mobile and unavailable WebGL;
- workspace routes do not import or ship the hero scene.

The fallback reproduces the protected orbital composition with CSS rings and remains readable without canvas.

## Workspace and real data

The workspace uses a dense three-surface shell: collapsible sidebar, live conversation rail and main work area. All data in production code comes from the Aegis API. There are no hard-coded conversations, model statuses, provider statuses, messages, Gmail items or Drive files.

- Conversation rail: live API list, loading skeletons, empty/offline/retry states, open, pin, archive and delete actions.
- Chat: real model availability, SSE streaming, Stop, Markdown/GFM, tables, code, Copy feedback and disabled Regenerate when no backend contract exists.
- Composer: fixed safe dock, provider location label, model selector, focus halo and keyboard send.
- Models: API search, local/cloud filters, capability metadata, context length, favourites and refresh.
- Providers: real active state, masked credential metadata, defaults, test action and enable/disable.
- Connections: Google OAuth/status/scopes plus deliberate routing to provider configuration for NVIDIA/OpenRouter; GitHub is never shown as connected without a backend route.
- Gmail: API list/search UI, selected message preview, body and attachments.
- Drive: API-backed grid/list, search, type, owner, date and external file link.
- Calendar/GitHub/Projects: explicit permission/unavailable states where the backend currently exposes no listing route; no fabricated records.
- Account/Security: profile update, sessions, revocation and password change through real auth routes.
- Appearance: persistent Full/Reduced/Off motion preference.

Normalized states cover loading, skeleton, empty, error, retry, offline, disconnected and permission missing. API errors are converted to user-facing messages; raw JSON is never rendered.

## Accessibility and responsive behaviour

- skip link and hierarchical headings;
- visible white focus rings;
- icon-only buttons have accessible labels and Radix tooltips;
- reduced-motion media query plus a user-level motion setting;
- semantic status text in addition to colour;
- keyboard-operable menus, popovers, dialogs and tabs;
- mobile landing at 390×844 has no horizontal overflow;
- workspace collapses to an icon rail, then a single full-width chat surface;
- composer never overlaps the final message padding.

## Tests and captures

Unit result:

- Vitest: 1 file, 2 tests passed.

E2E result:

- Playwright Chromium: 11 tests passed in the final run;
- covered landing, navbar, login, register, chat streaming, conversation reload, models, providers, connections, mobile overflow, keyboard focus and reduced motion;
- the fixtures in `e2e/helpers.ts` exist only inside intercepted Playwright requests and are not bundled into the application.

Generated screenshots:

| File | Resolution |
| --- | ---: |
| `landing-2560.png` | 2560×1440 |
| `landing-1920.png` | 1920×1080 |
| `landing-1366.png` | 1366×768 |
| `landing-mobile.png` | 390×844 |
| `login.png` | 1280×720 |
| `workspace-empty.png` | 1280×720 |
| `workspace-chat.png` | 1280×720 |
| `models.png` | 1280×720 |
| `providers.png` | 1280×720 |
| `connections.png` | 1280×720 |

All files are stored in `apps/web/test-results/screenshots/` and were visually inspected. They show a loaded monochrome interface, aligned navigation, official Aegis mark, restrained icon accents and no missing CSS or horizontal mobile overflow.

## Command results

- `pnpm.cmd install`: workspace install completed; lockfile updated with the new app dependencies.
- `pnpm.cmd --filter @aegis/web lint`: passed with no ESLint warnings or errors.
- `pnpm.cmd --filter @aegis/web test`: passed, 2/2.
- `pnpm.cmd --filter @aegis/web build`: passed; 31 routes generated.
- Chromium 1228 is installed and was used for the suite. On this Windows pnpm 9 environment, the exact filtered `pnpm exec playwright` wrapper cannot resolve the already-linked binary; `apps/web/node_modules/.bin/playwright.CMD install chromium` was used successfully instead.
- `pnpm.cmd --filter @aegis/web test:e2e`: passed, 11/11.

Production build evidence:

- landing first-load JS: 157 kB;
- chat first-load JS: 201 kB;
- shared first-load JS: 103 kB;
- static routes: 30;
- dynamic conversation route: 1;
- compile, type checking, page generation and trace collection all completed successfully.

## Remaining backend limits

The current API does not expose GitHub repository data, calendar event listing, project persistence, attachment upload, contact listing, assistant regeneration or citation records. The rebuilt frontend labels or disables those surfaces instead of pretending they work. Google OAuth also requires its documented server-side variables before connection can succeed. These are backend contract limits, not hidden UI failures.

`apps/web-old` remains untouched and was not deleted; it was absent from the supplied filesystem throughout this reconstruction.

Les icônes ne sont pas un détail secondaire. Elles doivent participer pleinement à l’identité d’Aegis : sélection Lucide précise, logos officiels pour les marques, accents colorés maîtrisés, halos subtils au survol, animations courtes et cohérence parfaite de taille, de trait et de comportement.
