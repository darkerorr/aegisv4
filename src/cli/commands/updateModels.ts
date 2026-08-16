import { Command } from "commander";
import type { AppContext } from "../../core/appContext.js";
import { printSuccess, printWarning } from "../../ui/printer.js";

export function registerUpdateModelsCommand(
  program: Command,
  context: AppContext,
): void {
  program
    .command("update-models")
    .description("Fetch available models from active providers")
    .action(async () => {
      const existing = await context.modelManager.list();
      const byId = new Map(existing.map((model) => [model.id, model]));

      for (const provider of await context.providerManager.list()) {
        if (!provider.active) continue;
        const driver = context.providerManager.getDriver(provider);
        if (!driver.listModels) continue;

        try {
          const models = await driver.listModels(provider);
          for (const model of models) {
            byId.set(`${provider.id}:${model.id}`, {
              ...model,
              id: `${provider.id}:${model.id}`,
            });
          }
          printSuccess(`${provider.id}: ${models.length} models found`);
        } catch (error) {
          printWarning(`${provider.id}: ${(error as Error).message}`);
        }
      }

      await context.modelManager.save([...byId.values()]);
      printSuccess("Model registry updated");
    });
}
