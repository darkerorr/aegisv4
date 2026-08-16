import { z } from "zod";

// ======== Privacy ========
export const PrivacyModeSchema = z.enum(["local", "remote-provider", "synced", "private"]);
export type PrivacyMode = z.infer<typeof PrivacyModeSchema>;

// ======== Errors ========
export const ERROR_CODES = [
  "AUTH_REQUIRED", "SESSION_EXPIRED", "INVALID_CREDENTIALS", "EMAIL_ALREADY_EXISTS",
  "VALIDATION_ERROR", "FORBIDDEN", "RESOURCE_NOT_FOUND", "RATE_LIMITED",
  "PROVIDER_NOT_CONFIGURED", "PROVIDER_AUTH_FAILED", "PROVIDER_UNAVAILABLE",
  "PROVIDER_TIMEOUT", "NO_MODELS_AVAILABLE", "MODEL_NOT_FOUND",
  "GOOGLE_PERMISSION_REQUIRED", "OAUTH_STATE_INVALID", "OAUTH_SESSION_EXPIRED",
  "INTEGRATION_NOT_CONFIGURED", "INTERNAL_ERROR",
] as const;
export type ErrorCode = typeof ERROR_CODES[number];

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().nullable().optional(),
  requestId: z.string().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(item: T) => z.object({
  data: z.array(item),
  cursor: z.string().optional(),
  hasMore: z.boolean().default(false),
  total: z.number().int().optional(),
});
export type PaginatedResponse<T> = {
  data: T[];
  cursor?: string;
  hasMore: boolean;
  total?: number;
};

// ======== Providers ========
export const ProviderIdSchema = z.enum(["nvidia-nim", "openrouter", "ollama", "lm-studio", "x-ai", "anthropic", "gemini", "openai", "mistral", "groq", "deepseek", "qwen", "meta", "together", "fireworks", "perplexity", "sambanova", "hyperbolic", "zhipu", "moonshot", "minimax", "novita", "huggingface"]);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

export const ProviderKindSchema = z.enum([
  "ollama", "lmstudio", "openai-compatible", "nvidia-nim", "openrouter", "custom", "x-ai",
  "anthropic", "gemini", "openai", "mistral", "groq", "deepseek", "qwen",
  "meta", "together", "fireworks", "perplexity", "sambanova", "hyperbolic", "zhipu", "moonshot", "minimax", "novita", "huggingface",
]);
export type ProviderKind = z.infer<typeof ProviderKindSchema>;

export const ProviderConfigSchema = z.object({
  id: z.string().min(1),
  kind: ProviderKindSchema,
  name: z.string().min(1),
  baseUrl: z.string().url(),
  apiKey: z.string().optional(),
  active: z.boolean().default(true),
  defaultModel: z.string().min(1).max(200).optional(),
  options: z.record(z.unknown()).optional(),
});
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

export const ProviderCreateSchema = z.object({
  id: z.string().min(1).max(120).optional(),
  providerKey: z.string().min(1).max(120).optional(),
  kind: ProviderKindSchema.optional(),
  type: z.string().min(1).max(80).optional(),
  name: z.string().trim().min(1).max(120),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1).optional(),
  defaultModel: z.string().min(1).max(200).optional(),
  active: z.boolean().optional(),
  enabled: z.boolean().optional(),
  options: z.record(z.unknown()).optional(),
}).refine((input) => Boolean(input.id || input.providerKey || input.type), { message: "A provider type or key is required." });
export type ProviderCreateInput = z.infer<typeof ProviderCreateSchema>;

export type ProviderType = ProviderKind;

export const ProviderStatusSchema = z.object({
  ok: z.boolean(),
  providerId: z.string(),
  latencyMs: z.number().optional(),
  message: z.string().optional(),
  error: ApiErrorSchema.optional(),
});
export type ProviderStatus = z.infer<typeof ProviderStatusSchema>;

