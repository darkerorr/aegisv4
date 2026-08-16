# Aegis-CLI — Color Themes

> Full color system for terminal-based UI.
> Each theme defines a complete palette with ANSI mappings.

---

## Theme 1: `aegis-dark` (default)

**Inspired by:** Cyberpunk minimalism, clean terminal interfaces.
**Best for:** General use, night-time coding.

### Palette

| Token             | Hex       | ANSI        | Description              |
|-------------------|-----------|-------------|--------------------------|
| `primary`         | `#00D4AA` | 36 (Cyan)   | Borders, accent text     |
| `primaryDim`      | `#007A66` | 29          | Muted borders            |
| `secondary`       | `#0A1628` | 17 (Blue)   | Background surfaces      |
| `accent`          | `#5F8EFF` | 33 (Blue)   | Highlights, links        |
| `error`           | `#FF4757` | 31 (Red)    | Error messages           |
| `success`         | `#2ED573` | 32 (Green)  | Success indicators       |
| `warning`         | `#FFA502` | 33 (Yellow) | Warning text             |
| `textBright`      | `#E4E8EF` | 37 (White)  | Primary text             |
| `textDim`         | `#6A7A8C` | 30 (Grey)   | Secondary text           |
| `textMuted`       | `#3D4B5A` | 30 (Grey)   | Borders, background text |
| `surface`         | `#0D1117` | 0 (Black)   | Main background          |
| `surfaceAlt`      | `#161B22` | 10          | Alternative background   |
| `selectionBg`     | `#1A2A44` | 24          | Selection highlight      |

### Visual sample

```
  ┌──────────────────────┐
  │  primary border      │ ← #00D4AA
  │  textBright content  │ ← #E4E8EF
  │  ● online   ○ offline│ ← #2ED573 / #6A7A8C
  └──────────────────────┘
```

### ANSI color mapping (16-index)

```
Black        30 #0D1117   Bright Black   90 #3D4B5A
Red          31 #FF4757   Bright Red     91 #FF6B7A
Green        32 #2ED573   Bright Green   92 #5DEA8D
Yellow       33 #FFA502   Bright Yellow  93 #FFBE44
Blue         34 #5F8EFF   Bright Blue    94 #82A8FF
Magenta      35 #C678DD   Bright Magenta 95 #D991F0
Cyan         36 #00D4AA   Bright Cyan    96 #33DFBD
White        37 #E4E8EF   Bright White   97 #F0F2F5
```

---

## Theme 2: `sentinel-green`

**Inspired by:** Classic green phosphor terminals, Fallout, early Linux.
**Best for:** Retro feel, extended sessions (easy on eyes).

### Palette

| Token             | Hex       | ANSI        | Description              |
|-------------------|-----------|-------------|--------------------------|
| `primary`         | `#00FF41` | 32 (Green)  | Borders, accent text     |
| `primaryDim`      | `#009A27` | 28          | Muted borders            |
| `secondary`       | `#0A1E0A` | 22          | Background surfaces      |
| `accent`          | `#66FF99` | 82          | Highlights               |
| `error`           | `#FF3355` | 31 (Red)    | Error messages           |
| `success`         | `#00FF41` | 32 (Green)  | Same as primary          |
| `warning`         | `#FFB800` | 33 (Yellow) | Warning text             |
| `textBright`      | `#C7F0CB` | 37 (White)  | Primary text             |
| `textDim`         | `#3A7D44` | 28          | Secondary text           |
| `textMuted`       | `#1A4A22` | 22          | Borders, background text |
| `surface`         | `#000C00` | 0 (Black)   | Main background          |
| `surfaceAlt`      | `#051A08` | 22          | Alternative background   |
| `selectionBg`     | `#0A2E12` | 22          | Selection highlight      |

### Visual sample

```
  ╔══════════════════════╗
  ║  AEGIS CLI — online  ║ ← #00FF41
  ╚══════════════════════╝
```

### ANSI color mapping

