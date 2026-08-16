import { describe, expect, it, vi } from "vitest";
import type { WorkAgentEvent, WorkspaceEntry } from "@aegis/types";

const state = (globalThis as { __agentTestState?: { streamCalls: number; failures: boolean[]; failure: { code: string; status: number } } }).__agentTestState ??= { streamCalls: 0, failures: [], failure: { code: "PROVIDER_RATE_LIMITED", status: 429 } };

vi.mock("@aegis/providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aegis/providers")>();
  return {
    ...actual,
    createProvider: () => ({
      streamChat: async function* (): AsyncGenerator<import("@aegis/types").ChatStreamEvent> {
        state.streamCalls += 1;
        if (state.failures.shift()) {
          throw Object.assign(new Error(state.failure.code), {
            code: state.failure.code,
            status: state.failure.status,
            details: { retryAfter: 0 },
          });
        }
        yield { type: "delta", content: "hello" };
      },
    }),
  };
});

import { runAgent } from "./agent.js";
import type { AgentRuntime } from "./agent.js";

const workspace: WorkspaceEntry = {
  id: "w1",
  root: "C:\\tmp\\project",
  name: "project",
  mode: "restricted",
  trustedAt: "2026-08-15T00:00:00Z",
  projectType: "Node.js",
  fileCount: 0,
};

function makeRuntime(events: WorkAgentEvent[]): AgentRuntime {
  return {
    workspace,
    approvals: {
      request: () => ({ id: "a1", promise: Promise.resolve(true) }),
    } as unknown as AgentRuntime["approvals"],
    onEvent: (event) => {
      events.push(event);
    },
    getAborted: () => false,
  };
}

const request = {
  workspaceId: "w1",
  model: "mistral-large-latest",
  provider: { id: "mistral", kind: "mistral", name: "Mistral", baseUrl: "https://api.mistral.ai/v1", active: true },
  messages: [{ role: "user" as const, content: "do the task" }],
};

describe("runAgent rate-limit handling", () => {
  it("retries a transient 429 and completes the turn", async () => {
    state.streamCalls = 0;
    state.failures = [true];
    state.failure = { code: "PROVIDER_RATE_LIMITED", status: 429 };
    const events: WorkAgentEvent[] = [];
    await runAgent(request as never, makeRuntime(events));
    expect(state.streamCalls).toBe(2);
    expect(events.some((event) => event.type === "agent.delta" && event.delta === "hello")).toBe(true);
    expect(events.some((event) => event.type === "agent.completed")).toBe(true);
    expect(events.some((event) => event.type === "agent.error")).toBe(false);
  });

  it("retries a transient 529 overload and completes the turn", async () => {
    state.streamCalls = 0;
    state.failures = [true, true];
    state.failure = { code: "PROVIDER_OVERLOADED", status: 529 };
    const events: WorkAgentEvent[] = [];
    await runAgent(request as never, makeRuntime(events));
    expect(state.streamCalls).toBe(3);
    expect(events.some((event) => event.type === "agent.delta" && event.delta === "hello")).toBe(true);
    expect(events.some((event) => event.type === "agent.error")).toBe(false);
  });

  it("gives up after exhausting the retry budget and propagates the rate-limit error", async () => {
    state.streamCalls = 0;
    state.failures = [true, true, true, true];
    state.failure = { code: "PROVIDER_RATE_LIMITED", status: 429 };
    const events: WorkAgentEvent[] = [];
    await expect(runAgent(request as never, makeRuntime(events))).rejects.toMatchObject({ code: "PROVIDER_RATE_LIMITED" });
    expect(state.streamCalls).toBe(4);
  });
});
