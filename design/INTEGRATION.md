# Aegis-CLI — Integration Guide

> How to implement the Aegis-CLI visual system in TypeScript/Node.js.
> Covers the interactive session architecture, theme engine, and all UI components.
> Aegis-CLI is a **persistent interactive terminal application** (like Codex CLI).

---

## 1. Package Dependencies

```json
{
  "dependencies": {
    "chalk": "^5.3.0",
    "boxen": "^8.0.0",
    "ora": "^8.0.0",
    "inquirer": "^9.0.0",
    "cli-cursor": "^4.0.0",
    "cli-spinners": "^2.9.0",
    "ansi-escapes": "^6.0.0",
    "string-width": "^7.0.0",
    "wrap-ansi": "^9.0.0",
    "diff": "^5.1.0"
  }
}
```

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────┐
│  main.ts                                 │
│  ┌─────────────────────────────────────┐ │
│  │ Session                             │ │
│  │  ├─ TrustManager (directory check)  │ │
│  │  ├─ BootSequence (startup anim)     │ │
│  │  ├─ EventLoop                       │ │
│  │  │   ├─ InputHandler (slash / NL)   │ │
│  │  │   ├─ SlashRouter (commands)      │ │
│  │  │   ├─ ChatEngine (AI calls)       │ │
│  │  │   └─ DiffManager (file changes)  │ │
│  │  └─ Renderer                        │ │
│  │      ├─ StatusBar                   │ │
│  │      ├─ Conversation (scrollable)   │ │
│  │      ├─ InputBar                    │ │
│  │      └─ Footer                      │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Key files

| File | Purpose |
|------|---------|
| `src/ui/theme/*` | Theme engine (5 themes) |
| `src/session/trust.ts` | Directory trust check |
| `src/session/boot.ts` | Startup animation |
| `src/session/event-loop.ts` | Main interactive loop |
| `src/session/input-handler.ts` | Parse input → slash or NL |
| `src/session/slash-router.ts` | Route `/model`, `/edit`, etc. |
| `src/session/diff-manager.ts` | Manage pending diffs |
| `src/renderer/status-bar.ts` | Top status bar |
| `src/renderer/conversation.ts` | Scrollable message area |
| `src/renderer/input-bar.ts` | Bottom input prompt |
| `src/renderer/footer.ts` | Slash command hints |
| `src/ui/box.ts` | makeBox utility |
| `src/ui/progress.ts` | Progress bars |
| `src/ui/spinner.ts` | Ora wrapper |
| `src/ui/streaming.ts` | Streaming response cursor |

---

## 3. Theme Engine

### AegisTheme interface

```typescript
// src/ui/theme/types.ts
import chalk from 'chalk';

export interface AegisTheme {
  name: string;
  primary:     chalk.Chalk;
  primaryDim:  chalk.Chalk;
  secondary:   chalk.Chalk;
  accent:      chalk.Chalk;
  error:       chalk.Chalk;
  success:     chalk.Chalk;
  warning:     chalk.Chalk;
  textBright:  chalk.Chalk;
  textDim:     chalk.Chalk;
  textMuted:   chalk.Chalk;
  surface:     chalk.Chalk;
  surfaceAlt:  chalk.Chalk;
  borders: {
    heavy: BoxChars;
    light: BoxChars;
  };
  symbols: {
    diamond:    string; // ◆
    diamondOpen:string; // ◇
    online:     string; // ●
    offline:    string; // ○
    success:    string; // ✓
    error:      string; // ✗
    warning:    string; // ⚠
    prompt:     string; // ›
    bullet:     string; // •
    separator:  string; // ─
  };
  spinnerFrames: string[];
  spinnerColor: string;
}

export interface BoxChars {
  tl: string; tr: string; bl: string; br: string;
  h:  string; v:  string;
}
```

### Theme registry

