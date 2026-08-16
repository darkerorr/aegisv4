import { describe, expect, it, vi } from "vitest";
import {
  GOOGLE_INITIAL_SCOPES,
  buildGoogleAuthorizationUrl,
  createIntegrationCipher,
  exchangeGoogleCode,
  getGoogleOAuthConfig,
  googleNotConfigured,
  normalizeRequestedScopes,
  refreshGoogleAccessToken,
} from "./google.js";

function configuredEnv(): NodeJS.ProcessEnv {
  return {
    GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "server-only-secret",
    GOOGLE_REDIRECT_URI: "http://127.0.0.1:4000/integrations/google/callback",
    AEGIS_WEB_URL: "http://127.0.0.1:3000",
    INTEGRATIONS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  };
}

describe("Google integration security", () => {
  it("reports missing server variables without exposing values", () => {
    const config = getGoogleOAuthConfig({ GOOGLE_CLIENT_ID: "public-id" });
    expect(config.configured).toBe(false);
    expect(config.missing).toContain("GOOGLE_CLIENT_SECRET");
    const failure = googleNotConfigured(config);
    expect(failure.message).toContain("Missing environment variable: GOOGLE_CLIENT_SECRET");
    expect(failure.message).not.toContain("public-id");
  });

  it("encrypts tokens with unique AES-256-GCM nonces and detects tampering", () => {
    const cipher = createIntegrationCipher(Buffer.alloc(32, 9).toString("base64"));
    const first = cipher.encrypt("google-access-token");
    const second = cipher.encrypt("google-access-token");
    expect(first).not.toBe(second);
    expect(first).not.toContain("google-access-token");
    expect(cipher.decrypt(first)).toBe("google-access-token");
    const tampered = first.split(":");
    tampered[2] = `${tampered[2].startsWith("A") ? "B" : "A"}${tampered[2].slice(1)}`;
    expect(() => cipher.decrypt(tampered.join(":"))).toThrow();
  });

  it("builds a state-bound offline authorization URL with read-only initial scopes", () => {
    const config = getGoogleOAuthConfig(configuredEnv());
    const url = new URL(buildGoogleAuthorizationUrl(config, "secure-state", [...GOOGLE_INITIAL_SCOPES]));
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("state")).toBe("secure-state");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("include_granted_scopes")).toBe("true");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("scope")).toContain("gmail.readonly");
    expect(url.searchParams.get("scope")).toContain("drive.metadata.readonly");
    expect(url.searchParams.get("scope")).not.toContain("gmail.send");
    expect(url.toString()).not.toContain("server-only-secret");
  });

  it("allows only the prepared incremental Google scopes", () => {
    const scopes = normalizeRequestedScopes(["https://www.googleapis.com/auth/drive.readonly"]);
    expect(scopes).toContain("https://www.googleapis.com/auth/drive.readonly");
    expect(scopes).toContain("https://www.googleapis.com/auth/gmail.readonly");
    expect(() => normalizeRequestedScopes(["https://www.googleapis.com/auth/drive"])).toThrow("not supported");
  });

  it("exchanges and refreshes tokens only through the official token endpoint", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ access_token: "access", refresh_token: "refresh", expires_in: 3600, scope: "openid email" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const config = getGoogleOAuthConfig(configuredEnv());
    await expect(exchangeGoogleCode(config, "authorization-code", fetchMock)).resolves.toMatchObject({ access_token: "access", refresh_token: "refresh" });
    const exchangeRequest = fetchMock.mock.calls[0];
    expect(String(exchangeRequest[0])).toBe("https://oauth2.googleapis.com/token");
    const exchangeBody = exchangeRequest[1]?.body as URLSearchParams;
    expect(exchangeBody.get("grant_type")).toBe("authorization_code");
    expect(exchangeBody.get("code")).toBe("authorization-code");
    fetchMock.mockClear();
    await expect(refreshGoogleAccessToken(config, "refresh-token", fetchMock)).resolves.toMatchObject({ access_token: "access" });
    const refreshBody = fetchMock.mock.calls[0][1]?.body as URLSearchParams;
    expect(refreshBody.get("grant_type")).toBe("refresh_token");
    expect(refreshBody.get("refresh_token")).toBe("refresh-token");
  });
});
