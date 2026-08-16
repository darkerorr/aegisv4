import { Command } from "commander";
import type { AppContext } from "../../core/appContext.js";

export function registerAnalyzeCommand(
  program: Command,
  context: AppContext,
): void {
  program
    .command("analyze")
    .description("Analyze a text file with the selected model")
    .argument("<file>", "File to analyze")
    .option("--fix", "Ask for a fix")
    .option("--explain", "Ask for an explanation")
    .option("--security", "Ask for a defensive security review")
    .option("--optimize", "Ask for optimization opportunities")
    .option("--model <model>", "Model id")
    .option("--provider <provider>", "Provider id")
    .action(async (file: string, options) => {
      const config = await context.configManager.get();
      const target = await context.fileManager.readTextFile(
        file,
        config.maxFileBytes,
      );
      const modes = [
        options.fix ? "fix issues" : "",
        options.explain ? "explain the file" : "",
        options.security ? "perform a defensive security review" : "",
        options.optimize ? "suggest optimizations" : "",
      ].filter(Boolean);
      const instruction = modes.length
        ? modes.join(", ")
        : "analyze quality, risks, and maintainability";
      const response = await context.aiClient.complete({
        model: options.model,
        provider: options.provider,
        messages: [
          {
            role: "user",
            content: `Please ${instruction} for ${target.path}.\n\n${target.content}`,
          },
        ],
      });
      console.log(response.content);
    });
}
