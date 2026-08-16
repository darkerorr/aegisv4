# Launcher supervision report

## Outcome

The Windows launcher parses and executes in production mode. It stops only recorded or positively identified Aegis processes, waits for ports 3000 and 4000, refuses foreign owners, builds before starting, records listener PIDs in `logs/api.pid` and `logs/web.pid`, validates `/health`, validates Next assets, supervises logs, supports R/L/Q, and stops cleanly.

## Root cause

The reported PowerShell parser failure belonged to an older launcher state: the initial parser audit of the checked-out file already returned zero errors. The reproducible production failure was process/build coordination: rebuilding `.next` while an older `next start` could still hold an in-memory manifest made HTML reference deleted chunks. The repaired launcher makes stop/wait/build/start/asset verification an ordered invariant.

## Verified flow

1. Monorepo root is resolved from the script location.
2. Node and pnpm are checked.
3. Root `.env` is loaded without overriding explicit process variables.
4. Dependencies are checked.
5. PID identity, start time, command line, workspace ancestry and port owner are checked.
6. Only an identified Aegis process is stopped; foreign owners cause a hard error.
7. Ports are awaited before build.
8. `ensure-web-build.mjs` refuses to rebuild while port 3000 is occupied.
9. `.next/BUILD_ID` is required and non-empty.
10. API build/start and `/health` precede Web start.
11. Seven routes and all extracted static assets are checked before browser opening.
12. Logs remain in `logs/launcher.log`, `logs/api.log`, `logs/web.log` with separate error logs.

## Executed validation

- PowerShell parser: `start.ps1` 0 errors; `aegis-common.ps1` 0 errors.
- `stop.bat`: exit 0; no unrelated process targeted.
- `start.bat`: exit 0; 131.4 seconds total, including 60 seconds of active supervision.
- Build ID: `nw30g3MU0eYYcUK7nKIey` for the supervised validation build.
- API listener PID recorded: 2232.
- Web listener PID recorded: 24308.
- API health: HTTP 200, `service=aegis-api`, `status=ready`.
- Asset validation: passed before entering supervision.
- Shutdown: Web PID 24308 and API PID 2232 stopped cleanly.
- Second production run for Playwright: Web PID 9416 and API PID 19480; both stopped by `stop.bat`.
- Final state: ports 3000 and 4000 are free.

## Remaining manual checks

The interactive R and L keystrokes were code-audited but not physically pressed in an interactive console during this non-interactive run. Q/Ctrl+C share the same `finally` cleanup path exercised by the bounded supervision shutdown.