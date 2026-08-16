import type {
  AIProvider,
  ChatChunk,
  ChatRequest,
  ChatResponse,
  ModelConfig,
  ProviderConfig,
} from "../types/index.js";
import { joinUrl, parseErrorResponse, providerHeaders } from "./http.js";

export class OpenAICompatibleProvider implements AIProvider {
  supportsStreaming = true;

  constructor(
    public id = "openai-compatible",
    public displayName = "OpenAI Compatible",
  ) {}

  async chat(
    config: ProviderConfig,
    request: ChatRequest,
  ): Promise<ChatResponse> {
    const response = await fetch(joinUrl(config.baseUrl, "/chat/completions"), {
      method: "POST",
      headers: providerHeaders(config),
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: false,
        temperature: request.temperature,
      }),
    });

    if (!response.ok) {
      throw await parseErrorResponse(response);
    }

    const data = (await response.json()) as any;
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("Provider returned an empty chat completion.");
    }
    return { content, raw: data };
  }

  async *streamChat(
    config: ProviderConfig,
    request: ChatRequest,
  ): AsyncGenerator<ChatChunk> {
    const response = await fetch(joinUrl(config.baseUrl, "/chat/completions"), {
      method: "POST",
      headers: providerHeaders(config),
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: true,
        temperature: request.temperature,
      }),
    });

    if (!response.ok) {
      throw await parseErrorResponse(response);
    }

    if (!response.body) {
      throw new Error("Provider did not return a stream body.");
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
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") {
          yield { content: "", done: true };
          return;
        }

        const data = JSON.parse(payload) as any;
        const content = data.choices?.[0]?.delta?.content;
        if (typeof content === "string") {
          yield { content };
        }
      }
    }
  }

  async listModels(config: ProviderConfig): Promise<ModelConfig[]> {
    const response = await fetch(joinUrl(config.baseUrl, "/models"), {
      headers: providerHeaders(config),
    });

    if (!response.ok) {
      throw await parseErrorResponse(response);
    }

    const data = (await response.json()) as any;
    return (data.data || []).map((model: any) => ({
      id: String(model.id),
      providerId: config.id,
      name: String(model.id),
      type: "chat",
      active: true,
    }));
  }

  async test(config: ProviderConfig): Promise<void> {
    await this.listModels(config);
  }
}
