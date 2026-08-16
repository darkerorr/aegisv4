import { describe, expect, it, vi } from "vitest";
import { pollGoogleConnection } from "./googlePolling";

describe("Google OAuth desktop polling", () => {
  it("stops when the OAuth session completes", async () => {
    const getStatus = vi.fn()
      .mockResolvedValueOnce({ connectionId: "connection-1", status: "pending", expiresAt: new Date(Date.now() + 1000).toISOString() })
      .mockResolvedValueOnce({ connectionId: "connection-1", status: "completed", expiresAt: new Date(Date.now() + 1000).toISOString() });
    const result = await pollGoogleConnection("connection-1", getStatus, { intervalMs: 0, maxAttempts: 3 });
    expect(result.status).toBe("completed");
    expect(getStatus).toHaveBeenCalledTimes(2);
  });

  it("stops polling when the desktop view is closed", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(pollGoogleConnection("connection-2", vi.fn(), { signal: controller.signal, intervalMs: 0 })).rejects.toMatchObject({ name: "AbortError" });
  });
});
