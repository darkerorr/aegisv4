import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ToolDefinition, ToolResult } from "./Tool.js";

const execAsync = promisify(exec);

export function createBashTool(
  rootDir: () => string,
  confirmFn: (command: string) => Promise<boolean>,
): ToolDefinition {
  return {
    name: "bash",
    description:
      "Execute a shell command in the project directory. Use for git, npm, running tests, or any terminal operation.",
    parameters: [
      {
        name: "command",
        type: "string",
        description: "The shell command to execute",
        required: true,
      },
      {
        name: "description",
        type: "string",
        description: "What this command does (for user confirmation)",
        required: false,
      },
    ],
    async execute(args): Promise<ToolResult> {
      const command = String(args.command || "");
      if (!command) {
        return { success: false, output: "Missing required parameter: command" };
      }
      if (!(await confirmFn(command))) {
        return { success: false, output: "Command execution denied by user." };
      }
      try {
        const cwd = process.cwd();
        const { stdout, stderr } = await execAsync(command, {
          cwd: rootDir(),
          timeout: 120_000,
          maxBuffer: 10 * 1024 * 1024,
        });
        const output = [stdout, stderr].filter(Boolean).join("\n").trim();
        if (!output) {
          return { success: true, output: "Command completed (no output)." };
        }
        return { success: true, output: output.slice(0, 10000) };
      } catch (error) {
        return { success: false, output: `Command failed:\n${(error as Error).message}` };
      }
    },
  };
}
