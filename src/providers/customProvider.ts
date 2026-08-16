import { OpenAICompatibleProvider } from "./openAICompatibleProvider.js";

export class CustomProvider extends OpenAICompatibleProvider {
  constructor() {
    super("custom", "Custom Provider");
  }
}
