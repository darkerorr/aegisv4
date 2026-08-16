import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { MessageView } from "../../api/client";

export type ProviderKind = "nvidia" | "openrouter" | "xai" | "ollama" | "lm-studio" | "openai-compatible";

export interface ProviderConnection {
  connectionId: string;
  provider: ProviderKind;
  displayName: string;
  secretRef?: string | null;
  enabled: boolean;
  defaultModel?: string | null;
  baseUrl: string;
}

export interface ProviderHealth {
  connectionId: string;
  status: "ready" | "stopped" | "not-installed";
  latencyMs: number;
  modelCount: number;
}

export interface ModelPricing {
  prompt?: string | null;
  completion?: string | null;
}

export interface ProviderModel {
  id: string;
  connectionId: string;
  provider: ProviderKind;
  providerName: string;
  name: string;
  description: string;
  location: "local" | "online";
  capabilities: string[];
  contextLength?: number | null;
  pricing?: ModelPricing | null;
  available: boolean;
  recommended: boolean;
}

export interface SaveConnectionInput {
  connectionId?: string;
  provider: ProviderKind;
  displayName?: string;
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}

export interface SaveConnectionResult {
  connection: ProviderConnection;
  health: ProviderHealth;
  models: ProviderModel[];
}

export interface ProviderCommandErrorShape {
  category: string;
  message: string;
  status?: number | null;
  requestId?: string | null;
  endpoint?: string | null;
  durationMs?: number | null;
}

export class ProviderCommandError extends Error implements ProviderCommandErrorShape {
  category: string;
  status?: number | null;
  requestId?: string | null;
  endpoint?: string | null;
  durationMs?: number | null;

  constructor(error: Partial<ProviderCommandErrorShape> | string) {
    const shape = typeof error === "string" ? { message: error } : error;
    super(shape.message || "The provider operation failed.");
    this.name = "ProviderCommandError";
    this.category = shape.category || "provider-error";
    this.status = shape.status;
    this.requestId = shape.requestId;
    this.endpoint = shape.endpoint;
    this.durationMs = shape.durationMs;
  }
}

function providerError(error: unknown): ProviderCommandError {
  if (error instanceof ProviderCommandError) return error;
  if (typeof error === "object" && error !== null) return new ProviderCommandError(error as Partial<ProviderCommandErrorShape>);
  return new ProviderCommandError(typeof error === "string" ? error : "The provider operation failed.");
}

async function command<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  try {
    return await invoke<T>(name, args);
  } catch (error) {
    throw providerError(error);
  }
}

export function isDesktopRuntime(): boolean {
  return isTauri();
}

export async function listProviderConnections(): Promise<ProviderConnection[]> {
  if (!isTauri()) return [];
  return command("provider_list_connections");
}

export async function saveProviderConnection(input: SaveConnectionInput): Promise<SaveConnectionResult> {
  if (!isTauri()) throw new ProviderCommandError({ category: "desktop-required", message: "Secure provider connections require the installed Aegis Desktop app." });
  return command("provider_save_connection", { input });
}

export async function removeProviderConnection(connectionId: string): Promise<void> {
  return command("provider_remove_connection", { input: { connectionId } });
}

export async function testProviderConnection(connectionId: string): Promise<ProviderHealth> {
  return command("provider_test_connection", { input: { connectionId } });
}

export async function refreshProviderModels(connectionId: string): Promise<ProviderModel[]> {
  return command("provider_refresh_models", { input: { connectionId } });
}

export async function listProviderModels(connectionId?: string): Promise<ProviderModel[]> {
  if (!isTauri()) return [];
  return command("provider_list_models", { input: { connectionId } });
}

export async function onProviderConnectionProgress(
  listener: (event: { connectionId: string; state: string }) => void,
): Promise<UnlistenFn> {
  if (!isTauri()) return () => undefined;
  return listen("provider-connection-progress", (event) => listener(event.payload as { connectionId: string; state: string }));
}

export async function* streamProviderChat(
  connectionId: string,
  model: string,
  messages: MessageView[],
  signal: AbortSignal,
): AsyncIterable<string> {
  if (!isTauri()) throw new ProviderCommandError({ category: "desktop-required", message: "Local provider streaming requires the installed Aegis Desktop app." });
  const requestId = crypto.randomUUID();
  const channel = new Channel<{ kind: "delta" | "done" | "cancelled"; data?: string }>();
  const queued: string[] = [];
  let done = false;
  let failure: ProviderCommandError | null = null;
  let wake: (() => void) | undefined;
  const notify = () => { wake?.(); wake = undefined; };
  channel.onmessage = (event) => {
    if (event.kind === "delta" && event.data) queued.push(event.data);
    if (event.kind === "done" || event.kind === "cancelled") done = true;
    notify();
  };
  const cancel = () => {
    done = true;
    failure = new ProviderCommandError({ category: "cancelled", message: "The generation was stopped." });
    void command("provider_cancel_chat", { input: { requestId } });
    notify();
  };
  signal.addEventListener("abort", cancel, { once: true });
  const request = command<void>("provider_start_chat", {
    input: {
      requestId,
      connectionId,
      model,
      messages: messages.map(({ role, content }) => ({ role, content })),
    },
    onEvent: channel,
  }).catch((error: unknown) => {
    if (!signal.aborted) failure = providerError(error);
    done = true;
    notify();
  });
  try {
    while (!done || queued.length) {
      if (queued.length) {
        yield queued.shift()!;
        continue;
      }
      await new Promise<void>((resolve) => { wake = resolve; });
    }
    await request;
    if (failure) throw failure;
  } finally {
    signal.removeEventListener("abort", cancel);
  }
}

export async function readDiagnosticsLogs(): Promise<string> {
  if (!isTauri()) return "Diagnostics logs are available in the installed desktop app.";
  return command("diagnostics_read_logs");
}

export async function readDiagnosticsLogPath(): Promise<string> {
  if (!isTauri()) return "Installed desktop runtime required";
  return command("diagnostics_log_path");
}
