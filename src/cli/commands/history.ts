import { Command } from "commander";
import type { AppContext } from "../../core/appContext.js";
import { printTable } from "../../ui/printer.js";

export function registerHistoryCommand(
  program: Command,
  context: AppContext,
): void {
  program
    .command("history")
    .description("List saved conversations")
    .action(async () => {
      const rows = (await context.historyManager.list()).map(
        (conversation) => ({
          id: conversation.id,
          title: conversation.title,
          model: conversation.model,
          provider: conversation.providerId,
          updatedAt: conversation.updatedAt,
        }),
      );
      printTable(rows);
    });
}
