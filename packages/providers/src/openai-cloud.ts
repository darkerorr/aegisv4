import type { ProviderConfig } from "@aegis/types";
import { OpenAICompatibleProvider } from "./openai-compatible.js";

export class OpenAIProvider extends OpenAICompatibleProvider {
  readonly type = "openai" as const;
  constructor(config: ProviderConfig) {
    super(config, "OpenAI");
  }
}

export class GeminiProvider extends OpenAICompatibleProvider {
  readonly type = "gemini" as const;
  constructor(config: ProviderConfig) {
    super(config, "Google Gemini");
  }
}

export class MistralProvider extends OpenAICompatibleProvider {
  readonly type = "mistral" as const;
  constructor(config: ProviderConfig) {
    super(config, "Mistral");
  }
}

export class GroqProvider extends OpenAICompatibleProvider {
  readonly type = "groq" as const;
  constructor(config: ProviderConfig) {
    super(config, "Groq");
  }
}

export class DeepSeekProvider extends OpenAICompatibleProvider {
  readonly type = "deepseek" as const;
  constructor(config: ProviderConfig) {
    super(config, "DeepSeek");
  }
}

export class QwenProvider extends OpenAICompatibleProvider {
  readonly type = "qwen" as const;
  constructor(config: ProviderConfig) {
    super(config, "Qwen");
  }
}

export class MetaProvider extends OpenAICompatibleProvider {
  readonly type = "meta" as const;
  constructor(config: ProviderConfig) {
    super(config, "Meta Llama");
  }
}

export class TogetherProvider extends OpenAICompatibleProvider {
  readonly type = "together" as const;
  constructor(config: ProviderConfig) {
    super(config, "Together AI");
  }
}

export class FireworksProvider extends OpenAICompatibleProvider {
  readonly type = "fireworks" as const;
  constructor(config: ProviderConfig) {
    super(config, "Fireworks AI");
  }
}

export class PerplexityProvider extends OpenAICompatibleProvider {
  readonly type = "perplexity" as const;
  constructor(config: ProviderConfig) {
    super(config, "Perplexity");
  }
}

export class SambanovaProvider extends OpenAICompatibleProvider {
  readonly type = "sambanova" as const;
  constructor(config: ProviderConfig) {
    super(config, "SambaNova");
  }
}

export class HyperbolicProvider extends OpenAICompatibleProvider {
  readonly type = "hyperbolic" as const;
  constructor(config: ProviderConfig) {
    super(config, "Hyperbolic");
  }
}

export class ZhipuProvider extends OpenAICompatibleProvider {
  readonly type = "zhipu" as const;
  constructor(config: ProviderConfig) {
    super(config, "Zhipu AI");
  }
}

export class MoonshotProvider extends OpenAICompatibleProvider {
  readonly type = "moonshot" as const;
  constructor(config: ProviderConfig) {
    super(config, "Moonshot AI");
  }
}

export class MiniMaxProvider extends OpenAICompatibleProvider {
  readonly type = "minimax" as const;
  constructor(config: ProviderConfig) {
    super(config, "MiniMax");
  }
}

export class NovitaProvider extends OpenAICompatibleProvider {
  readonly type = "novita" as const;
  constructor(config: ProviderConfig) {
    super(config, "Novita AI");
  }
}
