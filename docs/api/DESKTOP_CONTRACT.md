# Aegis API — Desktop Contract

## Purpose
This document defines the contract between the Aegis API (`apps/api`) and the desktop application (Rust/Tauri). All API responses follow a standardised envelope that the desktop client must parse.

---

## 1. Standard Response Envelope

### Success
```json
{
  "ok": true,
  "data": { ... }
}
```

### Error
```json
{
  "ok": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Human-readable description"
  }
}
```

All endpoints return `Content-Type: application/json`.

---

## 2. Authentication

### Register
`POST /auth/register`
```json
{ "email": "user@example.com", "password": "..." }
```
**Success** `201`: `{ "ok": true, "data": { "user": { "id": "...", "email": "..." } } }`

### Login
`POST /auth/login`
```json
{ "email": "user@example.com", "password": "..." }
```
**Success** `200`: sets `session` cookie (httpOnly, secure, sameSite=lax) + returns user.

### Desktop Auth Token
`POST /auth/desktop-token`
```json
{ "email": "user@example.com", "password": "..." }
```
**Success** `200`:
```json
{
  "ok": true,
  "data": {
    "token": "aegis_dt_<uuid>",
    "user": { "id": "...", "email": "..." },
    "expiresAt": "2026-01-01T00:00:00.000Z"
  }
}
```
Desktop client stores this token and sends it via `Authorization: Bearer aegis_dt_<uuid>` header on all subsequent requests.

---

## 3. Chat / Streaming

`POST /chat/stream`
```json
{
  "providerId": "...",
  "model": "...",
  "messages": [{ "role": "user", "content": "..." }],
  "conversationId": "optional-existing-id"
}
```

**Response**: `text/event-stream` with SSE events:
```
event: message.started
data: {"id":"msg_xxx","conversationId":"conv_xxx","role":"assistant"}

event: message.delta
data: {"delta":"Hello","index":0}

event: message.delta
data: {"delta":" world","index":1}

event: message.completed
data: {"id":"msg_xxx","conversationId":"conv_xxx","role":"assistant","content":"Hello world","duration":1234}

event: done
data: {"conversationId":"conv_xxx"}
```

---

## 4. Conversations

### List
`GET /conversations?cursor=...&limit=20`

**Response** `200`:
```json
{
  "ok": true,
  "data": {
    "conversations": [{ "id": "...", "title": "...", "updatedAt": "..." }],
    "cursor": "next-cursor-or-null",
    "hasMore": false
  }
}
```

### Create
`POST /conversations`
```json
{ "title": "optional", "model": "optional" }
```

### Get Messages
`GET /conversations/:id/messages?cursor=...`
```json
{
  "ok": true,
  "data": { "messages": [...], "cursor": null, "hasMore": false }
}
```

### Send Message
`POST /conversations/:id/messages`
```json
{ "content": "..." }
```
**Response** `201`:
```json
{ "ok": true, "data": { "message": { "id": "...", "role": "user", "content": "..." } } }
```

### Archive / Pin
`POST /conversations/:id/archive` or `POST /conversations/:id/pin`

---

## 5. Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `INVALID_INPUT` | 400 | Validation failure |
| `UNAUTHORIZED` | 401 | Missing/invalid session or token |
| `FORBIDDEN` | 403 | Operation not allowed |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Duplicate or state conflict |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `PROVIDER_ERROR` | 502 | Upstream provider error |
| `SERVICE_UNAVAILABLE` | 503 | Maintenance or overload |

---

## 6. Health

`GET /health` → `200` `{ "ok": true, "data": { "status": "ok" } }`
`GET /ready` → `200` `{ "ok": true, "data": { "ready": true } }`
`GET /` → `200` `{ "ok": true, "data": { "service": "Aegis API", "version": "0.3.0" } }`
