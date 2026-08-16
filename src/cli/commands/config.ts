import { input, select } from "@inquirer/prompts";
import { Command } from "commander";
import type { AppContext } from "../../core/appContext.js";
import type { AegisConfig, LogLevel } from "../../types/index.js";
import { printSuccess } from "../../ui/printer.js";

function parseValue(
  key: keyof AegisConfig,
  value: string,
): AegisConfig[keyof AegisConfig] {
  if (key === "streaming") return value === "true" || value === "1";
  if (key === "maxFileBytes") return Number(value);
  return value as AegisConfig[keyof AegisConfig];
}

export function registerConfigCommand(
  program: Command,
  context: AppContext,
): void {
  const config = program
    .command("config")
    .description("View or edit configuration");

  config
    .command("show", { isDefault: true })
    .description("Show configuration")
    .action(async () => {
      console.log(JSON.stringify(await context.configManager.get(), null, 2));
    });

  config
    .command("set")
    .description("Set a configuration value")
    .argument("[key]", "Configuration key")
    .argument("[value]", "Configuration value")
    .action(async (key?: keyof AegisConfig, value?: string) => {
      const configKey =
        key ||
        (await select<keyof AegisConfig>({
          message: "Config key",
          choices: [
            "defaultProvider",
            "defaultModel",
            "theme",
            "conversationsDir",
            "streaming",
            "logLevel",
            "maxFileBytes",
          ].map((item) => ({ name: item, value: item as keyof AegisConfig })),
        }));
      const nextValue =
        value || (await input({ message: `Value for ${configKey}` }));
      await context.configManager.set(
        configKey,
        parseValue(configKey, nextValue) as never,
      );
      printSuccess(`Config updated: ${configKey}`);
    });

  config
    .command("log-level")
    .description("Set log level")
    .argument("[level]", "silent, error, warn, info, debug")
    .action(async (level?: LogLevel) => {
      const selected =
        level ||
        (await select<LogLevel>({
          message: "Log level",
          choices: ["silent", "error", "warn", "info", "debug"].map((item) => ({
            name: item,
            value: item as LogLevel,
          })),
        }));
      await context.configManager.set("logLevel", selected);
      printSuccess(`Log level set to ${selected}`);
    });
}