// Structured, secret-free provider diagnostics used by the "Tester le provider"
// flow and the Provider diagnostics settings mode. NEVER include the API key or
// any other credential here.
export const ProviderDiagnosticCheckSchema = z.object({
  name: z.string(),
  ok: z.boolean(),
  status: z.number().int().optional(),
  durationMs: z.number().optional(),
  retryAfterSeconds: z.number().optional(),
  providerCode: z.string().optional(),
  errorType: z.string().optional(),
  message: z.string().optional(),
});
export type ProviderDiagnosticCheck = z.infer<typeof ProviderDiagnosticCheckSchema>;

export const ProviderDiagnosticSchema = z.object({
  providerId: z.string(),
  providerName: z.string(),
  kind: z.string(),
  baseUrl: z.string().url(),
  keyConfigured: z.boolean(),
  keyStatus: z.enum(["configured", "missing", "invalid", "expired", "unknown"]),
  latencyMs: z.number().optional(),
  checks: z.array(ProviderDiagnosticCheckSchema),
  modelCount: z.number().optional(),
  sampleModels: z.array(z.string()).max(40).optional(),
  probeModel: z.string().optional(),
  overall: z.enum(["ok", "auth", "rate-limited", "quota", "model-missing", "network", "server", "unknown"]),
  summary: z.string(),
});
export type ProviderDiagnostic = z.infer<typeof ProviderDiagnosticSchema>;

// ======== Models ========
export const ModelSchema = z.object({
  id: z.string().min(1),
  providerId: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["chat", "code", "embedding", "other"]).default("chat"),
  active: z.boolean().default(true),
  contextLength: z.number().int().positive().optional(),
  providerName: z.string().optional(),
  providerKind: z.string().optional(),
  family: z.string().optional(),
  capabilities: z.array(z.string()).default([]),
  local: z.boolean().default(false),
  free: z.boolean().optional(),
  favorite: z.boolean().default(false),
  visible: z.boolean().default(true),
  available: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
  pricing: z.object({ currency: z.literal("USD"), unit: z.literal("per_million_tokens"), input: z.number().optional(), output: z.number().optional(), cachedInput: z.number().optional(), request: z.number().optional(), source: z.string().optional(), lastUpdatedAt: z.string().optional() }).optional(),
  modalities: z.object({ input: z.array(z.string()).default(["text"]), output: z.array(z.string()).default(["text"]) }).optional(),
});
export type Model = z.infer<typeof ModelSchema>;

export const ModelPricingSchema = z.object({
  currency: z.literal("USD").default("USD"),
  unit: z.literal("per_million_tokens").default("per_million_tokens"),
  input: z.number().optional(), output: z.number().optional(), cachedInput: z.number().optional(), request: z.number().optional(), source: z.string().optional(), lastUpdatedAt: z.string().optional(),
});
export type ModelPricing = z.infer<typeof ModelPricingSchema>;

export const ModelModalitySchema = z.object({
  input: z.array(z.enum(["text", "image", "audio", "video"])).default(["text"]),
  output: z.array(z.enum(["text", "audio"])).default(["text"]),
});
export type ModelModality = z.infer<typeof ModelModalitySchema>;

export const ModelDescriptorSchema = ModelSchema.extend({
  pricing: ModelPricingSchema.optional(),
  modality: ModelModalitySchema.optional(),
  provider: z.string().optional(),
  updated: z.string().optional(),
});
export type ModelDescriptor = z.infer<typeof ModelDescriptorSchema>;

// ======== Messages & Chat ========
export const MessageStatusSchema = z.enum([
  "pending",
  "streaming",
  "completed",
  "error",
  "cancelled",
  "interrupted",
]);
export type MessageStatus = z.infer<typeof MessageStatusSchema>;

