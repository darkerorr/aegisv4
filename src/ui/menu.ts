import { select } from "@inquirer/prompts";
import type { AppContext } from "../core/appContext.js";
import { printTable, printTitle } from "./printer.js";
import { chooseChatModel, runChat } from "../cli/commands/chat.js";

export async function openMainMenu(context: AppContext): Promise<void> {
  printTitle("Aegis IA", "Interactive AI coding assistant with tools");

  const action = await select({
    message: "What do you want to do?",
    choices: [
      { name: "Start interactive session (recommended)", value: "session" },
      { name: "Start chat", value: "chat" },
      { name: "Choose model and chat", value: "model-chat" },
      { name: "Show providers", value: "providers" },
      { name: "Show models", value: "models" },
      { name: "Show config", value: "config" },
      { name: "Exit", value: "exit" },
    ],
  });

  if (action === "session") {
    const { AegisSession } = await import("../core/session.js");
    await new AegisSession(context).start(process.cwd());
  }
  if (action === "chat") await runChat(context, {});
  if (action === "model-chat")
    await runChat(context, { model: await chooseChatModel(context) });
  if (action === "providers") {
    printTable(
      (await context.providerManager.list()).map((provider) =>
        context.providerManager.publicView(provider),
      ),
    );
  }
  if (action === "models") printTable(await context.modelManager.list());
  if (action === "config")
    console.log(JSON.stringify(await context.configManager.get(), null, 2));
}
