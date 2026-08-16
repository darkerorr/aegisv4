/**
 * Pure derivation of the Work Mode agent status into a layered, displayable
 * model. The three concerns are kept strictly separate so that an absent AI
 * provider (or a missing token) can NEVER turn the Local Agent into "offline":
 *
 *  1. process     — is the Local Agent process running (/health answers)?
 *  2. connection  — does the API hold a token that the agent accepts?
 *  3. provider    — is an AI provider configured and usable?
 */

export type AgentProcessStatus = "online" | "offline";
export type AgentConnectionStatus = "connected" | "auth_required" | "unreachable";
export type AgentAuthenticationStatus = "authenticated" | "required" | "invalid";
export type ProviderLayerStatus = "ready" | "not_configured" | "invalid";

export interface AgentLayerInput {
  process: AgentProcessStatus;
  connection: AgentConnectionStatus;
  authentication: AgentAuthenticationStatus;
  version?: string;
  port?: number;
}

export interface ProviderLayerInput {
  status: "ready" | "invalid" | "not_configured";
  configured: number;
  enabled: number;
  ready: boolean;
  count?: number;
  list?: Array<{ id: string; name?: string; providerKey?: string; kind?: string; enabled?: boolean; configured?: boolean }>;
}

export interface WorkAgentStatusModel {
  process: AgentProcessStatus;
  connection: AgentConnectionStatus;
  authentication: AgentAuthenticationStatus;
  provider: ProviderLayerStatus;
  providerCount: number;
  canRunTask: boolean;
  agentMessage: string;
  connectionMessage: string;
  authMessage: string;
  providerMessage: string;
}

/** The provider layer is derived from how many providers are configured and
 * enabled. A missing provider is NEVER treated as the agent being offline. */
export function classifyProviderLayer(configured: number, enabled: number, ready: boolean): ProviderLayerStatus {
  if (ready && configured > 0 && enabled > 0) return "ready";
  if (configured > 0 || enabled > 0) return "invalid";
  return "not_configured";
}

export function deriveWorkStatus(agent: AgentLayerInput, providers: ProviderLayerInput): WorkAgentStatusModel {
  const process = agent.process;
  const connection = process === "online" ? agent.connection : "unreachable";
  const authentication = process === "online" ? agent.authentication : "required";
  const provider = classifyProviderLayer(providers.configured, providers.enabled, providers.ready);

  const agentMessage =
    process === "online"
      ? "Local Agent process is running."
      : "Local Agent process is not running. Start it with pnpm dev:local-agent.";

  const connectionMessage =
    connection === "connected"
      ? "This device is connected to the Local Agent."
      : connection === "auth_required"
        ? "This device is not connected to the Local Agent."
        : "The Local Agent process is not reachable.";

  const authMessage =
    authentication === "authenticated"
      ? "The Local Agent token is configured and accepted."
      : authentication === "invalid"
        ? "A Local Agent token is configured but the agent rejected it."
        : "Local Agent is running, but this device is not authenticated.";

  const providerMessage =
    provider === "ready"
      ? "At least one AI provider is configured and enabled."
      : provider === "invalid"
        ? "AI providers are configured but none is enabled with credentials."
        : "Local Agent is ready, but no AI provider is configured.";

  return {
    process,
    connection,
    authentication,
    provider,
    providerCount: providers.count ?? providers.list?.length ?? 0,
    canRunTask: connection === "connected" && provider === "ready",
    agentMessage,
    connectionMessage,
    authMessage,
    providerMessage,
  };
}

export type ConnectionPhase = "connecting" | "online" | "reconnecting" | "offline";

/** Track the live phase between two polls. A drop after being online yields
 * "reconnecting" (never a permanent offline), and a restored poll yields
 * "online" again. */
export function connectionPhase(previous: ConnectionPhase | null, process: AgentProcessStatus, isRefetching: boolean): ConnectionPhase {
  if (process === "online") return "online";
  if (previous === "online" || previous === "reconnecting") return isRefetching ? "reconnecting" : "reconnecting";
  return isRefetching ? "connecting" : "offline";
}