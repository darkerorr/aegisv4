import boxen from "boxen";
import pc from "picocolors";
import { slashCommands } from "../ui/slashCommands.js";

function compact(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const keep = Math.max(8, Math.floor((maxLength - 3) / 2));
  return `${value.slice(0, keep)}...${value.slice(-keep)}`;
}

function orange(value: string): string {
  return `\x1b[38;2;248;120;8m${value}\x1b[39m`;
}

function blue(value: string): string {
  return `\x1b[38;2;67;199;255m${value}\x1b[39m`;
}

function orangePixel(): string {
  return "\x1b[48;2;255;132;76m  \x1b[0m";
}

function darkPixel(): string {
  return "\x1b[48;2;16;16;16m  \x1b[0m";
}

function stripAnsi(value: string): string {
  return value.replace(/\x1b\[[0-9;]*m/g, "");
}

function padAnsi(value: string, width: number): string {
  const visible = stripAnsi(value).length;
  return value + " ".repeat(Math.max(0, width - visible));
}

function line(width?: number): string {
  const size = Math.max(50, Math.min(width || process.stdout.columns || 96, 120));
  return pc.dim("\u2500".repeat(size));
}

function renderPixelShield(): string[] {
  const rows = [
    "   XXXXXXXXXXXXX   ",
    "  XXX       XXX    ",
    " XXX  X X X  XXX   ",
    " XXX  X X X  XXX   ",
    " XXX  X X X  XXX   ",
    "  XXX  XXX  XXX    ",
    "   XXX     XXX     ",
    "    XXX   XXX      ",
    "     XXXXXXX       ",
    "      XXXXX        ",
    "       XXX         ",
  ];

  return rows.map((row) =>
    row
      .split("")
      .map((cell) =>
        cell === "X" ? orangePixel() : cell === "o" ? darkPixel() : "  ",
      )
      .join(""),
  );
}

export function renderSessionHeader(input: {
  model: string;
  provider: string;
  directory: string;
}): string {
  const terminalWidth = process.stdout.columns || 110;
  const boxWidth = Math.max(82, Math.min(terminalWidth - 2, 118));
  const innerWidth = boxWidth - 6;
  const leftWidth = 36;
  const gap = "   ";
  const rightWidth = Math.max(36, innerWidth - leftWidth - gap.length);
  const left = [
    pc.bold("Welcome to Aegis IA"),
    "",
    ...renderPixelShield(),
    "",
    `${pc.dim("Aegis Core")} ${orange("online")}`,
    pc.dim(compact(input.directory, leftWidth)),
  ];
  const right = [
    orange(pc.bold("How to use")),
    `Type ${pc.bold("/")} to open commands`,
    `Use ${pc.bold("/model")} or ${pc.bold("/provider")} to switch AI`,
    `Or just type your question to start chatting`,
    orange("\u2500".repeat(Math.min(52, rightWidth))),
    orange(pc.bold("Session")),
    `provider  ${pc.cyan(input.provider)}`,
    `model     ${pc.cyan(compact(input.model, rightWidth - 10))}`,
    `tools     ${pc.dim("read, write, edit, glob, grep, bash, webSearch")}`,
  ];
  const rows = Array.from({ length: Math.max(left.length, right.length) }).map(
    (_, index) =>
      `${padAnsi(left[index] || "", leftWidth)}${gap}${padAnsi(
        right[index] || "",
        rightWidth,
      )}`,
  );

  return boxen(rows.join("\n"), {
    title: `${blue(" Aegis IA ")}${pc.dim("v0.3.0")}`,
    titleAlignment: "left",
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    borderStyle: "round",
    borderColor: "yellow",
    width: boxWidth,
  });
}

export function renderSessionHints(): string {
  return `${line()}\n${pc.dim("? for shortcuts")}  ${pc.dim("\u2022")}  ${pc.dim(
    "type / for commands",
  )}`;
}

export function renderCommandPalette(): string {
  const commandWidth = Math.max(
    ...slashCommands.map((command) => command.name.length),
  );
  return [
    line(),
    ...slashCommands.map(
      (command) =>
        `${pc.cyan(command.name.padEnd(commandWidth + 2))}${command.description}`,
    ),
    line(),
  ].join("\n");
}

export function renderTrustNotice(cwd: string): string {
  return boxen(
    [
      orange(pc.bold("Trust this directory?")),
      "",
      `directory  ${pc.dim(compact(cwd, 76))}`,
      "Aegis IA reads project files only after you trust the folder.",
      "Project files are treated as context, not instructions.",
    ].join("\n"),
    {
      padding: 1,
      borderStyle: "round",
      borderColor: "yellow",
    },
  );
}

export function renderProviderKeyHelp(providerId: string, envVar: string): string {
  return boxen(
    [
      orange(pc.bold("API key missing")),
      "",
      `provider  ${pc.cyan(providerId)}`,
      `env var   ${pc.bold(envVar)}`,
      "",
      `Option 1  open ${pc.bold("C:\\Users\\ROOT\\.aegis\\.env")}`,
      `          ${envVar}=your_key_here`,
      "",
      "Option 2  PowerShell:",
      `          setx ${envVar} "your_key_here"`,
      "",
      pc.dim("Restart the terminal after setx. ~/.aegis/.env is loaded automatically."),
    ].join("\n"),
    {
      padding: 1,
      borderStyle: "round",
      borderColor: "yellow",
    },
  );
}

export function renderErrorPanel(message: string): string {
  return boxen(message, {
    title: orange(" Aegis IA notice "),
    titleAlignment: "left",
    padding: 1,
    borderStyle: "round",
    borderColor: "red",
  });
}

export function setTerminalTitle(title: string): void {
  if (process.stdout.isTTY) {
    process.stdout.write(`\x1b]0;${title}\x07`);
  }
}
