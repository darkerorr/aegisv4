# Aegis Desktop — API requirements

Ce document décrit uniquement les capacités Aegis Cloud dont le contrat n’existe pas dans `@aegis/api-client`. Aegis Desktop n’affiche aucune réussite fictive pour ces actions.

## Avatar du compte

- Route manquante : `/auth/account/avatar`
- Méthode HTTP : `POST`
- Corps attendu : `multipart/form-data` avec `file` (PNG, JPEG ou WebP, 2 Mo maximum).
- Réponse attendue : `200 { "user": { "id": string, "email": string, "displayName": string | null, "avatarUrl": string | null } }`.
- Erreurs attendues : `400 INVALID_IMAGE`, `401 AUTH_REQUIRED`, `413 FILE_TOO_LARGE`, `415 UNSUPPORTED_MEDIA_TYPE`, `500 STORAGE_ERROR` ; chaque erreur doit inclure le `requestId` standard.
- Raison du besoin : synchroniser l’avatar entre Aegis Desktop, Web et CLI. En attendant, Desktop conserve uniquement un aperçu local clairement signalé.

## Suppression de l’avatar

- Route manquante : `/auth/account/avatar`
- Méthode HTTP : `DELETE`
- Corps attendu : aucun.
- Réponse attendue : `200 { "user": { ..., "avatarUrl": null } }`.
- Erreurs attendues : `401 AUTH_REQUIRED`, `404 AVATAR_NOT_FOUND`, `500 STORAGE_ERROR`.
- Raison du besoin : supprimer réellement l’objet distant et propager l’état aux autres clients.

## Modification de l’adresse e-mail

- Route manquante : `/auth/account/email`
- Méthode HTTP : `PATCH`
- Corps attendu : `{ "email": string, "currentPassword": string }`.
- Réponse attendue : `202 { "email": string, "verificationRequired": true, "message": string }`.
- Erreurs attendues : `400 INVALID_EMAIL`, `401 AUTH_REQUIRED`, `403 INVALID_PASSWORD`, `409 EMAIL_ALREADY_USED`, `429 RATE_LIMITED`.
- Raison du besoin : l’écran Account doit permettre la modification vérifiée de l’e-mail; le champ reste actuellement en lecture seule.

## Export complet du compte

- Route manquante : `/auth/account/export`
- Méthode HTTP : `POST`
- Corps attendu : `{ "format": "json" | "zip" }`.
- Réponse attendue : `202 { "exportId": string, "status": "queued", "expiresAt": string }`, puis une route de statut/téléchargement documentée ou une URL signée à durée limitée.
- Erreurs attendues : `401 AUTH_REQUIRED`, `409 EXPORT_ALREADY_RUNNING`, `429 RATE_LIMITED`, `503 EXPORT_UNAVAILABLE`.
- Raison du besoin : exporter les conversations, projets, agents, réglages et métadonnées synchronisés. L’export local JSON reste disponible sans compte.

## Suppression du compte

- Route manquante : `/auth/account`
- Méthode HTTP : `DELETE`
- Corps attendu : `{ "confirmation": "DELETE", "currentPassword": string }` (ou un challenge de réauthentification équivalent).
- Réponse attendue : `202 { "deletionId": string, "status": "scheduled", "effectiveAt": string }`.
- Erreurs attendues : `400 CONFIRMATION_REQUIRED`, `401 AUTH_REQUIRED`, `403 REAUTHENTICATION_REQUIRED`, `409 DELETION_ALREADY_SCHEDULED`, `429 RATE_LIMITED`.
- Raison du besoin : fournir une suppression vérifiable, réauthentifiée et réversible pendant une éventuelle période de grâce. Le bouton Desktop reste désactivé tant que ce contrat n’existe pas.
