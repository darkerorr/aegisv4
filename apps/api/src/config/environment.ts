import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseDotenv } from "dotenv";

function findWorkspaceRoot(start: string): string {
  let current = path.resolve(start);
  while (true) {
    if (existsSync(path.join(current, "pnpm-workspace.yaml"))) return current;
    const parent = path.dirname(current);
    if (parent === current) throw new Error("AEGIS_WORKSPACE_ROOT_NOT_FOUND");
    current = parent;
  }
}

function parseFile(filePath: string): Record<string, string> {
  return existsSync(filePath) ? parseDotenv(readFileSync(filePath)) : {};
}

export const workspaceRoot = findWorkspaceRoot(path.dirname(fileURLToPath(import.meta.url)));
export const canonicalEnvPath = path.join(workspaceRoot, ".env");
export const legacyApiEnvPath = path.join(workspaceRoot, "apps", "api", ".env");

// Priority: explicit process environment > non-empty root .env > legacy
// apps/api/.env fallback. The legacy file never overrides a configured root key.
const inherited = new Set(Object.keys(process.env));
const rootValues = parseFile(canonicalEnvPath);
const legacyValues = parseFile(legacyApiEnvPath);
for (const [key, value] of Object.entries(rootValues)) {
  if (!inherited.has(key)) process.env[key] = value;
}
for (const [key, value] of Object.entries(legacyValues)) {
  if (!inherited.has(key) && !(rootValues[key] || "").trim()) process.env[key] = value;
}
