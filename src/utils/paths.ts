import { homedir } from "node:os";
import path from "node:path";

export function aegisHome(): string {
  return process.env.AEGIS_HOME || path.join(homedir(), ".aegis");
}

export function configPath(): string {
  return path.join(aegisHome(), "config.json");
}

export function globalEnvPath(): string {
  return path.join(aegisHome(), ".env");
}

export function modelsPath(): string {
  return path.join(aegisHome(), "models.json");
}

export function providersPath(): string {
  return path.join(aegisHome(), "providers.json");
}

export function promptsPath(): string {
  return path.join(aegisHome(), "prompts.json");
}

export function trustedProjectsPath(): string {
  return path.join(aegisHome(), "trusted.json");
}

export function historyDir(): string {
  return path.join(aegisHome(), "history");
}

export function logsDir(): string {
  return path.join(aegisHome(), "logs");
}

export function aegisRcPath(cwd = process.cwd()): string {
  return path.join(cwd, ".aegisrc");
}
