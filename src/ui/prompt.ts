import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import pc from "picocolors";
import { slashCommands } from "./slashCommands.js";

function rule(): string {
  const width = Math.max(50, Math.min(stdout.columns || 96, 120));
  return pc.dim("\u2500".repeat(width));
}

function inputWidth(): number {
  return Math.max(54, Math.min(stdout.columns || 96, 120));
}

function inputTop(): string {
  const width = inputWidth();
  const title = " Ask Aegis IA ";
  const right = "\u2500".repeat(Math.max(1, width - title.length - 3));
  return `${pc.dim("\u256d\u2500")}${pc.cyan(pc.bold(title))}${pc.dim(
    `${right}\u256e`,
  )}`;
}

function inputBottom(): string {
  const width = inputWidth();
  return pc.dim(`\u2570${"\u2500".repeat(width - 2)}\u256f`);
}

function completeSlashCommand(line: string): [string[], string] {
  if (!line.startsWith("/")) return [[], line];
  const hits = slashCommands
    .map((command) => command.name)
    .filter((command) => command.startsWith(line));
  return [hits.length ? hits : slashCommands.map((command) => command.name), line];
}

export async function readPrompt(prompt = `${pc.bold(">")} `): Promise<string> {
  const rl = createInterface({
    input: stdin,
    output: stdout,
    completer: completeSlashCommand,
  });

  try {
    return await rl.question(prompt);
  } finally {
    rl.close();
  }
}

export async function readChatPrompt(): Promise<string> {
  stdout.write(`${rule()}\n${inputTop()}\n`);
  const answer = await readPrompt(`${pc.dim("\u2502")} ${pc.bold("\u203a")} `);
  if (!stdin.isTTY) {
    stdout.write("\n");
  }
  stdout.write(`${inputBottom()}\n`);
  return answer;
}
