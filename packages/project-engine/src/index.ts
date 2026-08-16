import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { isSecretPath, isSafeRelativePath } from "@aegis/security";
import type { Patch } from "@aegis/types";

export const ignoredDirectories = [".git", "node_modules", "dist", "build", "coverage", ".next", ".turbo", ".aegis"];
const ignoredFiles = new Set([".env", ".env.local", ".env.development", ".env.production", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"]);
const binaryExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".zip", ".exe", ".dll", ".so", ".dylib", ".bin", ".wasm"]);

export interface ProjectFile { path: string; relativePath: string; size: number; }
export interface ProjectScan { root: string; projectType: string; files: ProjectFile[]; ignoredDirectories: string[]; }

export function isAllowedProjectFile(relativePath: string, size: number, maxFileBytes: number): boolean {
  const parts = relativePath.split(/[\\/]/);
  return !parts.some((part) => ignoredDirectories.includes(part)) && !ignoredFiles.has(path.basename(relativePath)) && !isSecretPath(relativePath) && !binaryExtensions.has(path.extname(relativePath).toLowerCase()) && size <= maxFileBytes;
}

export async function scanProject(root: string, maxFileBytes = 300 * 1024): Promise<ProjectScan> {
  const absoluteRoot = path.resolve(root);
  const files: ProjectFile[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name);
      const relative = path.relative(absoluteRoot, absolute);
      if (entry.isDirectory()) {
        if (!ignoredDirectories.includes(entry.name)) await walk(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      const info = await stat(absolute).catch(() => undefined);
      if (info && isAllowedProjectFile(relative, info.size, maxFileBytes)) files.push({ path: absolute, relativePath: relative, size: info.size });
    }
  }
  await walk(absoluteRoot);
  const names = new Set(files.map((file) => file.relativePath.replaceAll("\\", "/")));
  const projectType = names.has("package.json") ? "Node.js" : names.has("pyproject.toml") || names.has("requirements.txt") ? "Python" : names.has("Cargo.toml") ? "Rust" : names.has("go.mod") ? "Go" : "Unknown";
  return { root: absoluteRoot, projectType, files: files.sort((a, b) => a.relativePath.localeCompare(b.relativePath)), ignoredDirectories: [...ignoredDirectories] };
}

export async function readProjectFile(root: string, relativePath: string, maxFileBytes = 300 * 1024): Promise<{ path: string; relativePath: string; content: string }> {
  if (!isSafeRelativePath(root, relativePath)) throw new Error("The file is outside the trusted project or is sensitive.");
  const filePath = path.resolve(root, relativePath);
  const info = await stat(filePath);
  if (!isAllowedProjectFile(relativePath, info.size, maxFileBytes)) throw new Error("The file is excluded by workspace policy.");
  return { path: filePath, relativePath: path.relative(root, filePath), content: await readFile(filePath, "utf8") };
}

export function createPatch(filePath: string, relativePath: string, before: string, after: string): Patch { return { filePath, relativePath, before, after }; }

export function formatPatch(patch: Patch): string {
  const before = patch.before.split("\n");
  const after = patch.after.split("\n");
  const lines = [`--- ${patch.relativePath}`, `+++ ${patch.relativePath}`];
  for (let index = 0; index < Math.max(before.length, after.length); index += 1) {
    if (before[index] === after[index]) lines.push(` ${before[index] ?? ""}`);
    else { if (before[index] !== undefined) lines.push(`-${before[index]}`); if (after[index] !== undefined) lines.push(`+${after[index]}`); }
  }
  return lines.join("\n");
}

export async function applyPatch(patch: Patch, approve: () => Promise<boolean>): Promise<boolean> {
  if (!(await approve())) return false;
  await writeFile(patch.filePath, patch.after, "utf8");
  return true;
}

export class TrustStore {
  constructor(private readonly filePath: string) {}

  async isTrusted(root: string): Promise<boolean> {
    const records = await this.list();
    return records.some((record) => record.root === path.resolve(root));
  }

  async trust(root: string): Promise<void> {
    const absolute = path.resolve(root);
    const records = (await this.list()).filter((record) => record.root !== absolute);
    records.push({ root: absolute, trustedAt: new Date().toISOString() });
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  }

  async list(): Promise<Array<{ root: string; trustedAt: string }>> {
    const content = await readFile(this.filePath, "utf8").catch(() => "[]");
    return JSON.parse(content) as Array<{ root: string; trustedAt: string }>;
  }
}