export const ChatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string().max(200_000),
  id: z.string().optional(),
  createdAt: z.string().optional(),
  reasoning: z.string().optional(),
  /** Persistence status of a message. Assistant messages are written to the
   * database as "streaming" from the first token onward so a page refresh
   * never destroys an in-flight answer. */
  status: MessageStatusSchema.optional(),
  errorText: z.string().nullable().optional(),
  toolCallId: z.string().optional(),
  toolCalls: z.array(z.object({ id: z.string().optional(), name: z.string(), arguments: z.string() })).optional(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatRequestSchema = z.object({
  conversationId: z.string().optional(),
  clientMessageId: z.string().min(8).max(100).optional(),
  idempotencyKey: z.string().min(8).max(100).optional(),
  providerId: z.string().optional(),
  model: z.string().min(1).max(200),
  messages: z.array(ChatMessageSchema).min(1).max(100),
  temperature: z.number().min(0).max(2).optional(),
  privacyMode: PrivacyModeSchema.default("remote-provider"),
  attachmentIds: z.array(z.string().min(1)).max(8).default([]),
  toolMode: z.enum(["auto", "ask", "manual"]).default("auto"),
  enabledTools: z.array(z.string().min(1).max(80)).max(16).default([]),
  tools: z.array(z.record(z.unknown())).optional(),
  /** Optional ordered fallback provider ids tried when the primary provider
   * fails transiently (rate limit, overload, connect timeout, 5xx). */
  fallbackProviderIds: z.array(z.string().min(1)).max(4).optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ToolCallSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  arguments: z.string(),
});
export type ToolCall = z.infer<typeof ToolCallSchema>;

export const AttachmentSchema = z.object({
  id: z.string(), name: z.string(), mimeType: z.string(), size: z.number().int(),
  status: z.enum(["uploading", "ready", "error"]), createdAt: z.string().optional(),
});
export type Attachment = z.infer<typeof AttachmentSchema>;

export const ChatResponseSchema = z.object({
  content: z.string(),
  providerId: z.string(),
  model: z.string(),
  conversationId: z.string().optional(),
  toolCalls: z.array(ToolCallSchema).optional(),
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

export const ChatStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("delta"), content: z.string() }),
  z.object({ type: z.literal("reasoning"), content: z.string() }),
  z.object({ type: z.literal("tool_calls"), calls: z.array(ToolCallSchema) }),
  z.object({ type: z.literal("done"), response: ChatResponseSchema.optional() }),
  z.object({ type: z.literal("error"), error: ApiErrorSchema }),
  z.object({ type: z.literal("interrupted"), partialContent: z.string().optional() }),
]);
export type ChatStreamEvent = z.infer<typeof ChatStreamEventSchema>;

export const SseEventSchema = z.object({
  event: z.enum(["start", "status", "token", "tool", "completed", "error"]),
  data: z.record(z.unknown()),
  id: z.string().optional(),
});
export type SseEvent = z.infer<typeof SseEventSchema>;

