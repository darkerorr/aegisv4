import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import type { MessageView } from "./client";

export type LocalProviderKind = "ollama" | "lm-studio";

export async function listLocalModels(kind: LocalProviderKind): Promise<string[]> {
  if (isTauri()) return invoke<string[]>("list_local_models", { kind });
  const url = endpoint(kind, kind === "ollama" ? "/api/tags" : "/v1/models");
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error("Local provider is unavailable.");
    const data = await response.json() as { models?: Array<{ name?: string; model?: string }>; data?: Array<{ id?: string }> };
    return kind === "ollama" ? (data.models ?? []).map((item) => item.name || item.model || "").filter(Boolean) : (data.data ?? []).map((item) => item.id || "").filter(Boolean);
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Local provider detection timed out.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function endpoint(kind: LocalProviderKind, path: string): string {
  return kind === "ollama" ? `http://127.0.0.1:11434${path}` : `http://127.0.0.1:1234${path}`;
}

export async function* streamLocalChat(kind: LocalProviderKind, model: string, messages: MessageView[], signal: AbortSignal): AsyncIterable<string> {
  if (isTauri()) {
    const requestId = crypto.randomUUID();
    const channel = new Channel<{ kind: "delta" | "done"; data?: string }>();
    const queued: string[] = [];
    let done = false;
    let failure: Error | null = null;
    let wake: (() => void) | undefined;
    const notify = () => { wake?.(); wake = undefined; };
    channel.onmessage = (event) => {
      if (event.kind === "delta" && event.data) queued.push(event.data);
      if (event.kind === "done") done = true;
      notify();
    };
    const cancel = () => {
      done = true;
      failure = new DOMException("The generation was stopped.", "AbortError");
      void invoke("cancel_local_chat", { requestId });
      notify();
    };
    signal.addEventListener("abort", cancel, { once: true });
    const request = invoke<void>("stream_local_chat", {
      kind,
      requestId,
      model,
      messages: messages.map(({ role, content }) => ({ role, content })),
      onEvent: channel,
    }).catch((error: unknown) => {
      if (!signal.aborted) failure = new Error(typeof error === "string" ? error : "The local model stream failed.");
      done = true;
      notify();
    });
    try {
      while (!done || queued.length) {
        if (queued.length) { yield queued.shift()!; continue; }
        await new Promise<void>((resolve) => { wake = resolve; });
      }
      await request;
      if (failure) throw failure;
    } finally {
      signal.removeEventListener("abort", cancel);
    }
    return;
  }
  const url = endpoint(kind, kind === "ollama" ? "/api/chat" : "/v1/chat/completions");
  const body = kind === "ollama"
    ? { model, messages: messages.map(({ role, content }) => ({ role, content })), stream: true }
    : { model, messages: messages.map(({ role, content }) => ({ role, content })), stream: true };
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error(`${kind === "ollama" ? "Ollama" : "LM Studio"} is not available. Start it or choose another model.`);
  }
  if (!response.ok) throw new Error(`Local provider returned HTTP ${response.status}.`);
  if (!response.body) throw new Error("Local provider returned an empty stream.");
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read(); buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split(/\r?\n/); buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const raw = line.startsWith("data:") ? line.slice(5).trim() : line.trim();
        if (raw === "[DONE]") continue;
        try {
          const payload = JSON.parse(raw) as { message?: { content?: string }; response?: string; choices?: Array<{ delta?: { content?: string } }> };
          const delta = kind === "ollama" ? payload.message?.content ?? payload.response ?? "" : payload.choices?.[0]?.delta?.content ?? "";
          if (delta) yield delta;
        } catch { /* providers may split JSON at chunk boundaries */ }
      }
      if (done) break;
    }
  } finally { reader.releaseLock(); }
}
