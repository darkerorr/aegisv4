# Desktop validation report

## Build and tests

- TypeScript lint: passed.
- Vitest: 14/14 passed across three files.
- Vite production build: passed; 2022 modules transformed.
- Tauri release build: passed.
- Rust release profile: passed with one non-fatal localized linker informational warning.

## Native artifacts

- Application: `apps/desktop/src-tauri/target/release/aegis-desktop.exe`
- Size: 13,476,352 bytes.
- SHA-256: `AF894099A7E664F5FDA9BBDD190CC12510AF21BFCAD64E69F8D54C1B793E29D8`
- MSI: `apps/desktop/src-tauri/target/release/bundle/msi/Aegis Desktop_0.3.0_x64_en-US.msi`
- NSIS: `apps/desktop/src-tauri/target/release/bundle/nsis/Aegis Desktop_0.3.0_x64-setup.exe`

## Runtime smoke tests

- `tauri dev`: debug EXE launched; PID 17424 remained alive after five seconds; exact process tree stopped.
- Release without API: EXE remained alive after eight seconds.
- Release with API: `/health` returned ready and EXE remained alive after eight seconds.
- No `start.bat`, browser or visible terminal is required by the release EXE.

## Corrected regression

`ChatContext` used an outdated chat request missing attachment/tool fields and failed TypeScript. The complete contract is now sent. Local empty responses and remote streams without a terminal event now surface errors instead of silently ending.

## Remaining validation

Interactive login, secure-keyring inspection, real Ollama/NVIDIA/OpenRouter prompts, Gmail UI, attachments, settings, history and user-visible Stop/Retry were not manually exercised in the native window. Process smoke tests prove launchability, not end-to-end provider behavior. These remain unavailable without an interactive test session and applicable accounts/models.