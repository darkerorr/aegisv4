import { Command } from "commander";
import type { AppContext } from "../../core/appContext.js";

export function registerSummarizeCommand(
  program: Command,
  context: AppContext,
): void {
  program
    .command("summarize")
    .description("Summarize a text file")
    .argument("<file>", "File to summarize")
    .option("--short", "Short summary")
    .option("--medium", "Medium summary")
    .option("--detailed", "Detailed summary")
    .option("--model <model>", "Model id")
    .option("--provider <provider>", "Provider id")
    .action(async (file: string, options) => {
      const config = await context.configManager.get();
      const target = await context.fileManager.readTextFile(
        file,
        config.maxFileBytes,
      );
      const detail = options.detailed
        ? "detailed"
        : options.short
          ? "short"
          : "medium";
      const response = await context.aiClient.complete({
        model: options.model,
        provider: options.provider,
        messages: [
          {
            role: "user",
            content: `Create a ${detail} summary of this file: ${target.path}\n\n${target.content}`,
          },
        ],
      });
      console.log(response.content);
    });
}