```typescript
// src/ui/theme/index.ts
const themes = new Map<string, AegisTheme>([...]);
let currentTheme: AegisTheme = aegisDark;

export function getTheme(name?: string): AegisTheme { ... }
export function setTheme(name: string): AegisTheme { ... }
export function listThemes(): string { ... }
```

---

## 4. Box Builder (same makeBox utility)

```typescript
// src/ui/box.ts
export function makeBox(content, theme, opts?): string;
```

Specialized builders:

```typescript
// src/ui/boxes.ts
export function responseBox(content, meta?): string;
export function errorBox(message, details?, code?): string;
export function successBox(message, extra?): string;
export function confirmBox(message, actions?): string;
export function diffBox(diffLines, filePath): string;
export function trustBox(directory): string;
export function statusBar(model, ollamaStatus, cwd, streaming?): string;
export function inputBar(): string;
export function footer(commands): string;
```

---

## 5. Session — Event Loop

```typescript
// src/session/event-loop.ts

export class Session {
  private state: SessionState;
  private renderer: Renderer;
  private ollama: OllamaClient;
  private diffManager: DiffManager;

  async start(): Promise<void> {
    await this.checkTrust();
    await this.bootSequence();
    await this.eventLoop();
  }

  private async eventLoop(): Promise<void> {
    while (this.state.running) {
      const input = await this.renderer.waitForInput();
      if (input.startsWith('/')) {
        await this.slashRouter.route(input);
      } else {
        await this.handleNaturalLanguage(input);
      }
    }
  }

  private async handleNaturalLanguage(prompt: string): Promise<void> {
    const stream = this.ollama.chat(prompt);
    this.renderer.startStreaming();

    for await (const chunk of stream) {
      this.renderer.appendToStream(chunk);
    }

    if (this.diffManager.hasPendingDiff()) {
      this.renderer.showDiff(this.diffManager.getPendingDiff());
      const choice = await this.renderer.waitForDiffChoice();
      await this.handleDiffChoice(choice);
    }

    this.renderer.stopStreaming();
  }

  private async handleDiffChoice(choice: 'y' | 'd' | 'r' | 'e'): Promise<void> {
    switch (choice) {
      case 'y': await this.diffManager.apply(); break;
      case 'r': await this.diffManager.reject(); break;
      case 'd': this.renderer.showFullDiff(this.diffManager.getPendingDiff()); break;
      case 'e': /* open editor */ break;
    }
  }
}
```

---

## 6. Slash Router

```typescript
// src/session/slash-router.ts

type SlashHandler = (args: string[]) => Promise<void>;

const registry = new Map<string, SlashHandler>([
  ['model',    handleModel],
  ['provider', handleProvider],
  ['analyze',  handleAnalyze],
  ['edit',     handleEdit],
  ['diff',     handleDiff],
  ['review',   handleReview],
  ['apply',    handleApply],
  ['reject',   handleReject],
  ['doctor',   handleDoctor],
  ['help',     handleHelp],
  ['exit',     handleExit],
]);

export async function routeSlash(input: string): Promise<void> {
  const parts = input.trim().split(/\s+/);
  const cmd = parts[0].slice(1).toLowerCase(); // remove /
  const args = parts.slice(1);

  const handler = registry.get(cmd);
  if (!handler) {
    console.log(`Unknown command: "/${cmd}". Type /help for available commands.`);
    return;
  }
  await handler(args);
}

async function handleModel(args: string[]): Promise<void> {
  if (args.length === 0) {
    // Show model picker (Inquirer list)
    const { model } = await inquirer.prompt([{
      type: 'list', name: 'model',
      message: 'Select model:',
      choices: getModels().map(m => ({
        name: `${m.online ? '●' : '○'} ${m.name}`,
        value: m.name,
      })),
    }]);
    setCurrentModel(model);
    renderer.updateStatusBar();
  } else {
    const name = args.join(' ');
    const found = getModels().find(m => m.name === name);
    if (!found) {
      console.log(`Model "${name}" not found. Available: ${getModels().map(m => m.name).join(', ')}`);
      return;
    }
    setCurrentModel(name);
    renderer.updateStatusBar();
  }
}
```

