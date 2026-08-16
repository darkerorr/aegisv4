import { input, select } from "@inquirer/prompts";
import { Command } from "commander";
import type { AppContext } from "../../core/appContext.js";
import { printInfo, printTitle } from "../../ui/printer.js";
import { runChat } from "./chat.js";

export function registerShellCommand(
  program: Command,
  context: AppContext,
): void {
  program
    .command("shell")
    .description("Persistent interactive Aegis shell")
    .action(async () => {
      printTitle("Aegis Shell", "Choose actions without leaving the CLI.");

      while (true) {
        const action = await select({
          message: "Action",
          choices: [
            { name: "Chat", value: "chat" },
            { name: "Quick ask", value: "ask" },
            { name: "List models", value: "models" },
            { name: "List providers", value: "providers" },
            { name: "Exit", value: "exit" },
          ],
        });

        if (action === "exit") break;
        if (action === "chat") await runChat(context, {});
        if (action === "models")
          console.table(await context.modelManager.list());
        if (action === "providers") {
          console.table(
            (await context.providerManager.list()).map((provider) =>
              context.providerManager.publicView(provider),
            ),
          );
        }
        if (action === "ask") {
          const question = await input({ message: "Question" });
          const response = await context.aiClient.complete({
            messages: [{ role: "user", content: question }],
          });
          printInfo(response.content);
        }
      }
    });
}
