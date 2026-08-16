# Aegis-CLI — Screen Mockups

> Complete terminal screen designs for the interactive Aegis-CLI experience.
> Aegis-CLI is a persistent terminal application — like Codex CLI — not a set of separate commands.
> All models run via Ollama. Style: sober, dark, clean, premium terminal.

---

## 1. Trust Directory Screen (first launch)

```
╔══════════════════════════════════════════════════════════╗
║                    ◆  A E G I S  C L I  ◆               ║
║                                                          ║
║                                                          ║
║  Aegi would like to access this directory.               ║
║                                                          ║
║  ┌─────────────────────────────────────────────────────┐ ║
║  │  /Users/you/project/my-app                          │ ║
║  │                                                      │ ║
║  │  Aegi will be able to read and write files in        │ ║
║  │  this directory and its subdirectories.              │ ║
║  │                                                      │ ║
║  │  You can change this later in configuration.         │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                          ║
║  ○ Don't allow this directory again                      ║
║  ● Allow this directory                                  ║
║                                                          ║
║  [Enter] confirm  │  [↑↓] navigate  │  [Ctrl+C] exit    ║
╚══════════════════════════════════════════════════════════╝
```

---

## 2. Main Interface (idle state)

```
╔══════════════════════════════════════════════════════════╗
║  ◆ AEGIS CLI ◆  Llama 3 70B  ● Ollama  ◇ ./my-app      ║
║  ─────────────────────────────────────────────────────    ║
║                                                          ║
║                                                          ║
║                                                          ║
║                                                          ║
║                                                          ║
║                                                          ║
║                                                          ║
║                                                          ║
║  ╔═══════╗                                               ║
║  ║  ●   ║  Aegi online. Awaiting instruction.           ║
║  ╚═══╤═══╝                                               ║
║   ╱  │  ╲                                                ║
║                                                          ║
║  ┌─────────────────────────────────────────────────────┐ ║
║  │  › _                                                │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                          ║
║  /model /provider /analyze /edit /diff /review           ║
║  /apply /reject /doctor /help /exit                      ║
╚══════════════════════════════════════════════════════════╝
```

---

## 3. Chat / Streaming Response

```
╔══════════════════════════════════════════════════════════╗
║  ◆ AEGIS CLI ◆  Llama 3 70B  ● Ollama  ◇ ./my-app      ║
║  ─────────────────────────────────────────────────────    ║
║                                                          ║
║  ┌─ You ───────────────────────────────────────────────┐ ║
║  │ Explain the dependency injection pattern in this     │ ║
║  │ project.                                             │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                          ║
║  ┌─ Aegi ──────────────────────────────────────────────┐ ║
║  │ Looking at src/di/container.ts, your project uses a  │ ║
║  │ manual DI container with token-based resolution.     │ ║
║  │                                                      │ ║
║  │ The container registers services by token at boot    │ ║
║  │ and resolves them lazily. Dependencies are declared  │ ║
║  │ via constructor injection.                           │ ║
║  │                                                      │ ║
║  │ Key files:                                           │ ║
║  │   src/di/container.ts    — registry & resolver       │ ║
║  │   src/di/tokens.ts       — service identifiers       │ ║
║  │   src/di/module.ts       — module registration       │ ║
║  │                                                      │ ║
║  │ Confidence: 96%  Tokens: 134/4096  ■■■■░░░░░░        │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                          ║
║  ┌─────────────────────────────────────────────────────┐ ║
║  │  › _                                                │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                          ║
║  /model /provider /analyze /edit /diff /review           ║
║  /apply /reject /doctor /help /exit                      ║
╚══════════════════════════════════════════════════════════╝
```

---

## 4. Streaming Response (in progress)

```
╔══════════════════════════════════════════════════════════╗
║  ◆ AEGIS CLI ◆  Llama 3 70B  ● Ollama  ◇ ./my-app      ║
║  ─────────────────────────────────────────────────────    ║
║                                                          ║
║  ┌─ You ───────────────────────────────────────────────┐ ║
║  │ Add error handling to the database service.          │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                          ║
║  ┌─ Aegi ────────────────────────────────────────       ║
║  │ I'll add error handling to src/db/service.ts.        ║
║  │                                                      ║
║  │ I'll wrap each method in a try/catch that logs       ║
║  │ the error and returns a Result type instead of       ║
║  │ throwing. Let me read the file first…                 ║
║  │                                                      ║
║  │ [████████░░░░]  reading src/db/service.ts▐           ║
║  └─── [streaming... 38 tok/s] ────────────────────────── ║

║                                                          ║
║  ┌─────────────────────────────────────────────────────┐ ║
║  │  › _                                                │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                          ║
║  /model /provider /analyze /edit /diff /review           ║
╚══════════════════════════════════════════════════════════╝
```

---

## 5. Diff Display (before modification)

