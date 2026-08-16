# Aegis

**One ecosystem. Three surfaces. Local-first AI for real projects.**

Aegis is a monorepo that brings together three connected products around a
single goal: give developers an AI workspace that is fast, safe, and fully
visible — on the web, on the desktop, and in the terminal.

| Surface | What it is |
| --- | --- |
| **Aegis Web** | Account, chat, providers, models, projects, documentation and the **Work Mode** agent UI. |
| **Aegis App** | Native desktop workspace (Tauri) for local projects, models, agents and CLI sessions. |
| **Aegis CLI** | The existing terminal assistant, launched with `aegis`. The compatibility baseline of the ecosystem. |

The repository contains the first executable versions of all three surfaces.
The Web/API and the desktop workspace are expanded incrementally **without
breaking the CLI workflow**.

> **Aegis stays local-first.** It only reads files you explicitly trust, never
> runs commands silently, and keeps provider boundaries, context and execution
> visible while you work.

---

## Feature highlights

- **Interactive project sessions** — `aegis` detects the current directory,
  asks for trust, and opens a chat with streaming, history, slash commands and
  a pending-diff workflow before any file write.
- **Work Mode agent** — a local agent that reads, edits and creates files,
  runs commands and tests, with a **budget system** (turns, hard limits,
  stall detection) and an optional **team** of specialized agents.
- **Provider-agnostic** — Ollama, LM Studio, OpenAI-compatible APIs, NVIDIA
  NIM, Groq-compatible APIs and custom endpoints.
- **Safety-first** — trust prompts, `.env` protection, command confirmation,
  maximum file sizes, secret masking.
- **Multi-surface dev** — pnpm workspace, shared packages, Web + API +
  desktop + CLI built from one tree.

---

## Monorepo layout

```
aegis/
├─ apps/
│  ├─ api/            # @aegis/api           REST + streaming API (:4000)
│  ├─ cli/            # @aegis/cli           CLI facade → root dist
│  ├─ desktop/        # @aegis/desktop       Tauri native workspace
│  ├─ local-agent/    # @aegis/local-agent   Work Mode agent runtime
│  └─ web/            # @aegis/web           Next.js app (:3000)
├─ packages/
│  ├─ agent-runtime/  # @aegis/agent-runtime
│  ├─ ai-runtime/     # @aegis/ai-runtime
│  ├─ api-client/     # @aegis/api-client
│  ├─ cli-ui/         # @aegis/cli-ui
│  ├─ config/         # @aegis/config
│  ├─ project-engine/ # @aegis/project-engine
│  ├─ providers/      # @aegis/providers
│  ├─ security/       # @aegis/security
│  ├─ shared-ui/      # @aegis/shared-ui
│  ├─ supervisor/     # @aegis/supervisor
│  ├─ tools/          # @aegis/tools
│  └─ types/          # @aegis/types
├─ src/               # CLI source (built to dist/)
├─ docs/              # Audit, architecture, migration plan
└─ scripts/           # Supervisor + build tooling
```

**Requirements:** Node.js ≥ 20 · pnpm 10 · Git. Rust/Cargo is required only
for the desktop app.

---

## Getting started

### Full dev environment

```bash
pnpm install
pnpm dev          # starts API (:4000) + Web (:3000) via the supervisor
```

Or run surfaces individually:

```bash
pnpm dev:web        # Next.js app
pnpm dev:api        # REST + streaming API
pnpm dev:desktop    # Tauri desktop app
pnpm dev:local-agent
pnpm dev:cli        # CLI from source (tsx src/index.ts)
```

### Aegis CLI

Quick start in any project:

```bash
cd my-project
aegis
```

When launched without a subcommand, Aegis detects the current directory, asks
whether you trust it, then opens an interactive project session. It only reads
project files **after** trust is granted.

Manual development install:

```bash
npm install
npm run build
npm link
aegis init        # local global files
aegis setup       # setup wizard
```

### Windows scripts

The `*.bat` launchers use the pnpm workspace and resolve paths relative to the
repository, including under paths containing spaces.

| Script | Purpose |
| --- | --- |
| `start.bat` | Start API + Web and open the browser. |
| `stop.bat` | Stop only the services started by the launcher. |
| `start-app.bat` | Run the Tauri desktop dev app. |
| `build-app.bat` | Build the Windows desktop bundle (`.exe`, MSI/NSIS). |
| `build-all.bat` | Build the complete ecosystem (packages → API → Web → CLI → desktop). |
| `install.bat` | Build and link the CLI only. |
| `install.ps1` | One-shot Windows installer (checks Node, npm, Git, optional Ollama/LM Studio). |
| `uninstall.ps1` | Remove the CLI (`aegis uninstall` also works). |

