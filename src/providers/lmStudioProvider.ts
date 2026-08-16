import { OpenAICompatibleProvider } from "./openAICompatibleProvider.js";

export class LmStudioProvider extends OpenAICompatibleProvider {
  constructor() {
    super("lmstudio", "LM Studio");
  }
}
