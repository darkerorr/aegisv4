import { AegisApiError } from "@aegis/api-client";

export type UiError = { title: string; message: string; code: string; retryable: boolean; unauthorized: boolean };
export function normalizeError(error: unknown): UiError {
  if (error instanceof AegisApiError) {
    const unauthorized = error.status === 401 || ["AUTH_REQUIRED", "SESSION_EXPIRED"].includes(error.apiError.code);
    return { title: unauthorized ? "Session expired" : "Request failed", message: error.apiError.message, code: error.apiError.code, retryable: error.status === 0 || error.status >= 500, unauthorized };
  }
  return { title: "Something went wrong", message: error instanceof Error ? error.message : "The request could not be completed.", code: "UNKNOWN", retryable: true, unauthorized: false };
}
