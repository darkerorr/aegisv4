import type {
  AIProvider,
  ChatChunk,
  ChatRequest,
  ChatResponse,
  ModelConfig,
  ProviderConfig,
} from "../types/index.js";
import { joinUrl, parseErrorResponse } from "./http.js";

export class OllamaProvider implements AIProvider {
  id = "ollama";
  displayName = "Ollama";
  supportsStreaming = true;

  async chat(
    config: ProviderConfig,
    request: ChatRequest,
  ): Promise<ChatResponse> {
    const response = await fetch(joinUrl(config.baseUrl, "/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw await parseErrorResponse(response);
    }

    const data = (await response.json()) as any;
    const content = data.message?.content;
    if (typeof content !== "string") {
      throw new Error("Ollama returned an empty response.");
    }
    return { content, raw: data };
  }

  async *streamChat(
    config: ProviderConfig,
    request: ChatRequest,
  ): AsyncGenerator<ChatChunk> {
    const response = await fetch(joinUrl(config.baseUrl, "/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw await parseErrorResponse(response);
    }

    if (!response.body) {
      throw new Error("Ollama did not return a stream body.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        const data = JSON.parse(line) as any;
        const content = data.message?.content;
        if (typeof content === "string") {
          yield { content };
        }
        if (data.done) {
          yield { content: "", done: true };
          return;
        }
      }
    }
  }

  async listModels(config: ProviderConfig): Promise<ModelConfig[]> {
    const response = await fetch(joinUrl(config.baseUrl, "/api/tags"));
    if (!response.ok) {
      throw await parseErrorResponse(response);
    }

    const data = (await response.json()) as any;
    return (data.models || []).map((model: any) => ({
      id: String(model.name),
      providerId: config.id,
      name: String(model.name),
      type: "chat",
      active: true,
    }));
  }

  async test(config: ProviderConfig): Promise<void> {
    await this.listModels(config);
  }
}
