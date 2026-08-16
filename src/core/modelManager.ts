import type { ModelConfig } from "../types/index.js";
import { readJson, writeJson } from "../utils/fs.js";
import { modelsPath } from "../utils/paths.js";
import type { ProviderManager } from "./providerManager.js";

export const defaultModels: ModelConfig[] = [
  {
    id: "llama3",
    providerId: "ollama",
    name: "llama3",
    type: "chat",
    active: true,
  },
  {
    id: "qwen2.5-coder",
    providerId: "ollama",
    name: "qwen2.5-coder",
    type: "code",
    active: true,
  },
  {
    id: "lmstudio-local",
    providerId: "lmstudio",
    name: "local-model",
    type: "chat",
    active: true,
  },
  {
    id: "gpt-4o-mini",
    providerId: "openai",
    name: "gpt-4o-mini",
    type: "chat",
    active: false,
  },
  {
    id: "deepseek-ai/deepseek-v4-pro",
    providerId: "nvidia",
    name: "deepseek-ai/deepseek-v4-pro",
    type: "code",
    active: true,
  },
  {
    id: "meta/llama-3.1-70b-instruct",
    providerId: "nvidia",
    name: "meta/llama-3.1-70b-instruct",
    type: "chat",
    active: true,
  },
  {
    id: "nvidia/llama-3.1-nemotron-70b-instruct",
    providerId: "nvidia",
    name: "nvidia/llama-3.1-nemotron-70b-instruct",
    type: "chat",
    active: true,
  },
];

export class ModelManager {
  async init(): Promise<ModelConfig[]> {
    const models = await this.list();
    await this.save(models);
    return models;
  }

  async list(): Promise<ModelConfig[]> {
    const persisted = await readJson<ModelConfig[]>(modelsPath(), []);
    const merged = [...defaultModels];

    for (const model of persisted) {
      const index = merged.findIndex((item) => item.id === model.id);
      if (index >= 0) {
        merged[index] = { ...merged[index], ...model };
      } else {
        merged.push(model);
      }
    }

    return merged;
  }

  async save(models: ModelConfig[]): Promise<void> {
    await writeJson(modelsPath(), models);
  }

  async add(model: ModelConfig): Promise<void> {
    const models = await this.list();
    const next = models.filter((item) => item.id !== model.id);
    next.push(model);
    await this.save(next);
  }

  async remove(id: string): Promise<void> {
    const models = (await this.list()).filter((model) => model.id !== id);
    await this.save(models);
  }

  async get(id: string): Promise<ModelConfig> {
    const model = (await this.list()).find(
      (item) => item.id === id || item.name === id,
    );
    if (!model) {
      throw new Error(`Unknown model: ${id}`);
    }
    return model;
  }

  async refresh(providerManager: ProviderManager): Promise<ModelConfig[]> {
    const current = await this.list();
    const next = [...current];
    for (const provider of (await providerManager.list()).filter((item) => item.active)) {
      const driver = providerManager.getDriver(provider);
      if (!driver.listModels) continue;
      const discovered = await driver.listModels(provider);
      for (const model of discovered) {
        const index = next.findIndex((item) => item.id === model.id);
        if (index >= 0) next[index] = { ...next[index], ...model };
        else next.push(model);
      }
    }
    await this.save(next);
    return next;
  }

  async setActive(id: string, active: boolean): Promise<ModelConfig> {
    const model = await this.get(id);
    const updated = { ...model, active };
    const models = (await this.list()).map((item) => item.id === id ? updated : item);
    await this.save(models);
    return updated;
  }
}
