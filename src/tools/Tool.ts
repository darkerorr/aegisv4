export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  output: string;
}

export interface ToolParameter {
  name: string;
  type: "string" | "number" | "boolean" | "array";
  description: string;
  required?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute(args: Record<string, unknown>): Promise<ToolResult>;
}

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
  result?: ToolResult;
}
