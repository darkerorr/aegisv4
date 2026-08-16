import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { scanProject } from "@aegis/project-engine";
import type { WorkspaceEntry, WorkspaceMode } from "@aegis/types";
import { paths } from "./config.js";

const execFileAsync = promisify(execFile);

/** Open the native Windows folder picker when the Local Agent runs in a
 * desktop session. The browser cannot expose an absolute local path safely,
 * so the picker belongs to the explicitly trusted local process. */
export async function pickWorkspaceFolder(): Promise<string | null> {
  if (process.platform !== "win32") throw new Error("Native folder selection is currently available on Windows only. Enter the workspace path manually.");
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
    "$dialog.Description = 'Connect a workspace to Aegis'",
    "$dialog.UseDescriptionForTitle = $true",
    "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }",
  ].join("; ");
  const result = await execFileAsync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], { timeout: 120_000, windowsHide: false, maxBuffer: 32 * 1024 });
  const selected = result.stdout.trim();
  return selected || null;
}

interface StoredWorkspace {
  id: string;
  root: string;
  mode: WorkspaceMode;
  trustedAt: string;
  projectType: string;
  fileCount: number;
}

export function workspaceId(root: string): string {
  return createHash("sha256").update(path.resolve(root)).digest("hex").slice(0, 16);
}

export class WorkspaceStore {
  private async load(): Promise<StoredWorkspace[]> {
    const content = await readFile(paths.workspaces, "utf8").catch(() => "[]");
    try {
      const parsed = JSON.parse(content) as StoredWorkspace[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async save(records: StoredWorkspace[]): Promise<void> {
    await mkdir(path.dirname(paths.workspaces), { recursive: true });
    await writeFile(paths.workspaces, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  }

  async list(): Promise<WorkspaceEntry[]> {
    const records = await this.load();
    return records.map((record) => ({
      id: record.id,
      root: record.root,
      name: path.basename(record.root),
      mode: record.mode,
      trustedAt: record.trustedAt,
      projectType: record.projectType,
      fileCount: record.fileCount,
    }));
  }

  async get(id: string): Promise<WorkspaceEntry | undefined> {
    return (await this.list()).find((entry) => entry.id === id);
  }

  async getByRoot(root: string): Promise<WorkspaceEntry | undefined> {
    const absolute = path.resolve(root);
    return (await this.list()).find((entry) => path.resolve(entry.root) === absolute);
  }

  async trust(root: string, mode: WorkspaceMode): Promise<WorkspaceEntry> {
    const absolute = path.resolve(root);
    const scan = await scanProject(absolute);
    const records = await this.load();
    const id = workspaceId(absolute);
    const existing = records.find((record) => record.id === id);
    const record: StoredWorkspace = {
      id,
      root: absolute,
      mode: existing?.mode ?? mode,
      trustedAt: existing?.trustedAt ?? new Date().toISOString(),
      projectType: scan.projectType,
      fileCount: scan.files.length,
    };
    await this.save([record, ...records.filter((r) => r.id !== id)]);
    return {
      id: record.id,
      root: record.root,
      name: path.basename(record.root),
      mode: record.mode,
      trustedAt: record.trustedAt,
      projectType: record.projectType,
      fileCount: record.fileCount,
    };
  }

  async setMode(id: string, mode: WorkspaceMode): Promise<WorkspaceEntry> {
    const records = await this.load();
    const index = records.findIndex((record) => record.id === id);
    if (index === -1) throw new Error("Workspace not found.");
    records[index].mode = mode;
    await this.save(records);
    return (await this.get(id))!;
  }

  async untrust(id: string): Promise<boolean> {
    const records = await this.load();
    const filtered = records.filter((record) => record.id !== id);
    if (filtered.length === records.length) return false;
    await this.save(filtered);
    return true;
  }

  async ensureAllowed(id: string): Promise<WorkspaceEntry> {
    const entry = await this.get(id);
    if (!entry) throw new Error("Workspace not trusted. Open and trust it first.");
    return entry;
  }
}

export function newApprovalId(): string {
  return `ap_${randomUUID()}`;
}