```
Black        30 #000C00   Bright Black   90 #1A4A22
Red          31 #FF3355   Bright Red     91 #FF5570
Green        32 #00FF41   Bright Green   92 #33FF66
Yellow       33 #FFB800   Bright Yellow  93 #FFCC44
Blue         34 #33A1FF   Bright Blue    94 #66BBFF
Magenta      35 #C678DD   Bright Magenta 95 #D991F0
Cyan         36 #00D4AA   Bright Cyan    96 #33DFBD
White        37 #C7F0CB   Bright White   97 #DFF5E2
```

---

## Theme 3: `ember-red`

**Inspired by:** Security consoles, alert systems, firewatch.
**Best for:** Deep focus, dramatic atmosphere.

### Palette

| Token             | Hex       | ANSI        | Description              |
|-------------------|-----------|-------------|--------------------------|
| `primary`         | `#FF6B35` | 202 (Orange)| Borders, accent text     |
| `primaryDim`      | `#8A3A1C` | 94          | Muted borders            |
| `secondary`       | `#1A0A0A` | 52          | Background surfaces      |
| `accent`          | `#FF8C60` | 216         | Highlights               |
| `error`           | `#FF1A1A` | 31 (Red)    | Error messages           |
| `success`         | `#44CC44` | 32 (Green)  | Success indicators       |
| `warning`         | `#FFAA00` | 33 (Yellow) | Warning text             |
| `textBright`      | `#E8D5C4` | 37 (White)  | Primary text             |
| `textDim`         | `#8A6A54` | 95          | Secondary text           |
| `textMuted`       | `#4A3024` | 59          | Borders, background text |
| `surface`         | `#0D0606` | 0 (Black)   | Main background          |
| `surfaceAlt`      | `#1A0D0A` | 52          | Alternative background   |
| `selectionBg`     | `#2A1410` | 52          | Selection highlight      |

### Visual sample

```
  ┌─ ⚠  Warning ─────────────┐
  │  #FFAA00 Warning message  │
  │  #FF6B35 Action required  │
  └───────────────────────────┘
```

### ANSI color mapping

```
Black        30 #0D0606   Bright Black   90 #4A3024
Red          31 #FF1A1A   Bright Red     91 #FF4444
Green        32 #44CC44   Bright Green   92 #66DD66
Yellow       33 #FFAA00   Bright Yellow  93 #FFCC44
Blue         34 #5F8EFF   Bright Blue    94 #82A8FF
Magenta      35 #C678DD   Bright Magenta 95 #D991F0
Cyan         36 #FF6B35   Bright Cyan    96 #FF8C60
White        37 #E8D5C4   Bright White   97 #F0E6DC
```

---

## Theme 4: `minimal`

**Inspired by:** Stripe documentation, GitHub, clean monochrome.
**Best for:** Professional environments, light terminals.

### Palette

| Token             | Hex       | ANSI        | Description              |
|-------------------|-----------|-------------|--------------------------|
| `primary`         | `#6C7280` | 247 (Grey)  | Borders, accent text     |
| `primaryDim`      | `#9CA3AF` | 248 (Grey)  | Muted borders            |
| `secondary`       | `#F3F4F6` | 255 (White) | Background surfaces      |
| `accent`          | `#3B82F6` | 33 (Blue)   | Highlights (rare)        |
| `error`           | `#DC2626` | 31 (Red)    | Error messages           |
| `success`         | `#16A34A` | 32 (Green)  | Success indicators       |
| `warning`         | `#D97706` | 33 (Yellow) | Warning text             |
| `textBright`      | `#111827` | 0 (Black)   | Primary text             |
| `textDim`         | `#6B7280` | 247 (Grey)  | Secondary text           |
| `textMuted`       | `#D1D5DB` | 253 (Grey)  | Borders, background text |
| `surface`         | `#FFFFFF` | 15 (White)  | Main background          |
| `surfaceAlt`      | `#F9FAFB` | 255         | Alternative background   |
| `selectionBg`     | `#E5E7EB` | 254         | Selection highlight      |

### Visual sample

```
  ┌──────────────────────────┐
  │  Primary text            │ ← #111827
  │  Secondary text          │ ← #6B7280
  │  [✓] Success  [✗] Error │ ← #16A34A / #DC2626
  └──────────────────────────┘
```

