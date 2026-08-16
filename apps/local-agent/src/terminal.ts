import { spawn } from "node:child_process";
import path from "node:path";
import { classifyCommand, redactSecrets, type CommandRisk } from "@aegis/security";

export interface CommandResult {
  command: string;
  risk: CommandRisk;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export function commandRisk(command: string): CommandRisk {
  return classifyCommand(command);
}

const activeChildren = new Set<import("node:child_process").ChildProcess>();

/** Number of commands currently executing (used by /metrics). */
export function activeChildCount(): number {
  return activeChildren.size;
}

const AEGIS_PORTS = /\b(3000|4000|4150)\b/;

/** Hard-block commands that could kill, restart or shadow the Aegis services
 * (Web, API, Local Agent, supervisor). These are rejected no matter the
 * workspace trust mode or approval state, so the terminal can NEVER take down
 * the very infrastructure the user is working on. */
export function aegisTerminalGuard(command: string): string | null {
  const lower = command.toLowerCase();
  const killsNode = /\b(taskkill|stop-process|kill)\b.*\b(node|next|pnpm|npm|tsx)\b/i.test(command);
  const killsByName = /\b(taskkill\s+\/(f\s+)?\/?im\s+|stop-process\s+-name\s+)\S*(node|next|aegis)/i.test(command);
  const portKill = /\b(taskkill|stop-process|kill)\b/.test(command) && AEGIS_PORTS.test(command);
  const touchesSupervisor = /\b(start\.ps1|stop\.ps1|restart\.ps1|aegis-common\.ps1|supervisor\.mjs|start-web-only\.ps1|build-app\.ps1)\b/.test(lower);
  const touchesCliLifecycle = /\b(aegis\s+(start|stop|restart|dev|supervise)|pnpm\s+(dev|start|preview)|next\s+dev|tsx\s+\S*server\.ts)\b/.test(lower);

  if (killsNode || killsByName || portKill) {
    return "This command targets Aegis infrastructure processes and was blocked to protect the running services.";
  }
  if (touchesSupervisor || touchesCliLifecycle) {
    return "This command would launch or restart Aegis services (supervisor, launcher, dev servers) and was blocked to protect the running stack.";
  }
  return null;
}

export function runCommand(root: string, command: string, _timeoutMs?: number): Promise<CommandResult> {
  const risk = classifyCommand(command);
  const blocked = aegisTerminalGuard(command);
  if (blocked) {
    return Promise.resolve({
      command,
      risk,
      exitCode: null,
      stdout: "",
      stderr: `[local-agent] ${blocked}`,
    });
  }
  return new Promise<CommandResult>((resolve, reject) => {
    const child = spawn(command, { cwd: root, shell: true, env: process.env, windowsHide: true });
    activeChildren.add(child);
    const release = () => { activeChildren.delete(child); };
    let stdout = "";
    let stderr = "";
    let settled = false;
    child.stdout?.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      release();
      reject(Object.assign(new Error(error.message), { code: "TERMINAL_SPAWN_FAILED" }));
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      release();
      resolve({ command, risk, exitCode: code, stdout, stderr });
    });
  });
}

export function formatCommandResult(result: CommandResult): string {
  const lines = [
    `Command: ${result.command}`,
    `Risk: ${result.risk}`,
    `Exit code: ${result.exitCode === null ? "killed" : result.exitCode}`,
  ];
  if (result.stdout.trim()) lines.push(`STDOUT:\n${redactSecrets(result.stdout.trim().slice(-20_000))}`);
  if (result.stderr.trim()) lines.push(`STDERR:\n${redactSecrets(result.stderr.trim().slice(-10_000))}`);
  return lines.join("\n");
}

export function assertCommandWithinWorkspace(root: string, cwd: string): void {
  const relative = path.relative(path.resolve(root), path.resolve(cwd || root));
  if (relative && (relative.startsWith("..") || path.isAbsolute(relative))) throw new Error("The command working directory is outside the trusted workspace.");
}
