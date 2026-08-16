import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { scanProject } from "@aegis/project-engine";
import { isSafeRelativePath, isSecretPath } from "@aegis/security";

export interface FileNode {
  name: string;
  relativePath: string;
  type: "file" | "directory";
  size?: number;
}

export async function listFiles(root: string): Promise<FileNode[]> {
  const scan = await scanProject(root);
  return scan.files.map((file) => ({
    name: path.basename(file.relativePath),
    relativePath: file.relativePath.replaceAll("\\", "/"),
    type: "file" as const,
    size: file.size,
  }));
}

export async function buildTree(root: string, limit = 500): Promise<FileNode[]> {
  const nodes: FileNode[] = [];
  async function walk(dir: string, depth: number): Promise<void> {
    if (nodes.length >= limit) return;
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (nodes.length >= limit) return;
      const ignored = [".git", "node_modules", "dist", "build", "coverage", ".next", ".turbo", ".aegis"];
      if (entry.isDirectory() && ignored.includes(entry.name)) continue;
      const absolute = path.join(dir, entry.name);
      const relative = path.relative(root, absolute).replaceAll("\\", "/");
      if (isSecretPath(relative)) continue;
      if (entry.isDirectory()) {
        nodes.push({ name: entry.name, relativePath: relative, type: "directory" });
        await walk(absolute, depth + 1);
      } else if (entry.isFile()) {
        const info = await stat(absolute).catch(() => undefined);
        nodes.push({ name: entry.name, relativePath: relative, type: "file", size: info?.size });
      }
    }
  }
  await walk(root, 0);
  return nodes;
}

export async function readFileSafe(root: string, relativePath: string): Promise<{ content: string; size: number }> {
  const normalized = relativePath.replaceAll("\\", "/");
  if (!isSafeRelativePath(root, normalized)) throw new Error("The file is outside the trusted workspace or is sensitive.");
  const filePath = path.resolve(root, normalized);
  const info = await stat(filePath);
  if (!info.isFile()) throw new Error("The path is not a file.");
  return { content: await readFile(filePath, "utf8"), size: info.size };
}

export async function writeFileSafe(root: string, relativePath: string, content: string): Promise<void> {
  const normalized = relativePath.replaceAll("\\", "/");
  if (!isSafeRelativePath(root, normalized)) throw new Error("The file is outside the trusted workspace or is sensitive.");
  const filePath = path.resolve(root, normalized);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

export async function editFileSafe(root: string, relativePath: string, before: string, after: string): Promise<void> {
  const { content } = await readFileSafe(root, relativePath);
  if (before === "" && after === "") return;
  if (before === "") {
    await writeFileSafe(root, relativePath, content + after);
    return;
  }
  if (!content.includes(before)) throw new Error("The 'before' text was not found in the file.");
  const updated = content.split(before).join(after);
  await writeFileSafe(root, relativePath, updated);
}

export async function deleteFileSafe(root: string, relativePath: string): Promise<void> {
  const normalized = relativePath.replaceAll("\\", "/");
  if (!isSafeRelativePath(root, normalized)) throw new Error("The file is outside the trusted workspace or is sensitive.");
  await rm(path.resolve(root, normalized), { recursive: false, force: false });
}

export async function deleteFolderSafe(root: string, relativePath: string): Promise<void> {
  const normalized = relativePath.replaceAll("\\", "/");
  if (!isSafeRelativePath(root, normalized)) throw new Error("The folder is outside the trusted workspace or is sensitive.");
  await rm(path.resolve(root, normalized), { recursive: true, force: false });
}

export async function moveFileSafe(root: string, from: string, to: string): Promise<void> {
  const fromNormalized = from.replaceAll("\\", "/");
  const toNormalized = to.replaceAll("\\", "/");
  if (!isSafeRelativePath(root, fromNormalized) || !isSafeRelativePath(root, toNormalized)) {
    throw new Error("The path is outside the trusted workspace or is sensitive.");
  }
  const fromPath = path.resolve(root, fromNormalized);
  const toPath = path.resolve(root, toNormalized);
  await mkdir(path.dirname(toPath), { recursive: true });
  await rename(fromPath, toPath);
}

export async function copyFileSafe(root: string, from: string, to: string): Promise<void> {
  const fromNormalized = from.replaceAll("\\", "/");
  const toNormalized = to.replaceAll("\\", "/");
  if (!isSafeRelativePath(root, fromNormalized) || !isSafeRelativePath(root, toNormalized)) {
    throw new Error("The path is outside the trusted workspace or is sensitive.");
  }
  const fromPath = path.resolve(root, fromNormalized);
  const toPath = path.resolve(root, toNormalized);
  await mkdir(path.dirname(toPath), { recursive: true });
  await writeFile(toPath, await readFile(fromPath));
}

export async function searchFiles(root: string, query: string, pathFilter?: string): Promise<Array<{ relativePath: string; line: number; content: string }>> {
  const scan = await scanProject(root);
  const matches: Array<{ relativePath: string; line: number; content: string }> = [];
  for (const file of scan.files) {
    if (pathFilter && !file.relativePath.replaceAll("\\", "/").includes(pathFilter)) continue;
    const text = await readFile(file.path, "utf8").catch(() => "");
    const lines = text.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      if (lines[index].includes(query)) {
        matches.push({ relativePath: file.relativePath.replaceAll("\\", "/"), line: index + 1, content: lines[index].slice(0, 240) });
      }
    }
  }
  return matches.slice(0, 200);
}
