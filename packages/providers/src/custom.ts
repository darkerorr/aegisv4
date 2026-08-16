import type { ProviderConfig } from "@aegis/types";
import { OpenAICompatibleProvider } from "./openai-compatible.js";

export class CustomProvider extends OpenAICompatibleProvider {
  readonly type = "custom" as const;
  constructor(config: ProviderConfig) { super(config, config.name); }
}
