import { input } from "@inquirer/prompts";
import { Command } from "commander";
import path from "node:path";
import type { AppContext } from "../../core/appContext.js";
import { printSuccess } from "../../ui/printer.js";
import { sanitizeFileName } from "../../utils/validation.js";

const extensions: Record<string, string> = {
  js: "js",
  ts: "ts",
  py: "py",
  go: "go",
  rs: "rs",
  java: "java",
  md: "md",
};

export function registerCodeCommand(
  program: Command,
  context: AppContext,
): void {
  program
    .command("code")
    .description("Generate code from a task description")
    .argument("[task]", "What should be coded")
    .option("--lang <language>", "Target language", "ts")
    .option("--output <dir>", "Write generated code to a directory")
    .option("--model <model>", "Model id")
    .option("--provider <provider>", "Provider id")
    .action(async (task: string | undefined, options) => {
      const description =
        task || (await input({ message: "What should Aegis code?" }));
      const prompt = [
        `Generate ${options.lang} code for this request:`,
        description,
        "",
        "Return complete, runnable code. Include short comments only where they add clarity.",
      ].join("\n");

      const response = await context.aiClient.complete({
        model: options.model,
        provider: options.provider,
        messages: [{ role: "user", content: prompt }],
      });

      console.log(response.content);

      if (options.output) {
        const ext = extensions[String(options.lang).toLowerCase()] || "txt";
        const filename = `${sanitizeFileName(description).slice(0, 32) || "generated"}.${ext}`;
        const target = await context.fileManager.writeGeneratedFile(
          path.resolve(options.output),
          filename,
          response.content,
        );
        printSuccess(`Generated file: ${target}`);
      }
    });
}
