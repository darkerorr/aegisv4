# Aegis-CLI — UX Guidelines & Animation System

> Terminal UX principles, animation patterns, and interaction design for Aegis-CLI.
> Aegis-CLI is a **persistent interactive terminal application**, not a command-line tool.
> The user launches `aegis` once and stays in the interface.

---

## 1. Core UX Principles

### 1.1 Persistent Session

Aegis-CLI is a **stateful application**, not a command-runner.  
The user starts it once (`aegis`) and stays inside an interactive shell.

```
┌─────────────────────────────────────┐
│  Launch: aegis                      │
│  → Trust directory check            │
│  → Boot sequence                    │
│  → Interactive session (long-lived) │
│  → /exit                            │
└─────────────────────────────────────┘
```

All commands are **slash commands** typed into the input bar:
`/model`, `/edit`, `/diff`, `/apply`, `/reject`, `/doctor`, `/help`, `/exit`.

The user can also type free-form natural language to chat with the AI.

### 1.2 The Interface is a Single Page

Status bar at top → conversation scroll in middle → input bar at bottom.

```
╔══════════════════════════════════════════════════════════╗
║  Status bar: ◆ AEGIS ◆  model  ● provider  ◇ directory ║
║  ─────────────────────────────────────────────────────    ║
║  (chat history — scrollable)                             ║
║                                                          ║
║  ┌─ You ───────────────────────────────────────────────┐ ║
║  │ ...                                                  │ ║
║  └─────────────────────────────────────────────────────┘ ║
║  ┌─ Aegi ──────────────────────────────────────────────┐ ║
║  │ ...                                                  │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                          ║
║  ┌─────────────────────────────────────────────────────┐ ║
║  │  › _ (input)                                         │ ║
║  └─────────────────────────────────────────────────────┘ ║
║  Footer: /model /edit /diff /help                        ║
╚══════════════════════════════════════════════════════════╝
```

### 1.3 Trust First

Before any file operation, Aegis asks for directory trust.

```
  Aegi would like to access this directory.
  ┌─────────────────────────────────────┐
  │  /Users/you/project/my-app          │
  │                                     │
  │  Aegi will be able to read and      │
  │  write files in this directory.     │
  └─────────────────────────────────────┘

  ○ Don't allow this directory again
  ● Allow this directory
```

Once trusted, all file operations within that directory are permitted.
Trust can be revoked later via `/config`.

### 1.4 Confirm Before Action

Every file modification follows this flow:

```
  User request → Aegi proposes → Diff displayed → User confirms → Applied
                                                                    ↓
                                                               Rejected
```

1. Aegi reads the file and generates a diff.
2. The diff is displayed with `+` and `-` lines.
3. A confirmation prompt shows options: `[y] apply` `[r] reject` `[d] full diff` `[e] edit`.
4. On apply: file is written, backup saved.
5. On reject: no files touched, user can refine.

### 1.5 State Visibility

The status bar always shows:

| Element | Purpose |
|---------|---------|
| `◆ AEGIS CLI ◆` | App identity |
| `Llama 3 70B` | Current model (or `—` if none) |
| `● Ollama` | Provider status (● online / ○ offline) |
| `◇ ./my-app` | Current working directory |
| `~ ◉` | Streaming indicator (only during generation) |

### 1.6 Graceful Degradation

Same rules as before for small terminals, no-color, piped output.

---

## 2. Slash Command System

### 2.1 Command list

| Command | Description |
|---------|-------------|
| `/model <name>` | Switch model (shows picker if no arg) |
| `/provider` | Show Ollama connection status |
| `/analyze <path>` | Analyze files for issues |
| `/edit <file>` | Edit a file (free-form, then propose diff) |
| `/diff <file>` | Show pending diff |
| `/review` | Review all recent changes |
| `/apply` | Apply the currently displayed diff |
| `/reject` | Reject the currently displayed diff |
| `/doctor` | Run system diagnostics |
| `/help` | Show all slash commands |
| `/exit` | Quit Aegis CLI |

### 2.2 Slash input

```
  › /edit src/db/service.ts
```

- Typing `/` activates command mode.
- Tab completion: suggest commands.
- Unknown command: `Unknown command: "/foo". Type /help for available commands.`
- Empty command: ignored (treat as natural language).

### 2.3 Natural language input

Any input not starting with `/` is treated as a chat message to the AI.

```
  › Explain the dependency injection pattern in this project.
```

The response streams into a boxed message in the conversation area.

---

## 3. Screen Composition

### 3.1 Status bar

```
║  ◆ AEGIS CLI ◆  Llama 3 70B  ● Ollama  ◇ ./my-app  ~ ◉ ║
```

- Fixed single line at the top.
- Never scrolls away.
- Updates in real-time when model/provider/streaming state changes.

### 3.2 Conversation area

- Scrollable region between status bar and input bar.
- Messages appear as bordered boxes: `┌─ You ──┐` and `┌─ Aegi ──┐`.
- New messages appear at the bottom; older ones scroll up.
- Auto-scroll follows the latest message unless user manually scrolls up.
- Differential indicators on the right edge when user has scrolled up.

