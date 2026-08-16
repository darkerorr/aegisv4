export type TerminalColorMode = "truecolor" | "ansi256" | "none";
const trueColor = (r: number, g: number, b: number, value: string) => `\x1b[38;2;${r};${g};${b}m${value}\x1b[39m`;
const ansi256 = (code: number, value: string) => `\x1b[38;5;${code}m${value}\x1b[39m`;
export function terminalMode(): TerminalColorMode { if (process.env.NO_COLOR === "1") return "none"; if (process.env.COLORTERM) return "truecolor"; return "ansi256"; }
export const aegisCliTheme = {
  title: (value: string) => value,
  blue: (value: string, mode = terminalMode()) => mode === "none" ? value : mode === "truecolor" ? trueColor(67, 199, 255, value) : ansi256(39, value),
  orange: (value: string, mode = terminalMode()) => mode === "none" ? value : mode === "truecolor" ? trueColor(248, 120, 8, value) : ansi256(208, value),
  white: (value: string, mode = terminalMode()) => mode === "none" ? value : mode === "truecolor" ? trueColor(237, 244, 255, value) : ansi256(255, value),
  muted: (value: string, mode = terminalMode()) => mode === "none" ? value : mode === "truecolor" ? trueColor(143, 162, 191, value) : ansi256(67, value),
  success: (value: string, mode = terminalMode()) => mode === "none" ? value : mode === "truecolor" ? trueColor(54, 213, 138, value) : ansi256(78, value),
  warning: (value: string, mode = terminalMode()) => mode === "none" ? value : mode === "truecolor" ? trueColor(248, 120, 8, value) : ansi256(208, value),
  error: (value: string, mode = terminalMode()) => mode === "none" ? value : mode === "truecolor" ? trueColor(239, 83, 80, value) : ansi256(196, value),
};
