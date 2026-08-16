# Aegis-CLI — Identity & Visual System

> Design proposal for Aegis-CLI — a **persistent interactive terminal application** (like Codex CLI).
> The user launches `aegis` once in a project directory, then enters an interactive session
> with a status bar, conversation area, input bar, and slash commands.
> This is NOT a set of separate CLI subcommands — all interactions happen inside the session
> via `/model`, `/edit`, `/analyze`, `/help`, `/exit`, or natural language in the input bar.
> Created for the Aegis-CLI project — an AI gateway for multiple LLM providers.

---

## 1. Character Name Proposals

| Name        | Rationale                                                                 |
|-------------|---------------------------------------------------------------------------|
| **Aegi**    | Short for Aegis. Direct, memorable, easy to type. Fits the project name.  |
| Sentinel    | Guardian connotation. Strong, protective. Slightly longer.                |
| Kairo       | Greek *kairos* — the opportune moment. Crisp, unusual, mysterious.        |
| Vanta        | Vantablack — the darkest substance. Cyber, deep.                          |
| Unit-A      | Functional, systematic. Feels like a military AI designation.             |

**→ Recommendation: Aegi** (pronounced *EE-gee*)  
The name ties directly to Aegis, is short enough for terminal use, and
carries the right mix of friendly and authoritative.

---

## 2. Character Description

**Name:** Aegi  
**Type:** Digital guardian entity / AI assistant persona  
**Form:** A small shield-shaped entity with a single luminous central eye.  
**Height:** 4–5 lines in terminal (mini variant: 3 lines).  
**Presence:** Appears alongside responses, in headers, and as a status indicator.

Aegi represents the protective, intelligent core of the framework.  
It does not have a gender (use "it" / avoid pronouns).  
Its visual form is a minimalist shield — echoing the name *Aegis*.

**Personality traits:**

- **Calm** — never rushed, never flustered.
- **Clear** — speaks in simple, direct sentences.
- **Observant** — notices context, reports what it sees.
- **Protective** — prompts for confirmation before destructive actions.
- **Precise** — gives exact information without fluff.
- **Slightly cryptic** — occasional poetic phrasing, but always intelligible.
- **Never arrogant** — communicates as a partner, not a superior.

---

## 3. Tone of Voice — Writing Style Guide

### General principles

- Use **active voice**: *"Aegi detects 3 providers."* not *"3 providers were detected."*
- Use **present tense** for current state, past tense for completed actions.
- Write **complete sentences** for status lines.
- Use **fragments** for real-time scan/progress lines.
- Never use **first-person plural** ("we"). Aegi is singular.
- Avoid **over-explaining**. Trust the user's intelligence.

### Sentence patterns

| Context | Pattern | Example |
|---------|---------|---------|
| Startup | `{subject} {state}.` | *"Aegi online."* |
| Success | `{action} {result}.` | *"Model link established."* |
| Error   | `{subject} {failure}.` | *"Provider unreachable."* |
| Prompt  | `{instruction}` | *"Awaiting instruction."* |
| Warning | `{action} {risk}.` | *"Command requires confirmation."* |
| Progress| `{action}…` | *"Scanning context…"* |

### Capitalization

- Sentence case for all messages.
- Provider names: capitalize (Ollama, LM Studio, OpenAI).
- Slash commands: lowercase code style (`/model`, `/edit`, `/analyze`, `/help`).
- Model names: as-is from provider (Llama 3, Qwen 2.5).
- The app is launched as `aegis` (not `aegis <subcommand>`).

### Punctuation

- End status lines with `.` (period).
- End prompts with no punctuation, or `?` for questions.
- End progress lines with `…` (ellipsis, single char `…` not `...`).
- Use `:` for labels and explanations.

---

## 4. Visual Identity System

### Core concept

Aegis-CLI's visual identity is built on three elements:
1. **The shield** — protection, containment, framework.
2. **The eye** — observation, intelligence, awareness.
3. **The diamond** — precision, value, clarity.

These map to specific box-drawing and symbol characters used
consistently across the entire interface.

### Primary construction characters

```
Borders (light):  ┌ ─ ┐ │ └ ┘
Borders (heavy):  ╔ ═ ╗ ║ ╚ ╝
Borders (dashed): ┄ ┆ ┌ ┈ ┐ ┊ └ ┈ ┘
Diamonds:          ◆ ◇
Circles:           ● ○ ◉ ◎
Status marks:      ✓ ✗ ⚠
Arrows:            → ← ▼ ▲
Bullets:           › •
Separators:        ─ ═ ┈
```

### Logo — Full version (6 lines)

```
  ╔═══════════════════╗
  ║   A E G I S   C L I ║
  ║                     ║
  ║   ◆  AI Guardian  ◆ ║
  ╚═══════════════════╝
```

### Logo — Medium version (4 lines)

```
╔═══════════════╗
║  AEGIS CLI    ║
║  ◆ Guardian  ◆║
╚═══════════════╝
```

### Logo — Short badge (1 line)

```
◆ AEGIS
```

### Logo — Minimal (1 line, no symbol)

```
[AEGIS]
```

### Decorative separator

```
── AEGIS ──────────────────
```

### End-of-section marker

```
◆
```

---