---

## 7. Diff Manager

```typescript
// src/session/diff-manager.ts

import { diffLines } from 'diff';

interface PendingDiff {
  filePath: string;
  original: string;
  proposed: string;
  diff: DiffChange[];
  backupPath: string;
}

export class DiffManager {
  private pending: PendingDiff | null = null;

  async createDiff(filePath: string, proposal: string): Promise<PendingDiff> {
    const original = await fs.readFile(filePath, 'utf-8');
    const changes = diffLines(original, proposal);
    const backupPath = `.aegis/backups/${path.basename(filePath)}.bak`;

    this.pending = { filePath, original, proposed: proposal, diff: changes, backupPath };
    return this.pending;
  }

  async apply(): Promise<void> {
    if (!this.pending) throw new Error('No pending diff');
    await fs.mkdir(path.dirname(this.pending.backupPath), { recursive: true });
    await fs.copyFile(this.pending.filePath, this.pending.backupPath);
    await fs.writeFile(this.pending.filePath, this.pending.proposed, 'utf-8');
    this.pending = null;
  }

  reject(): void {
    this.pending = null;
  }

  getPendingDiff(): PendingDiff | null {
    return this.pending;
  }
}
```

---

## 8. Streaming Response

```typescript
// src/ui/streaming.ts

export class StreamingResponse {
  private buffer = '';
  private theme = getTheme();

  start(): void {
    process.stdout.write(`  ${this.theme.primary('┌─ Aegi ────────────────────────────────────────')}\n`);
    process.stdout.write(`  ${this.theme.primary('│ ')}`);
  }

  append(chunk: string): void {
    this.buffer += chunk;
    process.stdout.write(chunk);
  }

  complete(meta?: Record<string, string>): void {
    const theme = this.theme;
    process.stdout.write('\n');
    const metaStr = meta
      ? Object.entries(meta).map(([k, v]) => `${theme.textDim(k)}: ${v}`).join('  │  ')
      : '';
    process.stdout.write(`  │\n  │  ${theme.textDim(metaStr)}\n`);
    process.stdout.write(`  ${theme.primary('└───')} ${theme.textDim('[complete]')} ${theme.primary('─'.repeat(40))}\n`);
  }

  interrupt(): void {
    process.stdout.write('▏\n');
    process.stdout.write('  └─── [interrupted] ────────────────────────────────\n');
  }
}
```

---

## 9. Status Bar

```typescript
// src/renderer/status-bar.ts

import { getTheme } from '../ui/theme';

export function renderStatusBar(opts: {
  model: string | null;
  ollamaOnline: boolean;
  cwd: string;
  streaming: boolean;
}): string {
  const theme = getTheme();
  const model = opts.model ?? theme.textDim('—');
  const providerIcon = opts.ollamaOnline ? theme.symbols.online : theme.symbols.offline;
  const providerLabel = opts.ollamaOnline ? 'Ollama' : 'offline';
  const streamIndicator = opts.streaming ? `  ${theme.textDim('~')} ${theme.warning('◉')}` : '';
  const dir = opts.cwd.replace(process.env.HOME ?? '', '~');

  return [
    theme.primary('╔══════════════════════════════════════════════════════════╗'),
    theme.primary('║') +
      `  ${theme.symbols.diamond} AEGIS CLI ${theme.symbols.diamond}  ${theme.textBright(model)}  ${theme.success(providerIcon)} ${providerLabel}  ${theme.primaryDim(`◇ ${dir}`)}${streamIndicator}` +
      ' '.repeat(Math.max(0, 58 - model.length - dir.length)) +
      theme.primary('║'),
    theme.primaryDim('  ─────────────────────────────────────────────────────'),
  ].join('\n');
}
```

---

## 10. Trust Directory Screen

