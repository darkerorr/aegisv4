import path from "node:path";
import type { ToolDefinition, ToolResult } from "./Tool.js";

export function createWriteTool(
  rootDir: () => string,
  applyWrite: (relativePath: string, content: string) => Promise<boolean>,
  onWritten?: (relativePath: string) => void,
): ToolDefinition {
  return {
    name: "write",
    description: "Write content to a file, creating or overwriting it.",
    parameters: [
      {
        name: "filePath",
        type: "string",
        description: "Path to the file, relative to project root",
        required: true,
      },
      {
        name: "content",
        type: "string",
        description: "The full content to write to the file",
        required: true,
      },
    ],
    async execute(args): Promise<ToolResult> {
      const relativePath = String(args.filePath || "");
      const content = String(args.content || "");
      if (!relativePath) {
        return { success: false, output: "Missing required parameter: filePath" };
      }
      if (!content) {
        return { success: false, output: "Missing required parameter: content" };
      }
      const absolutePath = path.resolve(rootDir(), relativePath);
      const resolved = path.relative(rootDir(), absolutePath);
      if (resolved.startsWith("..") || path.isAbsolute(resolved)) {
        return { success: false, output: "Cannot write files outside the project root." };
      }
      try {
        const applied = await applyWrite(relativePath, content);
        if (!applied) {
          return { success: false, output: "Write rejected by user." };
        }
        onWritten?.(relativePath);
        return { success: true, output: `Successfully wrote ${relativePath} (${content.length} bytes).` };
      } catch (error) {
        return { success: false, output: `Failed to write ${relativePath}: ${(error as Error).message}` };
      }
    },
  };
}
