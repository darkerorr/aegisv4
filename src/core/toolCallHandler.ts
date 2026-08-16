import type { AppContext } from "./appContext.js";

export interface ParsedToolCall {
  tool: string;
  args: Record<string, unknown>;
  result?: { success: boolean; output: string; data?: unknown };
}

export class ToolCallHandler {
  constructor(private context: AppContext) {}

  parseToolCalls(content: string): ParsedToolCall[] {
    const calls: ParsedToolCall[] = [];
    const regex = /```tool:(\w+)\s*\n([\s\S]*?)```/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const toolName = (match[1] || "").trim();
      const argsRaw = (match[2] || "").trim();
      try {
        const args = argsRaw ? JSON.parse(argsRaw) : {};
        calls.push({ tool: toolName, args });
      } catch {
        calls.push({ tool: toolName, args: { _raw: argsRaw } });
      }
    }

    return calls;
  }
}
