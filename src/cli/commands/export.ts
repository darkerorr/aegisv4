import { writeFile } from "node:fs/promises";
import { Command } from "commander";
import type { AppContext } from "../../core/appContext.js";
import { printSuccess } from "../../ui/printer.js";

export function registerExportCommand(
  program: Command,
  context: AppContext,
): void {
  program
    .command("export")
    .description("Export a saved conversation")
    .argument("<id>", "Conversation id")
    .option("--format <format>", "json or md", "md")
    .action(async (id: string, options) => {
      const format = options.format === "json" ? "json" : "md";
      const conversation = await context.historyManager.load(id);
      const target = context.historyManager.exportPath(
        `${conversation.id}-export`,
        format,
      );

      if (format === "json") {
        await writeFile(
          target,
          `${JSON.stringify(conversation, null, 2)}\n`,
          "utf8",
        );
      } else {
        const body = conversation.messages
          .map((message) => `## ${message.role}\n\n${message.content}`)
          .join("\n\n");
        await writeFile(target, `# ${conversation.title}\n\n${body}\n`, "utf8");
      }

      printSuccess(`Exported: ${target}`);
    });
}