## 5. Mascot — Aegi

### Base appearance (idle state)

```
  ╔═════╗
  ║  ●  ║
  ╚══╤══╝
   ╱ │ ╲
```

**Anatomy:**
- Line 1–3: Shield-shaped head with double border.
- Line 2: Central eye (`●` for idle).
- Line 4: Small body with outstretched "arms" (`╱` and `╲`).

### Mini variant (for tight spaces)

```
 ╔═══╗
 ║ ● ║
 ╚═╤═╝
```

### All states

| State    | Eye | Visual | Notes |
|----------|-----|--------|-------|
| **idle**   | `●` | Filled circle | Default, calm |
| **thinking** | `◌` | Dotted circle (fallback: `○`) | Processing |
| **success** | `✓` | Check mark | Task complete |
| **error**   | `✗` | Cross mark | Failure occurred |
| **warning** | `⚠` | Warning sign | Caution needed |
| **scanning** | `◎` | Ring (fallback: `◉`) | Active search |
| **sleeping** | `─` | Dash | Low activity |

**Important:** `◌` (dotted circle) may not render in all terminals.
Fallback to `○` (empty circle) for thinking state.

### Full ASCII for each state

#### idle
```
  ╔═════╗
  ║  ●  ║
  ╚══╤══╝
   ╱ │ ╲
```

#### thinking
```
  ╔═════╗
  ║  ○  ║
  ╚══╤══╝
   ╱ │ ╲
```

#### success
```
  ╔═════╗
  ║  ✓  ║
  ╚══╤══╝
   ╱ │ ╲
```

#### error
```
  ╔═════╗
  ║  ✗  ║
  ╚══╤══╝
   ╱ │ ╲
```

#### warning
```
  ╔═════╗
  ║  ⚠  ║
  ╚══╤══╝
   ╱ │ ╲
```

#### scanning
```
  ╔═════╗
  ║  ◎  ║
  ╚══╤══╝
   ╱ │ ╲
```

#### sleeping
```
  ╔═════╗
  ║  ─  ║
  ╚══╤══╝
   ╱ │ ╲
```

### Mascot layout rules

- **Standalone** (with message): mascot on line 1–4, text on line 6+.
- **Inline** (progress / status): mini variant (3 lines) to the left of text.
- **Hidden** during intense output streaming (chat responses). Show again
  when Aegi has something to say.
- **Never** let the mascot take more than 6 lines of vertical space.

---

## 6. UI Component Vocabulary

| Component   | Characters              | Usage |
|-------------|-------------------------|-------|
| Title block | `╔═╗║╚╝`               | Welcome, major sections |
| Section box | `┌─┐│└┘`               | Chat, analysis, config |
| Alert box   | `┌─┐│└┘` + color       | Warnings, confirmation |
| Divider     | `───` or `════`         | Separating sections |
| Bullet      | `› ` or `• `            | Lists |
| Active item | `◆ `                    | Currently selected |
| Inactive    | `◇ `                    | Not selected |
| Online      | `● `                    | Running / available |
| Offline     | `○ `                    | Not available |
| Local       | `◇ `                    | Local-only resource |
| Default     | `◆ `                    | Default selection |
| Cursor      | `▌` or `█`             | Input field cursor |
| Prompt      | `›`                     | User input prompt |

---

## 7. Typography Considerations

- **No custom fonts** — terminal rendering depends on the user's font.
- **Use uppercase sparingly** — only for the logo (`AEGIS CLI`) and
  short labels.
- **Prefer lowercase, sentence case** for all user-facing text.
- **Avoid ALL-CAPS** blocks longer than 3 words.
- **Monospace alignment** — all designs assume a monospace terminal font
  (typically 8–10 chars per inch).
- **Minimum width:** 60 columns for full experience.
- **Minimum width:** 40 columns for compact mode.
- **Maximum width:** 120 columns (text wraps gracefully).

---

## 8. Quick Reference — Design Tokens

```
PRIMARY_BORDER    ╔ ═ ╗ ║ ╚ ╝
SECONDARY_BORDER  ┌ ─ ┐ │ └ ┘
ALERT_BORDER      ┌ ─ ┐ │ └ ┘  (with color)
DIVIDER           ─ ─ ─ ─ ─ ─
ACCENT_DIAMOND    ◆
INACTIVE_DIAMOND  ◇
STATUS_ONLINE     ●
STATUS_OFFLINE    ○
STATUS_LOCAL      ◇
STATUS_DEFAULT    ◆
MARK_SUCCESS      ✓
MARK_ERROR        ✗
MARK_WARNING      ⚠
PROMPT_SYMBOL     ›
BULLET_SYMBOL     •
```

---

## 9. Visual Hierarchy Rules

1. **Heavy border** (`╔ ╗ ╚ ╝`) = top-level section / app boundary.
2. **Light border** (`┌ ┐ └ ┘`) = secondary container / card.
3. **No border** = content area / streaming output.
4. **Bold + color** (ANSI bold) = labels, titles, key data.
5. **Dim / muted color** = secondary info, timestamps, metadata.
6. **Blinking** (ANSI blink) = **never** use. Unprofessional and
   inaccessible.
7. **Underline** = links, file paths (rarely used in terminal).
