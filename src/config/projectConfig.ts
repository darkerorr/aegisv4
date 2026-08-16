import { readFile } from "node:fs/promises";
import type { AegisConfig } from "../types/index.js";
import { exists } from "../utils/fs.js";
import { aegisRcPath } from "../utils/paths.js";

export async function readProjectConfig(
  cwd = process.cwd(),
): Promise<Partial<AegisConfig>> {
  const configPath = aegisRcPath(cwd);
  if (!(await exists(configPath))) {
    return {};
  }

  const raw = await readFile(configPath, "utf8");
  return JSON.parse(raw) as Partial<AegisConfig>;
}