export const ApiChatStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("message.started"), conversationId: z.string(), providerId: z.string(), model: z.string(), requestId: z.string().optional(), generationId: z.string().optional(), messageId: z.string().optional() }),
  z.object({ type: z.literal("generation.status"), status: z.string(), elapsedMs: z.number().optional(), message: z.string().optional(), retryInMs: z.number().optional() }),
  z.object({ type: z.literal("message.notice"), kind: z.enum(["provider-limited", "provider-fallback", "rate-limited", "model-unavailable", "info"]), message: z.string(), providerId: z.string().optional(), model: z.string().optional(), retryInMs: z.number().optional() }),
  z.object({ type: z.literal("message.interrupted"), messageId: z.string(), content: z.string(), reasoning: z.string().optional(), generationId: z.string().optional(), canResume: z.boolean().default(true) }),
  z.object({ type: z.literal("tool.requested"), tool: z.string(), label: z.string().optional(), query: z.string().optional(), activityId: z.string().optional(), url: z.string().url().optional(), title: z.string().optional(), domain: z.string().optional(), site: z.string().optional() }),
  z.object({ type: z.literal("tool.started"), tool: z.string(), label: z.string().optional(), query: z.string().optional(), activityId: z.string().optional(), url: z.string().url().optional(), title: z.string().optional(), domain: z.string().optional(), site: z.string().optional() }),
  z.object({ type: z.literal("tool.completed"), tool: z.string(), sourceCount: z.number(), resultCount: z.number().optional(), label: z.string().optional(), query: z.string().optional(), activityId: z.string().optional(), url: z.string().url().optional(), title: z.string().optional(), domain: z.string().optional(), site: z.string().optional() }),
  z.object({ type: z.literal("tool.failed"), tool: z.string(), code: z.string(), label: z.string().optional(), query: z.string().optional(), activityId: z.string().optional(), url: z.string().url().optional(), title: z.string().optional(), domain: z.string().optional(), site: z.string().optional() }),
  z.object({ type: z.literal("web.results"), query: z.string(), results: z.array(z.object({ title: z.string(), url: z.string(), snippet: z.string(), publishedAt: z.string().optional(), source: z.string().optional(), rank: z.number(), site: z.string().optional(), domain: z.string().optional(), score: z.number().optional(), sourceType: z.enum(["official", "primary", "technical", "news", "community", "other"]).optional() })) }),
  z.object({ type: z.literal("message.resync"), content: z.string(), reasoning: z.string().optional(), status: z.enum(["streaming", "completed", "error", "cancelled"]), messageId: z.string().optional(), generationId: z.string().optional(), error: ApiErrorSchema.nullable().optional() }),
  z.object({ type: z.literal("message.delta"), delta: z.string() }),
  z.object({ type: z.literal("message.reasoning"), delta: z.string() }),
  z.object({ type: z.literal("message.completed"), conversationId: z.string(), messageId: z.string() }),
  z.object({ type: z.literal("message.error"), error: ApiErrorSchema }),
]);
export type ApiChatStreamEvent = z.infer<typeof ApiChatStreamEventSchema>;

// ======== Conversations ========
export const ConversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  providerId: z.string(),
  model: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable().optional(),
  pinnedAt: z.string().nullable().optional(),
  messages: z.array(ChatMessageSchema).optional(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

// ======== Users & Sessions ========
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string().nullable().optional(),
  emailVerified: z.boolean().default(false),
  avatarUrl: z.string().nullable().optional(),
  preferences: z.record(z.unknown()).optional(),
  createdAt: z.string().optional(),
});
export type User = z.infer<typeof UserSchema>;

export const SessionSchema = z.object({
  id: z.string(),
  tokenHash: z.string().optional(),
  expiresAt: z.string(),
  createdAt: z.string(),
  lastSeenAt: z.string(),
  deviceName: z.string().nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  current: z.boolean().default(false),
});
export type Session = z.infer<typeof SessionSchema>;

export const DeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string().default("desktop"),
  lastSeenAt: z.string().optional(),
  createdAt: z.string(),
});
export type Device = z.infer<typeof DeviceSchema>;

