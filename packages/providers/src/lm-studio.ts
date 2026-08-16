import type { ProviderConfig } from "@aegis/types";
import { OpenAICompatibleProvider } from "./openai-compatible.js";

export class LMStudioProvider extends OpenAICompatibleProvider {
  readonly type = "lmstudio" as const;
  constructor(config: ProviderConfig) { super(config, "LM Studio"); }
}
