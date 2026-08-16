import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { homedir } from "node:os";

export const localAgentUrl = (process.env.AEGIS_LOCAL_AGENT_URL || "http://127.0.0.1:4150").replace(/\/$/, "");
const tokenPath = process.env.AEGIS_LOCAL_AGENT_TOKEN_PATH || path.join(homedir(), ".aegis", "local-agent", "token");

export async function getLocalAgentToken(): Promise<string | null> {
  if (process.env.AEGIS_LOCAL_AGENT_TOKEN) return process.env.AEGIS_LOCAL_AGENT_TOKEN;
  const content = await readFile(tokenPath, "utf8").catch(() => "");
  return content.trim() || null;
}

export async function setLocalAgentToken(token: string): Promise<void> {
  await mkdir(path.dirname(tokenPath), { recursive: true });
  await writeFile(tokenPath, `${token.trim()}\n`, "utf8");
}

export class LocalAgentUnavailableError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

/** Public request to the Local Agent (health / auth-status are unauthenticated).
 * Only fails when the process is unreachable — never because of a missing token. */
export async function localAgentPublicFetch(pathname: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(`${localAgentUrl}${pathname}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
  } catch (error) {
    throw new LocalAgentUnavailableError("LOCAL_AGENT_UNREACHABLE", `Unable to reach the Aegis Local Agent at ${localAgentUrl}. Start it with "pnpm start:local-agent".`);
  }
}

export async function localAgentFetch(pathname: string, init: RequestInit = {}): Promise<Response> {
  const token = await getLocalAgentToken();
  if (!token) throw new LocalAgentUnavailableError("LOCAL_AGENT_NOT_CONFIGURED", "The Aegis Local Agent token is not configured on this device.");
  try {
    return await fetch(`${localAgentUrl}${pathname}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    });
  } catch (error) {
    throw new LocalAgentUnavailableError("LOCAL_AGENT_UNREACHABLE", `Unable to reach the Aegis Local Agent at ${localAgentUrl}. Start it with "pnpm start:local-agent".`);
  }
}

export type AgentProcessStatus = "online" | "offline";
export type AgentConnectionStatus = "connected" | "auth_required" | "unreachable";
export type AgentAuthenticationStatus = "authenticated" | "required" | "invalid";

export interface AgentMetrics {
  pid: number;
  uptimeSeconds: number;
  memoryMb: number;
  heapUsedMb: number;
  heapTotalMb: number;
}

export interface SupervisorStatusService {
  state: "starting" | "online" | "unhealthy" | "crashed" | "stopped" | "crash_loop";
  pid: number | null;
  uptimeSeconds: number | null;
  lastExit: { code: number | null; signal: string | null; reason: string | null; at: string } | null;
  restarts: number;
  crashLoop: boolean;
}

export interface AgentStatusLayer {
  process: AgentProcessStatus;
  connection: AgentConnectionStatus;
  authentication: AgentAuthenticationStatus;
  version?: string;
  port?: number;
  lastHeartbeat: string;
  metrics?: AgentMetrics | null;
  supervisor?: SupervisorStatusService | null;
}

export async function localAgentProcessStatus(): Promise<{ process: AgentProcessStatus; version?: string; port?: number }> {
  try {
    const response = await localAgentPublicFetch("/health");
    if (!response.ok) return { process: "offline" };
    const data = (await response.json().catch(() => ({}))) as { service?: string; version?: string; port?: number };
    return { process: "online", version: data.version, port: data.port };
  } catch (error) {
    if (error instanceof LocalAgentUnavailableError && error.code === "LOCAL_AGENT_UNREACHABLE") return { process: "offline" };
    return { process: "offline" };
  }
}

/** Validate the locally stored token against the running agent. Returns:
 *  - "authenticated" when the token exists and is accepted
 *  - "invalid" when a token exists but the agent rejects it
 *  - "required" when no token is configured */
