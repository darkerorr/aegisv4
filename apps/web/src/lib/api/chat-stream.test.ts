import { describe, expect, it } from "vitest";
import { AegisApiClient } from "@aegis/api-client";

const SSE = (events: Array<{ event: string; data: Record<string, unknown> }>) =>
  events.map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`).join("");

describe("chat stream client mapping", () => {
  it("maps message.notice, generation.status (provider-waiting) and message.interrupted during streamChat", async () => {
    const client = new AegisApiClient({
      baseUrl: "http://api.test",
      fetch: async (input, init) => {
        expect(String(input)).toBe("http://api.test/chat/stream");
        return new Response(SSE([
          { event: "message.started", data: { conversationId: "c1", providerId: "p1", model: "m1", messageId: "m1" } },
          { event: "generation.status", data: { status: "provider-waiting", message: "Provider temporairement limité — nouvelle tentative dans 2s", retryInMs: 2000, elapsedMs: 500 } },
          { event: "message.notice", data: { kind: "provider-fallback", message: "Provider basculé vers fallback", providerId: "p2", model: "m2" } },
          { event: "message.delta", data: { delta: "Partial" } },
          { event: "message.interrupted", data: { messageId: "m1", content: "Partial", canResume: true, generationId: "g1" } },
        ]), { status: 200, headers: { "Content-Type": "text/event-stream" } });
      },
    });
    const events = [];
    for await (const event of client.streamChat({
      providerId: "p1",
      model: "m1",
      messages: [{ role: "user", content: "hi" }],
      privacyMode: "remote-provider",
      attachmentIds: [],
      toolMode: "auto",
      enabledTools: [],
    })) {
      events.push(event);
    }
    expect(events.map((e) => e.type)).toEqual([
      "message.started",
      "generation.status",
      "message.notice",
      "message.delta",
      "message.interrupted",
    ]);
    expect(events[1]).toMatchObject({ status: "provider-waiting", message: expect.stringContaining("2s"), retryInMs: 2000 });
    expect(events[2]).toMatchObject({ kind: "provider-fallback", providerId: "p2" });
    expect(events[4]).toMatchObject({ type: "message.interrupted", messageId: "m1", content: "Partial", canResume: true });
  });

  it("continueChat appends deltas and completes into the SAME message", async () => {
    const client = new AegisApiClient({
      baseUrl: "http://api.test",
      fetch: async (input, init) => {
        expect(String(input)).toBe("http://api.test/chat/continue");
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({ conversationId: "c1", messageId: "m1" });
        return new Response(SSE([
          { event: "message.started", data: { conversationId: "c1", providerId: "p1", model: "m1", messageId: "m1" } },
          { event: "message.delta", data: { delta: " continued" } },
          { event: "message.completed", data: { conversationId: "c1", messageId: "m1" } },
        ]), { status: 200, headers: { "Content-Type": "text/event-stream" } });
      },
    });
    const types = [];
    for await (const event of client.continueChat({ conversationId: "c1", messageId: "m1" })) {
      types.push(event.type);
    }
    expect(types).toEqual(["message.started", "message.delta", "message.completed"]);
  });
});
