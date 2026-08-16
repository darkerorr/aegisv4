import { execFile, spawn } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Open the OS file explorer highlighting the given path. Returns true when the
 * platform command was launched. */
export async function revealInExplorer(target: string): Promise<boolean> {
  if (process.platform === "win32") {
    // explorer.exe requires "/select," concatenated with the path as one
    // argument, and it exits with a non-zero code even on success.
    const child = spawn("explorer.exe", [`/select,${target}`], { detached: true, stdio: "ignore" });
    child.unref();
    return true;
  }
  if (process.platform === "darwin") {
    await execFileAsync("open", ["-R", target]);
    return true;
  }
  if (process.platform === "linux") {
    await execFileAsync("xdg-open", [path.dirname(target)]);
    return true;
  }
  return false;
}

export interface GitStatus {
  available: boolean;
  branch: string | null;
  changes: number;
  staged: number;
  behind?: number;
  ahead?: number;
  error?: string;
}

export async function gitStatus(root: string): Promise<GitStatus> {
  try {
    const branch = await execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: root, timeout: 8000, encoding: "utf8" });
    const currentBranch = branch.stdout.trim() || null;
    const porcelan = await execFileAsync("git", ["status", "--porcelain=v1", "--branch"], { cwd: root, timeout: 8000, encoding: "utf8" });
    const lines = porcelan.stdout.split("\n").filter(Boolean);
    let changes = 0;
    let staged = 0;
    let behind: number | undefined;
    let ahead: number | undefined;
    for (const line of lines) {
      if (line.startsWith("##")) {
        const match = line.match(/\[ahead (\d+)/);
        if (match) ahead = Number(match[1]);
        const behindMatch = line.match(/behind (\d+)/);
        if (behindMatch) behind = Number(behindMatch[1]);
        continue;
      }
      changes += 1;
      if (!line.startsWith("??") && !line.startsWith("!")) staged += 1;
    }
    return { available: true, branch: currentBranch, changes, staged, behind, ahead };
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes("not a git repository") || message.includes("not recognized") || message.includes("spawn git ENOENT")) {
      return { available: false, branch: null, changes: 0, staged: 0, error: message };
    }
    return { available: true, branch: null, changes: 0, staged: 0, error: message };
  }
}

export function isGitRepository(root: string): boolean {
  return path.basename(root) !== "" && !path.join(root, ".git").toLowerCase().endsWith(".aegis");
}