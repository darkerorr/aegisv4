#!/usr/bin/env node
import "dotenv/config";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { Command } from "commander";
import { createAppContext } from "./core/appContext.js";
import { AegisSession } from "./core/session.js";
import { registerCommands } from "./cli/registerCommands.js";
import { runSetup } from "./cli/commands/setup.js";
import { printError, printWarning } from "./ui/printer.js";
import { exists } from "./utils/fs.js";
import { configPath, globalEnvPath } from "./utils/paths.js";

function ensureGlobalEnvFile(): void {
  const envPath = globalEnvPath();
  if (existsSync(envPath)) return;

  try {
    mkdirSync(path.dirname(envPath), { recursive: true });
    writeFileSync(
      envPath,
      [
        "# Aegis IA API keys",
        "# Remove the # before a line and paste your key after the =",
        "",
        "# NVIDIA_API_KEY=your_nvidia_key_here",
        "# AEGIS_OPENAI_API_KEY=your_openai_key_here",
        "# AEGIS_GROQ_API_KEY=your_groq_key_here",
        "# AEGIS_CUSTOM_API_KEY=your_custom_key_here",
        "",
      ].join("\n"),
      "utf8",
    );
  } catch {
    // Do not block CLI startup if the home directory cannot be written.
  }
}

ensureGlobalEnvFile();
loadDotenv({ path: globalEnvPath(), override: false });

async function main(): Promise<void> {
  const context = createAppContext();
  const program = new Command();

  program
    .name("aegis")
    .description(
      "Aegis IA: interactive AI coding assistant with tools",
    )
    .version("0.3.0")
    .option("--no-color", "Disable colored output")
    .option("--debug", "Enable debug output");

  program.hook("preAction", (command) => {
    const options = command.optsWithGlobals<{
      noColor?: boolean;
      debug?: boolean;
    }>();
    if (options.noColor) process.env.NO_COLOR = "1";
    if (options.debug) process.env.AEGIS_DEBUG = "1";
  });

  registerCommands(program, context);

  program.action(async () => {
    const options = program.opts<{ noColor?: boolean; debug?: boolean }>();
    if (options.noColor) process.env.NO_COLOR = "1";
    if (options.debug) process.env.AEGIS_DEBUG = "1";
    if (!(await exists(configPath()))) {
      printWarning("No Aegis config found. Starting setup first.");
      await runSetup(context);
    }
    await new AegisSession(context).start(process.cwd());
  });

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  printError((error as Error).message);
  if (process.env.AEGIS_DEBUG === "1") {
    console.error(error);
  }
  process.exitCode = 1;
});
