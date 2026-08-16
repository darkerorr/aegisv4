import type { GoogleOAuthStatus } from "@aegis/api-client";

const TERMINAL = new Set(["completed", "error", "expired", "cancelled"]);

export async function pollGoogleConnection(
  connectionId: string,
  getStatus: (connectionId: string) => Promise<GoogleOAuthStatus>,
  options: { signal?: AbortSignal; intervalMs?: number; maxAttempts?: number } = {},
): Promise<GoogleOAuthStatus> {
  const intervalMs = options.intervalMs ?? 1500;
  const maxAttempts = options.maxAttempts ?? 400;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (options.signal?.aborted) throw new DOMException("Google OAuth polling aborted.", "AbortError");
    const result = await getStatus(connectionId);
    if (TERMINAL.has(result.status)) return result;
    await new Promise<void>((resolve, reject) => {
      const finish = () => { options.signal?.removeEventListener("abort", abort); resolve(); };
      const timer = globalThis.setTimeout(finish, intervalMs);
      const abort = () => { globalThis.clearTimeout(timer); options.signal?.removeEventListener("abort", abort); reject(new DOMException("Google OAuth polling aborted.", "AbortError")); };
      options.signal?.addEventListener("abort", abort, { once: true });
    });
  }
  return { connectionId, status: "expired", errorCode: "OAUTH_SESSION_EXPIRED", expiresAt: new Date().toISOString() };
}
