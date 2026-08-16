import { input, select } from "@inquirer/prompts";
import { Command } from "commander";
import type { AppContext } from "../../core/appContext.js";
import type { ModelConfig } from "../../types/index.js";
import { printSuccess, printTable } from "../../ui/printer.js";

export function registerModelsCommand(
  program: Command,
  context: AppContext,
): void {
  const models = program
    .command("models")
    .description("Manage configured models");

  models
    .command("list", { isDefault: true })
    .description("List configured models")
    .action(async () => {
      printTable(await context.modelManager.list());
    });

  models
    .command("search")
    .description("Search the model registry")
    .argument("[query]", "Name, provider or capability")
    .action(async (query = "") => {
      const needle = query || (await input({ message: "Search models" }));
      const rows = (await context.modelManager.list()).filter((model) => `${model.id} ${model.name} ${model.providerId}`.toLowerCase().includes(needle.toLowerCase()));
      printTable(rows);
    });

  models
    .command("refresh")
    .description("Discover models from active providers")
    .action(async () => {
      const refreshed = await context.modelManager.refresh(context.providerManager);
      printSuccess(`Model registry refreshed: ${refreshed.length} models.`);
    });

  models
    .command("use")
    .description("Set the default model")
    .argument("<id>", "Model id")
    .action(async (id: string) => {
      await context.modelManager.get(id);
      await context.configManager.set("defaultModel", id);
      printSuccess(`Default model set to ${id}`);
    });

  models
    .command("favorite")
    .description("Pin a model in the registry")
    .argument("<id>", "Model id")
    .action(async (id: string) => {
      const model = await context.modelManager.get(id);
      await context.modelManager.add({ ...model, active: true, favorite: true });
      printSuccess(`Model favorited: ${id}`);
    });

  models
    .command("hide")
    .description("Hide a model from the active list")
    .argument("<id>", "Model id")
    .action(async (id: string) => {
      await context.modelManager.setActive(id, false);
      printSuccess(`Model hidden: ${id}`);
    });

  models
    .command("add")
    .description("Add or update a model")
    .action(async () => {
      const providers = await context.providerManager.list();
      const id = await input({ message: "Model id" });
      const providerId = await select({
        message: "Provider",
        choices: providers.map((provider) => ({
          name: provider.id,
          value: provider.id,
        })),
      });
      const name = await input({ message: "Provider model name", default: id });
      const type = await select<ModelConfig["type"]>({
        message: "Type",
        choices: [
          { name: "chat", value: "chat" },
          { name: "code", value: "code" },
          { name: "embedding", value: "embedding" },
          { name: "other", value: "other" },
        ],
      });

      await context.modelManager.add({
        id,
        providerId,
        name,
        type,
        active: true,
      });
      printSuccess(`Model saved: ${id}`);
    });

  models
    .command("remove")
    .description("Remove a model")
    .argument("<id>", "Model id")
    .action(async (id: string) => {
      await context.modelManager.remove(id);
      printSuccess(`Model removed: ${id}`);
    });

  models
    .command("set-default")
    .description("Set the default model")
    .argument("[id]", "Model id")
    .action(async (id?: string) => {
      const modelsList = await context.modelManager.list();
      const modelId =
        id ||
        (await select({
          message: "Default model",
          choices: modelsList.map((model) => ({
            name: model.id,
            value: model.id,
          })),
        }));
      await context.configManager.set("defaultModel", modelId);
      printSuccess(`Default model set to ${modelId}`);
    });
}