// ======== Provider Connections ========
export const ProviderConnectionSchema = z.object({
  id: z.string(),
  provider: z.string(),
  name: z.string(),
  type: z.enum(["SERVER_MANAGED", "DEVICE_LOCAL"]).default("SERVER_MANAGED"),
  status: z.enum(["connected", "disconnected", "error", "connecting"]).default("disconnected"),
  defaultModel: z.string().optional(),
  modelsCount: z.number().int().optional(),
  lastCheckedAt: z.string().optional(),
  error: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type ProviderConnection = z.infer<typeof ProviderConnectionSchema>;

// ======== Integrations ========
export const IntegrationAccountSchema = z.object({
  id: z.string(),
  provider: z.string(),
  accountEmail: z.string().nullable().optional(),
  accountName: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  status: z.string(),
  scopes: z.array(z.string()).default([]),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable().optional(),
});
export type IntegrationAccount = z.infer<typeof IntegrationAccountSchema>;

export type ProviderSecretLocation = "server-encrypted" | "device-local" | "env-var";

export const OAuthLinkSessionSchema = z.object({
  id: z.string(),
  connectionId: z.string(),
  provider: z.string(),
  status: z.string(),
  expiresAt: z.string(),
  returnTarget: z.string().default("web"),
});
export type OAuthLinkSession = z.infer<typeof OAuthLinkSessionSchema>;

// ======== AI Provider interface ========
export interface ProviderCapabilities {
  tools?: boolean;
  vision?: boolean;
  reasoning?: boolean;
  structuredOutput?: boolean;
}

export interface AIProvider {
  readonly id: string;
  readonly name: string;
  readonly type: ProviderType;
  testConnection(signal?: AbortSignal): Promise<ProviderStatus>;
  listModels(signalOrConfig?: AbortSignal | ProviderConfig): Promise<ModelInfo[]>;
  chat(request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse>;
  streamChat?(request: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatStreamEvent>;
  /** Declared capabilities used by orchestrators to pick providers/tools. */
  capabilities?(): ProviderCapabilities;
  supportsTools?(): boolean;
  supportsVision?(): boolean;
  supportsReasoning?(): boolean;
  supportsStructuredOutput?(): boolean;
}

export type ModelInfo = Model;

// ======== Legacy ========
export const WorkspaceTrustSchema = z.object({
  root: z.string().min(1),
  mode: z.enum(["trusted", "restricted"]),
  trustedAt: z.string(),
});
export type WorkspaceTrust = z.infer<typeof WorkspaceTrustSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  color: z.string().default("neutral"),
  defaultModel: z.string().nullable().optional(),
  instructions: z.string().nullable().optional(),
  githubRepository: z.string().nullable().optional(),
  tools: z.array(z.string()).default([]),
  conversationCount: z.number().int().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const PatchSchema = z.object({
  filePath: z.string(),
  relativePath: z.string(),
  before: z.string(),
  after: z.string(),
});
export type Patch = z.infer<typeof PatchSchema>;

export const AgentStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["pending", "running", "completed", "failed", "blocked"]),
  detail: z.string().optional(),
});
export type AgentStep = z.infer<typeof AgentStepSchema>;

// ======== WORK MODE (Local Agent) ========
export const WorkspaceModeSchema = z.enum(["trusted", "restricted"]);
export type WorkspaceMode = z.infer<typeof WorkspaceModeSchema>;

export const WorkspaceEntrySchema = z.object({
  id: z.string().min(1),
  root: z.string().min(1),
  name: z.string().min(1),
  mode: WorkspaceModeSchema,
  trustedAt: z.string(),
  projectType: z.string().default("Unknown"),
  fileCount: z.number().int().default(0),
});
export type WorkspaceEntry = z.infer<typeof WorkspaceEntrySchema>;

export const WorkToolActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("terminal"), command: z.string(), risk: z.enum(["safe", "sensitive", "destructive"]) }),
  z.object({ type: z.literal("write"), relativePath: z.string(), summary: z.string().optional(), patch: PatchSchema.optional() }),
  z.object({ type: z.literal("edit"), relativePath: z.string(), patch: PatchSchema }),
]);
export type WorkToolAction = z.infer<typeof WorkToolActionSchema>;

// ======== WORK MODE: Team of specialized agents ========
export const WorkAgentRoleSchema = z.enum([
  "dev",
  "design",
  "marketing",
  "content",
  "seo",
  "qa",
  "security",
  "data",
]);
export type WorkAgentRole = z.infer<typeof WorkAgentRoleSchema>;

export const WorkTeamMemberSchema = z.object({
  id: z.string().min(1),
  role: WorkAgentRoleSchema,
  name: z.string().min(1),
  description: z.string().max(500).optional(),
  color: z.string().max(32).optional(),
});
export type WorkTeamMember = z.infer<typeof WorkTeamMemberSchema>;

