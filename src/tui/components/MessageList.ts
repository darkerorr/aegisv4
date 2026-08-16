import type { ChatMessage } from "../../types/index.js";

export function renderMessageList(messages: ChatMessage[]): string {
  return messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");
}
