import type { ApiError } from "@aegis/types";

export type GenerationStatus = "pending" | "streaming" | "completed" | "error" | "cancelled" | "interrupted";

export type WebSearchResultView = {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
  source?: string;
  rank: number;
  site?: string;
  domain?: string;
  score?: number;
  sourceType?: "official" | "primary" | "technical" | "news" | "community" | "other";
};

export type GenerationEvent =
  | { name: "message.started"; data: Record<string, unknown> }
  | { name: "generation.status"; data: { status: string; elapsedMs?: number; message?: string; retryInMs?: number } }
  | { name: "message.notice"; data: { kind: "provider-limited" | "provider-fallback" | "rate-limited" | "model-unavailable" | "info"; message: string; providerId?: string; model?: string; retryInMs?: number } }
  | { name: "message.interrupted"; data: { messageId: string; content: string; reasoning?: string; generationId?: string; canResume: boolean } }
  | { name: "tool.requested"; data: { tool: string; label?: string; query?: string; activityId?: string; url?: string; title?: string; domain?: string; site?: string } }
  | { name: "tool.started"; data: { tool: string; label?: string; query?: string; activityId?: string; url?: string; title?: string; domain?: string; site?: string } }
  | { name: "tool.completed"; data: { tool: string; sourceCount: number; resultCount?: number; label?: string; query?: string; activityId?: string; url?: string; title?: string; domain?: string; site?: string } }
  | { name: "tool.failed"; data: { tool: string; code: string; label?: string; query?: string; activityId?: string; url?: string; title?: string; domain?: string; site?: string } }
  | { name: "web.results"; data: { query: string; results: WebSearchResultView[] } }
  | { name: "message.delta"; data: { delta: string } }
  | { name: "message.reasoning"; data: { delta: string } }
  | { name: "message.resync"; data: { content: string; reasoning?: string; status: GenerationStatus; error?: ApiError } }
  | { name: "message.completed"; data: { conversationId: string; messageId: string } }
  | { name: "message.error"; data: ApiError };

type Subscriber = (name: string, data: unknown) => void;

/**
 * A single running chat generation. Owned by the API process, outliving the
 * HTTP connection that started it so a page refresh (or a dropped network
 * connection) never destroys an in-flight response.
 */
export class Generation {
  readonly id: string;
  readonly requestId: string;
  readonly conversationId: string;
  readonly messageId: string;
  content = "";
  reasoning = "";
  status: GenerationStatus = "streaming";
  error: ApiError | null = null;
  requestIdForCancel: string;

  private subscribers = new Set<Subscriber>();
  private abortHandlers = new Set<() => void>();

  constructor(init: {
    id: string;
    requestId: string;
    conversationId: string;
    messageId: string;
  }) {
    this.id = init.id;
    this.requestId = init.requestId;
    this.conversationId = init.conversationId;
    this.messageId = init.messageId;
    this.requestIdForCancel = init.requestId;
  }

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  emit(name: string, data: unknown): void {
    if (!this.alive && name !== "message.completed" && name !== "message.error" && name !== "message.interrupted" && name !== "message.notice") return;
    for (const fn of [...this.subscribers]) {
      try {
        fn(name, data);
      } catch {
        /* subscriber errors never break the generation */
      }
    }
  }

  setAbortHandler(fn: () => void): void {
    this.abortHandlers.add(fn);
  }

  abort(): void {
    for (const fn of [...this.abortHandlers]) fn();
  }

  finish(status: Exclude<GenerationStatus, "streaming" | "pending">, error: ApiError | null = null): void {
    if (this.status === "completed" || this.status === "cancelled") return;
    if (this.status === "error") return;
    this.status = status;
    this.error = error;
    unregisterGeneration(this);
  }

  get alive(): boolean {
    return this.status === "pending" || this.status === "streaming";
  }
}

const registry = new Map<string, Generation>();
const byRequestId = new Map<string, Generation>();

export function registerGeneration(generation: Generation): Generation {
  registry.set(generation.id, generation);
  byRequestId.set(generation.requestId, generation);
  return generation;
}

export function unregisterGeneration(generation: Generation): void {
  registry.delete(generation.id);
  if (byRequestId.get(generation.requestId) === generation) byRequestId.delete(generation.requestId);
}

export function getGeneration(id: string): Generation | undefined {
  return registry.get(id);
}

export function getGenerationByRequestId(requestId: string): Generation | undefined {
  return byRequestId.get(requestId);
}

export function activeGenerationCount(): number {
  return registry.size;
}