export const WorkTeamConfigSchema = z.object({
  /** When true, the agent runs as a team of up to 5 specialized agents. */
  enabled: z.boolean().default(false),
  /** auto: an orchestrator model picks the relevant members; custom: the user
   * picks them (max 5). */
  mode: z.enum(["auto", "custom"]).default("auto"),
  /** Explicit member roles for custom mode (max 5, dev is always added first). */
  roles: z.array(WorkAgentRoleSchema).min(0).max(5).default([]),
});
export type WorkTeamConfig = z.infer<typeof WorkTeamConfigSchema>;

/** Configurable action budget that replaces the old fixed turn limit. Simple
 * reads cost 1, edits/writes cost 3, commands cost 4, so a long task that
 * mostly reads files never hits the wall while a heavy build/test cycle does. */
export const AgentBudgetSchema = z.object({
  /** Weighted action cost budget for the whole run (default 240). */
  total: z.number().int().min(1).max(10_000).optional(),
  /** Absolute safety cap on provider turns (loop guard, default 80). */
  hardTurns: z.number().int().min(1).max(1000).optional(),
  /** Stop the run when the exact same action repeats this many times in a row
   * without any file change in between (loop detection, default 4). */
  stallRepeats: z.number().int().min(2).max(50).optional(),
  /** Fraction of the budget used before nudging the agent to wrap up
   * (default 0.25, i.e. warn at 75% consumed). */
  warnAtFraction: z.number().min(0.05).max(0.9).optional(),
});
export type AgentBudget = z.infer<typeof AgentBudgetSchema>;

/** Serializable state of an interrupted run, kept so the user can continue the
 * exact same task instead of starting over. */
export const WorkAgentCheckpointSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(100),
  changedFiles: z.array(z.string()).default([]),
});
export type WorkAgentCheckpoint = z.infer<typeof WorkAgentCheckpointSchema>;

const WorkMemberFieldsSchema = {
  memberId: z.string().optional(),
  memberName: z.string().optional(),
};

export const WorkAgentBudgetProgressSchema = z.object({
  used: z.number().int().min(0),
  total: z.number().int().min(1),
  turns: z.number().int().min(0),
  hardTurns: z.number().int().min(1),
  actions: z.number().int().min(0),
  filesChanged: z.number().int().min(0),
  testsRun: z.number().int().min(0),
  status: z.enum(["active", "low", "exhausted", "stalled"]),
});
export type WorkAgentBudgetProgress = z.infer<typeof WorkAgentBudgetProgressSchema>;

