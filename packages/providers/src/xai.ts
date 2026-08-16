import type { ProviderConfig } from "@aegis/types";
import { OpenAICompatibleProvider } from "./openai-compatible.js";

export class XAIProvider extends OpenAICompatibleProvider {
  readonly type = "x-ai" as const;
  constructor(config: ProviderConfig) {
    super(config, "xAI");
  }
}