export async function localAgentAuthenticationStatus(): Promise<AgentAuthenticationStatus> {
  const token = await getLocalAgentToken();
  if (!token) return "required";
  try {
    const response = await localAgentPublicFetch("/auth/status", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await response.json().catch(() => ({}))) as { authenticated?: boolean };
    return data.authenticated === true ? "authenticated" : "invalid";
  } catch {
    return "required";
  }
}

export async function localAgentConnectionStatus(processStatus: AgentProcessStatus): Promise<AgentConnectionStatus> {
  if (processStatus !== "online") return "unreachable";
  const authentication = await localAgentAuthenticationStatus();
  return authentication === "authenticated" ? "connected" : "auth_required";
}

export async function localAgentStatusLayer(): Promise<AgentStatusLayer> {
  const { process, version, port } = await localAgentProcessStatus();
  const authentication = await localAgentAuthenticationStatus();
  const connection = process === "online" ? (authentication === "authenticated" ? "connected" : "auth_required") : "unreachable";
  const [metrics, supervisor] = await Promise.all([
    process === "online" ? localAgentMetrics() : Promise.resolve(null),
    readSupervisorStatus("local-agent"),
  ]);
  return {
    process,
    connection,
    authentication,
    version,
    port,
    lastHeartbeat: new Date().toISOString(),
    metrics,
    supervisor,
  };
}

/** Live process metrics from the Local Agent (public /metrics endpoint). */
export async function localAgentMetrics(): Promise<AgentMetrics | null> {
  try {
    const response = await localAgentPublicFetch("/metrics");
    if (!response.ok) return null;
    const data = (await response.json().catch(() => ({}))) as {
      pid?: number;
      uptimeSeconds?: number;
      memory?: { rssMb?: number; heapUsedMb?: number; heapTotalMb?: number };
    };
    if (typeof data.pid !== "number") return null;
    return {
      pid: data.pid,
      uptimeSeconds: data.uptimeSeconds ?? 0,
      memoryMb: data.memory?.rssMb ?? 0,
      heapUsedMb: data.memory?.heapUsedMb ?? 0,
      heapTotalMb: data.memory?.heapTotalMb ?? 0,
    };
  } catch {
    return null;
  }
}

/** Reads the supervisor's machine-readable state (logs/status.json) for a
 * service, so Work Mode can show "PROCESS CRASHED (exit code N)" instead of a
 * generic offline. Returns null when the supervisor never recorded anything. */
export async function readSupervisorStatus(service: "api" | "web" | "local-agent"): Promise<SupervisorStatusService | null> {
  const logDir = process.env.AEGIS_LOG_DIR || path.join(process.cwd(), "logs");
  try {
    const content = await readFile(path.join(logDir, "status.json"), "utf8");
    const payload = JSON.parse(content) as { services?: Record<string, SupervisorStatusService> };
    return payload?.services?.[service] ?? null;
  } catch {
    return null;
  }
}

/** One-click connect: the Local Agent exposes an unauthenticated handshake that
 * returns the device token, so the API can configure itself and validate it. */
export async function connectLocalAgent(): Promise<{ tokenConfigured: boolean; tokenAccepted: boolean; workspaces: unknown[] }> {
  const handshake = await localAgentPublicFetch("/auth/token", { method: "POST" });
  if (!handshake.ok) {
    throw new LocalAgentUnavailableError("LOCAL_AGENT_HANDSHAKE_FAILED", "The Local Agent refused the token handshake.");
  }
  const data = (await handshake.json().catch(() => ({}))) as { token?: string; workspaces?: unknown[] };
  if (!data.token) {
    throw new LocalAgentUnavailableError("LOCAL_AGENT_HANDSHAKE_FAILED", "The Local Agent returned no device token.");
  }
  await setLocalAgentToken(data.token);
  const authentication = await localAgentAuthenticationStatus();
  return {
    tokenConfigured: true,
    tokenAccepted: authentication === "authenticated",
    workspaces: data.workspaces ?? [],
  };
}

export async function localAgentJson(pathname: string, init: RequestInit = {}): Promise<{ status: number; data: unknown }> {
  const response = await localAgentFetch(pathname, init);
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}