export const WorkAgentEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("agent.plan"), steps: z.array(AgentStepSchema) }),
  z.object({ type: z.literal("agent.step"), step: AgentStepSchema }),
  z.object({ type: z.literal("agent.team.plan"), members: z.array(WorkTeamMemberSchema).min(1).max(5) }),
  z.object({ type: z.literal("agent.member.started"), member: WorkTeamMemberSchema }),
  z.object({ type: z.literal("agent.delta"), delta: z.string(), ...WorkMemberFieldsSchema }),
  z.object({ type: z.literal("agent.reasoning"), delta: z.string(), ...WorkMemberFieldsSchema }),
  z.object({ type: z.literal("agent.progress"), progress: WorkAgentBudgetProgressSchema, ...WorkMemberFieldsSchema }),
  z.object({ type: z.literal("agent.budget.low"), used: z.number().int(), total: z.number().int(), message: z.string(), ...WorkMemberFieldsSchema }),
  z.object({ type: z.literal("agent.budget.exhausted"), used: z.number().int(), total: z.number().int(), reason: z.string(), checkpoint: WorkAgentCheckpointSchema, ...WorkMemberFieldsSchema }),
  z.object({ type: z.literal("agent.stalled"), reason: z.string(), action: z.string().optional(), ...WorkMemberFieldsSchema }),
  z.object({ type: z.literal("agent.tool.started"), tool: z.string(), label: z.string().optional(), filePath: z.string().optional(), query: z.string().optional(), command: z.string().optional(), action: z.enum(["read", "write", "edit", "create", "delete", "move", "rename", "search", "run", "list"]).optional(), ...WorkMemberFieldsSchema }),
  z.object({ type: z.literal("agent.tool.completed"), tool: z.string(), summary: z.string().optional(), filePath: z.string().optional(), query: z.string().optional(), command: z.string().optional(), action: z.enum(["read", "write", "edit", "create", "delete", "move", "rename", "search", "run", "list"]).optional(), ok: z.boolean().optional(), ...WorkMemberFieldsSchema }),
  z.object({ type: z.literal("agent.tool.failed"), tool: z.string(), message: z.string().optional(), filePath: z.string().optional(), query: z.string().optional(), command: z.string().optional(), action: z.enum(["read", "write", "edit", "create", "delete", "move", "rename", "search", "run", "list"]).optional(), ...WorkMemberFieldsSchema }),
  z.object({ type: z.literal("agent.approval.required"), approvalId: z.string(), action: WorkToolActionSchema, reason: z.string().optional(), ...WorkMemberFieldsSchema }),
  z.object({ type: z.literal("agent.approval.resolved"), approvalId: z.string(), approved: z.boolean(), ...WorkMemberFieldsSchema }),
  z.object({ type: z.literal("agent.file.change"), relativePath: z.string(), patch: PatchSchema.optional(), ...WorkMemberFieldsSchema }),
  z.object({ type: z.literal("agent.completed"), message: z.string(), steps: z.array(AgentStepSchema).default([]), ...WorkMemberFieldsSchema }),
  z.object({ type: z.literal("agent.error"), error: ApiErrorSchema, ...WorkMemberFieldsSchema }),
]);
export type WorkAgentEvent = z.infer<typeof WorkAgentEventSchema>;

export const WorkAgentRequestSchema = z.object({
  workspaceId: z.string().min(1),
  model: z.string().min(1).max(200),
  provider: ProviderConfigSchema,
  messages: z.array(ChatMessageSchema).min(1).max(100),
  instructions: z.string().max(20_000).optional(),
  /** Deprecated legacy limit; superseded by `budget`. When only this is set it
   * is converted into an equivalent action budget (16 per turn). */
  maxTurns: z.number().int().min(1).max(40).optional(),
  budget: AgentBudgetSchema.optional(),
  /** State of a previous interrupted run to resume from instead of the prompt. */
  resume: WorkAgentCheckpointSchema.optional(),
  team: WorkTeamConfigSchema.optional(),
});
export type WorkAgentRequest = z.infer<typeof WorkAgentRequestSchema>;

// ======== WORK MODE: Sessions (server-persisted chat history) ========
export const WorkSessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string().default("active"),
  workspaceId: z.string().nullable().optional(),
  providerId: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  messages: z.unknown().nullable().optional(),
  project: z
    .object({ id: z.string(), name: z.string(), color: z.string() })
    .nullable()
    .optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type WorkSession = z.infer<typeof WorkSessionSchema>;

export const WorkSessionCreateInputSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  workspaceId: z.string().max(500).nullable().optional(),
  providerId: z.string().nullable().optional(),
  model: z.string().max(200).nullable().optional(),
  projectId: z.string().nullable().optional(),
  messages: z.unknown().optional(),
});
export type WorkSessionCreateInput = z.infer<typeof WorkSessionCreateInputSchema>;

export const WorkSessionPatchInputSchema = WorkSessionCreateInputSchema.extend({
  status: z.enum(["active", "archived"]).optional(),
});
export type WorkSessionPatchInput = z.infer<typeof WorkSessionPatchInputSchema>;
