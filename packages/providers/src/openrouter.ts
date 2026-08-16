import type { ProviderConfig } from "@aegis/types";
import { OpenAICompatibleProvider } from "./openai-compatible.js";

export class OpenRouterProvider extends OpenAICompatibleProvider {
  readonly type = "openrouter" as const;
  constructor(config: ProviderConfig, referer = process.env.OPENROUTER_HTTP_REFERER ?? "http://127.0.0.1:3000", title = process.env.OPENROUTER_APP_TITLE ?? "Aegis") {
    super(config, "OpenRouter", { "HTTP-Referer": referer, "X-Title": title });
  }
}
