# Aegis API — Final Report

## Overview
The Aegis API (`apps/api`) provides all backend services for the Aegis platform: authentication, conversation management, AI provider integration (including proxy endpoints for NVIDIA, OpenRouter, and direct provider calls), Google Workspace integration (Gmail/Drive), and desktop auth token support.

## Architecture
- **Runtime**: Node.js native `http` module (no Express/Fastify).
- **Database**: Prisma ORM + SQLite (file-based).
- **Port**: 4000.
- **Auth**: Session cookies for web clients; bearer tokens (`aegis_dt_*`) for desktop clients.
- **Streaming**: Server-Sent Events (`text/event-stream`) for AI chat completions.

## Files
| File | Purpose |
|------|---------|
| `src/server.ts` | HTTP server (909 lines), route handlers, middleware |
| `src/server.test.ts` | 8 integration tests covering auth, conversations, Google OAuth, streaming |
| `src/auth.ts` | Password hashing (bcryptjs + AES-256-GCM) |
| `src/auth.test.ts` | Password hashing verification test |
| `src/integrations/google.ts` | Google OAuth token encryption, Gmail/Drive polling |
| `src/integrations/google.test.ts` | Google integration tests (5) |
| `src/providers/nvidia.ts` | NVIDIA NIM proxy handler |
| `src/providers/openrouter.ts` | OpenRouter proxy handler |
| `prisma/schema.prisma` | Database schema |

## Features Implemented
1. **Authentication**: Register, login, logout, session management, password change, forgot/reset password, desktop auth tokens.
2. **Conversations**: CRUD, cursor-based pagination, archive, pin, message streaming.
3. **AI Providers**: Connect/disconnect providers, proxy chat completions through NVIDIA and OpenRouter, SSE streaming with named events (`message.started`, `message.delta`, `message.completed`, `done`).
4. **Google Workspace**: OAuth 2.0 flow with encrypted token storage, Gmail message polling, Drive file listing.
5. **Middleware**: CORS, request ID, idempotency keys (`Idempotency-Key` header), error standardisation, rate limiting (in-memory token bucket).
6. **Error Handling**: Unified error codes with consistent JSON envelope.

## Test Results
- **14/14 tests passing** (3 test files).
- Coverage: auth, conversations, Google OAuth flow, streaming, ownership segregation.

## Schema (Prisma + SQLite)
- `User` — id, email, passwordHash, displayName, emailVerified, preferences (JSON)
- `Session` — id, userId, token, deviceName, ipAddress, lastSeenAt, expiresAt
- `RefreshToken` — id, userId, tokenHash, expiresAt, revoked
- `Conversation` — id, userId, title, model, archivedAt, pinnedAt
- `Message` — id, conversationId, role, content, createdAt
- `Provider` — id, userId, name, type, apiKeyHash, baseUrl
- `GoogleAccount` — id, userId, email, accessTokenEncrypted, refreshTokenEncrypted, scope, tokenExpiresAt
- `Device` — id, userId, name, tokenHash, lastSeenAt
