import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { ToolDefinition, ToolResult } from "./Tool.js";

function matchGlob(filePath: string, pattern: string): boolean {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "___GLOBSTAR___")
    .replace(/\*/g, "[^/]*")
    .replace(/___GLOBSTAR___/g, ".*");
  return new RegExp(`^${regexStr}$`).test(filePath.replace(/\\/g, "/"));
}

export function createGlobTool(
  rootDir: () => string,
  ignoredDirs: () => string[],
): ToolDefinition {
  return {
    name: "glob",
    description:
      "Search for files matching a glob pattern (e.g. 'src/**/*.ts', '*.json'). Case-sensitive on Linux.",
    parameters: [
      {
        name: "pattern",
        type: "string",
        description: "The glob pattern to search for",
        required: true,
      },
    ],
    async execute(args): Promise<ToolResult> {
      const pattern = String(args.pattern || "");
      if (!pattern) {
        return { success: false, output: "Missing required parameter: pattern" };
      }
      const root = rootDir();
      const ignore = new Set(ignoredDirs());
      const matches: string[] = [];

      try {
        await walk(root, root, ignore, pattern, matches);
        if (matches.length === 0) {
          return {
            success: true,
            output: `No files matched pattern: ${pattern}`,
          };
        }
        const list = matches.map((f) => `  ${f}`).join("\n");
        return {
          success: true,
          data: matches,
          output: `Found ${matches.length} file(s) matching \`${pattern}\`:\n${list}`,
        };
      } catch (error) {
        return {
          success: false,
          output: `Glob error: ${(error as Error).message}`,
        };
      }
    },
  };
}

async function walk(
  root: string,
  dir: string,
  ignore: Set<string>,
  pattern: string,
  matches: string[],
): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (ignore.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    const relative = path.relative(root, fullPath).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      if (matchGlob(relative + "/", pattern)) matches.push(relative + "/");
      await walk(root, fullPath, ignore, pattern, matches);
    } else if (entry.isFile()) {
      if (matchGlob(relative, pattern)) {
        matches.push(relative);
      }
    }
  }
}
