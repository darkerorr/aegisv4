import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { ToolDefinition, ToolResult } from "./Tool.js";

export function createGrepTool(
  rootDir: () => string,
  ignoredDirs: () => string[],
  maxBytes: () => number,
): ToolDefinition {
  return {
    name: "grep",
    description:
      "Search file contents using a regular expression. Returns matching files with line numbers.",
    parameters: [
      {
        name: "pattern",
        type: "string",
        description: "The regex pattern to search for",
        required: true,
      },
      {
        name: "include",
        type: "string",
        description: "Optional file glob pattern to filter (e.g. '*.ts')",
        required: false,
      },
    ],
    async execute(args): Promise<ToolResult> {
      const pattern = String(args.pattern || "");
      if (!pattern) {
        return { success: false, output: "Missing required parameter: pattern" };
      }
      const include = args.include ? String(args.include) : "";
      const root = rootDir();
      const ignore = new Set(ignoredDirs());
      const maxSize = maxBytes();
      const regex = new RegExp(pattern, "mi");
      const results: { file: string; line: number; text: string }[] = [];

      try {
        await walkGrep(root, root, ignore, regex, include, maxSize, results);
        if (results.length === 0) {
          return { success: true, output: `No matches found for: ${pattern}` };
        }
        const lines = results.slice(0, 100).map((r) => `  ${r.file}:${r.line}: ${r.text.trim().slice(0, 200)}`);
        const summary = `Found ${results.length} match(es) for \`${pattern}\`:\n${lines.join("\n")}`;
        return { success: true, data: results, output: summary };
      } catch (error) {
        return { success: false, output: `Grep error: ${(error as Error).message}` };
      }
    },
  };
}

async function walkGrep(
  root: string,
  dir: string,
  ignore: Set<string>,
  regex: RegExp,
  includePattern: string | undefined,
  maxSize: number,
  results: { file: string; line: number; text: string }[],
): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (ignore.has(entry.name) || entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const fullPath = path.join(dir, entry.name);
    const relative = path.relative(root, fullPath);
    if (entry.isDirectory()) {
      await walkGrep(root, fullPath, ignore, regex, includePattern, maxSize, results);
    } else if (entry.isFile()) {
      if (includePattern && !relative.endsWith(includePattern.replace("*", ""))) continue;
      try {
        const info = await stat(fullPath);
        if (info.size > maxSize) continue;
        const content = await readFile(fullPath, "utf8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i] ?? "";
          if (regex.test(line)) {
            results.push({ file: relative, line: i + 1, text: line });
          }
        }
      } catch {
        // skip unreadable files
      }
    }
  }
}
