import { confirm, select } from "@inquirer/prompts";
import { Command } from "commander";
import type { AppContext } from "../../core/appContext.js";
import type { ChatMessage } from "../../types/index.js";
import { assistantLabel, ThinkingMascot } from "../../ui/mascot.js";
import { readChatPrompt } from "../../ui/prompt.js";
import { printInfo, printSuccess, printTitle } from "../../ui/printer.js";

interface ChatOptions {
  model?: string;
  provider?: string;
  system?: string;
  save?: boolean;
  load?: string;
  stream?: boolean;
}

export async function runChat(
  context: AppContext,
  options: ChatOptions = {},
): Promise<void> {
  const config = await context.configManager.get();
  const conversation = options.load
    ? await context.historyManager.load(options.load)
    : undefined;
  const model = options.model || conversation?.model || config.defaultModel;
  const provider = options.provider || conversation?.providerId;
  const messages: ChatMessage[] = conversation
    ? [...conversation.messages]
    : [];
  const shouldSave =
    options.save ||
    (await confirm({ message: "Save this conversation?", default: false }));
  let conversationId = conversation?.id;

  printTitle(
    "Aegis Chat",
    `Model: ${model}${provider ? ` | Provider: ${provider}` : ""}`,
  );
  printInfo("Type /exit to stop, /save to save, /clear to clear memory.");

  while (true) {
    const text = await readChatPrompt();
    if (text.trim() === "/exit") break;
    if (text.trim() === "/clear") {
      messages.splice(0, messages.length);
      printSuccess("Conversation memory cleared.");
      continue;
    }
    if (text.trim() === "/save") {
      const saved = await context.historyManager.saveConversation({
        id: conversationId,
        title:
          messages
            .find((message) => message.role === "user")
            ?.content.slice(0, 64) || "chat",
        providerId: provider || config.defaultProvider,
        model,
        messages,
      });
      conversationId = saved.id;
      printSuccess(`Saved: ${saved.id}`);
      continue;
    }

    messages.push({ role: "user", content: text });
    const thinking = new ThinkingMascot(
      "Aegi is thinking",
      `${provider || config.defaultProvider} / ${model}`,
    );
    thinking.start();
    let responseStarted = false;
    const startResponse = () => {
      if (responseStarted) return;
      thinking.stop();
      process.stdout.write(assistantLabel());
      responseStarted = true;
    };

    let response;
    try {
      response = await context.aiClient.complete({
        messages,
        model,
        provider,
        system: options.system,
        stream: options.stream,
        onChunk: (chunk) => {
          startResponse();
          process.stdout.write(chunk);
        },
      });
    } catch (error) {
      thinking.stop();
      throw error;
    }
    if (!responseStarted) {
      startResponse();
      process.stdout.write(response.content);
    }
    process.stdout.write("\n\n");
    messages.push({ role: "assistant", content: response.content });

    if (shouldSave) {
      const saved = await context.historyManager.saveConversation({
        id: conversationId,
        title:
          messages
            .find((message) => message.role === "user")
            ?.content.slice(0, 64) || "chat",
        providerId: provider || config.defaultProvider,
        model,
        messages,
      });
      conversationId = saved.id;
    }
  }
}

export async function chooseChatModel(context: AppContext): Promise<string> {
  const models = (await context.modelManager.list()).filter(
    (model) => model.active,
  );
  return select({
    message: "Choose a model",
    choices: models.map((model) => ({
      name: `${model.id} (${model.providerId})`,
      value: model.id,
    })),
  });
}

export function registerChatCommand(
  program: Command,
  context: AppContext,
): void {
  program
    .command("chat")
    .description("Start an AI chat session")
    .option("--model <model>", "Model id or provider model name")
    .option("--provider <provider>", "Provider id")
    .option("--system <prompt>", "System prompt")
    .option("--save", "Save the conversation")
    .option("--load <id>", "Load a saved conversation")
    .option("--no-stream", "Disable streaming")
    .action((options: ChatOptions) => runChat(context, options));
}
