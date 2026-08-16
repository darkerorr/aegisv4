import { copyFile, rm } from "node:fs/promises";
import { confirm } from "@inquirer/prompts";
import { Command } from "commander";
import { exists } from "../../utils/fs.js";
import { configPath } from "../../utils/paths.js";
import { printSuccess, printWarning } from "../../ui/printer.js";

export function registerResetConfigCommand(program: Command): void {
  program
    .command("reset-config")
    .description("Backup and reset global Aegis config")
    .action(async () => {
      if (!(await exists(configPath()))) {
        printWarning("No global config found.");
        return;
      }

      const ok = await confirm({
        message: "Backup and reset global config?",
        default: false,
      });
      if (!ok) {
        printWarning("Reset cancelled.");
        return;
      }

      const backup = `${configPath()}.backup-${Date.now()}`;
      await copyFile(configPath(), backup);
      await rm(configPath(), { force: true });
      printSuccess(`Config reset. Backup saved: ${backup}`);
    });
}
