import type {
  AIProvider,
  ChatRequest,
  ChatResponse,
  ModelInfo,
  ProviderConfig,
  ProviderStatus,
} from "@aegis/types";
import { AnthropicProvider } from "./anthropic.js";
import { CustomProvider } from "./custom.js";
import { LMStudioProvider } from "./lm-studio.js";
import { NvidiaNimProvider } from "./nvidia-nim.js";
import { OllamaProvider } from "./ollama.js";
import { OpenAICompatibleProvider } from "./openai-compatible.js";
import {
  DeepSeekProvider,
  FireworksProvider,
  GeminiProvider,
  GroqProvider,
  HyperbolicProvider,
  MetaProvider,
  MiniMaxProvider,
  MistralProvider,
  MoonshotProvider,
  NovitaProvider,
  OpenAIProvider,
  PerplexityProvider,
  QwenProvider,
  SambanovaProvider,
  TogetherProvider,
  ZhipuProvider,
} from "./openai-cloud.js";
import { OpenRouterProvider } from "./openrouter.js";
import { XAIProvider } from "./xai.js";
import { HuggingFaceProvider } from "./huggingface.js";

export type {
  AIProvider,
  ChatRequest,
  ChatResponse,
  ModelInfo,
  ProviderConfig,
  ProviderStatus,
} from "@aegis/types";
export { ProviderError, toApiError, isTransientProviderError, providerRetryAfter, transientBackoff, providerRateLimitCategory, parseProviderErrorBody } from "./common.js";
export { diagnoseProvider } from "./diagnose.js";
export { OllamaProvider } from "./ollama.js";
export { LMStudioProvider } from "./lm-studio.js";
export { NvidiaNimProvider } from "./nvidia-nim.js";
export { OpenRouterProvider } from "./openrouter.js";
export { OpenAICompatibleProvider } from "./openai-compatible.js";
export { CustomProvider } from "./custom.js";
export { XAIProvider } from "./xai.js";
export { HuggingFaceProvider } from "./huggingface.js";
export { AnthropicProvider } from "./anthropic.js";
export {
  OpenAIProvider,
  GeminiProvider,
  MistralProvider,
  GroqProvider,
  DeepSeekProvider,
  QwenProvider,
  MetaProvider,
  TogetherProvider,
  FireworksProvider,
  PerplexityProvider,
  SambanovaProvider,
  HyperbolicProvider,
  ZhipuProvider,
  MoonshotProvider,
  MiniMaxProvider,
  NovitaProvider,
} from "./openai-cloud.js";

export function createProvider(config: ProviderConfig): AIProvider {
  switch (config.kind) {
    case "ollama":
      return new OllamaProvider(config);
    case "lmstudio":
      return new LMStudioProvider(config);
    case "nvidia-nim":
      return new NvidiaNimProvider(config);
    case "openrouter":
      return new OpenRouterProvider(config);
    case "custom":
      return new CustomProvider(config);
    case "openai-compatible":
      return new OpenAICompatibleProvider(config);
    case "x-ai":
      return new XAIProvider(config);
    case "anthropic":
      return new AnthropicProvider(config);
    case "gemini":
      return new GeminiProvider(config);
    case "openai":
      return new OpenAIProvider(config);
    case "mistral":
      return new MistralProvider(config);
    case "groq":
      return new GroqProvider(config);
    case "deepseek":
      return new DeepSeekProvider(config);
    case "qwen":
      return new QwenProvider(config);
    case "meta":
      return new MetaProvider(config);
    case "together":
      return new TogetherProvider(config);
    case "fireworks":
      return new FireworksProvider(config);
    case "perplexity":
      return new PerplexityProvider(config);
    case "sambanova":
      return new SambanovaProvider(config);
    case "hyperbolic":
      return new HyperbolicProvider(config);
    case "zhipu":
      return new ZhipuProvider(config);
    case "moonshot":
      return new MoonshotProvider(config);
    case "minimax":
      return new MiniMaxProvider(config);
    case "novita":
      return new NovitaProvider(config);
    case "huggingface":
      return new HuggingFaceProvider(config);
  }
}

export async function listProviderModels(
  config: ProviderConfig,
  signal?: AbortSignal,
): Promise<ModelInfo[]> {
  return createProvider(config).listModels(signal);
}
export async function testProvider(
  config: ProviderConfig,
  signal?: AbortSignal,
): Promise<ProviderStatus> {
  return createProvider(config).testConnection(signal);
}
export async function chatWithProvider(input: {
  config: ProviderConfig;
  request: ChatRequest;
  signal?: AbortSignal;
}): Promise<ChatResponse> {
  return createProvider(input.config).chat(input.request, input.signal);
}
