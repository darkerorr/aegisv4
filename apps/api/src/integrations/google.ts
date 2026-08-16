import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const GOOGLE_PROVIDER = "google" as const;
export const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
export const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

export const GOOGLE_INITIAL_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
] as const;

export const GOOGLE_INCREMENTAL_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/contacts.readonly",
] as const;

const GOOGLE_ALLOWED_SCOPES = new Set<string>([
  ...GOOGLE_INITIAL_SCOPES,
  ...GOOGLE_INCREMENTAL_SCOPES,
]);

export type GoogleOAuthConfig = {
  configured: boolean;
  missing: string[];
  clientId?: string;
  clientSecret?: string;
  redirectUri: string;
  webUrl: string;
  encryptionKey?: string;
};

export type GoogleTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
};

export type GoogleUserInfo = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

export class GoogleIntegrationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 502,
  ) {
    super(message);
    this.name = "GoogleIntegrationError";
  }
}

export function getGoogleOAuthConfig(env: NodeJS.ProcessEnv = process.env): GoogleOAuthConfig {
  const redirectUri = env.GOOGLE_REDIRECT_URI?.trim() || "http://127.0.0.1:4000/integrations/google/callback";
  const webUrl = (env.AEGIS_WEB_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
  const required = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "INTEGRATIONS_ENCRYPTION_KEY"] as const;
  const missing: string[] = required.filter((name) => !env[name]?.trim());
  let redirectValid = false;
  try {
    const parsed = new URL(redirectUri);
    redirectValid = ["http:", "https:"].includes(parsed.protocol)
      && parsed.pathname === "/integrations/google/callback";
  } catch {
    redirectValid = false;
  }
  if (!redirectValid) missing.push("GOOGLE_REDIRECT_URI");
  return {
    configured: missing.length === 0,
    missing: [...new Set(missing)],
    clientId: env.GOOGLE_CLIENT_ID?.trim(),
    clientSecret: env.GOOGLE_CLIENT_SECRET?.trim(),
    redirectUri,
    webUrl,
    encryptionKey: env.INTEGRATIONS_ENCRYPTION_KEY?.trim(),
  };
}

export function reportGoogleConfiguration(env: NodeJS.ProcessEnv = process.env): void {
  const config = getGoogleOAuthConfig(env);
  if (config.configured) {
    console.info("Google OAuth configured.");
    return;
  }
  console.warn("Google integration is not configured.");
  for (const variable of config.missing) console.warn(`Missing environment variable: ${variable}`);
}

function decodeEncryptionKey(value: string): Buffer {
  const decoded = /^[0-9a-f]{64}$/i.test(value)
    ? Buffer.from(value, "hex")
    : Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (decoded.length !== 32) {
    throw new GoogleIntegrationError(
      "INTEGRATIONS_ENCRYPTION_INVALID",
      "The integrations encryption key must contain exactly 32 bytes.",
      503,
    );
  }
  return decoded;
}

export function createIntegrationCipher(keyValue: string) {
  const key = decodeEncryptionKey(keyValue);
  return {
    encrypt(value: string): string {
      const nonce = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, nonce);
      const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
      return ["v1", nonce.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(":");
    },
    decrypt(value: string): string {
      const [version, nonce, tag, ciphertext] = value.split(":");
      if (version !== "v1" || !nonce || !tag || !ciphertext) {
        throw new GoogleIntegrationError("TOKEN_DECRYPTION_FAILED", "The stored Google credential is invalid.", 500);
      }
      try {
        const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(nonce, "base64url"));
        decipher.setAuthTag(Buffer.from(tag, "base64url"));
        return Buffer.concat([
          decipher.update(Buffer.from(ciphertext, "base64url")),
          decipher.final(),
        ]).toString("utf8");
      } catch {
        throw new GoogleIntegrationError("TOKEN_DECRYPTION_FAILED", "The stored Google credential could not be decrypted.", 500);
      }
    },
  };
}