```
╔══════════════════════════════════════════════════════════╗
║  ◆ AEGIS CLI ◆  Llama 3 70B  ● Ollama  ◇ ./my-app      ║
║  ─────────────────────────────────────────────────────    ║
║                                                          ║
║  ┌─ You ───────────────────────────────────────────────┐ ║
║  │ Add error handling to the database service.          │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                          ║
║  ┌─ Aegi — Proposed changes ───────────────────────────┐ ║
║  │  File: src/db/service.ts                             │ ║
║  │                                                      │ ║
║  │   ~ ─ existing ──────────────────────────────────    │ ║
║  │   - async query(sql: string) {                       │ ║
║  │   ~ ─ proposed ─────────────────────────────────    │ ║
║  │   + async query(sql: string): Promise<Result<       │ ║
║  │   +   Row[], DbError                                │ ║
║  │   + >> {                                             │ ║
║  │   +   try {                                          │ ║
║  │   +     return ok(await this.pool.query(sql));       │ ║
║  │   +   } catch (err) {                                │ ║
║  │   +     logger.error('query failed', err);            │ ║
║  │   +     return err(DbError.QueryFailed);              │ ║
║  │   +   }                                              │ ║
║  │   + }                                                │ ║
║  │                                                      │ ║
║  │   Lines: 12 added, 1 removed                         │ ║
║  │   Risk: low — wrapped in try/catch                   │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                          ║
║  ┌─ Confirmation Required ─────────────────────────────┐ ║
║  │  Apply this change to src/db/service.ts?             │ ║
║  │  [y] apply  │  [d] full diff  │  [r] reject  │  [e] edit ║
║  └─────────────────────────────────────────────────────┘ ║
╚══════════════════════════════════════════════════════════╝
```

---

## 6. After Apply (success)

```
╔══════════════════════════════════════════════════════════╗
║  ◆ AEGIS CLI ◆  Llama 3 70B  ● Ollama  ◇ ./my-app      ║
║  ─────────────────────────────────────────────────────    ║
║                                                          ║
║  ┌─ You ───────────────────────────────────────────────┐ ║
║  │ Add error handling to the database service.          │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                          ║
║  ┌─ Aegi ──────────────────────────────────────────────┐ ║
║  │ ✓  Change applied to src/db/service.ts               │ ║
║  │     12 lines added, 1 removed                        │ ║
║  │     File backed up at .aegis/backups/service.ts.bak  │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                          ║
║  ┌─────────────────────────────────────────────────────┐ ║
║  │  › _                                                │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                          ║
║  /model /provider /analyze /edit /diff /review           ║
╚══════════════════════════════════════════════════════════╝
```

---

## 7. After Reject

```
╔══════════════════════════════════════════════════════════╗
║  ◆ AEGIS CLI ◆  Llama 3 70B  ● Ollama  ◇ ./my-app      ║
║  ─────────────────────────────────────────────────────    ║
║                                                          ║
║  ┌─ You ───────────────────────────────────────────────┐ ║
║  │ Add error handling to the database service.          │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                          ║
║  ┌─ Aegi ──────────────────────────────────────────────┐ ║
║  │ ○  Change rejected. No files modified.               │ ║
║  │     You can ask me to adjust the approach.           │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                          ║
║  ┌─────────────────────────────────────────────────────┐ ║
║  │  › _                                                │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                          ║
║  /model /provider /analyze /edit /diff /review           ║
╚══════════════════════════════════════════════════════════╝
```

---

## 8. Quick Review (`/review`)

```
╔══════════════════════════════════════════════════════════╗
║  ◆ AEGIS CLI ◆  Llama 3 70B  ● Ollama  ◇ ./my-app      ║
║  ─────────────────────────────────────────────────────    ║
║                                                          ║
║  ┌─ Aegi — Review ─────────────────────────────────────┐ ║
║  │  Analyzing 12 changed files…                         │ ║
║  │  [████████████░░░░░░░░]  8/12 files                  │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                          ║
║  ┌─ Issues Found ──────────────────────────────────────┐ ║
║  │  ⚠  src/db/service.ts:45   Unhandled promise        │ ║
║  │  ⚠  src/api/routes.ts:112  Missing input validation │ ║
║  │  ⚠  src/config/index.ts:22  Hardcoded value         │ ║
║  │                                                      │ ║
║  │  › /edit src/db/service.ts  to fix                   │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                          ║
║  ┌─────────────────────────────────────────────────────┐ ║
║  │  › /edit src/db/service.ts                          │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                          ║
║  /model /provider /analyze /edit /diff /review           ║
╚══════════════════════════════════════════════════════════╝
```

---

## 9. `/model` — Switch Model

