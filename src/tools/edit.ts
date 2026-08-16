import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ToolDefinition, ToolResult } from "./Tool.js";

export function createEditTool(
  rootDir: () => string,
  applyWrite: (relativePath: string, content: string) => Promise<boolean>,
): ToolDefinition {
  return {
    name: "edit",
    description: "Edit a file by replacing exact text with new text.",
    parameters: [
      {
        name: "filePath",
        type: "string",
        description: "Path to the file, relative to project root",
        required: true,
      },
      {
        name: "oldString",
        type: "string",
        description: "The exact text to replace",
        required: true,
      },
      {
        name: "newString",
        type: "string",
        description: "The replacement text",
        required: true,
      },
    ],
    async execute(args): Promise<ToolResult> {
      const relativePath = String(args.filePath || "");
      const oldString = String(args.oldString || "");
      const newString = String(args.newString || "");
      if (!relativePath || !oldString) {
        return { success: false, output: "Missing required parameters: filePath and oldString are required." };
      }
      const absolutePath = path.resolve(rootDir(), relativePath);
      const resolved = path.relative(rootDir(), absolutePath);
      if (resolved.startsWith("..") || path.isAbsolute(resolved)) {
        return { success: false, output: "Cannot edit files outside the project root." };
      }
      try {
        const content = await readFile(absolutePath, "utf8");
        if (!content.includes(oldString)) {
          return { success: false, output: `Could not find the exact text to replace in ${relativePath}. Make sure the string matches exactly.` };
        }
        const newContent = content.replace(oldString, newString);
        const applied = await applyWrite(relativePath, newContent);
        if (!applied) return { success: false, output: "Edit rejected by user." };
        return { success: true, output: `Successfully edited ${relativePath}.` };
      } catch (error) {
        return { success: false, output: `Failed to edit ${relativePath}: ${(error as Error).message}` };
      }
    },
  };
}
