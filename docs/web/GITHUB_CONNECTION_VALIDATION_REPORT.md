# GitHub connection validation report

## Reproduced connect response

With a valid Aegis session and the intentionally blank replacement client secret:

```http
HTTP 503
{"code":"GITHUB_NOT_CONFIGURED","message":"The GitHub App configuration is incomplete.","requestId":"<request-id>"}
```

This replaces the formerly opaque HTTP 409. The safe API log for the same request recorded:

```text
[GitHub Connect]
configured=false
existingConnection=false
connectionStatus=none
pendingState=false
installationIdPresent=false
```

The user ID was present in the real log but is omitted from this document. No secret was logged.

## UI states

The Connections grid and `/github` page now distinguish loading, not configured, not connected, connected, revoked, permission/error and retry states. Connected UI exposes account, repository count, contents/issues/pull-request permissions, refresh/test/manage/disconnect actions. Connect is disabled when configuration is absent and is not shown as the valid action for an already connected installation.

## Production route validation

- Direct `/github`: HTTP 200.
- Workspace CSS: loaded.
- Next JavaScript: loaded.
- Hydration: Chromium assertion passed.
- Full reload: passed.
- `ChunkLoadError`: none.
- Error fallback and Retry: passed.
- Navigation layout remained present in the error state.

## Automated versus real GitHub

- Mock-tested UI: yes, Chromium.
- Unit-tested service/tool behavior: yes, 12 GitHub-specific tests.
- Real local config diagnostics: yes.
- Real GitHub authorization, installation, repository listing and GitHub-backed chat: not verified because `GITHUB_CLIENT_SECRET` is intentionally blank pending rotation.

Exact next step: generate a new Client Secret in the GitHub App settings, set only `GITHUB_CLIENT_SECRET` in the root `.env`, restart Aegis, then run the installation flow. No fake App ID, Client ID or secret was generated.