export function normalizeRequestedScopes(scopes: string[] | undefined): string[] {
  const requested = scopes?.length ? scopes : [...GOOGLE_INITIAL_SCOPES];
  const invalid = requested.find((scope) => !GOOGLE_ALLOWED_SCOPES.has(scope));
  if (invalid) throw new GoogleIntegrationError("GOOGLE_SCOPE_NOT_ALLOWED", "The requested Google permission is not supported.", 400);
  return [...new Set([...GOOGLE_INITIAL_SCOPES, ...requested])];
}

export function buildGoogleAuthorizationUrl(config: GoogleOAuthConfig, state: string, scopes: string[]): string {
  if (!config.configured || !config.clientId) throw googleNotConfigured(config);
  const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
    scope: scopes.join(" "),
  }).toString();
  return url.toString();
}

export function googleNotConfigured(config: GoogleOAuthConfig): GoogleIntegrationError {
  const missing = config.missing[0] || "GOOGLE_CLIENT_SECRET";
  return new GoogleIntegrationError(
    "GOOGLE_NOT_CONFIGURED",
    `Google integration is not configured.\nMissing environment variable: ${missing}`,
    503,
  );
}

async function parseGoogleError(response: Response): Promise<never> {
  const payload = await response.json().catch(() => ({})) as { error?: string | { status?: string; message?: string }; error_description?: string };
  const rawCode = typeof payload.error === "string" ? payload.error : payload.error?.status;
  const code = rawCode === "invalid_client"
    ? "INVALID_CLIENT"
    : rawCode === "invalid_grant"
      ? "INVALID_GRANT"
      : response.status === 403
        ? "MISSING_SCOPE"
        : "GOOGLE_API_UNAVAILABLE";
  const message = code === "INVALID_CLIENT"
    ? "The Google OAuth client configuration was refused."
    : code === "INVALID_GRANT"
      ? "The Google authorization has expired. Please reconnect."
      : code === "MISSING_SCOPE"
        ? "Aegis needs an additional permission for this feature."
        : "Google is temporarily unavailable.";
  throw new GoogleIntegrationError(code, message, code === "MISSING_SCOPE" ? 403 : 502);
}

export async function exchangeGoogleCode(
  config: GoogleOAuthConfig,
  code: string,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<GoogleTokenResponse> {
  if (!config.configured || !config.clientId || !config.clientSecret) throw googleNotConfigured(config);
  const response = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
    }),
  });
  if (!response.ok) return parseGoogleError(response);
  const tokens = await response.json() as GoogleTokenResponse;
  if (!tokens.access_token) throw new GoogleIntegrationError("GOOGLE_TOKEN_MISSING", "Google did not return an access token.");
  return tokens;
}

export async function refreshGoogleAccessToken(
  config: GoogleOAuthConfig,
  refreshToken: string,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<GoogleTokenResponse> {
  if (!config.configured || !config.clientId || !config.clientSecret) throw googleNotConfigured(config);
  const response = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) return parseGoogleError(response);
  const tokens = await response.json() as GoogleTokenResponse;
  if (!tokens.access_token) throw new GoogleIntegrationError("GOOGLE_TOKEN_MISSING", "Google did not return a refreshed access token.");
  return tokens;
}

export async function fetchGoogleUserInfo(
  accessToken: string,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<GoogleUserInfo> {
  const response = await fetchImpl(GOOGLE_USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!response.ok) return parseGoogleError(response);
  const user = await response.json() as GoogleUserInfo;
  if (!user.sub) throw new GoogleIntegrationError("GOOGLE_PROFILE_INVALID", "Google returned an invalid user profile.");
  return user;
}

export async function revokeGoogleToken(
  token: string,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<boolean> {
  try {
    const response = await fetchImpl(`${GOOGLE_REVOKE_ENDPOINT}?${new URLSearchParams({ token })}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function parseGrantedScopes(value: string | undefined, fallback: string[]): string[] {
  return [...new Set((value?.split(/\s+/).filter(Boolean) || fallback))];
}

export function hasGoogleScope(scopes: string[], scope: string): boolean {
  return scopes.includes(scope);
}
