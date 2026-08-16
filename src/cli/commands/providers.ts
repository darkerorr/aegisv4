import { confirm, input, select } from "@inquirer/prompts";
import { Command } from "commander";
import type { AppContext } from "../../core/appContext.js";
import type { ProviderKind } from "../../types/index.js";
import { createSpinner } from "../../ui/spinner.js";
import { printSuccess, printTable } from "../../ui/printer.js";

export function registerProvidersCommand(
  program: Command,
  context: AppContext,
): void {
  const providers = program
    .command("providers")
    .description("Manage AI providers");

  providers
    .command("list", { isDefault: true })
    .description("List providers")
    .action(async () => {
      const rows = (await context.providerManager.list()).map((provider) =>
        context.providerManager.publicView(provider),
      );
      printTable(rows);
    });

  providers
    .command("add")
    .description("Add or update a provider")
    .action(async () => {
      const id = await input({ message: "Provider id" });
      const kind = await select<ProviderKind>({
        message: "Provider kind",
        choices: [
          { name: "Ollama local", value: "ollama" },
          { name: "LM Studio local", value: "lmstudio" },
          { name: "OpenAI-compatible API", value: "openai-compatible" },
          { name: "Anthropic-compatible API", value: "anthropic-compatible" },
          { name: "NVIDIA API", value: "nvidia-compatible" },
          { name: "Groq-compatible API", value: "groq-compatible" },
          { name: "Custom provider", value: "custom" },
        ],
      });
      const name = await input({ message: "Display name", default: id });
      const baseUrl = await input({ message: "Base URL" });
      const apiKeyEnv = await input({
        message: "API key env var (leave blank for none)",
        default: "",
      });
      const active = await confirm({
        message: "Enable provider?",
        default: true,
      });

      await context.providerManager.add({
        id,
        kind,
        name,
        baseUrl,
        apiKeyEnv: apiKeyEnv || undefined,
        active,
      });
      printSuccess(`Provider saved: ${id}`);
    });

  providers
    .command("test")
    .description("Test a provider")
    .argument("[id]", "Provider id")
    .action(async (id?: string) => {
      const providerId =
        id ||
        (await select({
          message: "Provider",
          choices: (await context.providerManager.list()).map((provider) => ({
            name: provider.id,
            value: provider.id,
          })),
        }));
      const config = await context.providerManager.get(providerId);
      const driver = context.providerManager.getDriver(config);
      const spinner = createSpinner(`Testing ${providerId}`).start();
      await driver.test?.(config);
      spinner.succeed(`${providerId} is reachable`);
    });

  providers
    .command("refresh")
    .description("Refresh models from active providers")
    .action(async () => {
      const refreshed = await context.modelManager.refresh(context.providerManager);
      printSuccess(`Provider registry refreshed. ${refreshed.length} models available.`);
    });

  providers
    .command("remove")
    .description("Remove a provider")
    .argument("<id>", "Provider id")
    .action(async (id: string) => {
      await context.providerManager.remove(id);
      printSuccess(`Provider removed: ${id}`);
    });
}
