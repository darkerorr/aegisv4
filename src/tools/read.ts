import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ToolDefinition } from "./Tool.js";

export function createReadTool(rootDir: () => string): ToolDefinition {
  return {
    name: "read",
    description: "Read the contents of a file within the project.",
    parameters: [
      {
        name: "filePath",
        type: "string",
        description: "Path to the file, relative to project root",
        required: true,
      },
    ],
    async execute(args) {
      const relativePath = String(args.filePath || "");
      if (!relativePath) {
        return { success: false, output: "Missing required parameter: filePath" };
      }
      const absolutePath = path.resolve(rootDir(), relativePath);
      const resolved = path.relative(rootDir(), absolutePath);
      if (resolved.startsWith("..") || path.isAbsolute(resolved)) {
        return { success: false, output: "Cannot read files outside the project root." };
      }
      try {
        const content = await readFile(absolutePath, "utf8");
        return {
          success: true,
          data: content,
          output: `\`${relativePath}\`:\n\n\`\`\`\n${content.slice(0, 50000)}\n\`\`\``,
        };
      } catch (error) {
        return { success: false, output: `Failed to read ${relativePath}: ${(error as Error).message}` };
      }
    },
  };
}
