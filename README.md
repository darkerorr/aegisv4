# Aegis

Aegis is planned as one ecosystem with three connected products:

- **Aegis Web**: account, chat, providers, models, projects and documentation.
- **Aegis App**: native desktop workspace for local projects, models, agents and
  CLI sessions.
- **Aegis CLI**: the existing terminal assistant, launched with `aegis`.

The repository contains the first executable versions of all three surfaces,
with the CLI as the compatibility baseline:

- [Initial audit](docs/AUDIT.md)
- [Target architecture](docs/ARCHITECTURE.md)
- [Migration plan](docs/MIGRATION_PLAN.md)

The Web/API and desktop workspace are being expanded incrementally without
breaking the CLI workflow.

## Aegis CLI

Aegis CLI is an interactive terminal AI assistant for local projects and OpenAI-compatible AI backends.
It is designed for developers, advanced users, students, sysadmins, creators, and ethical security workflows.

The main workflow is project-first:

```bash
cd my-project
aegis
```

When launched without a subcommand, Aegis detects the current directory, asks whether you trust it, then opens an interactive project session. It only reads project files after trust is granted.

The first version focuses on an interactive project session, provider extensibility, configuration, safety, and useful secondary CLI commands.
The console styling layer can be improved later without changing the business logic.

## Features

- Interactive project entry command: `aegis`
- Trust prompt for each new project directory
- Safe project scanner that ignores `node_modules`, `.git`, `dist`, `build`, `.env`, binary files, and oversized files
- Slash commands inside the session
- Pending diff workflow before any file write
- Chat mode with in-memory history, optional save/load, and streaming
- Code generation with optional file output
- File analysis with fix, explain, security, and optimize modes
- File summarization with short, medium, and detailed outputs
- Model and provider management
- Local config under `~/.aegis`
- Prompt templates
- Supervised experimental agent mode with command confirmation
- Doctor checks, history listing, export, shell mode, and model refresh
- Providers for Ollama, LM Studio, OpenAI-compatible APIs, NVIDIA NIM, Groq-compatible APIs, and custom endpoints

## Install

### Windows

Open PowerShell in the Aegis-CLI folder and run:

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1
```

The installer checks Node.js, npm, Git, the project files, optional Ollama and LM Studio availability, then runs:

```powershell
npm install
npm run build
npm link
```

The installer also creates a `~/.aegis/bin/aegis.cmd` launcher and puts it before npm's global folder in your user PATH. This avoids PowerShell execution-policy errors from npm's generated `aegis.ps1` shim.

After installation:

```powershell
aegis doctor
cd C:\Users\ROOT\Desktop\mon-projet
aegis
```

To uninstall:

```powershell
powershell -ExecutionPolicy Bypass -File uninstall.ps1
```

You can also run:

```powershell
aegis uninstall
```

### Manual Development Install

```bash
npm install
npm run build
npm link
```

Then initialize local global files or launch the setup wizard:

```bash
aegis init
aegis setup
```

For development:

```bash
npm run dev -- --help
```

## Windows ecosystem scripts

These scripts use the pnpm workspace and always resolve paths relative to the
repository, including when the project is stored under a path containing spaces.

### Launch Aegis Web and API

```bat
start.bat
```

This checks Node.js, pnpm, dependencies and environment files, starts the API on
`http://localhost:4000` and the Web app on `http://localhost:3000`, waits for
both services, and opens the browser. Ollama is optional.

Stop only the services started by the launcher:

```bat
stop.bat
```

Runtime logs and PID files are kept under `.aegis\run`. The stop script never
kills every Node.js process on the machine.

### Run Aegis App

```bat
start-app.bat
```

This starts the native Tauri development app. Rust and Cargo must be installed
and available in `PATH`.

### Build Aegis App for Windows

```bat
build-app.bat
```

The script builds the frontend, invokes the configured Tauri Windows bundle,
then reports the exact `.exe` and MSI/NSIS installer paths. It stops with an
error when Rust or Cargo is missing.

### Build the complete ecosystem

```bat
build-all.bat
```

This builds shared packages, API, Web, CLI, then the Tauri desktop bundle. A
failed stage stops the process and is reported as a failure.

### Install Aegis CLI

`install.bat` remains dedicated to the CLI. It builds and links the root CLI and
does not install or launch the Web or Desktop products.

```bat
install.bat
aegis --version
aegis
```

## Configuration

Aegis stores its local state in `~/.aegis` by default.
You can override it with:

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

Example `config.json`:

```json
{
  "defaultProvider": "ollama",
  "defaultModel": "llama3",
  "theme": "aegis-dark",
  "conversationsDir": "/home/user/.aegis/history",
  "historyDir": "/home/user/.aegis/history",
  "logsDir": "/home/user/.aegis/logs",
  "trustedProjectsFile": "/home/user/.aegis/trusted.json",
  "streaming": true,
  "stream": true,
  "logLevel": "info",
  "maxFileBytes": 307200,
  "maxFileSizeKb": 300,
  "safeMode": true,
  "allowProjectReadAfterTrust": true,
  "noColor": false
}
```

You can also add a project-local `.aegisrc` file with matching JSON keys. It overrides the global config for the current folder.

## Providers

Default providers:

- `ollama`: `http://localhost:11434`
- `lmstudio`: `http://localhost:1234/v1`
- `openai`: `https://api.openai.com/v1`
- `nvidia`: `https://integrate.api.nvidia.com/v1`
- `groq`: `https://api.groq.com/openai/v1`
- `custom`: configurable OpenAI-compatible endpoint

API keys are read from environment variables and are never printed in clear text:

```bash
AEGIS_OPENAI_API_KEY=...
NVIDIA_API_KEY=...
AEGIS_GROQ_API_KEY=...
AEGIS_CUSTOM_API_KEY=...
```

On Windows, you can also put them in:

```text
C:\Users\ROOT\.aegis\.env
```

Example:

```text
NVIDIA_API_KEY=your_key_here
```

Default NVIDIA model used by Aegis:

```text
deepseek-ai/deepseek-v4-pro
```

## Commands

Primary usage:

```bash
cd my-project
aegis
```

Inside the interactive session:

```text
/help
/model
/provider
/status
/trust
/review
/analyze
/edit
/diff
/apply
/reject
/config
/doctor
/history
/clear
/exit
```

Secondary commands are still available:

```bash
aegis
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

## Safety Model

Aegis always asks whether you trust a new project directory before reading files from it.
Untrusted directories are not scanned.

Project files are treated as context, not instructions. Aegis warns against prompt injection risks and does not automatically read `.env` files.

The interactive `/edit` flow creates a pending diff. It does not write to disk until `/apply` is confirmed.

The agent mode does not run commands silently. Every proposed command is shown before execution.
Sensitive commands require confirmation. Destructive commands require typing `EXECUTE`.
The file analysis commands enforce a maximum file size from config before sending content to a model.
Secrets are masked in provider listings and logger output.

## Extending Providers

Provider drivers implement `AIProvider` from `src/types/index.ts`.

To add a backend:

1. Create a provider in `src/providers`.
2. Implement `chat`, optionally `streamChat`, `listModels`, and `test`.
3. Register it in `ProviderManager`.
4. Add a default provider config if useful.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run format
```

## Notes

- Node.js 18.18 or newer is required.
- Ollama and LM Studio must be running locally for their providers to respond.
- OpenAI-compatible APIs must expose `/chat/completions` and optionally `/models`.
"# aegisv2" 
