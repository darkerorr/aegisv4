import { DEFAULT_API_URL, normalizeApiUrl } from "@aegis/api-client";

const STORAGE_KEY = "aegis-api-url";
const envApiUrl = typeof import.meta !== "undefined" ? import.meta.env.VITE_AEGIS_API_URL : undefined;

function readStoredApiUrl(): string | undefined {
  try { return localStorage.getItem(STORAGE_KEY) || undefined; } catch { return undefined; }
}

export let API_BASE_URL = normalizeApiUrl(envApiUrl || readStoredApiUrl(), DEFAULT_API_URL);

export function getApiUrl(): string { return API_BASE_URL; }

export function setApiUrl(value: string): string {
  const next = normalizeApiUrl(value);
  API_BASE_URL = next;
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* storage may be unavailable in restricted WebViews */ }
  return next;
}
