import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AegisApiClient } from "@aegis/api-client";
import { AegisApiError, describeApiError } from "./api/client";
import { AegisButton, AegisEmptyState, AegisErrorState, AegisStatus } from "./components/ui/AegisUI";

describe("desktop experience contracts", () => {
  it("distinguishes authentication from an unavailable API", () => {
    expect(describeApiError(new AegisApiError(401, { code: "AUTH_REQUIRED", message: "Authentication required." }))).toBe("Please sign in to continue.");
    expect(describeApiError(new AegisApiError(0, { code: "API_UNREACHABLE", message: "Failed to fetch" }))).toContain("currently unavailable");
    expect(describeApiError(new AegisApiError(403, { code: "EMAIL_NOT_VERIFIED", message: "Verify your email." }))).toBe("Please verify your email before signing in.");
  });

  it("renders reusable accessible action, status, empty and retry states", () => {
    const markup = renderToStaticMarkup(<div>
      <AegisButton>New chat</AegisButton>
      <AegisStatus tone="success" label="Synced" />
      <AegisEmptyState title="No conversations yet" description="Start a private conversation." action={<AegisButton>Start chatting</AegisButton>} />
      <AegisErrorState title="Aegis services are unavailable" description="Continue locally or retry." onRetry={() => undefined} />
    </div>);
    expect(markup).toContain("New chat");
    expect(markup).toContain("Synced");
    expect(markup).toContain("No conversations yet");
    expect(markup).toContain("Retry");
  });

  it("calls the native browser fetch with the global receiver", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = function (this: unknown) {
      if (this !== globalThis) throw new TypeError("Illegal invocation");
      return Promise.resolve(new Response(JSON.stringify({ ok: true, service: "aegis-api", version: "0.3.0", status: "ready" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    } as typeof fetch;
    try {
      const client = new AegisApiClient({ baseUrl: "http://127.0.0.1:4000", retries: 0 });
      await expect(client.health()).resolves.toMatchObject({ ok: true, status: "ready" });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