### 3.3 Input bar

```
  ┌─────────────────────────────────────────────────────┐
  │  › _                                                │
  └─────────────────────────────────────────────────────┘
```

- Fixed single line at the bottom.
- `›` prefix for all input.
- `_` cursor (ANSI blink block or underscore).
- Multi-line paste: auto-collapse, show `(3 lines pasted)`.

### 3.4 Footer bar

```
  /model /provider /analyze /edit /diff /review /apply /reject /doctor /help /exit
```

- Shows slash commands as a hint.
- Auto-collapses to most relevant subset when space < 80 columns.
- Dimmed color.

---

## 4. Interaction Patterns

### 4.1 Streaming response

When generating a response:

1. Replace input bar prompt with a spinner or "Thinking…" indicator.
2. Stream the response token by token into an open `┌─ Aegi ──┐` box.
3. Show `▐` cursor advancing with text.
4. Show metadata in the right side of the streaming box: `[42 tok/s]`.
5. On completion: close box, show metadata line, restore input bar.

### 4.2 Diff interaction

When Aegi proposes a file change:

1. Display the diff in a bordered box with `-` (red/muted) and `+` (green) lines.
2. Show a confirmation prompt below:
   ```
   ┌─ Confirmation Required ─────────────────────────────┐
   │  Apply this change to src/db/service.ts?             │
   │  [y] apply  │  [d] full diff  │  [r] reject  │  [e] edit ║
   └─────────────────────────────────────────────────────┘
   ```
3. Focus moves to the confirmation input (single keypress: y/d/r/e).
4. After apply: show success message, return to input bar.
5. After reject: show "Change rejected" message, return to input bar.

### 4.3 Multiple turns

The conversation accumulates:

```
  › Explain the DI pattern
  [Aegi responds]
  › Show me the container.ts file
  [Aegi responds]
  › /edit src/di/container.ts
  [Aegi reads file, proposes changes]
  [Diff displayed]
  y
  [Aegi applies changes]
  › Done. /exit
```

Each turn adds to the scrollable history.

---

## 5. Animation Rules (same as before)

- Startup animation (boot sequence) on launch.
- Eye pulsing on the mascot during idle.
- Streaming cursor `▐` during generation.
- Progress bars `[████░░]` for file scanning and long operations.
- All animations optional via `--no-animations` or `AEGIS_NO_ANIMATIONS=1`.

---

## 6. Edge Cases

### 6.1 First launch (no trust)

Show trust directory screen. Block all file operations until trust is granted.

### 6.2 Ollama goes offline mid-session

- Status bar updates: `○ offline`
- Next request shows error box and offers `/doctor`
- State preserved; resume when Ollama comes back

### 6.3 Model not found

When user types `/model UnknownModel`:

```
  Model "UnknownModel" not found. Available: Llama 3 70B, Llama 3 8B, Qwen 2.5 7B
```

Stick with current model.

### 6.4 File doesn't exist

When user types `/edit nonexistent.ts`:

```
  File "src/nonexistent.ts" not found in the current directory tree.
  Check the path and try again.
```

### 6.5 Pending diff lost

If user types a new request before applying/rejecting a pending diff:

```
  You have a pending change to src/db/service.ts.
  Apply it first with /apply, reject with /reject, or proceed anyway? [y]
```

---

## 7. Keyboard Bindings

| Key | Action |
|-----|--------|
| `Enter` | Submit input |
| `↑` | Recall previous input |
| `↓` | Forward in input history |
| `Tab` | Auto-complete slash command |
| `Ctrl+C` | Interrupt generation / exit |
| `Ctrl+L` | Clear conversation |
| `Ctrl+D` | Exit (when input empty) |
| `Page Up` | Scroll conversation up |
| `Page Down` | Scroll conversation down |

---

## 8. Quick Reference — Layout Zones

```
┌──────────────────────────────────────────────────────────┐
│  STATUS BAR  (1 line, fixed)                             │
│  model, provider status, cwd, streaming indicator        │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  CONVERSATION AREA  (scrollable)                         │
│                                                           │
│  ┌─ You ──┐                                              │
│  │ ...    │                                              │
│  └────────┘                                              │
│                                                           │
│  ┌─ Aegi ──────────────────────┐                         │
│  │ ...                         │                         │
│  └─────────────────────────────┘                         │
│                                                           │
│  ▼ 3 more lines  (scroll indicator if applicable)        │
│                                                           │
├──────────────────────────────────────────────────────────┤
│  INPUT BAR  (1 line, fixed)                              │
│  ┌─────────────────────────────────────────────────┐     │
│  │  › _                                            │     │
│  └─────────────────────────────────────────────────┘     │
├──────────────────────────────────────────────────────────┤
│  FOOTER  (1 line, fixed)                                 │
│  /model /edit /diff /help                                │
└──────────────────────────────────────────────────────────┘
