import { Command } from "commander";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { printInfo } from "../../ui/printer.js";

export function registerUninstallCommand(program: Command): void {
  program
    .command("uninstall")
    .description("Show how to uninstall Aegis")
    .action(() => {
      const currentFile = fileURLToPath(import.meta.url);
      const script = path.resolve(
        path.dirname(currentFile),
        "../../../uninstall.ps1",
      );
      printInfo("To uninstall Aegis on Windows, run:");
      console.log(`powershell -ExecutionPolicy Bypass -File "${script}"`);
      printInfo(
        "The script can remove the global command, config, and history after confirmation.",
      );
    });
}