---

## Theme 5: `no-color`

**Inspired by:** Old school terminals, accessibility, CI/CD logs.
**Best for:** Piping output, screen readers, minimal environments.

### Palette

| Token             | ANSI        | Description              |
|-------------------|-------------|--------------------------|
| `primary`         | (none)      | Uses only `-` `=` `#`    |
| `primaryDim`      | (none)      | Same as primary          |
| `secondary`       | (none)      | No background            |
| `accent`          | (none)      | Uses `*` or `>` instead  |
| `error`           | (none)      | Prefixed with `[ERROR]`  |
| `success`         | (none)      | Prefixed with `[OK]`     |
| `warning`         | (none)      | Prefixed with `[WARN]`   |
| `textBright`      | (none)      | Standard terminal text   |
| `textDim`         | (none)      | Uses characters only     |
| `surface`         | (none)      | Transparent / default    |
| `surfaceAlt`      | (none)      | Same as surface          |

### Visual adaptations

In `no-color` mode, all visual indicators switch to pure character-based:

```
Color borders   →  `- - -` or `# # #`
◆  ◇            →  `*` `o`
●  ○            →  `@` `o`
✓  ✗  ⚠         →  `[OK]` `[ERR]` `[!]`
⚠ error text    →  `[!] Error description`
```

### Sample

```
+--------------------------------------------------+
|  AEGIS CLI                                        |
+--------------------------------------------------+
|  [OK] Model detected: Llama 3                     |
|  [!] Provider unreachable: LM Studio              |
|  [ERR] Connection failed                          |
+--------------------------------------------------+
```

---

## Implementation Recommendations

### Chalk usage (TypeScript)

```typescript
// theme.ts — exports for the default theme (aegis-dark)
import chalk from 'chalk';

export const theme = {
  primary:    chalk.hex('#00D4AA'),
  primaryDim: chalk.hex('#007A66'),
  secondary:  chalk.hex('#0A1628'),
  accent:     chalk.hex('#5F8EFF'),
  error:      chalk.hex('#FF4757'),
  success:    chalk.hex('#2ED573'),
  warning:    chalk.hex('#FFA502'),
  textBright: chalk.hex('#E4E8EF'),
  textDim:    chalk.hex('#6A7A8C'),
  textMuted:  chalk.hex('#3D4B5A'),
  surface:    chalk.hex('#0D1117'),
  surfaceAlt: chalk.hex('#161B22'),
};
```

### Theme loader — interface

```typescript
interface AegisTheme {
  name: string;
  primary:    Chalk;
  primaryDim: Chalk;
  secondary:  Chalk;
  accent:     Chalk;
  error:      Chalk;
  success:    Chalk;
  warning:    Chalk;
  textBright: Chalk;
  textDim:    Chalk;
  textMuted:  Chalk;
  surface:    Chalk;
  surfaceAlt: Chalk;
  borders: {
    heavy: { tl: string; tr: string; bl: string; br: string; h: string; v: string };
    light: { tl: string; tr: string; bl: string; br: string; h: string; v: string };
  };
  symbols: {
    diamond:     string;
    diamondOpen: string;
    online:      string;
    offline:     string;
    success:     string;
    error:       string;
    warning:     string;
    prompt:      string;
    bullet:      string;
  };
}
```

### Theme registration

```typescript
const themes = new Map<string, AegisTheme>();
themes.set('aegis-dark',    aegisDarkTheme);
themes.set('sentinel-green', sentinelGreenTheme);
themes.set('ember-red',      emberRedTheme);
themes.set('minimal',        minimalTheme);
themes.set('no-color',       noColorTheme);

export function getTheme(name: string = 'aegis-dark'): AegisTheme {
  return themes.get(name) ?? themes.get('aegis-dark')!;
}
```

---

## Theme switching UX

When a user switches themes:

```
  ◆ theme set to "sentinel-green"
  [████████████] done
  Palette updated: 13 tokens, 2-second flash test.
```

Briefly flash each color token on screen to confirm the switch.
