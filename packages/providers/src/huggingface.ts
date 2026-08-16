import type { ProviderConfig } from "@aegis/types";
import { OpenAICompatibleProvider } from "./openai-compatible.js";

export class HuggingFaceProvider extends OpenAICompatibleProvider {
  readonly type = "huggingface" as const;
  constructor(config: ProviderConfig) {
    super(config, "Hugging Face");
  }
}
