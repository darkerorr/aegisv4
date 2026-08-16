import { Command } from "commander";
import type { AppContext } from "../../core/appContext.js";
import { ensureDir } from "../../utils/fs.js";
import { aegisHome, historyDir, logsDir } from "../../utils/paths.js";
import { printSuccess } from "../../ui/printer.js";

export function registerInitCommand(
  program: Command,
  context: AppContext,
): void {
  program
    .command("init")
    .description("Initialize Aegis local configuration")
    .action(async () => {
      await ensureDir(aegisHome());
      await ensureDir(historyDir());
      await ensureDir(logsDir());
      await context.configManager.init();
      await context.providerManager.init();
      await context.modelManager.init();
      await context.promptManager.init();
      printSuccess(`Aegis initialized in ${aegisHome()}`);
    });
}
