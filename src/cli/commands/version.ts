import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";

export function registerVersionCommand(program: Command): void {
  program
    .command("version")
    .description("Print Aegis version")
    .action(async () => {
      const currentFile = fileURLToPath(import.meta.url);
      const packagePath = path.resolve(
        path.dirname(currentFile),
        "../../../package.json",
      );
      const pkg = JSON.parse(await readFile(packagePath, "utf8")) as {
        version: string;
      };
      console.log(pkg.version);
    });
}