`start.bat` runs the API on `http://localhost:4000` and the Web app on
`http://localhost:3000`, waits for both services, then opens the browser.
Runtime logs and PID files live under `.aegis\run`.

---

## Work Mode (Local Agent)

**Work Mode** is Aegis's agent surface: a local agent that works inside a
workspace you trust, with every action shown as an inline chat card.

- Reads, creates, edits and moves files; searches the workspace.
- Runs commands, tests, lint and typecheck; reports diffs inline.
- **Budget system** — actions are metered (reads, edits, commands); the agent
  warns when the budget runs low and can be resumed from a checkpoint instead
  of restarting.
- **Single or Team** — one agent by default, or a team of specialized agents
  (design, marketing, QA, security…) selected automatically or by hand.
- **Stall detection** — repeated identical turns are detected and surfaced
  instead of looping forever.
- Sensitive actions require your approval before they run.

---

## Configuration

Local state lives in `~/.aegis` by default. Override it with `AEGIS_HOME`:

```bash
AEGIS_HOME=/path/to/aegis-home
```

Generated files:

```text
~/.aegis/config.json
~/.aegis/models.json
~/.aegis/providers.json
~/.aegis/prompts.json
~/.aegis/history/
```

A project-local `.aegisrc` file with matching JSON keys overrides the global
config for the current folder.

---

## Providers

| Provider | Default endpoint |
| --- | --- |
| `ollama` | `http://localhost:11434` |
| `lmstudio` | `http://localhost:1234/v1` |
| `openai` | `https://api.openai.com/v1` |
| `nvidia` | `https://integrate.api.nvidia.com/v1` |
| `groq` | `https://api.groq.com/openai/v1` |
| `custom` | Configurable OpenAI-compatible endpoint |

API keys are read from environment variables and never printed in clear text:

```bash
AEGIS_OPENAI_API_KEY=...
NVIDIA_API_KEY=...
AEGIS_GROQ_API_KEY=...
AEGIS_CUSTOM_API_KEY=...
```

On Windows they can also be placed in `C:\Users\ROOT\.aegis\.env`.

---

## CLI reference

Inside an interactive session:

```text
/help      /model     /provider   /status   /trust
/review    /analyze   /edit       /diff     /apply
/reject    /config    /doctor     /history  /clear
/exit
```

Secondary commands:

```bash
aegis init
aegis setup
aegis doctor
aegis version
aegis reset-config
aegis uninstall
aegis update
aegis chat --model llama3 --provider ollama
aegis chat --system "You are a defensive cybersecurity expert" --save
aegis code "Create a REST API" --lang ts --output ./api
aegis analyze ./src/index.ts --security
aegis summarize ./notes.txt --detailed
aegis models list
aegis models add
aegis models set-default llama3
aegis providers list
aegis providers add
aegis providers test ollama
aegis config show
aegis config set streaming true
aegis prompt list
aegis prompt use developer "Review this architecture"
aegis history
aegis export <conversation-id> --format md
aegis update-models
aegis shell
aegis agent
```

---

## Safety model

- Aegis asks whether you trust a new project directory before reading from it.
  Untrusted directories are never scanned.
- Project files are treated as **context, not instructions**. Aegis warns
  against prompt injection risks and does not automatically read `.env` files.
- The `/edit` flow creates a pending diff. Nothing is written to disk until
  `/apply` is confirmed.
- The agent mode shows every proposed command before execution. Sensitive
  commands require confirmation; destructive commands require typing `EXECUTE`.
- File analysis enforces a maximum file size from config before content is sent
  to a model.
- Secrets are masked in provider listings and logger output.

---

## Extending providers

Provider drivers implement `AIProvider` from `src/types/index.ts`.

To add a backend:

1. Create a provider in `src/providers`.
2. Implement `chat`, optionally `streamChat`, `listModels`, and `test`.
3. Register it in `ProviderManager`.
4. Add a default provider config if useful.

---

## Development scripts

```bash
pnpm dev        # supervisor: API + Web
pnpm build      # CLI + all workspace packages
pnpm test       # all workspace tests
pnpm lint       # all workspace lint
pnpm format     # prettier --write .
```

---

## Documentation

- [Initial audit](docs/AUDIT.md)
- [Target architecture](docs/ARCHITECTURE.md)
- [Migration plan](docs/MIGRATION_PLAN.md)
- [AI coordination](docs/AI_COORDINATION.md)

## Notes

- Ollama and LM Studio must be running locally for their providers to respond.
- OpenAI-compatible APIs must expose `/chat/completions` and optionally `/models`.
- The console styling layer can be improved later without changing business logic.