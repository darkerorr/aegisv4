import { AegisApiClient, AegisApiError } from "@aegis/api-client";
import type { ApiChatStreamEvent, ChatRequest, DriveFile, GmailMessage, GoogleIntegration, GoogleOAuthStatus } from "@aegis/api-client";
import { API_BASE_URL, setApiUrl } from "../config/api";

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  emailVerified: boolean;
  preferences?: Record<string, unknown>;
}

export interface ProviderView {
  id: string;
  providerKey: string;
  kind: string;
  type?: string;
  name: string;
  baseUrl: string;
  defaultModel?: string | null;
  active: boolean;
  enabled?: boolean;
  hasApiKey: boolean;
  maskedApiKey?: string;
}

export interface ModelView {
  id: string;
  providerId: string;
  name: string;
  type: string;
  active: boolean;
  contextLength?: number;
  providerName?: string;
  providerKind?: string;
  local?: boolean;
  favorite?: boolean;
  visible?: boolean;
  available?: boolean;
  capabilities?: string[];
  description?: string;
  pricing?: { prompt?: string | null; completion?: string | null };
  recommended?: boolean;
}

export interface ConversationView {
  id: string;
  title: string;
  providerId: string | null;
  model: string;
  createdAt: string;
  updatedAt: string;
  messages: MessageView[];
}

export interface MessageView {
  id?: string;
  role: "system" | "user" | "assistant";
  content: string;
  createdAt?: string;
}

export interface ChatResponse {
  conversationId: string;
  provider: ProviderView;
  model: string;
  content: string;
  privacyMode: string;
}

export function describeApiError(error: unknown): string {
  if (error instanceof AegisApiError) {
    if (error.apiError.code === "API_UNREACHABLE" || error.apiError.code === "API_TIMEOUT") {
      return "Aegis services are currently unavailable.\n\nRetry or continue locally.";
    }
    if (error.status === 401 || error.apiError.code === "AUTH_REQUIRED") return "Please sign in to continue.";
    if (error.apiError.code === "EMAIL_NOT_VERIFIED") return "Please verify your email before signing in.";
    return error.apiError.requestId ? `${error.apiError.message} (Request ${error.apiError.requestId})` : error.apiError.message;
  }
  if (error instanceof TypeError && error.message.toLowerCase().includes("fetch")) {
    return "Aegis services are currently unavailable.\n\nRetry or continue locally.";
  }
  return error instanceof Error ? error.message : "Aegis request failed.";
}

const sharedClient = new AegisApiClient({ baseUrl: API_BASE_URL, credentials: "include", timeoutMs: 12_000, retries: 1, debug: import.meta.env.DEV });

class DesktopApiClient {
  async register(input: { email: string; password: string; displayName?: string }) {
    return sharedClient.register(input) as Promise<{ user: User; message?: string; emailVerificationRequired?: boolean }>;
  }
  async login(input: { email: string; password: string }) { return sharedClient.login(input) as Promise<{ user: User }>; }
  async logout() { await sharedClient.logout(); }
  async me() { return sharedClient.me() as Promise<{ user: User }>; }
  async refresh() { return sharedClient.refresh() as Promise<{ user: User }>;
  }
  async verifyEmail(token: string) { return sharedClient.verifyEmail(token) as Promise<{ user: User; message?: string }>; }
  async forgotPassword(email: string) { return sharedClient.forgotPassword(email); }
  async resetPassword(token: string, password: string) { return sharedClient.resetPassword(token, password); }
  async listProviders() { return sharedClient.listProviders() as Promise<{ providers: ProviderView[] }>; }
  async createProvider(input: Record<string, unknown>) { return sharedClient.createProvider(input as never) as Promise<{ provider: ProviderView }>; }
  async updateProvider(id: string, input: Record<string, unknown>) { return sharedClient.updateProvider(id, input as never) as Promise<{ provider: ProviderView }>; }
  async deleteProvider(id: string) { return sharedClient.deleteProvider(id); }
  async testProvider(id: string) { return sharedClient.testProvider(id); }
  async listModels() { return sharedClient.listModels() as Promise<{ models: ModelView[] }>; }
  async listProviderModels(id: string) { return sharedClient.listProviderModels(id) as Promise<{ models: ModelView[] }>; }
  async listConversations() { return sharedClient.listConversations() as Promise<{ conversations: ConversationView[] }>; }
  async getConversation(id: string) { return sharedClient.getConversation(id) as Promise<{ conversation: ConversationView }>; }
  async createConversation(input: { title?: string; providerId: string; model: string }) { return sharedClient.createConversation(input); }
  async updateConversation(id: string, title: string) { return sharedClient.updateConversation(id, { title }); }
  async deleteConversation(id: string) { return sharedClient.deleteConversation(id); }
  async updateAccount(input: { displayName?: string; preferences?: Record<string, unknown> }) { return sharedClient.updateAccount(input) as Promise<{ user: User }>; }
  async listSessions() { return sharedClient.listSessions(); }
  async revokeSession(id: string) { return sharedClient.revokeSession(id); }
  async changePassword(input: { currentPassword: string; newPassword: string; confirmPassword: string }) { return sharedClient.changePassword(input); }
  async chat(input: ChatRequest) { return sharedClient.chat(input) as unknown as Promise<ChatResponse>; }
  streamChat(input: ChatRequest, signal?: AbortSignal): AsyncIterable<ApiChatStreamEvent> { return sharedClient.streamChat(input, signal); }
  async health() { return sharedClient.health(); }
  setServerUrl(url: string): string { const next = setApiUrl(url); sharedClient.setBaseUrl(next); return next; }
  getServerUrl(): string { return sharedClient.getBaseUrl(); }
  async getGoogleIntegration() { return sharedClient.getGoogleIntegration(); }
  async startGoogleIntegration(input: { returnTarget?: "web" | "desktop"; scopes?: string[] } = {}) { return sharedClient.startGoogleIntegration(input); }
  async getGoogleIntegrationStatus(connectionId: string) { return sharedClient.getGoogleIntegrationStatus(connectionId) as Promise<GoogleOAuthStatus>; }
  async disconnectGoogle() { return sharedClient.disconnectGoogle(); }
  async listGmailMessages(input: { q?: string; pageToken?: string; maxResults?: number } = {}) { return sharedClient.listGmailMessages(input) as Promise<{ messages: GmailMessage[]; nextPageToken?: string; resultSizeEstimate: number }>; }
  async getGmailMessage(id: string) { return sharedClient.getGmailMessage(id); }
  async listDriveFiles(input: { pageToken?: string; pageSize?: number } = {}) { return sharedClient.listDriveFiles(input) as Promise<{ files: DriveFile[]; nextPageToken?: string; contentAvailable: boolean; permissionMessage?: string }>; }
  async searchDrive(q: string, pageToken?: string) { return sharedClient.searchDrive(q, pageToken); }
}

export const api = new DesktopApiClient();
export { AegisApiError };
export type { DriveFile, GmailMessage, GoogleIntegration, GoogleOAuthStatus };
