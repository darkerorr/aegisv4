export type CloudProviderId =
  | "nvidia-nim"
  | "openrouter"
  | "x-ai"
  | "anthropic"
  | "gemini"
  | "openai"
  | "mistral"
  | "groq"
  | "deepseek"
  | "qwen"
  | "meta"
  | "together"
  | "fireworks"
  | "perplexity"
  | "sambanova"
  | "hyperbolic"
  | "zhipu"
  | "moonshot"
  | "minimax"
  | "novita"
  | "huggingface";

export interface CloudCatalogEntry {
  id: CloudProviderId;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  baseUrl: string;
  keyUrl: string;
  keyPlaceholder: string;
  brand: string;
  color: string;
}

export const cloudCatalog: CloudCatalogEntry[] = [
  {
    id: "x-ai",
    name: "xAI Grok",
    shortName: "xAI",
    tagline: "Grok models by xAI",
    description: "Grok models hosted by xAI, exposed through an OpenAI-compatible endpoint.",
    baseUrl: "https://api.x.ai/v1",
    keyUrl: "https://console.x.ai/",
    keyPlaceholder: "xai-…",
    brand: "xai",
    color: "#ECECEC",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    shortName: "Anthropic",
    tagline: "Claude by Anthropic",
    description:
      "Claude models via the Anthropic Messages API, including long-context windows and extended thinking.",
    baseUrl: "https://api.anthropic.com/v1",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyPlaceholder: "sk-ant-…",
    brand: "anthropic",
    color: "#D97757",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    shortName: "Gemini",
    tagline: "Google Gemini models",
    description: "Google's Gemini models through the OpenAI-compatible endpoint of the Gemini API.",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyUrl: "https://aistudio.google.com/app/apikey",
    keyPlaceholder: "AIza…",
    brand: "gemini",
    color: "#8AB4F8",
  },
  {
    id: "openai",
    name: "OpenAI",
    shortName: "OpenAI",
    tagline: "GPT & o-series by OpenAI",
    description:
      "GPT and o-series models from OpenAI, served through their official OpenAI-compatible API.",
    baseUrl: "https://api.openai.com/v1",
    keyUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-…",
    brand: "openai",
    color: "#10A37F",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    shortName: "OpenRouter",
    tagline: "One key, many model providers",
    description: "A single key for hundreds of models across many providers, with unified billing.",
    baseUrl: "https://openrouter.ai/api/v1",
    keyUrl: "https://openrouter.ai/settings/keys",
    keyPlaceholder: "sk-or-…",
    brand: "openrouter",
    color: "#8C63F6",
  },
  {
    id: "nvidia-nim",
    name: "NVIDIA NIM",
    shortName: "NVIDIA",
    tagline: "Hosted NVIDIA AI models",
    description:
      "NVIDIA-hosted models (Llama, DeepSeek, Nemotron) served through an OpenAI-compatible endpoint.",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    keyUrl: "https://build.nvidia.com/",
    keyPlaceholder: "nvapi-…",
    brand: "nvidia",
    color: "#76B900",
  },
  {
    id: "mistral",
    name: "Mistral",
    shortName: "Mistral",
    tagline: "Mistral AI models",
    description: "Mistral's open-weight and frontier models, hosted on the Mistral platform.",
    baseUrl: "https://api.mistral.ai/v1",
    keyUrl: "https://console.mistral.ai/api-keys/",
    keyPlaceholder: "…",
    brand: "mistral",
    color: "#FF7000",
  },
  {
    id: "groq",
    name: "Groq",
    shortName: "Groq",
    tagline: "Fastest open-model inference",
    description: "Ultra-fast inference for open models (Llama, Qwen) on Groq's LPU hardware.",
    baseUrl: "https://api.groq.com/openai/v1",
    keyUrl: "https://console.groq.com/keys",
    keyPlaceholder: "gsk_…",
    brand: "groq",
    color: "#F55036",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    shortName: "DeepSeek",
    tagline: "DeepSeek reasoning models",
    description: "DeepSeek's reasoning and chat models through their official API.",
    baseUrl: "https://api.deepseek.com/v1",
    keyUrl: "https://platform.deepseek.com/api_keys",
    keyPlaceholder: "sk-…",
    brand: "deepseek",
    color: "#4D6BFE",
  },
  {
    id: "qwen",
    name: "Qwen",
    shortName: "Qwen",
    tagline: "Alibaba Qwen models",
    description: "Alibaba's Qwen models via the DashScope OpenAI-compatible endpoint.",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    keyUrl: "https://bailian.console.aliyun.com/?apiKey=1#/api-key",
    keyPlaceholder: "sk-…",
    brand: "qwen",
    color: "#5D5CDE",
  },
  {
    id: "meta",
    name: "Meta Llama",
    shortName: "Meta",
    tagline: "Llama models by Meta",
    description: "Meta's Llama models through the official Llama API, OpenAI-compatible.",
    baseUrl: "https://api.llama.com/compat/v1",
    keyUrl: "https://llama.developer.meta.com/",
    keyPlaceholder: "…",
    brand: "meta",
    color: "#0866FF",
  },
  {
    id: "together",
    name: "Together AI",
    shortName: "Together",
    tagline: "Fast open-model inference",
    description:
      "High-performance inference for open models (Llama, Qwen, DeepSeek) on Together's GPU cloud.",
    baseUrl: "https://api.together.xyz/v1",
    keyUrl: "https://api.together.xyz/settings/api-keys",
    keyPlaceholder: "…",
    brand: "together",
    color: "#FF5B4F",
  },
  {
    id: "fireworks",
    name: "Fireworks AI",
    shortName: "Fireworks",
    tagline: "Production open-model serving",
    description: "Fireworks AI serves open and custom models with fast, reliable inference.",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    keyUrl: "https://fireworks.ai/api-keys",
    keyPlaceholder: "…",
    brand: "fireworks",
    color: "#FF6B35",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    shortName: "Perplexity",
    tagline: "Answer engines & Sonar models",
    description:
      "Perplexity's Sonar models with live web search, exposed through an OpenAI-compatible endpoint.",
    baseUrl: "https://api.perplexity.ai",
    keyUrl: "https://www.perplexity.ai/settings/api",
    keyPlaceholder: "pplx-…",
    brand: "perplexity",
    color: "#20C8C6",
  },
  {
    id: "sambanova",
    name: "SambaNova",
    shortName: "SambaNova",
    tagline: "Enterprise open-model cloud",
    description:
      "SambaNova Cloud hosts open models (Llama, Qwen, DeepSeek) on RDU-accelerated hardware.",
    baseUrl: "https://api.sambanova.ai/v1",
    keyUrl: "https://cloud.sambanova.ai/apis",
    keyPlaceholder: "…",
    brand: "sambanova",
    color: "#7C3AED",
  },
  {
    id: "hyperbolic",
    name: "Hyperbolic",
    shortName: "Hyperbolic",
    tagline: "GPU cloud & open models",
    description:
      "Hyperbolic offers open models and the RayServe-compatible AI API on a decentralized GPU cloud.",
    baseUrl: "https://api.hyperbolic.xyz/v1",
    keyUrl: "https://app.hyperbolic.xyz/settings",
    keyPlaceholder: "…",
    brand: "hyperbolic",
    color: "#7B61FF",
  },
  {
    id: "zhipu",
    name: "Zhipu AI",
    shortName: "Zhipu",
    tagline: "GLM models by Zhipu",
    description:
      "Zhipu's GLM series (chat, reasoning, vision) through the BigModel OpenAI-compatible endpoint.",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    keyUrl: "https://open.bigmodel.cn/usercenter/apikeys",
    keyPlaceholder: "…",
    brand: "zhipu",
    color: "#3859FF",
  },
  {
    id: "moonshot",
    name: "Moonshot AI",
    shortName: "Moonshot",
    tagline: "Kimi models by Moonshot",
    description:
      "Moonshot AI's Kimi models, renowned for long-context understanding, via their API.",
    baseUrl: "https://api.moonshot.cn/v1",
    keyUrl: "https://platform.moonshot.cn/console/api-keys",
    keyPlaceholder: "sk-…",
    brand: "moonshot",
    color: "#3D6EF7",
  },
  {
    id: "minimax",
    name: "MiniMax",
    shortName: "MiniMax",
    tagline: "MiniMax text & audio models",
    description: "MiniMax's models (text, reasoning, speech) through their OpenAI-compatible API.",
    baseUrl: "https://api.minimax.chat/v1",
    keyUrl: "https://platform.minimaxi.com/user-center/basic-information/interface-key",
    keyPlaceholder: "…",
    brand: "minimax",
    color: "#9747FF",
  },
  {
    id: "novita",
    name: "Novita AI",
    shortName: "Novita",
    tagline: "GPU cloud for open models",
    description:
      "Novita AI serves hundreds of open and Llama-based models on an affordable GPU cloud.",
    baseUrl: "https://api.novita.ai/v3/openai",
    keyUrl: "https://novita.ai/dashboard/key",
    keyPlaceholder: "…",
    brand: "novita",
    color: "#6A5AE0",
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    shortName: "Hugging Face",
    tagline: "Open models on the Hugging Face hub",
    description:
      "Thousands of open models (Llama, Qwen, Mistral, etc.) served through the Hugging Face Inference Provider OpenAI-compatible endpoint.",
    baseUrl: "https://router.huggingface.co/v1",
    keyUrl: "https://huggingface.co/settings/tokens",
    keyPlaceholder: "hf_••••",
    brand: "hugging-face",
    color: "#FF9D00",
  },
];

export const cloudCatalogById = new Map(cloudCatalog.map((entry) => [entry.id, entry]));
