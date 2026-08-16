import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { isSafeRelativePath } from "@aegis/security";
import { paths } from "./config.js";
import { writeFileSafe } from "./files.js";

const MAX_SNAPSHOT_BYTES = 10 * 1024 * 1024;
const MAX_SNAPSHOT_FILES = 250;

export type UndoFileSnapshot = { relativePath: string; content: string | null };
export type UndoEntry = {
  version: 1;
  operation: "file" | "folder" | "move" | "copy";
  createdAt: string;
  files: UndoFileSnapshot[];
};

async function capturePath(root: string, relativePath: string, files: UndoFileSnapshot[], state: { bytes: number }): Promise<void> {
  const normalized = relativePath.replaceAll("\\", "/");
  if (!isSafeRelativePath(root, normalized)) throw new Error("The undo path is outside the trusted workspace.");
  const absolute = path.resolve(root, normalized);
  const info = await stat(absolute).catch(() => undefined);
  if (!info) {
    files.push({ relativePath: normalized, content: null });
    return;
  }
  if (info.isFile()) {
    if (info.size > MAX_SNAPSHOT_BYTES || files.length >= MAX_SNAPSHOT_FILES) throw new Error("The change is too large to checkpoint safely.");
    const content = await readFile(absolute, "utf8");
    state.bytes += Buffer.byteLength(content, "utf8");
    if (state.bytes > MAX_SNAPSHOT_BYTES) throw new Error("The change is too large to checkpoint safely.");
    files.push({ relativePath: normalized, content });
    return;
  }
  if (info.isDirectory()) {
    const entries = await readdir(absolute, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      await capturePath(root, `${normalized}/${entry.name}`, files, state);
    }
  }
}

export class UndoStore {
  private file(workspaceId: string): string { return path.join(paths.undoDir, `${workspaceId}.json`); }

  private async load(workspaceId: string): Promise<UndoEntry[]> {
    const raw = await readFile(this.file(workspaceId), "utf8").catch(() => "[]");
    try {
      const entries = JSON.parse(raw) as UndoEntry[];
      return Array.isArray(entries) ? entries.filter((entry) => entry?.version === 1 && Array.isArray(entry.files)) : [];
    } catch { return []; }
  }

  private async save(workspaceId: string, entries: UndoEntry[]): Promise<void> {
    await mkdir(paths.undoDir, { recursive: true });
    const target = this.file(workspaceId);
    const temporary = `${target}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(entries.slice(-20), null, 2)}\n`, "utf8");
    await rename(temporary, target);
  }

  async checkpoint(workspaceId: string, root: string, operation: UndoEntry["operation"], relativePaths: string[]): Promise<void> {
    const files: UndoFileSnapshot[] = [];
    const state = { bytes: 0 };
    for (const relativePath of [...new Set(relativePaths)]) await capturePath(root, relativePath, files, state);
    const entry: UndoEntry = { version: 1, operation, createdAt: new Date().toISOString(), files };
    await this.save(workspaceId, [...await this.load(workspaceId), entry]);
  }

  async undo(workspaceId: string, root: string): Promise<{ relativePath: string }> {
    const entries = await this.load(workspaceId);
    const entry = entries.pop();
    if (!entry) throw new Error("There is no recent agent change to roll back.");
    try {
      for (const snapshot of entry.files.filter((item) => item.content === null)) {
        if (!isSafeRelativePath(root, snapshot.relativePath)) throw new Error("The undo path is outside the trusted workspace.");
        await rm(path.resolve(root, snapshot.relativePath), { recursive: true, force: true });
      }
      for (const snapshot of entry.files.filter((item) => item.content !== null)) {
        await writeFileSafe(root, snapshot.relativePath, snapshot.content!);
      }
      await this.save(workspaceId, entries);
      return { relativePath: entry.files[0]?.relativePath ?? "workspace" };
    } catch (error) {
      await this.save(workspaceId, [...entries, entry]);
      throw error;
    }
  }
}