```
╔══════════════════════════════════════════════════════════╗
║  ◆ AEGIS CLI ◆  Llama 3 70B  ● Ollama  ◇ ./my-app      ║
║  ─────────────────────────────────────────────────────    ║
║                                                          ║
║  ┌─ Select Model ──────────────────────────────────────┐ ║
║  │                                                      │ ║
║  │    ◆ Llama 3 70B         ◇ 7.2GB  ● online     ←    │ ║
║  │    ◇ Llama 3 8B          ◇ 4.6GB  ● online          │ ║
║  │    ◇ Qwen 2.5 7B         ◇ 4.1GB  ○ offline         │ ║
║  │    ◇ Mistral 7B          ◇ 4.2GB  ○ offline         │ ║
║  │    ◇ DeepSeek Coder 6.7B ◇ 3.8GB  ● online          │ ║
║  │                                                      │ ║
║  │  ↑↓  navigate  │  enter  select  │  esc  cancel      │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                          ║
║  ┌─────────────────────────────────────────────────────┐ ║
║  │  › /model                                            │ ║
║  └─────────────────────────────────────────────────────┘ ║
╚══════════════════════════════════════════════════════════╝
```

---

## 10. `/doctor` — Diagnostics

```
╔══════════════════════════════════════════════════════════╗
║  ◆ AEGIS CLI ◆  doctor                    system check  ║
║  ─────────────────────────────────────────────────────    ║
║                                                          ║
║  ●  Node.js          v20.11.0                       ✓   ║
║  ●  TypeScript       v5.4.0                        ✓   ║
║  ●  Ollama           v0.1.32  ● running at 11434       ✓   ║
║  ●  Config file      ~/.aegis/config.json  ● valid      ✓   ║
║  ●  Disk space       available: 42.3 GB                 ✓   ║
║  ●  Terminal         256 colors  ● utf-8 supported      ✓   ║
║                                                          ║
║  All systems nominal.                                    ║
║                                                          ║
║  [Enter] return to main  │  [Ctrl+C] exit                ║
╚══════════════════════════════════════════════════════════╝
```

---

## 11. Error — Ollama Unreachable

```
╔══════════════════════════════════════════════════════════╗
║  ◆ AEGIS CLI ◆  Llama 3 70B  ○ offline  ◇ ./my-app     ║
║  ─────────────────────────────────────────────────────    ║
║                                                          ║
║  ┌─ ⚠  Error ──────────────────────────────────────────┐ ║
║  │                                                       │ ║
║  │  Ollama is not running at http://localhost:11434      │ ║
║  │                                                       │ ║
║  │  ›  Run: ollama serve                                │ ║
║  │  ›  Run: /doctor  to diagnose                        │ ║
║  │                                                       │ ║
║  └───────────────────────────────────────────────────────┘ ║
║                                                          ║
║  ┌─────────────────────────────────────────────────────┐ ║
║  │  › _                                                │ ║
║  └─────────────────────────────────────────────────────┘ ║
╚══════════════════════════════════════════════════════════╝
```

---

## 12. Logo — Startup Animation

```
  ╔═══════════════════════╗
  ║   A E G I S   C L I   ║
  ║                       ║
  ║   ◆  AI Guardian  ◆   ║
  ╚═══════════════════════╝

  ◆ Booting Aegis Core…
  [████████░░░░░░░░░░░░]  module: ollama

  ◆ Loading models…
  [████████████░░░░░░░░]  5 models found

  ◆ Aegis online.
  ╔═══════╗
  ║  ●   ║  Type › /help  to see available commands.
  ╚═══╤═══╝
   ╱  │  ╲

  ┌─────────────────────────────────────────────────────┐
  │  › _                                                │
  └─────────────────────────────────────────────────────┘
```

---

## 13. Status Bar Variants

**Idle:**
```
║  ◆ AEGIS CLI ◆  Llama 3 70B  ● Ollama  ◇ ./my-app      ║
```

**No model loaded:**
```
║  ◆ AEGIS CLI ◆  —          ○ Ollama  ◇ ./my-app         ║
```

**Streaming:**
```
║  ◆ AEGIS CLI ◆  Llama 3 70B  ● Ollama  ◇ ./my-app  ~ ◉ ║
```

**Error state:**
```
║  ◆ AEGIS CLI ◆  Llama 3 70B  ○ offline  ◇ ./my-app     ║
```

---

## 14. Slash Commands Reference

Displayed at the bottom bar:

```
  /model <name>     Switch model
  /provider         Show Ollama status
  /analyze <path>   Analyze files
  /edit <file>      Edit a file
  /diff <file>      Show pending diff
  /review           Review changes
  /apply            Apply pending change
  /reject           Reject pending change
  /doctor           Run diagnostics
  /help             Show this list
  /exit             Quit Aegis
```

These appear in the footer of the main interface,
auto-collapsed to one row of most-relevant commands
when space is limited.

---

## Responsive Design: Compact Mode

When width < 60 columns:

```
◆ AEGIS  Llama 3 70B  ●  ./my-app
───────────────────────────────
 › Explain DI pattern.

── Aegi ───────────────────────
Looking at src/di/container.ts,
your project uses a manual DI
container with tokens.

Confidence: 96%
Tokens: 134/4096

 › _
───────────────────────────────
 /model /edit /diff /help
