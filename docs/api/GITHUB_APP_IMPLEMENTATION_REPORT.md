# GitHub App implementation report

## Implemented architecture

A single server-side GitHub App implementation is used. Configuration resolution, private-key validation, Octokit App initialization, installation authentication, status verification, repository access and normalized errors are centralized under `apps/api/src/integrations/github` and `github-integration.ts`. Installation tokens are ephemeral and are never persisted or returned.

The private-key resolver accepts an absolute path or a monorepo-relative path and does not assume `process.cwd()` is the repository root. It locates the workspace through `pnpm-workspace.yaml`.

## Routes

- `GET /integrations/github/connect`
- `GET /integrations/github/callback`
- `GET /integrations/github/setup`
- `GET /integrations/github/status`
- `GET /integrations/github/repositories`
- `POST /integrations/github/test`
- `DELETE /integrations/github`

The legacy POST disconnect alias remains only for compatibility. There is no competing second connection system.

## Connect behavior

- Missing session: 401.
- Missing configuration: `GITHUB_NOT_CONFIGURED`, HTTP 503.
- Missing/unreadable/invalid PEM: explicit GitHub key error.
- Valid connected installation: structured `already_connected`, not an opaque conflict.
- Revoked installation: status is updated and reconnect is allowed.
- Expired state: marked expired and replaced.
- State: cryptographically random, short-lived, user-bound, one-time claimed.
- Same-user installation: upsert/update.
- Other-user installation: `GITHUB_INSTALLATION_ALREADY_LINKED`, HTTP 409.
- Prisma uniqueness conflicts are normalized rather than mapped to a generic 409.

The safe connect log contains only user ID and booleans/status. No PEM, JWT, installation token, client secret or OAuth token is logged.

## Data model

`IntegrationAccount` remains the architecture-compatible storage. A unique `(provider, providerAccountId)` constraint prevents one GitHub installation being linked to two users. Stored metadata includes account, repository selection, permissions, status and verification timestamps. No temporary installation token, PEM or client secret is stored.

The pre-migration duplicate audit found 16 integration rows and zero duplicate provider/account pairs. The unique index was applied successfully.

## Tools

The following executors are implemented and validate input with the registry Zod schemas:

- `github.listRepositories`
- `github.getRepository`
- `github.listDirectory`
- `github.getFileContent`
- `github.searchCode`
- `github.listIssues`
- `github.getIssue`
- `github.listPullRequests`
- `github.getPullRequest`

The executor derives the installation from the authenticated user, checks connection status, repository access and required permissions, handles pagination/rate errors, detects binary content and limits text file reads to 256 KiB. Model-supplied installation IDs are not accepted.

## Tests

- GitHub config/service: 8 passed.
- GitHub tool normalization: 4 passed.
- API contract suite: 32 total passed.
- Agent intent suite: 8 passed, including repository clarification and Web intent.
- Secret values were never printed during validation.

## Real configuration status

```json
{"configured":false,"appIdConfigured":true,"clientIdConfigured":true,"clientSecretConfigured":false,"privateKeyPathConfigured":true,"privateKeyExists":true,"privateKeyReadable":true,"privateKeyValid":true,"errorCode":"GITHUB_NOT_CONFIGURED"}
```

A new, non-compromised `GITHUB_CLIENT_SECRET` is the exact remaining required value. The previous value was cleared and was not reused. Real GitHub installation/callback/repository/chat validation is not verified until the user supplies the new secret.