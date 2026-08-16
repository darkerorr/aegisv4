# Aegis Web — Final Report

## Overview
The Aegis web app (`apps/web`) is a Next.js 15 Application Router project providing the browser-based UI for the Aegis platform. It communicates exclusively with the Aegis API (`apps/api`).

## Architecture
- **Framework**: Next.js 15 App Router, React 19.
- **Styling**: Tailwind CSS 3 + custom CSS variables (self-contained `globals.css`).
- **Animation**: Framer Motion.
- **Icons**: Lucide React.
- **Package Manager**: pnpm workspace monorepo.
- **Port**: 3000 (dev).

## Pages and Routes

### Public (no auth required)
| Route | File | Status |
|-------|------|--------|
| `/` | Landing | ✅ Redirects to /chat when authed |
| `/login` | `app/login/page.tsx` | ✅ AuthForm with Google Sign-In |
| `/register` | `app/register/page.tsx` | ✅ AuthForm with Google Sign-In |
| `/forgot-password` | `app/forgot-password/page.tsx` | ✅ Email form with success state |

### Protected (auth required, wrapped in `Protected` component)
| Route | File | Description |
|-------|------|-------------|
| `/chat` | `app/chat/page.tsx` | Chat interface with message streaming |
| `/search` | `app/search/page.tsx` | Search across conversations |
| `/account` | `app/account/page.tsx` | Profile editing, linked accounts, sessions, danger zone |
| `/security` | `app/security/page.tsx` | Active sessions list with revoke |
| `/settings` | `app/settings/page.tsx` | Application preferences |
| `/connections` | `app/connections/page.tsx` | Google, GitHub, NVIDIA, OpenRouter connections |
| `/providers` | `app/providers/page.tsx` | AI provider management |
| `/models` | `app/models/page.tsx` | AI model listings |
| `/gmail` | `app/gmail/page.tsx` | Google Mail inbox view |
| `/drive` | `app/drive/page.tsx` | Google Drive file browser |
| `/download` | `app/download/page.tsx` | Desktop app download |

## Components
| Component | File | Purpose |
|-----------|------|---------|
| `AuthForm` | `src/components/AuthForm.tsx` | Login/register form with Google Sign-In button |
| `SiteNav` | `src/components/SiteNav.tsx` | Public site navigation |
| `AppShell` | `src/components/AppShell.tsx` | Authenticated app shell with sidebar navigation, mobile drawer, user info |
| `Protected` | `src/components/Protected.tsx` | Auth guard, redirects to `/login` if unauthenticated |
| `AegisLogo` | `@aegis/shared-ui` | Shared logo component |

## Libraries
| Package | Path | Purpose |
|---------|------|---------|
| `@aegis/types` | `packages/types` | TypeScript types + Zod schemas |
| `@aegis/api-client` | `packages/api-client` | Typed API client |
| `@aegis/shared-ui` | `packages/shared-ui` | Shared UI components (AegisLogo) |

## Features
- **Authentication**: Login/register with email+password, Google Sign-In button (redirect to `GET /auth/google`).
- **Conversations**: Create, list, send messages, archive, pin (via AppShell sidebar).
- **Chat Streaming**: SSE-based assistant responses.
- **Google Workspace**: Gmail inbox, Drive file browser (both require Google OAuth connection).
- **AI Providers**: NVIDIA NIM, OpenRouter integration pages.
- **Responsive**: Desktop sidebar + mobile hamburger drawer.
- **Session Management**: View and revoke active sessions from Security page.

## CSS Architecture
- `globals.css` contains all design tokens (colours, surfaces, controls) as CSS custom properties.
- Tailwind utility classes used for layout and spacing.
- No external CSS-in-JS or component library dependencies.
