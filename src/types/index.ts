export type ProviderKind =
  | "ollama"
  | "lmstudio"
  | "openai-compatible"
  | "anthropic-compatible"
  | "nvidia-compatible"
  | "groq-compatible"
  | "custom";

export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";

export type AegisTheme =
  | "default"
  | "dark"
  | "light"
  | "aegis-dark"
  | "sentinel-green"
  | "minimal"
  | "no-color";

export interface ProviderConfig {
  id: string;
  kind: ProviderKind;
  name: string;
  baseUrl: string;
  apiKeyEnv?: string;
  apiKey?: string;
  active: boolean;
  headers?: Record<string, string>;
}

export interface ModelConfig {
  id: string;
  providerId: string;
  name: string;
  type: "chat" | "code" | "embedding" | "other";
  active: boolean;
  favorite?: boolean;
}

export interface AegisConfig {
  defaultProvider: string;
  defaultModel: string;
  theme: AegisTheme;
  conversationsDir: string;
  historyDir: string;
  logsDir: string;
  trustedProjectsFile: string;
  streaming: boolean;
  stream: boolean;
  logLevel: LogLevel;
  maxFileBytes: number;
  maxFileSizeKb: number;
  safeMode: boolean;
  allowProjectReadAfterTrust: boolean;
  noColor: boolean;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  system?: string;
}

export interface ChatChunk {
  content: string;
  done?: boolean;
}

export interface ChatResponse {
  content: string;
  raw?: unknown;
}

export interface AIProvider {
  id: string;
  displayName: string;
  supportsStreaming: boolean;
  chat(config: ProviderConfig, request: ChatRequest): Promise<ChatResponse>;
  streamChat?(
    config: ProviderConfig,
    request: ChatRequest,
  ): AsyncGenerator<ChatChunk>;
  listModels?(config: ProviderConfig): Promise<ModelConfig[]>;
  test?(config: ProviderConfig): Promise<void>;
}

export interface Conversation {
  id: string;
  title: string;
  providerId: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
  tags: string[];
}
