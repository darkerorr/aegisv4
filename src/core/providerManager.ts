import type {
  AIProvider,
  ProviderConfig,
  ProviderKind,
} from "../types/index.js";
import { readJson, writeJson } from "../utils/fs.js";
import { providersPath } from "../utils/paths.js";
import { maskSecret } from "../utils/validation.js";
import { CustomProvider } from "../providers/customProvider.js";
import { LmStudioProvider } from "../providers/lmStudioProvider.js";
import { OllamaProvider } from "../providers/ollamaProvider.js";
import { OpenAICompatibleProvider } from "../providers/openAICompatibleProvider.js";

export const defaultProviders: ProviderConfig[] = [
  {
    id: "ollama",
    kind: "ollama",
    name: "Ollama Local",
    baseUrl: "http://localhost:11434",
    active: true,
  },
  {
    id: "lmstudio",
    kind: "lmstudio",
    name: "LM Studio Local",
    baseUrl: "http://localhost:1234/v1",
    active: true,
  },
  {
    id: "openai",
    kind: "openai-compatible",
    name: "OpenAI Compatible",
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "AEGIS_OPENAI_API_KEY",
    active: false,
  },
  {
    id: "groq",
    kind: "groq-compatible",
    name: "Groq Compatible",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKeyEnv: "AEGIS_GROQ_API_KEY",
    active: false,
  },
  {
    id: "nvidia",
    kind: "nvidia-compatible",
    name: "NVIDIA NIM",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    apiKeyEnv: "NVIDIA_API_KEY",
    active: true,
  },
  {
    id: "custom",
    kind: "custom",
    name: "Custom OpenAI-Compatible",
    baseUrl: "http://localhost:8080/v1",
    apiKeyEnv: "AEGIS_CUSTOM_API_KEY",
    active: false,
  },
];

export class ProviderManager {
  private registry: Record<ProviderKind, AIProvider> = {
    ollama: new OllamaProvider(),
    lmstudio: new LmStudioProvider(),
    "openai-compatible": new OpenAICompatibleProvider(
      "openai-compatible",
      "OpenAI Compatible",
    ),
    "anthropic-compatible": new OpenAICompatibleProvider(
      "anthropic-compatible",
      "Anthropic Compatible",
    ),
    "groq-compatible": new OpenAICompatibleProvider(
      "groq-compatible",
      "Groq Compatible",
    ),
    "nvidia-compatible": new OpenAICompatibleProvider(
      "nvidia-compatible",
      "NVIDIA NIM",
    ),
    custom: new CustomProvider(),
  };

  async init(): Promise<ProviderConfig[]> {
    const providers = await this.list();
    await this.save(providers);
    return providers;
  }

  async list(): Promise<ProviderConfig[]> {
    const persisted = await readJson<ProviderConfig[]>(providersPath(), []);
    const merged = [...defaultProviders];

    for (const provider of persisted) {
      const index = merged.findIndex((item) => item.id === provider.id);
      if (index >= 0) {
        merged[index] = { ...merged[index], ...provider };
      } else {
        merged.push(provider);
      }
    }

    return merged;
  }

  async save(providers: ProviderConfig[]): Promise<void> {
    await writeJson(providersPath(), providers);
  }

  async add(provider: ProviderConfig): Promise<void> {
    const providers = await this.list();
    const next = providers.filter((item) => item.id !== provider.id);
    next.push(provider);
    await this.save(next);
  }

  async remove(id: string): Promise<void> {
    const providers = (await this.list()).filter(
      (provider) => provider.id !== id,
    );
    await this.save(providers);
  }

  async get(id: string): Promise<ProviderConfig> {
    const provider = (await this.list()).find((item) => item.id === id);
    if (!provider) {
      throw new Error(`Unknown provider: ${id}`);
    }
    return provider;
  }

  getDriver(provider: ProviderConfig): AIProvider {
    const driver = this.registry[provider.kind];
    if (!driver) {
      throw new Error(`Unsupported provider kind: ${provider.kind}`);
    }
    return driver;
  }

  publicView(provider: ProviderConfig): Record<string, unknown> {
    return {
      id: provider.id,
      name: provider.name,
      kind: provider.kind,
      baseUrl: provider.baseUrl,
      active: provider.active,
      apiKey: provider.apiKey
        ? maskSecret(provider.apiKey)
        : provider.apiKeyEnv || "",
    };
  }
}
