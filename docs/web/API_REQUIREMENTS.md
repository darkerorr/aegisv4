# Aegis Web — API requirements

La reconstruction n’a pas modifié `apps/api`. Les écrans ne simulent aucune réussite lorsque le contrat n’existe pas.

## Export de compte

- Route manquante : `POST /auth/account/export`
- Corps : `{ "format": "json" | "zip" }`
- Réponse attendue : `202 { "exportId": string, "status": "queued", "expiresAt": string }`, puis statut et téléchargement signés.
- Erreurs : `401 AUTH_REQUIRED`, `409 EXPORT_ALREADY_RUNNING`, `429 RATE_LIMITED`, `503 EXPORT_UNAVAILABLE`.
- Raison : permettre l’export des conversations, projets, agents et réglages synchronisés depuis Account.

## Suppression de compte

- Route manquante : `DELETE /auth/account`
- Corps : `{ "confirmation": "DELETE", "currentPassword": string }` ou challenge de réauthentification.
- Réponse attendue : `202 { "deletionId": string, "status": "scheduled", "effectiveAt": string }`.
- Erreurs : `400 CONFIRMATION_REQUIRED`, `401 AUTH_REQUIRED`, `403 REAUTHENTICATION_REQUIRED`, `409 DELETION_ALREADY_SCHEDULED`, `429 RATE_LIMITED`.
- Raison : offrir une suppression vérifiable et réversible sans simuler une réussite dans Account.

## Avatar et e-mail

- `POST /auth/account/avatar` — `multipart/form-data` (`file`, PNG/JPEG/WebP, 2 Mo) ; réponse utilisateur avec `avatarUrl` ; erreurs `400`, `401`, `413`, `415`, `500`.
- `DELETE /auth/account/avatar` — aucun corps ; réponse utilisateur avec `avatarUrl: null` ; erreurs `401`, `404`, `500`.
- `PATCH /auth/account/email` — `{ "email": string, "currentPassword": string }` ; réponse `202` avec `verificationRequired` ; erreurs `400`, `401`, `403`, `409`, `429`.
- Raison commune : synchroniser Account entre Web, Desktop et CLI sans stocker de faux état local présenté comme distant.

## GitHub

- Routes manquantes : `POST /integrations/github/start`, `GET /integrations/github/status`, `GET /integrations/github/repositories`, `GET /integrations/github/issues`, `GET /integrations/github/pulls`, `POST /integrations/github/disconnect`.
- Méthodes : POST pour OAuth/déconnexion, GET pour statut et ressources.
- Corps : `{ "returnTarget": "web" }` pour start ; filtres `page`, `query`, `repository` pour les listes.
- Réponses : URL d’autorisation puis statut connecté ; listes paginées avec `items`, `nextCursor` et métadonnées minimales.
- Erreurs : `401 AUTH_REQUIRED`, `403 ACCESS_DENIED`, `404 NOT_CONNECTED`, `429 RATE_LIMITED`, `502 GITHUB_UNAVAILABLE`.
- Raison : la page GitHub affiche explicitement “Not connected” et ne fabrique ni dépôt, ni issue, ni pull request.

## Recherche plein texte

- Route manquante : `GET /conversations/search?q=...&cursor=...&limit=...`.
- Réponse attendue : `{ "results": [{ "conversationId": string, "title": string, "snippet": string, "updatedAt": string }], "cursor": string | null, "hasMore": boolean }`.
- Erreurs : `400 QUERY_TOO_SHORT`, `401 AUTH_REQUIRED`, `429 RATE_LIMITED`.
- Raison : la page Search filtre actuellement le catalogue `/conversations` côté client ; elle ne prétend pas offrir une recherche serveur complète.
## Regenerate assistant response

- Route manquante : `POST /conversations/:conversationId/regenerate`
- Corps : `{ "messageId": string, "model": string, "providerId": string }`
- Réponse : le même flux SSE que `/chat/stream`, avec remplacement atomique du message assistant.
- Erreurs : `404`, `409`, `422`, `502`, `504`.
- Raison : le contrat actuel ajoute toujours le dernier message utilisateur et ne permet pas le remplacement sans doublon.
