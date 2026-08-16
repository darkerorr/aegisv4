import path from "node:path";

const secretNames = new Set([
  ".env", ".env.local", ".env.development", ".env.production", ".npmrc",
  "id_rsa", "id_ed25519", "credentials.json", "service-account.json",
]);
const secretExtensions = new Set([".pem", ".key", ".p12", ".pfx"]);

export function isSecretPath(relativePath: string): boolean {
  const normalized = relativePath.replaceAll("\\", "/");
  const name = path.posix.basename(normalized).toLowerCase();
  return secretNames.has(name) || secretExtensions.has(path.posix.extname(name));
}

export function isSafeRelativePath(root: string, candidate: string): boolean {
  const resolved = path.resolve(root, candidate);
  const relative = path.relative(path.resolve(root), resolved);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative) && !isSecretPath(relative);
}

export type CommandRisk = "safe" | "sensitive" | "destructive";

export function classifyCommand(command: string): CommandRisk {
  if (/\b(rm\s+-rf|Remove-Item.*-Recurse|format\s|diskpart|mkfs\.|fdisk|del\s+\/[fsq]|shutdown|restart-computer|stop-computer|taskkill\s+\/f\s+\/im|reg\s+delete|rd\s+\/s)\b/i.test(command)) return "destructive";
  if (/\b(sudo\s|chmod\s+777|chown\s|npm\s+i\s+-g|pnpm\s+add\s+-g|yarn\s+global\s+add|curl.*\|\s*(sh|bash|powershell|pwsh)|wget.*\|\s*(sh|bash)|git\s+push|git\s+reset\s+--hard|git\s+clean|git\s+rebase|git\s+checkout\s+\.|git\s+restore\s+\.)\b/i.test(command)) return "sensitive";
  return "safe";
}

export function redactSecrets(value: string): string {
  return value
    .replace(/(api[_-]?key|token|password|secret)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/(sk-[A-Za-z0-9_-]{12,})/g, "[REDACTED]");
}
