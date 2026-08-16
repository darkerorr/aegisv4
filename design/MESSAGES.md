# Aegis-CLI — System Message Catalog

> Complete set of user-facing messages, organized by context.
> All messages follow the tone-of-voice rules from IDENTITY.md.
> Aegis-CLI is a persistent interactive application; all interactions
> happen through slash commands or natural language in the input bar.

---

## 1. Startup & Shutdown

### Boot sequence messages

| Message | Context |
|---------|---------|
| `Booting Aegis Core…` | First startup line |
| `Loading models from Ollama…` | Initializing models |
| `Checking model status…` | Scanning local models |
| `Aegis online.` | Startup complete |
| `Aegi online. Awaiting instruction.` | Ready with mascot |
| `Aegis CLI v{version} ready.` | Version info at startup |
| `Session restored. {n} messages in memory.` | Resumed conversation |

### Shutdown

| Message | Context |
|---------|---------|
| `Shutting down Aegis…` | /exit or Ctrl+C |
| `Session saved.` | Chat persisted |
| `Aegis offline.` | Final message |

---

## 2. Trust Directory

| Message | Context |
|---------|---------|
| `Aegi would like to access this directory.` | Trust prompt title |
| `Aegi will be able to read and write files in this directory and its subdirectories.` | Trust explanation |
| `You can change this later in configuration.` | Reassurance |
| `Don't allow this directory again` | Option |
| `Allow this directory` | Option |
| `Directory trust granted.` | After confirmation |
| `Directory trust denied. Aegi cannot operate without file access.` | After rejection |

---

## 3. Status Bar States

| State | Status bar |
|-------|-----------|
| Idle | `◆ AEGIS CLI ◆  Llama 3 70B  ● Ollama  ◇ ./my-app` |
| No model | `◆ AEGIS CLI ◆  —          ○ Ollama  ◇ ./my-app` |
| Streaming | `◆ AEGIS CLI ◆  Llama 3 70B  ● Ollama  ◇ ./my-app  ~ ◉` |
| Offline | `◆ AEGIS CLI ◆  Llama 3 70B  ○ offline  ◇ ./my-app` |

---

## 4. Slash Commands

| Message | Context |
|---------|---------|
| `Unknown command: "{cmd}". Type /help for available commands.` | Unrecognized slash |
| `Usage: /model <name>` | `/model` help |
| `Usage: /edit <file>` | `/edit` help |
| `Usage: /analyze <path>` | `/analyze` help |
| `Switched to {name}.` | Model changed via `/model` |
| `Model "{name}" not found. Available: {list}` | Invalid model name |
| `File "{path}" not found in the current directory tree.` | `/edit` nonexistent file |
| `No changes to review.` | `/review` when nothing changed |
| `No pending diff.` | `/apply` or `/reject` without diff |
| `You have a pending change to {path}. Apply it first with /apply, reject with /reject.` | New input while diff pending |

---

## 5. Chat / Natural Language

### Session

| Message | Context |
|---------|---------|
| `Awaiting instruction.` | Idle prompt |
| `Enter your message or type /help for commands.` | First-time hint |
| `Conversation cleared.` | Ctrl+L |

### Streaming

| Message | Context |
|---------|---------|
| `Streaming… [{n} tok/s]` | Active generation |
| `Response complete. ({n} tokens, {t}s)` | Generation done |
| `Generation interrupted.` | Ctrl+C during stream |
| `(no response generated)` | Empty output |

### Input

| Message | Context |
|---------|---------|
| `{n} lines pasted.` | Multi-line paste |
| `Message exceeds {n} tokens.` | Input too long |

---

## 6. File Edit Flow

| Message | Context |
|---------|---------|
| `Reading {path}…` | Aegi reads file |
| `Analyzing {path}…` | Aegi analyzes contents |
| `Changes proposed for {path}.` | Diff ready |
| `Lines: {n} added, {m} removed` | Diff summary |
| `Risk: {level} — {reason}` | Risk assessment |
| `✓  Change applied to {path}.` | After `/apply` |
| `File backed up at .aegis/backups/{name}.bak` | Backup notice |
| `○  Change rejected. No files modified.` | After `/reject` |
| `You can ask me to adjust the approach.` | Follow-up to rejection |

---

## 7. Diff Display

| Message | Context |
|---------|---------|
| `Apply this change to {path}?` | Confirmation prompt |
| `[y] apply` | Apply option |
| `[d] full diff` | View full diff option |
| `[r] reject` | Reject option |
| `[e] edit` | Edit prompt option |

---

## 8. Analysis

| Message | Context |
|---------|---------|
| `Analyzing {n} files…` | `/analyze` start |
| `{path}:{line}  {issue}` | Issue line |
| `{n} issues found.` | Analysis complete |
| `No issues found.` | Clean analysis |
| `› /edit {path}  to fix` | Suggestion |

---

## 9. Diagnostics (doctor)

| Message | Context |
|---------|---------|
| `Running diagnostics…` | Starting `/doctor` |
| `{n} checks passed.` | All good |
| `{n} passed │ {m} warning │ {k} error` | Summary |
| `✓ {check}` | Passed check |
| `✗ {check}` | Failed check |
| `→ Run: {command}` | How to fix |
| `All systems nominal.` | Clean bill of health |

---

## 10. Errors & Warnings

| Message | Context |
|---------|---------|
| `Ollama is not running at http://localhost:11434` | Connection refused |
| `› Run: ollama serve` | Suggestion |
| `› Run: /doctor  to diagnose` | Suggest doctor |
| `Internal error. Please report this.` | Unhandled exception |
| `Config file corrupted at {path}.` | Parse failure |
| `Disk write failed: {path}.` | Permissions issue |
| `Out of memory.` | RAM limit hit |
| `Application terminated.` | Kill signal received |

---

## 11. Confirmations

| Message | Context |
|---------|---------|
| `Continue? [y/N]` | Generic confirm |
| `Delete {n} backup(s)? [y/N]` | Cleanup backups |
| `Reset all configuration? [y/N]` | Factory reset |

---

## 12. Theme System

| Message | Context |
|---------|---------|
| `Theme set to "{name}".` | After `/theme` |
| `Palette updated: {n} tokens.` | Confirm switch |
| `Unknown theme: "{name}".` | Invalid choice |
| `Available themes: {list}` | Help info |

---

## 13. Spinner / Activity Labels

| Label | Context |
|-------|---------|
| `Thinking…` | AI processing |
| `Reading file…` | Aegi reading |
| `Analyzing…` | Code analysis |
| `Generating…` | Response generation |
| `Editing…` | File modification |

---

## 14. Farewell

| Message | Context |
|---------|---------|
| `Until next time.` | Friendly sign-off |
| `Aegi offline.` | Standard poweroff |
| `Session secured.` | Clean exit |
| `Goodbye.` | Simple farewell |

---

## 15. Message Formatting Rules

1. **Variables** wrapped in `{curly braces}`.
2. **Ellipsis** always uses single character `…` (U+2026).
3. **Colon** followed by a space before value.
4. **Right-arrow** `→` for suggestions and transitions.
5. **Never** end a message without period if it's a complete sentence.
6. **Short forms** ok in spinners and labels (used repeatedly).
7. **Full forms** required in error messages and explanations.
