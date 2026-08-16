# Aegis API Audit

## Architecture actuelle

- Serveur HTTP natif Node.js (sans framework Express/Fastify)
- Prisma avec SQLite
- Zod pour la validation
- AES-256-GCM pour le chiffrement
- Sessions basées sur cookie HttpOnly
- SSE pour le streaming
- bcryptjs pour le hash de mots de passe
- Pas d'OpenAPI / Swagger

## Routes existantes

| Méthode | Route | Status |
|---------|-------|--------|
| GET | /health | ✅ 200 |
| GET | / | ✅ 200 |
| POST | /auth/register | ✅ 201 |
| POST | /auth/verify-email | ✅ |
| POST | /auth/login | ✅ |
| POST | /auth/logout | ✅ |
| GET | /auth/me | ✅ |
| PATCH | /auth/account | ✅ |
| PUT | /auth/password | ✅ |
| POST | /auth/refresh | ✅ |
| POST | /auth/forgot-password | ✅ |
| POST | /auth/reset-password | ✅ |
| GET | /auth/sessions | ✅ |
| DELETE | /auth/sessions/:id | ✅ |
| POST | /auth/device/start | ✅ |
| POST | /auth/device/approve | ✅ |
| GET | /auth/device/status | ✅ |
| POST | /auth/device/token | ✅ |
| GET | /providers | ✅ |
| POST | /providers | ✅ |
| POST | /providers/test | ✅ |
| PATCH | /providers/:id | ✅ |
| DELETE | /providers/:id | ✅ |
| POST | /providers/:id/test | ✅ |
| GET | /providers/:id/models | ✅ |
| GET | /models | ✅ |
| POST | /models/refresh | ✅ |
| PATCH | /models/:id | ✅ |
| POST | /chat | ✅ |
| POST | /chat/stream | ✅ |
| GET | /conversations | ✅ |
| POST | /conversations | ✅ |
| GET | /conversations/:id | ✅ |
| PATCH | /conversations/:id | ✅ |
| DELETE | /conversations/:id | ✅ |
| GET | /conversations/:id/messages | ✅ |
| POST | /integrations/google/start | ✅ |
| GET | /integrations/google/callback | ✅ |
| GET | /integrations/google/status | ✅ |
| GET | /integrations/google | ✅ |
| GET | /integrations/google/account | ✅ |
| GET | /integrations/google/diagnostics | ✅ |
| POST | /integrations/google/disconnect | ✅ |
| GET | /integrations/google/gmail/messages | ✅ |
| GET | /integrations/google/gmail/messages/:id | ✅ |
| GET | /integrations/google/gmail/threads/:id | ✅ |
| GET | /integrations/google/gmail/search | ✅ |
| GET | /integrations/google/drive/files | ✅ |
| GET | /integrations/google/drive/files/:id | ✅ |
| GET | /integrations/google/drive/search | ✅ |

## Routes manquantes

- GET /ready (readiness avec vérification base)
- POST /auth/google/start (Google Sign-In)
- GET /auth/google/callback (Google Sign-In)
- POST /auth/google/link
- POST /auth/google/unlink
- POST /auth/desktop/login
- POST /auth/desktop/refresh
- POST /auth/desktop/logout
- POST /auth/desktop/register-device
- DELETE /auth/devices/:id
- POST /conversations/:id/archive
- POST /conversations/:id/pin
- POST /chat/cancel
- POST /providers/nvidia/connect
- POST /providers/nvidia/test
- GET /providers/nvidia/models
- DELETE /providers/nvidia
- POST /providers/openrouter/connect
- POST /providers/openrouter/test
- GET /providers/openrouter/models
- DELETE /providers/openrouter
- POST /integrations/github/start
- GET /integrations/github/callback
- GET /integrations/github/status
- POST /integrations/github/disconnect
- GET /integrations/google (request-scope)

## Bugs reproduits

1. **Format d'erreur incohérent**: Certaines erreurs utilisent `{ code, message }`, d'autres `{ ok, code, message }`. Manque `details` et `requestId` systématique.
2. **Pas de route /ready**: Seul /health existe, sans vérification de la base.
3. **Google Sign-In manquant**: Pas de route dédiée pour "Continue with Google" (connexion/création de compte).
4. **Pas de pagination curseur**: GET /conversations charge tous les messages.
5. **Conversations dupliquées**: Pas de clé d'idempotence.
6. **NVIDIA flow**: Le provider NVIDIA hérite simplement d'OpenAI-Compatible sans logique de connexion dédiée. Pas de route /providers/nvidia/connect.
7. **Pas de /ready**: La base n'est pas vérifiée séparément.
8. **Pas de Device model**: Les appareils Desktop ne sont pas persistés.
9. **Pas de Device session pour Desktop**: Le flux device code existe mais pas de refresh token rotatif.
10. **Pas d'archivage/pin**: Les conversations n'ont pas ces champs.
11. **Streaming sans événement "completed" dans certains cas**: Quand le contenu est vide.
12. **Pas de CSRF**: Aucune protection CSRF pour les mutations.
13. **Sessions concurrentes**: GET /conversations retourne les messages sans pagination.

## Erreurs Prisma

- Aucun index sur `Session.userId + expiresAt`
- Aucun index sur `OAuthLinkSession.stateHash + expiresAt`
- Aucun champ `archivedAt`, `pinnedAt` sur Conversation
- Pas de modèle `Device`
- Pas de modèle `IntegrationAuditEvent` complet (existe mais pas utilisé partout)

## Performances observées

- GET /auth/me: ~5ms
- GET /conversations: charge TOUS les messages → lent avec des données
- POST /chat/stream: correct avec SSE
- POST /providers/test: pas de cache, test à chaque fois
- GET /models: refresh à chaque fois, test de tous les providers

## Causes probables

- Développement itératif rapide sans spécification formelle
- Pas d'OpenAPI contract
- Pas de pagination initiale
- Pas de séparation auth Google / intégration Google
- Provider registry trop simple (héritage OpenAI-Compatible)
