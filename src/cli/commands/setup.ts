import { confirm, input, select } from "@inquirer/prompts";
import { Command } from "commander";
import type { AppContext } from "../../core/appContext.js";
import type { AegisTheme, ProviderKind } from "../../types/index.js";
import { ensureDir } from "../../utils/fs.js";
import {
  aegisHome,
  historyDir,
  logsDir,
  trustedProjectsPath,
} from "../../utils/paths.js";
import { printInfo, printSuccess, printWarning } from "../../ui/printer.js";

async function detectOllamaModels(): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch("http://localhost:11434/api/tags", {
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const data = (await response.json()) as {
      models?: Array<{ name?: string }>;
    };
    return (data.models || [])
      .map((model) => model.name)
      .filter((name): name is string => Boolean(name));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function providerDefaults(choice: string): {
  id: string;
  kind: ProviderKind;
  name: string;
  baseUrl: string;
  apiKeyEnv?: string;
  active: boolean;
} {
  if (choice === "lmstudio") {
    return {
      id: "lmstudio",
      kind: "lmstudio",
      name: "LM Studio Local",
      baseUrl: "http://localhost:1234/v1",
      active: true,
    };
  }

  if (choice === "openai") {
    return {
      id: "openai",
      kind: "openai-compatible",
      name: "OpenAI Compatible",
      baseUrl: "https://api.openai.com/v1",
      apiKeyEnv: "AEGIS_OPENAI_API_KEY",
      active: true,
    };
  }

  if (choice === "nvidia") {
    return {
      id: "nvidia",
      kind: "nvidia-compatible",
      name: "NVIDIA NIM",
      baseUrl: "https://integrate.api.nvidia.com/v1",
      apiKeyEnv: "NVIDIA_API_KEY",
      active: true,
    };
  }

  if (choice === "custom") {
    return {
      id: "custom",
      kind: "custom",
      name: "Custom Provider",
      baseUrl: "http://localhost:8080/v1",
      apiKeyEnv: "AEGIS_CUSTOM_API_KEY",
      active: true,
    };
  }

  return {
    id: "ollama",
    kind: "ollama",
    name: "Ollama Local",
    baseUrl: "http://localhost:11434",
    active: true,
  };
}

export async function runSetup(context: AppContext): Promise<void> {
  printInfo("Aegis setup");

  const createNow = await confirm({
    message: "Create or update global config now?",
    default: true,
  });
  if (!createNow) {
    printWarning("Setup skipped.");
    return;
  }

  const providerChoice = await select({
    message: "Default provider",
    choices: [
      { name: "Ollama local", value: "ollama" },
      { name: "LM Studio local", value: "lmstudio" },
      { name: "OpenAI-compatible API", value: "openai" },
      { name: "NVIDIA API", value: "nvidia" },
      { name: "Custom provider", value: "custom" },
      { name: "Configure later", value: "later" },
    ],
  });

  const ollamaModels =
    providerChoice === "ollama" ? await detectOllamaModels() : [];
  const model =
    ollamaModels.length > 0
      ? await select({
          message: "Default model",
          choices: [
            ...ollamaModels.map((name) => ({ name, value: name })),
            { name: "Custom", value: "__custom__" },
          ],
        })
      : "__custom__";
  const selectedModel =
    model === "__custom__"
      ? await input({
          message: "Default model",
          default:
            providerChoice === "lmstudio"
              ? "local-model"
              : providerChoice === "nvidia"
                ? "deepseek-ai/deepseek-v4-pro"
                : "qwen2.5-coder",
        })
      : model;
  const streaming = await confirm({
    message: "Enable response streaming?",
    default: true,
  });
  const theme = await select<AegisTheme>({
    message: "Theme",
    choices: [
      { name: "aegis-dark", value: "aegis-dark" },
      { name: "sentinel-green", value: "sentinel-green" },
      { name: "minimal", value: "minimal" },
      { name: "no-color", value: "no-color" },
    ],
  });
  const selectedHistoryDir = await input({
    message: "History directory",
    default: historyDir(),
  });
  const safeMode = await confirm({
    message: "Enable safe mode?",
    default: true,
  });
  const allowProjectReadAfterTrust = await confirm({
    message: "Allow Aegis to read project files after directory trust?",
    default: true,
  });
  const maxFileSizeKb = Number(
    await input({
      message: "Maximum file size to read, in KB",
      default: "300",
    }),
  );

  await ensureDir(aegisHome());
  await ensureDir(selectedHistoryDir);
  await ensureDir(logsDir());

  const defaultProvider =
    providerChoice === "later" ? "ollama" : providerChoice;
  const provider = providerDefaults(defaultProvider);
  if (providerChoice === "custom") {
    provider.baseUrl = await input({
      message: "Custom provider base URL",
      default: provider.baseUrl,
    });
    const apiKeyEnv = await input({
      message: "API key environment variable name, not the key itself",
      default: provider.apiKeyEnv,
    });
    provider.apiKeyEnv = apiKeyEnv || undefined;
  }

  if (providerChoice === "openai") {
    printInfo(
      "API keys are not displayed by Aegis. Set AEGIS_OPENAI_API_KEY in your environment.",
    );
  }

  if (providerChoice === "nvidia") {
    printInfo(
      "API keys are not displayed by Aegis. Set NVIDIA_API_KEY in your environment.",
    );
  }

  await context.configManager.save({
    defaultProvider,
    defaultModel: selectedModel,
    theme,
    conversationsDir: selectedHistoryDir,
    historyDir: selectedHistoryDir,
    logsDir: logsDir(),
    trustedProjectsFile: trustedProjectsPath(),
    streaming,
    stream: streaming,
    logLevel: "info",
    maxFileBytes: maxFileSizeKb * 1024,
    maxFileSizeKb,
    safeMode,
    allowProjectReadAfterTrust,
    noColor: theme === "no-color",
  });

  await context.providerManager.init();
  await context.providerManager.add(provider);
  await context.modelManager.init();
  await context.modelManager.add({
    id: selectedModel,
    providerId: provider.id,
    name: selectedModel,
    type: selectedModel.toLowerCase().includes("coder") ? "code" : "chat",
    active: true,
  });
  await context.promptManager.init();

  printSuccess(`Global config written in ${aegisHome()}`);

  const testNow = await confirm({
    message: "Test provider connection now?",
    default: false,
  });
  if (testNow && providerChoice !== "later") {
    try {
      await context.providerManager.getDriver(provider).test?.(provider);
      printSuccess(`${provider.id} is reachable`);
    } catch (error) {
      printWarning(`${provider.id}: ${(error as Error).message}`);
    }
  }
}

export function registerSetupCommand(
  program: Command,
  context: AppContext,
): void {
  program
    .command("setup")
    .description("Run the interactive Aegis configuration wizard")
    .action(async () => runSetup(context));
}
