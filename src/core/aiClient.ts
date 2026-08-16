import type { ChatMessage, ChatRequest, ChatResponse } from "../types/index.js";
import { ConfigManager } from "./configManager.js";
import { ModelManager } from "./modelManager.js";
import { ProviderManager } from "./providerManager.js";

export class AIClient {
  constructor(
    private configManager: ConfigManager,
    private providerManager: ProviderManager,
    private modelManager: ModelManager,
  ) {}

  async complete(input: {
    messages: ChatMessage[];
    model?: string;
    provider?: string;
    system?: string;
    stream?: boolean;
    onChunk?: (content: string) => void;
  }): Promise<ChatResponse> {
    const config = await this.configManager.get();
    const model = await this.modelManager.get(
      input.model || config.defaultModel,
    );
    const providerConfig = await this.providerManager.get(
      input.provider || model.providerId || config.defaultProvider,
    );
    const provider = this.providerManager.getDriver(providerConfig);
    const messages = this.withSystem(input.messages, input.system);
    const request: ChatRequest = {
      model: model.name,
      messages,
      stream: input.stream ?? config.streaming,
    };

    if (request.stream && provider.streamChat && input.onChunk) {
      let content = "";
      for await (const chunk of provider.streamChat(providerConfig, request)) {
        if (chunk.content) {
          content += chunk.content;
          input.onChunk(chunk.content);
        }
      }
      return { content };
    }

    return provider.chat(providerConfig, request);
  }

  private withSystem(messages: ChatMessage[], system?: string): ChatMessage[] {
    if (!system) {
      return messages;
    }
    const hasSystem = messages.some((message) => message.role === "system");
    return hasSystem
      ? messages
      : [{ role: "system", content: system }, ...messages];
  }
}
