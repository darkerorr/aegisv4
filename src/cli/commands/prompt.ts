import { input } from "@inquirer/prompts";
import { Command } from "commander";
import type { AppContext } from "../../core/appContext.js";
import { printSuccess, printTable } from "../../ui/printer.js";
import { sanitizeFileName } from "../../utils/validation.js";

export function registerPromptCommand(
  program: Command,
  context: AppContext,
): void {
  const prompt = program
    .command("prompt")
    .description("Manage prompt templates");

  prompt
    .command("list", { isDefault: true })
    .description("List prompt templates")
    .action(async () => {
      printTable(
        (await context.promptManager.list()).map(
          ({ content: _content, ...rest }) => rest,
        ),
      );
    });

  prompt
    .command("show")
    .description("Show a prompt template")
    .argument("<id>", "Prompt id")
    .action(async (id: string) => {
      const template = await context.promptManager.get(id);
      console.log(template.content);
    });

  prompt
    .command("add")
    .description("Add a prompt template")
    .action(async () => {
      const name = await input({ message: "Prompt name" });
      const description = await input({ message: "Description" });
      const content = await input({ message: "Prompt content" });
      const tags = await input({
        message: "Tags (comma separated)",
        default: "",
      });
      const id = sanitizeFileName(name.toLowerCase());
      await context.promptManager.add({
        id,
        name,
        description,
        content,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      printSuccess(`Prompt saved: ${id}`);
    });

  prompt
    .command("use")
    .description("Run a prompt template with an extra user message")
    .argument("<id>", "Prompt id")
    .argument("[message]", "User message")
    .option("--model <model>", "Model id")
    .option("--provider <provider>", "Provider id")
    .action(async (id: string, message: string | undefined, options) => {
      const template = await context.promptManager.get(id);
      const userMessage = message || (await input({ message: "Message" }));
      const response = await context.aiClient.complete({
        model: options.model,
        provider: options.provider,
        system: template.content,
        messages: [{ role: "user", content: userMessage }],
      });
      console.log(response.content);
    });
}
