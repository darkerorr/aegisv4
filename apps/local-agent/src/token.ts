import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config, paths } from "./config.js";

export async function ensureToken(): Promise<string> {
  if (config.token) return config.token;
  const existing = await readFile(paths.token, "utf8").catch(() => "");
  if (existing.trim()) return existing.trim();
  await mkdir(path.dirname(paths.token), { recursive: true });
  const token = `aegis_la_${randomBytes(24).toString("base64url")}`;
  await writeFile(paths.token, `${token}\n`, "utf8");
  console.log(`[local-agent] Generated device token: ${token}`);
  return token;
}

export function tokenMatches(candidate: string | undefined, expected: string): boolean {
  return Boolean(candidate && candidate === expected);
}
