import { chatWithProvider } from "@aegis/providers";
import type { ChatMessage, ProviderConfig } from "@aegis/types";

export async function complete(input: { provider: ProviderConfig; model: string; messages: ChatMessage[]; temperature?: number }): Promise<string> {
  const response = await chatWithProvider({
    config: input.provider,
    request: {
      model: input.model,
      messages: input.messages,
      temperature: input.temperature,
      privacyMode: "remote-provider",
      attachmentIds: [],
      toolMode: "auto",
      enabledTools: [],
    },
  });
  return response.content;
}
