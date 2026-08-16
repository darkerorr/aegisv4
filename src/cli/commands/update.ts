import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { confirm } from "@inquirer/prompts";
import { Command } from "commander";
import { printInfo, printSuccess, printWarning } from "../../ui/printer.js";

function packageRoot(): string {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../",
  );
}

function run(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: true,
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(`${command} ${args.join(" ")} failed with code ${code}`),
        );
    });
  });
}

export function registerUpdateCommand(program: Command): void {
  program
    .command("update")
    .description("Update local Aegis checkout and relink the global command")
    .action(async () => {
      printInfo(
        "This runs git pull, npm install, npm run build, and npm link.",
      );
      const ok = await confirm({
        message: "Continue?",
        default: false,
      });
      if (!ok) {
        printWarning("Update cancelled.");
        return;
      }

      const root = packageRoot();
      await run("git", ["pull"], root);
      await run("npm", ["install"], root);
      await run("npm", ["run", "build"], root);
      await run("npm", ["link"], root);
      printSuccess("Aegis updated and relinked.");
    });
}
