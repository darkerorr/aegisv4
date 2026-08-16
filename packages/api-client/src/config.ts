export const DEFAULT_API_URL = "http://127.0.0.1:4000";

export function normalizeApiUrl(value: string | undefined, fallback = DEFAULT_API_URL): string {
  const candidate = value?.trim() || fallback;
  return candidate.replace(/\/$/, "");
}
