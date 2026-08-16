import { AegisApiClient, AegisApiError } from "@aegis/api-client";
import type { ApiChatStreamEvent, ChatRequest } from "@aegis/api-client";
import { API_URL } from "./config";

export const apiClient = new AegisApiClient({
  baseUrl: API_URL,
  credentials: "include",
  timeoutMs: 12_000,
  retries: 1,
  debug: process.env.NODE_ENV === "development",
});

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    const result = await apiClient.request<T>(path, init);
    if (process.env.NODE_ENV === "development") console.info(`[Aegis Web] ${(init.method || "GET").toUpperCase()} ${path}: success`);
    return result;
  } catch (error) {
    if (error instanceof AegisApiError) throw error;
    throw new Error("Aegis services are unavailable.");
  }
}

export async function checkApiHealth(signal?: AbortSignal) {
  if (process.env.NODE_ENV === "development") console.info(`[Aegis Web] API URL: ${API_URL}`);
  const result = await apiClient.health(signal);
  if (process.env.NODE_ENV === "development") console.info("[Aegis Web] GET /health: 200");
  return result;
}

export async function restoreSession(signal?: AbortSignal) {
  try {
    return { authenticated: true as const, ...(await apiClient.me(signal)) };
  } catch (error) {
    if (error instanceof AegisApiError && error.status === 401 && error.apiError.code === "AUTH_REQUIRED") {
      return { authenticated: false as const };
    }
    throw error;
  }
}

export function streamChat(input: ChatRequest, signal?: AbortSignal): AsyncIterable<ApiChatStreamEvent> {
  return apiClient.streamChat(input, signal);
}

export function formatApiError(error: unknown): string {
  if (error instanceof AegisApiError) {
    if (error.apiError.code === "API_UNREACHABLE" || error.apiError.code === "API_TIMEOUT") {
      return "Aegis services are unavailable.\n\nRetry or continue locally.";
    }
    if (error.status === 401 && error.apiError.code === "AUTH_REQUIRED") return "Please sign in to continue.";
    if (error.apiError.code === "ACCOUNT_EXISTS") return "This email is already registered.";
    if (error.apiError.code === "INVALID_CREDENTIALS") return "Invalid email or password.";
    if (error.apiError.code === "VALIDATION_ERROR") return error.apiError.message || "Please check the form fields.";
    if (error.status >= 500) return "Aegis encountered a server error. Please retry.";
    return error.apiError.message;
  }
  return error instanceof Error ? error.message : "Aegis request failed.";
}