```typescript
// src/session/trust.ts

import inquirer from 'inquirer';
import { getTheme } from '../ui/theme';
import { makeBox } from '../ui/box';

export async function checkTrust(directory: string): Promise<boolean> {
  // Check if already trusted
  const trusted = await loadTrustedDirectories();
  if (trusted.includes(directory)) return true;

  // Show trust screen
  const theme = getTheme();
  console.log(makeBox(
    `  ${theme.textBright(directory)}\n\n` +
    theme.textDim('Aegi will be able to read and write files in\nthis directory and its subdirectories.\n\n') +
    theme.textDim('You can change this later in configuration.'),
    theme,
    { title: 'Aegi would like to access this directory.', borderStyle: 'heavy', color: theme.primary }
  ));

  const { allow } = await inquirer.prompt([{
    type: 'list',
    name: 'allow',
    message: 'Choose:',
    choices: [
      { name: 'Allow this directory', value: true },
      { name: "Don't allow this directory again", value: false },
    ],
  }]);

  if (allow) {
    await saveTrustedDirectory(directory);
    console.log(theme.success('  Directory trust granted.'));
  } else {
    console.log(theme.error('  Directory trust denied. Aegi cannot operate without file access.'));
  }
  return allow;
}
```

---

## 11. Progress & Spinners

```typescript
// src/ui/progress.ts
export function renderProgress(current: number, total: number): string;

// src/ui/spinner.ts
export function startSpinner(text: string): void;
export function stopSpinner(finalText?: string, state?: 'succeed' | 'fail' | 'warn' | 'info'): void;
export function updateSpinner(text: string): void;
```

---

## 12. ANSI Helpers

```typescript
// src/ui/ansi.ts

export const cursor = {
  up: (n = 1) => `\x1b[${n}A`,
  down: (n = 1) => `\x1b[${n}B`,
  hide: '\x1b[?25l',
  show: '\x1b[?25h',
  clearLine: '\x1b[2K',
  clearScreen: '\x1b[2J',
};

export function hasColorSupport(): boolean;
export function hasAnimationSupport(): boolean;
```

---

## 13. Piped Output Mode

```typescript
// src/ui/format.ts

export function formatOutput(content: string): string {
  // Strip ANSI codes and box chars if piped
}

export function stripBorders(content: string): string;
```

---

## 14. Implementation Checklist

- [ ] Install deps: chalk, boxen, ora, inquirer, cli-spinners, string-width, diff
- [ ] Create `src/ui/theme/types.ts` with AegisTheme interface
- [ ] Create all 5 theme files
- [ ] Create `src/ui/theme/index.ts` (registry)
- [ ] Create `src/ui/box.ts` (makeBox)
- [ ] Create `src/ui/boxes.ts` (responseBox, errorBox, diffBox, trustBox, statusBar, footer)
- [ ] Create `src/ui/progress.ts`
- [ ] Create `src/ui/spinner.ts` (Ora wrapper)
- [ ] Create `src/ui/streaming.ts` (StreamingResponse)
- [ ] Create `src/session/trust.ts` (directory trust)
- [ ] Create `src/session/boot.ts` (startup animation)
- [ ] Create `src/session/event-loop.ts` (main loop)
- [ ] Create `src/session/input-handler.ts` (slash vs NL parser)
- [ ] Create `src/session/slash-router.ts` (command routing)
- [ ] Create `src/session/diff-manager.ts` (file diff + apply/reject)
- [ ] Create `src/renderer/status-bar.ts`
- [ ] Create `src/renderer/conversation.ts`
- [ ] Create `src/renderer/input-bar.ts`
- [ ] Create `src/renderer/footer.ts`
- [ ] Test trust flow, slash commands, streaming, diff, apply/reject
- [ ] Test with 40, 60, 80, 120 column terminals
- [ ] Test with `NO_COLOR=1` and `AEGIS_NO_ANIMATIONS=1`
