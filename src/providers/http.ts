import type { ProviderConfig } from "../types/index.js";

export function providerHeaders(
  config: ProviderConfig,
): Record<string, string> {
  const apiKey =
    config.apiKey ||
    (config.apiKeyEnv ? process.env[config.apiKeyEnv] : undefined);
  return {
    "Content-Type": "application/json",
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    ...config.headers,
  };
}

export async function parseErrorResponse(response: Response): Promise<Error> {
  const text = await response.text().catch(() => "");
  return new Error(
    `Provider request failed (${response.status}): ${text || response.statusText}`,
  );
}

export function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
