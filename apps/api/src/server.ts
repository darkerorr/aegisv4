import "./config/environment.js";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { setDefaultResultOrder } from "node:dns";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prismaClientPackage, { Prisma, type Provider, type User } from "@prisma/client";
import { defaultProviders, getRuntimeConfig } from "@aegis/config";
import {
  chatWithProvider,
  createProvider,
  diagnoseProvider,
  isTransientProviderError,
  listProviderModels,
  ProviderError,
  providerRateLimitCategory,
  providerRetryAfter,
  testProvider,
  toApiError,
  transientBackoff,
} from "@aegis/providers";
import type { ChatMessage, ChatRequest, ProviderConfig } from "@aegis/types";
import { ChatRequestSchema, ProviderConfigSchema, ProviderCreateSchema } from "@aegis/types";
import { z } from "zod";
import { classifyIntent, deriveSearchQuery } from "@aegis/agent-runtime";

// Resolve AAAA (IPv6) addresses after A (IPv4). undici performs no Happy Eyeballs
// and would otherwise sit on a dead IPv6 path until the connect timeout fires.
setDefaultResultOrder("ipv4first");

const CHAT_CORE_GUARD = `You are Aegis, the user's personal AI assistant.
CORE BEHAVIOR — Give the user what they want. Answer directly, confidently and in their language. State the answer first, then the reasoning; do not hedge with "I think", "maybe", "je pense" or "peut-être" when you know the answer, and never answer with questions you could answer yourself — if a detail is genuinely unknown, say so plainly and give the concrete next step to find it. When web search results are present above, combine them with your own knowledge so the answer is complete and current.
MEDIA & LINKS — When you mention a film, series, video, song, artist, place, product, famous person, website or event, include 1-2 relevant, real links formatted as markdown (trailer, official page, Wikipedia, streaming or store link) so the user can go straight there. Only include URLs you are confident actually exist — never invent one.
MEMORY — The whole conversation above is your memory: reuse what the user told you earlier, reference it naturally when relevant, and never repeat what is already established.`;
import {
  Generation,
  activeGenerationCount,
  getGeneration,
  getGenerationByRequestId,
  registerGeneration,
  type WebSearchResultView,
} from "./generations.js";
import { hashPassword, verifyPassword } from "./auth.js";
import { getLatestGmailMessageForAgent, handleIntegrationRoute } from "./integrations/routes.js";
import { handleWebSearchRoute } from "./integrations/web-search.js";
import {
  exchangeGoogleCode,
  fetchGoogleUserInfo,
  getGoogleOAuthConfig,
  googleNotConfigured,
} from "./integrations/google.js";
import { reportGoogleConfiguration } from "./integrations/google.js";
import {
  decryptProviderSecret,
  encryptProviderSecret,
  ProviderSecretError,
} from "./provider-secrets.js";
import {
  connectLocalAgent,
  localAgentFetch,
  localAgentJson,
  localAgentStatusLayer,
  LocalAgentUnavailableError,
  setLocalAgentToken,
} from "./work.js";
import { installCrashLogger, processMemorySample } from "@aegis/supervisor";

const { PrismaClient } = prismaClientPackage;
export const prisma = new PrismaClient();
const config = getRuntimeConfig();
reportGoogleConfiguration();

// Brute-force protection
const attempts = new Map<string, { count: number; resetAt: number }>();

// Validation schemas
const authSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(200),
});
const registerSchema = authSchema.extend({
  displayName: z.string().trim().min(1).max(80).optional(),
});
const tokenSchema = z.object({ token: z.string().min(20) });
const providerPatchSchema = z.object({
  kind: z.string().min(1).max(80).optional(),
  type: z.string().min(1).max(80).optional(),
  name: z.string().min(1).max(120).optional(),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().min(1).nullable().optional(),
  defaultModel: z.string().min(1).max(200).nullable().optional(),
  active: z.boolean().optional(),
  enabled: z.boolean().optional(),
  options: z.record(z.unknown()).optional(),
});
const conversationSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  providerId: z.string().min(1),
  model: z.string().min(1).max(200),
  idempotencyKey: z.string().min(1).max(100).optional(),
});
const conversationPatchSchema = z.object({ title: z.string().trim().min(1).max(200).optional() });
const projectSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional(),
  color: z.string().max(30).optional(),
  defaultModel: z.string().max(200).optional(),
  instructions: z.string().max(20_000).optional(),
  githubRepository: z.string().max(300).optional(),
});
const accountSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  preferences: z.record(z.unknown()).optional(),
});
const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1).optional(),
    newPassword: z.string().min(8).max(200).optional(),
    confirmPassword: z.string().min(8).max(200).optional(),
    password: z.string().min(8).max(200).optional(),
  })
  .superRefine((input, ctx) => {
    const next = input.newPassword || input.password;
    if (!next)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPassword"],
        message: "A new password is required.",
      });
    if (input.newPassword && input.confirmPassword !== input.newPassword)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      });
  });
const cloudConnectSchema = z.object({
  apiKey: z.string().trim().min(1).max(500),
  displayName: z.string().trim().min(1).max(120).optional(),
  baseUrl: z.string().url().optional(),
  timeoutMs: z.number().int().min(1_000).max(60_000).optional(),
});

// Helpers
function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
function createToken(): string {
  return randomBytes(32).toString("base64url");
}
async function withToolTimeout<T>(
  toolId: string,
  _timeoutMs: number,
  operation: () => Promise<T>,
): Promise<T> {
  return operation();
}

// Response helpers
function json(
  res: http.ServerResponse,
  status: number,
  body: unknown,
  extra: Record<string, string> = {},
): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...extra });
  res.end(JSON.stringify(body));
}
function apiError(
  res: http.ServerResponse,
  status: number,
  code: string,
  message: string,
  details?: unknown,
  requestId?: string,
): void {
  json(res, status, {
    code,
    message,
    details: details ?? null,
    ...(requestId ? { requestId } : {}),
  });
}
function cookie(name: string, value: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${name}=${value}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
function parseCookies(request: http.IncomingMessage): Record<string, string> {
  return Object.fromEntries(
    (request.headers.cookie || "")
      .split(";")
      .filter(Boolean)
      .map((part) => {
        const [key, ...value] = part.trim().split("=");
        return [key, value.join("=")];
      }),
  );
}
async function body(request: http.IncomingMessage, maxBytes = 1_000_000): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const value = Buffer.from(chunk);
    total += value.length;
    if (total > maxBytes)
      throw new RequestBodyError("PAYLOAD_TOO_LARGE", "The request body is too large.", 413);
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}
class RequestBodyError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
const attachmentRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.data/attachments",
);
const MAX_ATTACHMENT_BYTES = (Number(process.env.ATTACHMENT_MAX_SIZE_MB) || 10) * 1024 * 1024;
const attachmentInput = z.object({
  name: z.string().trim().min(1).max(180),
  mimeType: z.string().min(1).max(120),
  size: z.number().int().min(1).max(MAX_ATTACHMENT_BYTES),
  dataBase64: z.string().min(1),
});
const allowedAttachmentTypes = new Set([
  "text/plain",
  "text/markdown",
  "application/json",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/typescript",
  "text/javascript",
  "text/x-python",
  "text/css",
  "text/html",
]);
function attachmentView(value: {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  status: string;
  createdAt: Date;
}) {
  return {
    id: value.id,
    name: value.name,
    mimeType: value.mimeType,
    size: value.size,
    status: value.status,
    createdAt: value.createdAt.toISOString(),
  };
}
function clientKey(request: http.IncomingMessage): string {
  return request.socket.remoteAddress || "unknown";
}
function allowAttempt(request: http.IncomingMessage): boolean {
  const now = Date.now();
  const key = clientKey(request);
  const current = attempts.get(key);
  if (!current || current.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  // The limiter is per remote address. Keep enough headroom for a normal setup
  // flow (register, verify, reconnect providers) while still bounding bursts.
  if (current.count >= 30) return false;
  current.count += 1;
  return true;
}
function publicUser(
  user: Pick<User, "id" | "email" | "displayName" | "emailVerifiedAt"> &
    Partial<Pick<User, "preferencesJson">>,
) {
  let preferences: Record<string, unknown> = {};
  try {
    preferences = user.preferencesJson
      ? (JSON.parse(user.preferencesJson) as Record<string, unknown>)
      : {};
  } catch {
    /* ignore */
  }
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    emailVerified: Boolean(user.emailVerifiedAt),
    preferences,
  };
}
function providerView(provider: Provider) {
  let options: Record<string, unknown> = {};
  try {
    options = provider.optionsJson
      ? (JSON.parse(provider.optionsJson) as Record<string, unknown>)
      : {};
  } catch {
    /* ignore */
  }
  const apiKey = decryptProviderSecret(provider.apiKey);
  return {
    id: provider.id,
    providerKey: canonicalProviderKey(provider.providerKey),
    kind: provider.kind,
    type: provider.kind,
    name: provider.name,
    baseUrl: provider.baseUrl,
    defaultModel: provider.defaultModel,
    active: provider.active,
    enabled: provider.active,
    options,
    hasApiKey: Boolean(apiKey),
    secretConfigured: Boolean(apiKey),
  };
}
function providerConfig(provider: Provider): ProviderConfig {
  const envKeys: Record<string, string | undefined> = {
    "nvidia-nim": process.env.NVIDIA_NIM_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
    "x-ai": process.env.XAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    mistral: process.env.MISTRAL_API_KEY,
    groq: process.env.GROQ_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY,
    qwen: process.env.QWEN_API_KEY,
    meta: process.env.META_LLAMA_API_KEY,
    together: process.env.TOGETHER_API_KEY,
    fireworks: process.env.FIREWORKS_API_KEY,
    perplexity: process.env.PERPLEXITY_API_KEY,
    sambanova: process.env.SAMBANOVA_API_KEY,
    hyperbolic: process.env.HYPERBOLIC_API_KEY,
    zhipu: process.env.ZHIPU_API_KEY,
    moonshot: process.env.MOONSHOT_API_KEY,
    minimax: process.env.MINIMAX_API_KEY,
    novita: process.env.NOVITA_API_KEY,
    huggingface: process.env.HUGGINGFACE_API_KEY ?? process.env.HF_TOKEN,
  };
  const envKey = envKeys[provider.providerKey];
  const baseUrl =
    provider.kind === "ollama" ? provider.baseUrl.replace(/\/v1\/?$/, "") : provider.baseUrl;
  const storedOptions = provider.optionsJson
    ? (JSON.parse(provider.optionsJson) as Record<string, unknown>)
    : {};
  const timeoutNumber = (name: string, fallback: number) => {
    const parsed = Number(process.env[name]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  return ProviderConfigSchema.parse({
    id: provider.id,
    kind: provider.kind,
    name: provider.name,
    baseUrl,
    apiKey: decryptProviderSecret(provider.apiKey) || envKey,
    active: provider.active,
    defaultModel: provider.defaultModel || undefined,
    options: {
      ...storedOptions,
      connectTimeoutMs:
        storedOptions.connectTimeoutMs ?? timeoutNumber("PROVIDER_CONNECT_TIMEOUT_MS", 30_000),
      firstTokenTimeoutMs:
        storedOptions.firstTokenTimeoutMs ??
        timeoutNumber("PROVIDER_FIRST_TOKEN_TIMEOUT_MS", 120_000),
      idleStreamTimeoutMs:
        storedOptions.idleStreamTimeoutMs ??
        timeoutNumber("PROVIDER_IDLE_STREAM_TIMEOUT_MS", 300_000),
      totalTimeoutMs:
        storedOptions.totalTimeoutMs ?? timeoutNumber("PROVIDER_TOTAL_TIMEOUT_MS", 1_800_000),
      toolTimeoutMs: storedOptions.toolTimeoutMs ?? timeoutNumber("TOOL_TIMEOUT_MS", 30_000),
    },
  });
}
function normalizeProviderKind(
  value: string,
):
  | "ollama"
  | "lmstudio"
  | "nvidia-nim"
  | "openrouter"
  | "openai-compatible"
  | "custom"
  | "x-ai"
  | "anthropic"
  | "gemini"
  | "openai"
  | "mistral"
  | "groq"
  | "deepseek"
  | "qwen"
  | "meta"
  | "together"
  | "fireworks"
  | "perplexity"
  | "sambanova"
  | "hyperbolic"
  | "zhipu"
  | "moonshot"
  | "minimax"
  | "novita"
  | "huggingface" {
  const normalized = value.toLowerCase();
  if (normalized === "nvidia-compatible" || normalized === "nvidia" || normalized === "nvidia-nim")
    return "nvidia-nim";
  if (normalized === "openrouter") return "openrouter";
  if (normalized === "x-ai" || normalized === "xai" || normalized === "grok") return "x-ai";
  if (normalized === "anthropic" || normalized === "claude") return "anthropic";
  if (normalized === "gemini" || normalized === "google" || normalized === "google-gemini")
    return "gemini";
  if (normalized === "mistral") return "mistral";
  if (normalized === "groq") return "groq";
  if (normalized === "deepseek") return "deepseek";
  if (normalized === "qwen") return "qwen";
  if (normalized === "meta" || normalized === "llama") return "meta";
  if (normalized === "together" || normalized === "together-ai") return "together";
  if (normalized === "fireworks" || normalized === "fireworks-ai") return "fireworks";
  if (normalized === "perplexity") return "perplexity";
  if (normalized === "sambanova" || normalized === "samba-nova") return "sambanova";
  if (normalized === "hyperbolic") return "hyperbolic";
  if (normalized === "zhipu" || normalized === "glm" || normalized === "bigmodel") return "zhipu";
  if (normalized === "moonshot" || normalized === "kimi") return "moonshot";
  if (normalized === "minimax") return "minimax";
  if (normalized === "novita" || normalized === "novita-ai") return "novita";
  if (
    normalized === "huggingface" ||
    normalized === "hugging-face" ||
    normalized === "hf"
  )
    return "huggingface";
  if (normalized === "ollama") return "ollama";
  if (normalized === "lmstudio" || normalized === "lm-studio") return "lmstudio";
  if (normalized === "openai-compatible" || normalized === "openai") return "openai-compatible";
  return "custom";
}
function canonicalProviderKey(
  value: string,
):
  | "nvidia-nim"
  | "openrouter"
  | "ollama"
  | "lm-studio"
  | "x-ai"
  | "anthropic"
  | "gemini"
  | "openai"
  | "mistral"
  | "groq"
  | "deepseek"
  | "qwen"
  | "meta"
  | "together"
  | "fireworks"
  | "perplexity"
  | "sambanova"
  | "hyperbolic"
  | "zhipu"
  | "moonshot"
  | "minimax"
  | "novita"
  | "huggingface"
  | string {
  const normalized = value.toLowerCase();
  if (["nvidia", "nvidia_nim", "nim", "nvidia-nim"].includes(normalized)) return "nvidia-nim";
  if (normalized === "openrouter") return "openrouter";
  if (normalized === "x-ai" || normalized === "xai" || normalized === "grok") return "x-ai";
  if (normalized === "anthropic" || normalized === "claude") return "anthropic";
  if (normalized === "gemini" || normalized === "google" || normalized === "google-gemini")
    return "gemini";
  if (normalized === "openai" || normalized === "gpt") return "openai";
  if (normalized === "mistral") return "mistral";
  if (normalized === "groq") return "groq";
  if (normalized === "deepseek") return "deepseek";
  if (normalized === "qwen" || normalized === "dashscope") return "qwen";
  if (normalized === "meta" || normalized === "llama" || normalized === "meta-llama") return "meta";
  if (normalized === "together" || normalized === "together-ai") return "together";
  if (normalized === "fireworks" || normalized === "fireworks-ai") return "fireworks";
  if (normalized === "perplexity") return "perplexity";
  if (normalized === "sambanova" || normalized === "samba-nova") return "sambanova";
  if (normalized === "hyperbolic") return "hyperbolic";
  if (normalized === "zhipu" || normalized === "glm" || normalized === "bigmodel") return "zhipu";
  if (normalized === "moonshot" || normalized === "kimi") return "moonshot";
  if (normalized === "minimax") return "minimax";
  if (normalized === "novita" || normalized === "novita-ai") return "novita";
  if (
    normalized === "huggingface" ||
    normalized === "hugging-face" ||
    normalized === "hf"
  )
    return "huggingface";
  if (normalized === "ollama") return "ollama";
  if (normalized === "lmstudio" || normalized === "lm_studio" || normalized === "lm-studio")
    return "lm-studio";
  return value;
}
function maskIp(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value.includes("."))
    return value
      .split(".")
      .map((part, index) => (index < 2 ? part : "*"))
      .join(".");
  return "*:*";
}
async function createSession(
  userId: string,
  request?: http.IncomingMessage,
): Promise<{ token: string; expiresAt: Date }> {
  const token = createToken();
  const expiresAt = new Date(Date.now() + config.sessionDays * 86_400_000);
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      deviceName: request?.headers["user-agent"]?.slice(0, 120) || "Aegis client",
      ipAddress: request?.socket.remoteAddress || null,
    },
  });
  return { token, expiresAt };
}
async function currentUser(
  request: http.IncomingMessage,
): Promise<{ user: User; sessionId: string } | null> {
  const token =
    parseCookies(request).aegis_session ||
    request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  prisma.session
    .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
    .catch(() => undefined);
  return { user: session.user, sessionId: session.id };
}
async function requireUser(
  request: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<{ user: User; sessionId: string } | null> {
  const result = await currentUser(request);
  if (!result) {
    apiError(res, 401, "AUTH_REQUIRED", "Authentication required.", null);
    return null;
  }
  return result;
}
function mailDev(kind: string, email: string, token: string): void {
  if (config.mailMode === "console")
    console.log(
      `[Aegis dev mail] ${kind} for ${email}: http://127.0.0.1:3000/${kind === "verify-email" ? "verify-email" : "reset-password"}?token=${token}`,
    );
}
function resolveProvider(providers: Provider[], id?: string): Provider | undefined {
  return id
    ? providers.find(
        (p) => p.id === id || canonicalProviderKey(p.providerKey) === canonicalProviderKey(id),
      )
    : providers.find((p) => p.active);
}
function modelCapabilities(name: string, type: string): string[] {
  const value = name.toLowerCase();
  const capabilities = new Set<string>([type === "code" ? "coding" : "chat"]);
  if (/vision|vl|gemini|claude-3|gpt-4o/.test(value)) capabilities.add("vision");
  if (/reason|deepseek-r1|o1|o3/.test(value)) capabilities.add("reasoning");
  if (/tool|instruct|qwen|llama|gpt|mistral|claude/.test(value)) capabilities.add("tools");
  return [...capabilities];
}
function parseModelMetadata(value: string | null): Record<string, unknown> {
  try {
    return value ? (JSON.parse(value) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
function modelView(model: {
  id: string;
  modelName: string;
  type: string;
  active: boolean;
  contextLength: number | null;
  metadataJson: string | null;
  providerId: string;
  provider: Provider;
}) {
  const options = parseModelMetadata(model.provider.optionsJson);
  const preferences =
    options.modelPreferences && typeof options.modelPreferences === "object"
      ? (options.modelPreferences as Record<string, unknown>)
      : {};
  const favorite = preferences[model.modelName] === "favorite";
  const metadata = parseModelMetadata(model.metadataJson);
  return {
    id: model.modelName,
    providerId: model.providerId,
    providerName: model.provider.name,
    providerKind: model.provider.kind,
    name: model.modelName,
    type: model.type,
    active: model.active,
    favorite,
    visible: model.active,
    available: model.active,
    local: model.provider.kind === "ollama" || model.provider.kind === "lmstudio",
    contextLength: model.contextLength ?? undefined,
    family: typeof metadata.family === "string" ? metadata.family : undefined,
    capabilities: Array.isArray(metadata.capabilities)
      ? metadata.capabilities
      : modelCapabilities(model.modelName, model.type),
    pricing:
      metadata.pricing && typeof metadata.pricing === "object" ? metadata.pricing : undefined,
    modalities:
      metadata.modalities && typeof metadata.modalities === "object"
        ? metadata.modalities
        : undefined,
    metadata,
  };
}
async function upsertDiscoveredModels(
  provider: Provider,
  models: Awaited<ReturnType<typeof listProviderModels>>,
): Promise<void> {
  // Cloud catalogues (NVIDIA NIM, OpenRouter) return the public catalogue rather
  // than the account-filtered set, so only the models the API actually returned
  // are considered available. Models that disappeared from a refreshed cloud
  // list are retired/inaccessible for this account and must stop being offered.
  // Local runtimes only list currently-loaded models, so keep their records as-is.
  const cloudProvider =
    provider.kind === "nvidia-nim" ||
    provider.kind === "openrouter" ||
    provider.kind === "x-ai" ||
    provider.kind === "anthropic" ||
    provider.kind === "gemini" ||
    provider.kind === "openai" ||
    provider.kind === "mistral" ||
    provider.kind === "groq" ||
    provider.kind === "deepseek" ||
    provider.kind === "qwen" ||
    provider.kind === "meta" ||
    provider.kind === "together" ||
    provider.kind === "fireworks" ||
    provider.kind === "perplexity" ||
    provider.kind === "sambanova" ||
    provider.kind === "hyperbolic" ||
    provider.kind === "zhipu" ||
    provider.kind === "moonshot" ||
    provider.kind === "minimax" ||
    provider.kind === "novita" ||
    provider.kind === "huggingface" ||
    provider.kind === "openai-compatible" ||
    provider.kind === "custom";
  const returned = new Set(models.map((model) => model.name));
  if (cloudProvider && models.length > 0) {
    await prisma.model.updateMany({
      where: { providerId: provider.id, modelName: { notIn: [...returned] } },
      data: { active: false },
    });
  }
  for (const model of models) {
    await prisma.model.upsert({
      where: { providerId_modelName: { providerId: provider.id, modelName: model.name } },
      update: {
        active: true,
        type: model.type,
        contextLength: model.contextLength,
        metadataJson: JSON.stringify({
          ...(model.metadata ?? {}),
          capabilities: modelCapabilities(model.name, model.type),
        }),
      },
      create: {
        providerId: provider.id,
        modelName: model.name,
        type: model.type,
        active: true,
        contextLength: model.contextLength,
        metadataJson: JSON.stringify({
          ...(model.metadata ?? {}),
          capabilities: modelCapabilities(model.name, model.type),
        }),
      },
    });
  }
}

type CloudProviderId =
  | "nvidia-nim"
  | "openrouter"
  | "x-ai"
  | "anthropic"
  | "gemini"
  | "openai"
  | "mistral"
  | "groq"
  | "deepseek"
  | "qwen"
  | "meta"
  | "together"
  | "fireworks"
  | "perplexity"
  | "sambanova"
  | "hyperbolic"
  | "zhipu"
  | "moonshot"
  | "minimax"
  | "novita"
  | "huggingface";
const cloudProviderSettings: Record<CloudProviderId, { name: string; baseUrl: string }> = {
  "nvidia-nim": { name: "NVIDIA NIM", baseUrl: "https://integrate.api.nvidia.com/v1" },
  openrouter: { name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" },
  "x-ai": { name: "xAI", baseUrl: "https://api.x.ai/v1" },
  anthropic: { name: "Anthropic", baseUrl: "https://api.anthropic.com/v1" },
  gemini: {
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  },
  openai: { name: "OpenAI", baseUrl: "https://api.openai.com/v1" },
  mistral: { name: "Mistral", baseUrl: "https://api.mistral.ai/v1" },
  groq: { name: "Groq", baseUrl: "https://api.groq.com/openai/v1" },
  deepseek: { name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1" },
  qwen: { name: "Qwen", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  meta: { name: "Meta Llama", baseUrl: "https://api.llama.com/compat/v1" },
  together: { name: "Together AI", baseUrl: "https://api.together.xyz/v1" },
  fireworks: { name: "Fireworks AI", baseUrl: "https://api.fireworks.ai/inference/v1" },
  perplexity: { name: "Perplexity", baseUrl: "https://api.perplexity.ai" },
  sambanova: { name: "SambaNova", baseUrl: "https://api.sambanova.ai/v1" },
  hyperbolic: { name: "Hyperbolic", baseUrl: "https://api.hyperbolic.xyz/v1" },
  zhipu: { name: "Zhipu AI", baseUrl: "https://open.bigmodel.cn/api/paas/v4" },
  moonshot: { name: "Moonshot AI", baseUrl: "https://api.moonshot.cn/v1" },
  minimax: { name: "MiniMax", baseUrl: "https://api.minimax.chat/v1" },
  novita: { name: "Novita AI", baseUrl: "https://api.novita.ai/v3/openai" },
  huggingface: {
    name: "Hugging Face",
    baseUrl: "https://router.huggingface.co/v1",
  },
};

async function testCloudCredential(
  testConfig: ProviderConfig,
): Promise<Awaited<ReturnType<typeof testProvider>>> {
  // xAI (and some other vendors) propagate freshly created API keys across
  // clusters with a short delay; a key that fails once often succeeds moments
  // later. Retry the probe a few times before surfacing an auth failure.
  const attempts = 3;
  let lastHealth: Awaited<ReturnType<typeof testProvider>> | undefined;
  for (let attempt = 0; attempt < attempts; attempt++) {
    lastHealth = await testProvider(testConfig);
    if (lastHealth.ok) return lastHealth;
    if (attempt < attempts - 1)
      await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 1_000 : 2_000));
  }
  return lastHealth!;
}

async function connectCloudProvider(
  userId: string,
  providerId: CloudProviderId,
  input: { apiKey: string; displayName?: string; baseUrl?: string; timeoutMs?: number },
) {
  const settings = cloudProviderSettings[providerId];
  const name = input.displayName || settings.name;
  const baseUrl = input.baseUrl || settings.baseUrl;
  const options = input.timeoutMs ? { timeoutMs: input.timeoutMs } : undefined;
  const testConfig = ProviderConfigSchema.parse({
    id: "credential-test",
    kind: providerId,
    name,
    baseUrl,
    apiKey: input.apiKey,
    options,
  });
  const health = await testCloudCredential(testConfig);
  if (!health.ok) {
    const reason = health.message ?? "The key was not accepted.";
    throw new ProviderError(
      "PROVIDER_AUTH_FAILED",
      `The ${settings.name} API key was rejected. ${reason}`,
      401,
      { provider: settings.name, reason },
    );
  }
  const models = await listProviderModels(testConfig);
  if (!models.length)
    throw new ProviderError(
      "NO_MODELS_AVAILABLE",
      `No compatible ${settings.name} models were found.`,
      422,
    );
  const accessibleNames = new Set(models.map((model) => model.name));
  const defaultModel = models[0]?.name;
  const encrypted = encryptProviderSecret(input.apiKey);
  const saved = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.provider.findFirst({
      where: { userId, providerKey: providerId },
    });
    const keptDefault =
      existing?.defaultModel && accessibleNames.has(existing.defaultModel)
        ? existing.defaultModel
        : undefined;
    const provider = existing
      ? await transaction.provider.update({
          where: { id: existing.id },
          data: {
            apiKey: encrypted,
            name,
            baseUrl,
            kind: providerId,
            optionsJson: options ? JSON.stringify(options) : existing.optionsJson,
            active: true,
            defaultModel: keptDefault || defaultModel,
          },
        })
      : await transaction.provider.create({
          data: {
            userId,
            providerKey: providerId,
            kind: providerId,
            name,
            baseUrl,
            apiKey: encrypted,
            optionsJson: options ? JSON.stringify(options) : undefined,
            active: true,
            defaultModel,
          },
        });
    for (const model of models) {
      await transaction.model.upsert({
        where: { providerId_modelName: { providerId: provider.id, modelName: model.name } },
        update: {
          active: true,
          type: model.type,
          contextLength: model.contextLength,
          metadataJson: JSON.stringify({
            ...(model.metadata ?? {}),
            capabilities: modelCapabilities(model.name, model.type),
          }),
        },
        create: {
          providerId: provider.id,
          modelName: model.name,
          type: model.type,
          active: true,
          contextLength: model.contextLength,
          metadataJson: JSON.stringify({
            ...(model.metadata ?? {}),
            capabilities: modelCapabilities(model.name, model.type),
          }),
        },
      });
    }
    if (models.length > 0) {
      await transaction.model.updateMany({
        where: { providerId: provider.id, modelName: { notIn: models.map((model) => model.name) } },
        data: { active: false },
      });
    }
    return provider;
  });
  return {
    connection: {
      id: saved.id,
      provider: providerId,
      status: "connected" as const,
      enabled: true,
      secretConfigured: true,
    },
    modelsDiscovered: models.length,
    defaultModelId: saved.defaultModel || defaultModel,
    health: { ok: true, latencyMs: health.latencyMs },
  };
}
async function listModelsForUser(userId: string, refresh = true) {
  const providers = await prisma.provider.findMany({
    where: { userId },
    include: { models: true },
  });
  if (refresh) {
    await Promise.all(
      providers
        .filter((p) => p.active)
        .map(async (provider) => {
          try {
            await upsertDiscoveredModels(
              provider,
              await listProviderModels(providerConfig(provider)),
            );
          } catch {
            /* cached */
          }
        }),
    );
  }
  const cached = await prisma.model.findMany({
    where: { provider: { userId } },
    include: { provider: true },
    orderBy: { modelName: "asc" },
  });
  return cached
    .map((model) => ({ ...modelView(model), available: model.active && model.provider.active }))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));
}
const sseGuarded = new WeakSet<http.ServerResponse>();
function guardRes(res: http.ServerResponse): void {
  if (sseGuarded.has(res)) return;
  sseGuarded.add(res);
  // An unhandled 'error' event on the response stream (e.g. the browser
  // refreshed mid-stream and the socket is gone) would crash the whole API.
  res.on("error", () => {});
}
function sse(res: http.ServerResponse, eventName: string, data: unknown): void {
  guardRes(res);
  if (res.destroyed || res.writableEnded) return;
  try {
    res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    // the client left; the stream is already guarded by the 'error' listener
  }
}

// Streaming generations live in the in-process registry (see generations.ts) so
// they survive a browser disconnect and can be resumed after a page refresh.
// `streamControllers` is kept as a lightweight alias for older callers.
const streamControllers = new Map<string, AbortController>();

// ======== Provider request management ========
// A naive client (several open tabs, send-while-streaming, auto-resume) can
// stack many concurrent generations against the same provider account and burn
// its rate limits. Cap in-flight streams per provider id.
const MAX_PROVIDER_STREAMS = 2;
const providerStreamsActive = new Map<string, number>();
const providerStreamWaiters = new Map<string, Array<() => boolean>>();

function acquireProviderSlot(providerId: string, signal?: AbortSignal): Promise<() => void> {
  return new Promise((resolve, reject) => {
    const tryAcquire = (): boolean => {
      const active = providerStreamsActive.get(providerId) ?? 0;
      if (active >= MAX_PROVIDER_STREAMS) return false;
      providerStreamsActive.set(providerId, active + 1);
      const release = () => {
        const now = providerStreamsActive.get(providerId) ?? 1;
        if (now <= 1) providerStreamsActive.delete(providerId);
        else providerStreamsActive.set(providerId, now - 1);
        const waiters = providerStreamWaiters.get(providerId);
        waiters?.shift()?.();
      };
      resolve(release);
      return true;
    };
    if (tryAcquire()) return;
    const waiters = providerStreamWaiters.get(providerId) ?? [];
    waiters.push(tryAcquire);
    providerStreamWaiters.set(providerId, waiters);
    const onAbort = () => {
      signal?.removeEventListener("abort", onAbort);
      const pending = providerStreamWaiters.get(providerId) ?? [];
      const index = pending.indexOf(tryAcquire);
      if (index >= 0) pending.splice(index, 1);
      if (!pending.length) providerStreamWaiters.delete(providerId);
      reject(signal?.reason ?? new Error("Provider slot wait aborted."));
    };
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

const CLOUD_MODEL_GUARD_KINDS = new Set([
  "nvidia-nim", "openrouter", "x-ai", "anthropic", "gemini", "openai", "mistral",
  "groq", "deepseek", "qwen", "meta", "together", "fireworks", "perplexity",
  "sambanova", "hyperbolic", "zhipu", "moonshot", "minimax", "novita", "huggingface",
]);

/** Result of resolving the model the user asked for against the real providers. */
type ModelResolution = {
  provider: Provider;
  model: string;
  notice?: { kind: "rate-limited" | "model-unavailable" | "info"; message: string; providerId: string; model: string };
};

/**
 * Verifies the requested model really belongs to the resolved provider before
 * any request is sent (never send a foreign model to api.mistral.ai). When the
 * model belongs to another enabled provider of this user, the request is
 * automatically re-routed there; otherwise it falls back to the provider's
 * default model with a clear notice. Local/custom runtimes are not guarded:
 * their endpoints decide what they accept.
 */
async function resolveChatModel(
  providers: Provider[],
  requested: Provider | undefined,
  model: string,
): Promise<ModelResolution | null> {
  if (!requested) return null;
  const guarded = CLOUD_MODEL_GUARD_KINDS.has(requested.kind);
  const activeModels = new Map<string, string[]>();
  if (guarded) {
    const rows = await prisma.model.findMany({
      where: { provider: { userId: requested.userId } },
    });
    for (const row of rows) {
      if (!row.active) continue;
      const list = activeModels.get(row.providerId) ?? [];
      list.push(row.modelName);
      activeModels.set(row.providerId, list);
    }
    const mine = activeModels.get(requested.id) ?? [];
    const isKnown =
      mine.includes(model) ||
      (requested.defaultModel === model && mine.length > 0);
    if (isKnown || mine.length === 0) {
      return {
        provider: requested,
        model,
        notice:
          mine.length === 0
            ? {
                kind: "info" as const,
                message: `La liste des modèles de ${requested.name} n'a pas encore été synchronisée. Le modèle « ${model} » est envoyé sans vérification.`,
                providerId: requested.id,
                model,
              }
            : undefined,
      };
    }
    const owner = providers.find(
      (candidate) =>
        candidate.id !== requested.id &&
        candidate.active &&
        (activeModels.get(candidate.id) ?? []).includes(model),
    );
    if (owner) {
      return {
        provider: owner,
        model,
        notice: {
          kind: "model-unavailable" as const,
          message: `« ${model} » appartient à ${owner.name} : la conversation bascule automatiquement sur ce provider.`,
          providerId: owner.id,
          model,
        },
      };
    }
    const fallback = requested.defaultModel || mine[0];
    if (fallback) {
      return {
        provider: requested,
        model: fallback,
        notice: {
          kind: "model-unavailable" as const,
          message: `Le modèle « ${model} » n'est pas disponible sur ${requested.name}. Bascule sur « ${fallback} ».`,
          providerId: requested.id,
          model: fallback,
        },
      };
    }
    return null;
  }
  return { provider: requested, model };
}

/** The provider's own safe fallback model (default, then first active). */
async function safeFallbackModel(provider: Provider): Promise<string | undefined> {
  if (provider.defaultModel) return provider.defaultModel;
  const first = await prisma.model.findFirst({
    where: { providerId: provider.id, active: true },
    orderBy: { modelName: "asc" },
  });
  return first?.modelName ?? undefined;
}

/** Builds an actionable, user-facing error for a failed provider request. */
function actionableProviderFailure(
  failure: { code: string; message: string; details?: unknown },
  provider: Provider,
  model: string,
): { code: string; message: string; details?: unknown } {
  const details = (typeof failure.details === "object" && failure.details
    ? failure.details
    : {}) as Record<string, unknown>;
  const status = typeof details.status === "number" ? details.status : undefined;
  const retryAfter = typeof details.retryAfter === "number" ? details.retryAfter : undefined;
  const providerCode = typeof details.providerCode === "string" ? details.providerCode : undefined;
  const errorType = typeof details.errorType === "string" ? details.errorType : undefined;
  const enriched: Record<string, unknown> = {
    ...details,
    providerId: provider.id,
    providerName: provider.name,
    model,
  };
  let message = failure.message;
  if (failure.code === "PROVIDER_RATE_LIMITED") {
    const category = providerRateLimitCategory(failure);
    const wait = retryAfter ? ` Nouvelle tentative conseillée dans ${retryAfter}s.` : "";
    message =
      category === "model"
        ? `Le modèle « ${model} » est actuellement limité par ${provider.name} (HTTP ${status ?? 429}${providerCode ? `, code ${providerCode}` : ""}). Choisissez un autre modèle de la liste, ou réessayez dans quelques minutes.${wait}`
        : `${provider.name} a renvoyé une limite de débit (HTTP ${status ?? 429}${providerCode ? `, code ${providerCode}` : ""}). Réessayez dans quelques instants, ou vérifiez le quota dans la console ${provider.name}.${wait}`;
  } else if (failure.code === "PROVIDER_MODEL_NOT_FOUND" || failure.code === "PROVIDER_MODEL_UNAVAILABLE") {
    message = `Le modèle « ${model} » n'est pas disponible sur ${provider.name} (HTTP ${status ?? 404}${errorType ? `, ${errorType}` : ""}). Choisissez un modèle de la liste (sélecteur de modèle dans le composeur).`;
  } else if (failure.code === "PROVIDER_AUTH_FAILED") {
    message = `La clé API ${provider.name} a été rejetée (HTTP ${status ?? 401}${errorType ? `, ${errorType}` : ""}). Elle est peut-être expirée — mettez-la à jour dans Paramètres → API.`;
  }
  return { code: failure.code, message, details: enriched };
}

async function handleStream(
  request: http.IncomingMessage,
  res: http.ServerResponse,
  requestId: string,
): Promise<void> {
  const generationId = `gen_${randomUUID()}`;
  const startedAt = Date.now();
  const mark = (area: "Chat" | "Agent" | "Provider", stage: string, details = "") => {
    const elapsed = Date.now() - startedAt;
    console.log(
      `[${requestId}] [${area}] ${stage}: ${elapsed} ms${details ? ` · ${details}` : ""} · generation=${generationId}`,
    );
  };
  mark("Chat", "Request received");
  const auth = await requireUser(request, res);
  if (!auth) return;
  const input = ChatRequestSchema.parse(await body(request));
  const providers = await prisma.provider.findMany({ where: { userId: auth.user.id } });
  mark("Chat", "Providers loaded");
  const intent = classifyIntent({
    text: input.messages.at(-1)?.content ?? "",
    attachmentIds: input.attachmentIds,
    explicitlyEnabledTools: input.toolMode === "manual" ? input.enabledTools : undefined,
  });
  mark(
    "Agent",
    "Intent classified",
    `kind=${intent.kind} confidence=${intent.confidence.toFixed(2)}`,
  );
  // --- Auto web research: when auto mode and the prompt is not a trivial greeting or a
  // personal-integration request, always pull current public info from the web so the model
  // combines search results with its own knowledge.
  const lastUserText = input.messages.at(-1)?.content ?? "";
  const isTrivialPrompt =
    /^(bonjour|bonsoir|salut|hello|hi|hey|yo|coucou|ok|okay|merci|thanks?|thank you|oui|non|yes|no)[\s!.]*$/i.test(
      lastUserText.trim(),
    );
  const personalIntents = new Set<string>(["gmail", "github", "calendar", "drive"]);
  const autoWebSearch =
    input.toolMode === "auto" && !isTrivialPrompt && !personalIntents.has(intent.kind);
  if (autoWebSearch && !intent.tools.includes("web.search")) intent.tools.push("web.search");
  const explicitWebSearch = input.enabledTools.includes("web.search");
  const requestedProvider = resolveProvider(providers, input.providerId);
  if (!requestedProvider) {
    apiError(
      res,
      400,
      "PROVIDER_NOT_CONFIGURED",
      "No provider configured for this request.",
      null,
      requestId,
    );
    return;
  }
  // Model guard: verify the requested model really belongs to the resolved
  // provider before anything is sent. Foreign models are re-routed to the
  // provider that owns them; unknown ones fall back to the provider default.
  let modelNotice:
    | { kind: "rate-limited" | "model-unavailable" | "info"; message: string; providerId: string; model: string }
    | undefined;
  const guardedProvider = requestedProvider;
  const resolution = await resolveChatModel(providers, guardedProvider, input.model);
  if (!resolution) {
    apiError(
      res,
      400,
      "MODEL_NOT_FOUND",
      "No usable model is configured for this provider. Set a default model in Settings → API.",
      null,
      requestId,
    );
    return;
  }
  if (resolution.provider.id !== guardedProvider.id || resolution.model !== input.model) {
    mark(
      "Provider",
      "Model re-routed",
      `from=${input.model}@${guardedProvider.name} to=${resolution.model}@${resolution.provider.name}`,
    );
  }
  input.model = resolution.model;
  let provider: Provider = resolution.provider;
  modelNotice = resolution.notice;
  const latest = input.messages[input.messages.length - 1];
  if (latest.role !== "user") {
    apiError(
      res,
      400,
      "INVALID_CHAT_MESSAGES",
      "The last message must be from the user.",
      null,
      requestId,
    );
    return;
  }
  const conversation = input.conversationId
    ? await prisma.conversation.findFirst({
        where: { id: input.conversationId, userId: auth.user.id },
      })
    : await prisma.conversation.create({
        data: {
          title: latest.content.slice(0, 80) || "New conversation",
          userId: auth.user.id,
          providerId: provider.id,
          model: input.model,
        },
      });
  if (!conversation) {
    apiError(res, 404, "CONVERSATION_NOT_FOUND", "Conversation not found.", null, requestId);
    return;
  }
  if (conversation.providerId !== provider.id || conversation.model !== input.model) {
    await prisma.conversation
      .update({
        where: { id: conversation.id },
        data: { providerId: provider.id, model: input.model },
      })
      .catch(() => undefined);
  }
  mark("Chat", "Conversation loaded", `conversation=${conversation.id}`);
  const existingUserMessage = input.clientMessageId
    ? await prisma.message.findUnique({ where: { id: input.clientMessageId } })
    : null;
  const userMessage =
    existingUserMessage ??
    (await prisma.message.create({
      data: {
        id: input.clientMessageId,
        role: "user",
        content: latest.content,
        conversationId: conversation.id,
      },
    }));
  if (existingUserMessage && existingUserMessage.conversationId !== conversation.id) {
    apiError(
      res,
      409,
      "VALIDATION_ERROR",
      "This message submission was already used for another conversation.",
      null,
      requestId,
    );
    return;
  }
  if (input.attachmentIds.length)
    await prisma.attachment.updateMany({
      where: { id: { in: input.attachmentIds }, userId: auth.user.id },
      data: { conversationId: conversation.id, messageId: userMessage.id },
    });
  mark("Chat", "User message persisted");
  const assistantMessageId = randomUUID();
  await prisma.message.create({
    data: {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      status: "streaming",
      generationId,
      conversationId: conversation.id,
    },
  });
  const generation = registerGeneration(
    new Generation({
      id: generationId,
      requestId,
      conversationId: conversation.id,
      messageId: assistantMessageId,
    }),
  );
  // Progressive persistence: the assistant message exists as a real row from
  // the first token onward, so a refresh or a lost connection never destroys
  // an in-flight answer. DB writes are throttled to keep the stream smooth.
  let lastPersistAt = 0;
  let persistTimer: ReturnType<typeof setTimeout> | undefined;
  const persistMessage = () => {
    void prisma.message
      .update({
        where: { id: assistantMessageId },
        data: { content: generation.content, status: generation.status },
      })
      .catch(() => undefined);
  };
  const schedulePersist = () => {
    const now = Date.now();
    if (now - lastPersistAt > 750) {
      lastPersistAt = now;
      persistMessage();
    } else if (!persistTimer) {
      persistTimer = setTimeout(() => {
        persistTimer = undefined;
        lastPersistAt = Date.now();
        persistMessage();
      }, 800);
    }
  };
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  let content = "";
  let streamFailed = false;
  let streamFailure: { code: string; message: string; details?: unknown } | null = null;
  const abortController = new AbortController();
  generation.setAbortHandler(() => abortController.abort());
  generation.subscribe((name, data) => {
    if (!res.writableEnded) sse(res, name, data);
  });
  const emit = (name: string, data: unknown) => generation.emit(name, data);
  if (modelNotice) emit("message.notice", modelNotice);
  const clientClosed = () => {
    // The browser left (refresh, tab switch, network drop). Do NOT abort: the
    // generation keeps running in the background, keeps persisting, and can be
    // re-attached through POST /chat/resume.
    if (!res.writableEnded) mark("Chat", "Client disconnected (generation continues)");
  };
  res.on("close", clientClosed);
  let reasoningTimer: ReturnType<typeof setTimeout> | undefined;
  let usedAgent = false;
  try {
    const configForRequest = providerConfig(provider);
    const requestToolTimeoutMs = Number(configForRequest.options?.toolTimeoutMs) || 30_000;
    mark("Chat", "Model resolved", `provider=${provider.providerKey} model=${input.model}`);
    mark("Chat", "Provider connection loaded");
    mark("Chat", "Secret decrypted");
    const shouldUseAgent =
      input.attachmentIds.length > 0 ||
      input.enabledTools.length > 0 ||
      (input.toolMode === "auto" &&
        (autoWebSearch || (intent.confidence >= 0.5 && intent.tools.length > 0)));
    usedAgent = shouldUseAgent;
    mark(
      "Agent",
      shouldUseAgent ? "Agent path selected" : "Fast path selected",
      shouldUseAgent ? `tools=${intent.tools.join(",")}` : "provider direct",
    );
    const toolContext: string[] = [];
    let safeToolFailure: string | null = null;
    // --- Gmail ---
    if (shouldUseAgent && intent.tools.includes("gmail.getLatestMessage")) {
      generation.emit("tool.requested", { tool: "gmail.getLatestMessage", label: "Gmail requested" });
      generation.emit("tool.started", { tool: "gmail.getLatestMessage", label: "Checking Gmail" });
      mark("Agent", "Tool started", "tool=gmail.getLatestMessage");
      try {
        const latestMessage = await withToolTimeout(
          "gmail.getLatestMessage",
          requestToolTimeoutMs,
          () => getLatestGmailMessageForAgent(prisma, auth.user.id),
        );
        if (latestMessage) {
          toolContext.push(
            `Tool: gmail.getLatestMessage\nStatus: success\nResult: ${JSON.stringify(latestMessage)}\nSource: Gmail`,
          );
          generation.emit("tool.completed", {
            tool: "gmail.getLatestMessage",
            sourceCount: 1,
            label: "Found 1 email",
          });
        } else {
          toolContext.push(
            "Tool: gmail.getLatestMessage\nStatus: success\nResult: No messages were found.\nSource: Gmail",
          );
          generation.emit("tool.completed", {
            tool: "gmail.getLatestMessage",
            sourceCount: 0,
            label: "No email found",
          });
        }
      } catch (error) {
        const code =
          error instanceof Error && "code" in error
            ? String((error as Error & { code: string }).code)
            : "TOOL_FAILED";
        safeToolFailure =
          code === "GOOGLE_ACCOUNT_NOT_CONNECTED"
            ? "I don't have access to Gmail yet. Connect Google to let Aegis check your inbox."
            : code === "MISSING_SCOPE"
              ? "Aegis is connected to Google, but Gmail permission is missing. Grant Gmail access to continue."
              : "Aegis could not check Gmail right now. No email data was used in this answer.";
        generation.emit("tool.failed", { tool: "gmail.getLatestMessage", code, label: safeToolFailure });
      }
      mark(
        "Agent",
        "Tool execution completed",
        `tool=gmail.getLatestMessage success=${!safeToolFailure}`,
      );
    }
    // --- Web Search ---
    if (
      shouldUseAgent &&
      (intent.tools.includes("web.search") || intent.tools.includes("web.readPage"))
    ) {
      const query = deriveSearchQuery(latest.content);
      const searchActivityId = `web_${randomUUID()}`;
      generation.emit("tool.requested", { tool: "web.search", label: "Web search requested", query, activityId: searchActivityId });
      generation.emit("tool.started", { tool: "web.search", label: `Searching the web…`, query, activityId: searchActivityId });
      mark("Agent", "Tool started", `tool=web.search query=${query.slice(0, 80)}`);
      try {
        const { getConfiguredProvider, isWebSearchConfigured, WEB_SEARCH_ERRORS } =
          await import("@aegis/tools");
        if (!isWebSearchConfigured()) {
          throw Object.assign(new Error(WEB_SEARCH_ERRORS.NOT_CONFIGURED.message), {
            code: "WEB_SEARCH_NOT_CONFIGURED",
          });
        }
        const provider = getConfiguredProvider()!;
        const results = await withToolTimeout("web.search", requestToolTimeoutMs, () =>
          provider.search({ query, maxResults: Number(process.env.WEB_SEARCH_MAX_RESULTS) || 8 }),
        );
        if (results.length > 0) {
          const resultText = results
            .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`)
            .join("\n\n");
          toolContext.push(
            `Tool: web.search\nStatus: success\nQuery: ${query}\nResults:\n${resultText}\nSources: web search results`,
          );
          generation.emit("tool.completed", {
            tool: "web.search",
            resultCount: results.length,
            sourceCount: results.length,
            label: `Found ${results.length} results`,
            query,
            activityId: searchActivityId,
          });
          // Validate top results with the real page reader before returning them.
          const validatedResults = [] as typeof results;
          if (autoWebSearch || intent.tools.includes("web.readPage")) {
            const pageReadLimit = Math.max(
              0,
              Math.min(Number(process.env.WEB_SEARCH_MAX_PAGE_READS) || 3, results.length),
            );
            for (const result of results.slice(0, pageReadLimit)) {
              const activityId = `web_${randomUUID()}`;
              let domain = result.domain;
              try { domain = new URL(result.url).hostname; } catch { /* provider validated the URL */ }
              const metadata = { url: result.url, title: result.title, domain, site: result.site || domain, activityId };
              try {
                generation.emit("tool.requested", { tool: "web.readPage", label: "Page read requested", ...metadata });
                generation.emit("tool.started", {
                  tool: "web.readPage",
                  label: `Reading ${result.title.slice(0, 40)}…`,
                  ...metadata,
                });
                const { readPageContent } = await import("@aegis/tools");
                const page = await withToolTimeout("web.readPage", requestToolTimeoutMs, () =>
                  readPageContent(result.url),
                );
                const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 3).slice(0, 12);
                const searchable = `${result.title} ${result.snippet} ${page.title} ${page.content.slice(0, 8000)}`.toLowerCase();
                const matches = terms.filter((term) => searchable.includes(term)).length;
                if (terms.length === 0 || matches >= Math.max(1, Math.ceil(terms.length * 0.15))) validatedResults.push(result);
                toolContext.push(
                  `Tool: web.readPage\nStatus: success\nURL: ${result.url}\nTitle: ${page.title}\nContent:\n${page.content.slice(0, 8000)}`,
                );
                generation.emit("tool.completed", {
                  tool: "web.readPage",
                  sourceCount: 1,
                  label: `Read ${result.title.slice(0, 30)}`,
                  ...metadata,
                });
              } catch {
                generation.emit("tool.failed", {
                  tool: "web.readPage",
                  code: "PAGE_UNREADABLE",
                  label: `Could not read ${result.title.slice(0, 30)}`,
                  ...metadata,
                });
              }
            }
          } else {
            validatedResults.push(...results);
          }
          const finalResults = validatedResults.length > 0 ? validatedResults : results;
          generation.emit("web.results", { query, results: finalResults });
        } else {
          toolContext.push(
            `Tool: web.search\nStatus: success\nQuery: ${query}\nResults: No results found.`,
          );
          generation.emit("tool.completed", {
            tool: "web.search",
            resultCount: 0,
            sourceCount: 0,
            label: "No results found",
          });
        }
      } catch (error) {
        const code = (error as { code?: string }).code || "WEB_SEARCH_FAILED";
        const label =
          code === "WEB_SEARCH_NOT_CONFIGURED"
            ? "Web search is not configured"
            : "Web search failed";
        safeToolFailure = explicitWebSearch
          ? code === "WEB_SEARCH_NOT_CONFIGURED"
            ? "Web search is not configured on this Aegis instance. You can configure it in Settings."
            : "Aegis could not search the web right now. No web data was used in this answer."
          : null;
        generation.emit("tool.failed", {
          tool: "web.search",
          code,
          label: autoWebSearch && !explicitWebSearch ? `${label} (auto)` : label,
        });
      }
      mark("Agent", "Tool execution completed", `tool=web.search success=${!safeToolFailure}`);
    }
    // --- GitHub ---
    const githubTools = intent.tools.filter((tool) => tool.startsWith("github."));
    if (shouldUseAgent && githubTools.length > 0) {
      const { executeGitHubTool } = await import("./integrations/github-tools.js");
      const repositoryMatch = /\b([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\b/.exec(latest.content);
      let inferredRepository: { owner: string; repo: string } | null = repositoryMatch
        ? { owner: repositoryMatch[1], repo: repositoryMatch[2] }
        : null;
      for (const toolId of githubTools) {
        generation.emit("tool.requested", { tool: toolId, label: "GitHub requested" });
        try {
          const toolInput: Record<string, unknown> = {};
          if (toolId !== "github.listRepositories") {
            if (!inferredRepository) {
              const available = (await withToolTimeout(
                "github.listRepositories",
                requestToolTimeoutMs,
                () =>
                  executeGitHubTool(prisma, auth.user.id, "github.listRepositories", {
                    page: 1,
                    perPage: 10,
                  }),
              )) as { repositories?: Array<{ owner?: string; name: string; fullName: string }> };
              if (available.repositories?.length === 1 && available.repositories[0].owner)
                inferredRepository = {
                  owner: available.repositories[0].owner,
                  repo: available.repositories[0].name,
                };
              else {
                const count = available.repositories?.length || 0;
                const clarification =
                  count > 1
                    ? `I found ${count} accessible GitHub repositories. Specify the repository as owner/repo.`
                    : "No accessible GitHub repository was found for this installation.";
                safeToolFailure = clarification;
                generation.emit("tool.failed", {
                  tool: toolId,
                  code: "GITHUB_REPOSITORY_REQUIRED",
                  label: clarification,
                });
                continue;
              }
            }
            toolInput.owner = inferredRepository.owner;
            toolInput.repo = inferredRepository.repo;
          }
          if (toolId === "github.getFileContent") {
            if (/\breadme\b/i.test(latest.content)) toolInput.path = "README.md";
            else {
              const pathMatch = /(?:file|fichier|path|chemin)\s+[`"']?([^\s`"']+)/i.exec(
                latest.content,
              );
              if (!pathMatch) {
                safeToolFailure = "Specify the repository file path to read.";
                generation.emit("tool.failed", {
                  tool: toolId,
                  code: "GITHUB_FILE_PATH_REQUIRED",
                  label: safeToolFailure,
                });
                continue;
              }
              toolInput.path = pathMatch[1];
            }
          } else if (toolId === "github.searchCode") {
            const queryMatch =
              /(?:search|find|cherche|recherche)\s+[`"']?(.+?)[`"']?(?:\s+(?:in|dans)\s+|$)/i.exec(
                latest.content,
              );
            toolInput.query = queryMatch?.[1]?.trim() || latest.content.trim();
          } else if (toolId === "github.listIssues" || toolId === "github.listPullRequests") {
            toolInput.state = /\bclosed|ferm[ée]e?s?\b/i.test(latest.content)
              ? "closed"
              : /\ball|tous|toutes\b/i.test(latest.content)
                ? "all"
                : "open";
          }
          const label =
            toolId === "github.getFileContent"
              ? "Reading repository…"
              : toolId === "github.searchCode"
                ? "Searching GitHub code…"
                : "Checking GitHub…";
          generation.emit("tool.started", { tool: toolId, label });
          const result = await withToolTimeout(toolId, requestToolTimeoutMs, () =>
            executeGitHubTool(prisma, auth.user.id, toolId, toolInput),
          );
          toolContext.push(
            `Tool: ${toolId}\nStatus: success\nResult: ${JSON.stringify(result)}\nSource: GitHub`,
          );
          const resultCount = Array.isArray((result as any).repositories)
            ? (result as any).repositories.length
            : Array.isArray((result as any).issues)
              ? (result as any).issues.length
              : Array.isArray((result as any).pullRequests)
                ? (result as any).pullRequests.length
                : Array.isArray((result as any).matches)
                  ? (result as any).matches.length
                  : 1;
          generation.emit("tool.completed", {
            tool: toolId,
            resultCount,
            sourceCount: resultCount,
            label: `GitHub returned ${resultCount} result${resultCount === 1 ? "" : "s"}`,
          });
        } catch (cause) {
          const code =
            cause instanceof Error && "code" in cause
              ? String((cause as Error & { code: string }).code)
              : "GITHUB_TOOL_FAILED";
          const label =
            code === "GITHUB_NOT_CONNECTED"
              ? "GitHub is not connected. Connect GitHub to continue."
              : cause instanceof Error
                ? cause.message
                : "GitHub tool failed.";
          safeToolFailure = safeToolFailure || label;
          generation.emit("tool.failed", { tool: toolId, code, label });
        }
      }
      mark("Agent", "GitHub tools completed", `success=${!safeToolFailure}`);
    }
    if (shouldUseAgent && input.attachmentIds.length) {
      const attachments = await prisma.attachment.findMany({
        where: { id: { in: input.attachmentIds }, userId: auth.user.id },
      });
      const extracted: string[] = [];
      for (const attachment of attachments) {
        if (attachment.mimeType.startsWith("text/") || attachment.mimeType === "application/json")
          extracted.push(
            `${attachment.name}:\n${(await readFile(attachment.storagePath, "utf8")).slice(0, 100_000)}`,
          );
      }
      if (extracted.length)
        toolContext.push(
          `Tool: attachments.readText\nStatus: success\nResult:\n${extracted.join("\n\n")}\nSource: user attachments`,
        );
      else if (attachments.length)
        safeToolFailure =
          "The selected attachment is stored safely, but this Aegis build cannot extract that format yet.";
    }
    generation.emit("generation.status", { status: "writing-answer", elapsedMs: Date.now() - startedAt });
    const guard = `You are Aegis, the user's personal AI assistant.
CORE BEHAVIOR — Give the user what they want. Answer directly, confidently and in their language. State the answer first, then the reasoning; do not hedge with "I think", "maybe", "je pense" or "peut-être" when you know the answer, and never answer with questions you could answer yourself — if a detail is genuinely unknown, say so plainly and give the concrete next step to find it. When web search results are present above, combine them with your own knowledge so the answer is complete and current.
MEDIA & LINKS — When you mention a film, series, video, song, artist, place, product, famous person, website or event, include 1-2 relevant, real links formatted as markdown (trailer, official page, Wikipedia, streaming or store link) so the user can go straight there. Only include URLs you are confident actually exist — never invent one.
MEMORY — The whole conversation above is your memory: reuse what the user told you earlier, reference it naturally when relevant, and never repeat what is already established.
EXTERNAL TOOL POLICY\n${toolContext.length ? toolContext.join("\n\n") : "No external tools were executed."}\nNever claim to have read Gmail, Drive, GitHub, the web, a calendar, a project, or a file unless a successful tool result above proves it. Never treat a user chat message as external data.`;
    // ---- Provider chain: primary → fallbacks (same context, tools, workspace) ----
    const fallbackProviders = await prisma.provider.findMany({
      where: { id: { in: input.fallbackProviderIds ?? [] }, userId: auth.user.id, active: true },
    });
    const chain: Array<{ provider: typeof provider; model: string }> = [
      { provider, model: input.model },
      ...fallbackProviders.map((fallback) => ({
        provider: fallback,
        model: fallback.defaultModel || input.model,
      })),
    ];
    const continueInstruction = {
      role: "user" as const,
      content:
        "Continue your previous answer exactly from where it stopped. Do not repeat anything you already wrote — just keep going.",
    };
    const buildRequest = (candidate: { provider: typeof provider; model: string }, isContinue: boolean) => ({
      ...input,
      providerId: candidate.provider.id,
      model: candidate.model,
      messages: [
        { role: "system" as const, content: guard },
        ...input.messages,
        ...(isContinue && content
          ? [{ role: "assistant" as const, content }, continueInstruction]
          : []),
      ],
    });
    // A per-provider concurrency cap: no more than MAX_PROVIDER_STREAMS in-flight
    // generations per provider account, so a stray tab never burns its rate
    // limit while a real answer is streaming.
    const streamFor = async function* (
      candidate: { provider: typeof provider; model: string },
      isContinue: boolean,
    ) {
      const release = await acquireProviderSlot(candidate.provider.id, abortController.signal);
      try {
        const candidateConfig = providerConfig(candidate.provider);
        const candidateDriver = createProvider(candidateConfig);
        const candidateRequest = buildRequest(candidate, isContinue);
        if (safeToolFailure) {
          yield { type: "delta" as const, content: safeToolFailure };
          return;
        }
        if (candidateDriver.streamChat) {
          yield* candidateDriver.streamChat(candidateRequest, abortController.signal);
          return;
        }
        yield {
          type: "delta" as const,
          content: (
            await chatWithProvider({
              config: candidateConfig,
              request: candidateRequest,
              signal: abortController.signal,
            })
          ).content,
        };
      } finally {
        release();
      }
    };
    generation.emit("message.started", {
      conversationId: conversation.id,
      providerId: provider.id,
      model: input.model,
      requestId,
      generationId,
      messageId: assistantMessageId,
    });
    generation.emit("generation.status", { status: "provider-active", elapsedMs: Date.now() - startedAt });
    mark("Provider", "Request started");
    const firstTokenMs = Number(configForRequest.options?.firstTokenTimeoutMs) || 120_000;
    reasoningTimer = setTimeout(
      () => {
        if (!res.writableEnded && !content)
          generation.emit("generation.status", {
            status: "model-reasoning",
            elapsedMs: Date.now() - startedAt,
          });
      },
      Math.min(10_000, firstTokenMs / 2),
    );
    // Run the provider chain. A candidate fails transiently only when NOTHING
    // reached the user yet; once partial content exists, a drop is an
    // interruption (kept + resumed), never a fallback.
    for (let chainIndex = 0; chainIndex < chain.length; chainIndex += 1) {
      const candidate = chain[chainIndex];
      if (chainIndex > 0) {
        mark("Provider", "Fallback switched", `provider=${candidate.provider.id} model=${candidate.model}`);
        generation.emit("message.notice", {
          kind: "provider-fallback",
          message: `Provider basculé vers ${candidate.provider.name}`,
          providerId: candidate.provider.id,
          model: candidate.model,
        });
      }
      mark("Provider", "stream_started", `provider=${candidate.provider.id} model=${candidate.model}`);
      // Transient provider failures (NVIDIA NIM 529 overload, HTTP 429/502/503/504)
      // are retried with a bounded exponential backoff (2s→4s→8s→16s→30s cap) as
      // long as nothing reached the user yet, so a temporary overload never
      // surfaces as an error in the chat and never loops forever.
      let activeCandidate = candidate;
      let switchedModel = false;
      for (let attempt = 0; ; attempt += 1) {
        streamFailed = false;
        streamFailure = null;
        try {
          for await (const event of streamFor(activeCandidate, false)) {
            if (event.type === "delta") {
              if (!content) mark("Provider", "stream_chunk", "first token");
              content += event.content;
              generation.content = content;
              generation.emit("message.delta", { delta: event.content });
              schedulePersist();
            } else if (event.type === "reasoning") {
              generation.reasoning += event.content;
              generation.emit("message.reasoning", { delta: event.content });
            } else if (event.type === "error") {
              streamFailed = true;
              streamFailure = event.error;
              const failureStatus =
                typeof (event.error.details as { status?: unknown } | undefined)?.status === "number"
                  ? (event.error.details as { status: number }).status
                  : "?";
              mark("Provider", "stream_interrupted", `code=${event.error.code} status=${failureStatus} duration=${Date.now() - startedAt}ms`);
              break;
            }
          }
        } catch (error) {
          if (abortController.signal.aborted) throw error;
          streamFailed = true;
          streamFailure = toApiError(error);
          const failureStatus =
            typeof (streamFailure.details as { status?: unknown } | undefined)?.status === "number"
              ? (streamFailure.details as { status: number }).status
              : "?";
          mark("Provider", "stream_interrupted", `code=${streamFailure.code} status=${failureStatus} duration=${Date.now() - startedAt}ms`);
        }
        if (!streamFailed) { mark("Provider", "stream_completed", `provider=${activeCandidate.provider.id}`); break; }
        if (content || generation.reasoning) break;
        // Model-level rate limit (e.g. Mistral code 1300 on glm-5-2): retrying
        // the same limited model is pointless. Switch once to the provider's own
        // default model, then stop hammering if that model is limited too.
        const currentFailure = streamFailure!;
        const rateLimitCategory =
          currentFailure.code === "PROVIDER_RATE_LIMITED"
            ? providerRateLimitCategory(currentFailure)
            : undefined;
        if (rateLimitCategory === "model") {
          const safeModel = await safeFallbackModel(activeCandidate.provider);
          if (!switchedModel && safeModel && safeModel !== activeCandidate.model) {
            switchedModel = true;
            const previousModel = activeCandidate.model;
            activeCandidate = { provider: activeCandidate.provider, model: safeModel };
            mark("Provider", "model_rate_limited_fallback", `from=${previousModel} to=${safeModel}`);
            generation.emit("generation.status", {
              status: "provider-waiting",
              message: `Le modèle « ${previousModel} » est limité par ${activeCandidate.provider.name} — bascule sur « ${safeModel} »`,
              retryInMs: 0,
              elapsedMs: Date.now() - startedAt,
            });
            generation.emit("message.notice", {
              kind: "rate-limited",
              message: `Le modèle « ${previousModel} » est temporairement limité par ${activeCandidate.provider.name} (429). Bascule sur « ${safeModel} ».`,
              providerId: activeCandidate.provider.id,
              model: safeModel,
            });
            continue;
          }
          break;
        }
        if (!isTransientProviderError(currentFailure) || attempt >= 3) break;
        const backoff = transientBackoff(attempt, providerRetryAfter(currentFailure));
        const waitSeconds = Math.max(1, Math.round(backoff / 1000));
        mark("Provider", "stream_reconnecting", `attempt=${attempt + 1} delay=${backoff}ms`);
        generation.emit("generation.status", {
          status: "provider-waiting",
          message: `Provider temporairement limité — nouvelle tentative dans ${waitSeconds}s`,
          retryInMs: backoff,
          elapsedMs: Date.now() - startedAt,
        });
        generation.emit("message.notice", {
          kind: "provider-limited",
          message: `Provider temporairement limité — nouvelle tentative dans ${waitSeconds}s`,
          providerId: activeCandidate.provider.id,
          model: activeCandidate.model,
          retryInMs: backoff,
        });
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
      if (!streamFailed) break;
      if (content || generation.reasoning) break;
      if (chainIndex >= chain.length - 1 || !isTransientProviderError(streamFailure)) break;
    }
    mark("Provider", "Stream ended");
    if (!streamFailed && content) {
      generation.emit("generation.status", { status: "persisting", elapsedMs: Date.now() - startedAt });
      generation.finish("completed");
      await prisma.message.update({
        where: { id: assistantMessageId },
        data: { content, status: "completed" },
      });
      mark("Chat", "Assistant message persisted");
      mark("Chat", "SSE completed");
      generation.emit("message.completed", { conversationId: conversation.id, messageId: assistantMessageId });
    } else if (!streamFailed && !content) {
      // No content but no error — this is an empty response. Emit done to close gracefully.
      mark("Chat", "Empty response (no content, no error)");
      generation.finish("completed");
      await prisma.message.update({
        where: { id: assistantMessageId },
        data: { content: "", status: "completed" },
      });
      generation.emit("message.completed", { conversationId: conversation.id, messageId: assistantMessageId });
    } else if (streamFailed && content && !abortController.signal.aborted) {
      // ---- Interruption: the provider cut the stream mid-answer. The partial
      // response is preserved and marked "interrupted" (never discarded, never
      // duplicated). One automatic resume is attempted; if it fails the user can
      // press "Continuer" which runs the exact same continuation.
      mark("Provider", "stream_interrupted", `partial=${content.length} chars`);
      generation.emit("generation.status", { status: "writing-answer", elapsedMs: Date.now() - startedAt });
      mark("Provider", "stream_reconnecting", "auto-resume attempt 1");
      const resumedStream = streamFor({ provider, model: input.model }, true);
      let resumedContent = "";
      let resumeFailed = false;
      try {
        for await (const event of resumedStream) {
          if (event.type === "delta") {
            resumedContent += event.content;
            content += event.content;
            generation.content = content;
            generation.emit("message.delta", { delta: event.content });
            schedulePersist();
          } else if (event.type === "reasoning") {
            generation.reasoning += event.content;
            generation.emit("message.reasoning", { delta: event.content });
          } else if (event.type === "error") {
            resumeFailed = true;
            mark("Provider", "stream_interrupted", `auto-resume code=${event.error.code}`);
            break;
          }
        }
      } catch (resumeError) {
        if (abortController.signal.aborted) throw resumeError;
        resumeFailed = true;
        mark("Provider", "stream_interrupted", `auto-resume code=${toApiError(resumeError).code}`);
      }
      if (!resumeFailed) {
        mark("Provider", "stream_resumed", `+${resumedContent.length} chars`);
        generation.emit("generation.status", { status: "persisting", elapsedMs: Date.now() - startedAt });
        generation.finish("completed");
        await prisma.message.update({
          where: { id: assistantMessageId },
          data: { content, status: "completed" },
        });
        generation.emit("message.completed", { conversationId: conversation.id, messageId: assistantMessageId });
      } else {
        generation.finish("interrupted");
        await prisma.message
          .update({
            where: { id: assistantMessageId },
            data: { content, status: "interrupted" },
          })
          .catch(() => undefined);
        generation.emit("message.interrupted", {
          messageId: assistantMessageId,
          content,
          reasoning: generation.reasoning,
          generationId,
          canResume: true,
        });
      }
    } else if (streamFailed) {
      const rawFailure = streamFailure ?? { code: "PROVIDER_STREAM_FAILED", message: "The provider stream failed. The partial response was preserved." };
      const failure = actionableProviderFailure(rawFailure, provider, input.model);
      generation.finish("error", failure);
      await prisma.message.update({
        where: { id: assistantMessageId },
        data: { content, status: "error", errorText: failure.message.slice(0, 2000) },
      }).catch(() => undefined);
      generation.emit("message.error", failure);
    }
  } catch (error) {
    const normalized = actionableProviderFailure(toApiError(error), provider, input.model);
    if (!abortController.signal.aborted) {
      const failureStatus =
        typeof (normalized.details as { status?: unknown } | undefined)?.status === "number"
          ? (normalized.details as { status: number }).status
          : "?";
      mark(
        "Provider",
        "Request failed",
        `code=${normalized.code} status=${failureStatus} msg=${normalized.message.slice(0, 80)} duration=${Date.now() - startedAt}ms`,
      );
      generation.finish("error", normalized);
      await prisma.message
        .update({
          where: { id: assistantMessageId },
          data: { content, status: "error", errorText: normalized.message.slice(0, 2000) },
        })
        .catch(() => undefined);
      generation.emit("message.error", normalized);
    } else {
      mark(
        "Chat",
        "Cancelled (user-action)",
        `reason=${String((abortController.signal.reason instanceof Error ? abortController.signal.reason.message : "") || "user-stop")}`,
      );
      generation.finish("cancelled");
      await prisma.message
        .update({
          where: { id: assistantMessageId },
          data: { content, status: "cancelled" },
        })
        .catch(() => undefined);
      generation.emit("message.error", {
        code: "CANCELLED",
        message: "The generation was stopped.",
      });
    }
  } finally {
    if (reasoningTimer) clearTimeout(reasoningTimer);
    if (persistTimer) clearTimeout(persistTimer);
    if (generation.alive) generation.finish("cancelled");
    res.off("close", clientClosed);
    if (!res.writableEnded) res.end();
  }
  mark("Chat", "SSE completed");
}

// ======== Continue an interrupted generation ========
async function handleContinue(request: http.IncomingMessage, res: http.ServerResponse, requestId: string): Promise<void> {
  const startedAt = Date.now();
  const mark = (area: "Chat" | "Provider", stage: string, details = "") => {
    console.log(`[${requestId}] [${area}] ${stage}: ${Date.now() - startedAt} ms${details ? ` · ${details}` : ""}`);
  };
  const auth = await requireUser(request, res);
  if (!auth) return;
  const input = z
    .object({
      conversationId: z.string().min(1),
      messageId: z.string().min(1),
      providerId: z.string().min(1).optional(),
      model: z.string().min(1).max(200).optional(),
      fallbackProviderIds: z.array(z.string().min(1)).max(4).optional(),
    })
    .parse(await body(request));
  const conversation = await prisma.conversation.findFirst({
    where: { id: input.conversationId, userId: auth.user.id },
  });
  if (!conversation) {
    apiError(res, 404, "CONVERSATION_NOT_FOUND", "Conversation not found.", null, requestId);
    return;
  }
  const message = await prisma.message.findFirst({
    where: { id: input.messageId, conversationId: conversation.id, role: "assistant" },
  });
  if (!message || (message.status !== "interrupted" && message.status !== "error")) {
    apiError(res, 409, "GENERATION_NOT_CONTINUABLE", "Only an interrupted message can be continued.", null, requestId);
    return;
  }
  const providerId = input.providerId ?? conversation.providerId ?? undefined;
  if (!providerId) {
    apiError(res, 404, "PROVIDER_NOT_CONFIGURED", "No provider configured for this continuation.", null, requestId);
    return;
  }
  const provider = await prisma.provider.findFirst({
    where: { id: providerId, userId: auth.user.id },
  });
  if (!provider) {
    apiError(res, 404, "PROVIDER_NOT_CONFIGURED", "No provider configured for this continuation.", null, requestId);
    return;
  }
  const previous = await prisma.message.findMany({
    where: { conversationId: conversation.id, createdAt: { lt: message.createdAt } },
    orderBy: { createdAt: "asc" },
  });
  const history: ChatMessage[] = previous.map((entry) => ({
    role: entry.role as ChatMessage["role"],
    content: entry.content,
  }));
  const guard = `${CHAT_CORE_GUARD}
CONTINUATION — You are resuming an answer that was interrupted. Continue exactly from where it stopped, in the same language and style. Never repeat text already written above.`;
  const messages: ChatMessage[] = [
    { role: "system", content: guard },
    ...history,
    { role: "assistant", content: message.content },
    {
      role: "user",
      content:
        "Continue your previous answer exactly from where it stopped. Do not repeat anything you already wrote — just keep going.",
    },
  ];
  const config = providerConfig(provider);
  const driver = createProvider(config);
  const model = input.model ?? conversation.model;
  const generationId = `gen_${randomUUID()}`;
  const generation = registerGeneration(
    new Generation({
      id: generationId,
      requestId,
      conversationId: conversation.id,
      messageId: message.id,
    }),
  );
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "X-Request-Id": requestId,
  });
  const abortController = new AbortController();
  generation.setAbortHandler(() => abortController.abort());
  generation.subscribe((name, data) => {
    if (!res.writableEnded) sse(res, name, data);
  });
  const emit = (name: string, data: unknown) => generation.emit(name, data);
  let content = message.content;
  let streamFailed = false;
  let streamFailure: { code: string; message: string; details?: unknown } | null = null;
  const persist = (status: string) =>
    prisma.message
      .update({ where: { id: message.id }, data: { content, status } })
      .catch(() => undefined);
  const providerRequest: ChatRequest = {
    providerId: provider.id,
    model,
    messages,
    privacyMode: "remote-provider",
    attachmentIds: [],
    toolMode: "auto",
    enabledTools: [],
  };
  try {
    emit("message.started", {
      conversationId: conversation.id,
      providerId: provider.id,
      model,
      requestId,
      generationId,
      messageId: message.id,
    });
    emit("generation.status", { status: "provider-active", elapsedMs: 0 });
    mark("Provider", "stream_started", `provider=${provider.id} model=${model}`);
    let activeModel = model;
    let switchedModel = false;
    for (let attempt = 0; ; attempt += 1) {
      streamFailed = false;
      streamFailure = null;
      const release = await acquireProviderSlot(provider.id, abortController.signal);
      try {
        const activeRequest = { ...providerRequest, model: activeModel };
        const stream = driver.streamChat
          ? driver.streamChat(activeRequest, abortController.signal)
          : (async function* () {
              yield {
                type: "delta" as const,
                content: (await chatWithProvider({ config, request: activeRequest, signal: abortController.signal })).content,
              };
            })();
        try {
          for await (const event of stream) {
            if (event.type === "delta") {
              content += event.content;
              generation.content = content;
              emit("message.delta", { delta: event.content });
              await persist("streaming");
            } else if (event.type === "reasoning") {
              generation.reasoning += event.content;
              emit("message.reasoning", { delta: event.content });
            } else if (event.type === "error") {
              streamFailed = true;
              streamFailure = event.error;
              const failureStatus =
                typeof (event.error.details as { status?: unknown } | undefined)?.status === "number"
                  ? (event.error.details as { status: number }).status
                  : "?";
              mark("Provider", "stream_interrupted", `code=${event.error.code} status=${failureStatus} duration=${Date.now() - startedAt}ms`);
              break;
            }
          }
        } catch (error) {
          if (abortController.signal.aborted) throw error;
          streamFailed = true;
          streamFailure = toApiError(error);
          const failureStatus =
            typeof (streamFailure.details as { status?: unknown } | undefined)?.status === "number"
              ? (streamFailure.details as { status: number }).status
              : "?";
          mark("Provider", "stream_interrupted", `code=${streamFailure.code} status=${failureStatus} duration=${Date.now() - startedAt}ms`);
        }
      } finally {
        release();
      }
      if (!streamFailed) break;
      // Partial continuation output was already appended → keep it, mark
      // interrupted.
      if (content !== message.content) break;
      // Model-level rate limit (Mistral code 1300): switch once to the
      // provider's default model, then stop rather than hammering the same one.
      const currentFailure = streamFailure!;
      const rateLimitCategory =
        currentFailure.code === "PROVIDER_RATE_LIMITED"
          ? providerRateLimitCategory(currentFailure)
          : undefined;
      if (rateLimitCategory === "model") {
        const safeModel = await safeFallbackModel(provider);
        if (!switchedModel && safeModel && safeModel !== activeModel) {
          switchedModel = true;
          const previousModel = activeModel;
          activeModel = safeModel;
          mark("Provider", "model_rate_limited_fallback", `from=${previousModel} to=${safeModel}`);
          emit("message.notice", {
            kind: "rate-limited",
            message: `Le modèle « ${previousModel} » est temporairement limité par ${provider.name} (429). Bascule sur « ${safeModel} ».`,
            providerId: provider.id,
            model: safeModel,
          });
          continue;
        }
        break;
      }
      // Otherwise retry bounded transient failures with exponential backoff.
      if (!isTransientProviderError(currentFailure) || attempt >= 3) break;
      mark("Provider", "stream_reconnecting", `attempt=${attempt + 1}`);
      await new Promise((resolve) => setTimeout(resolve, transientBackoff(attempt, providerRetryAfter(currentFailure))));
    }
    if (!streamFailed) {
      mark("Provider", "stream_completed", `provider=${provider.id}`);
      generation.finish("completed");
      await persist("completed");
      emit("message.completed", { conversationId: conversation.id, messageId: message.id });
    } else {
      mark("Provider", "stream_interrupted", `partial=${content.length} chars`);
      generation.finish("interrupted");
      await persist("interrupted");
      emit("message.interrupted", {
        messageId: message.id,
        content,
        reasoning: generation.reasoning,
        generationId,
        canResume: true,
      });
    }
  } catch (error) {
    if (abortController.signal.aborted) {
      generation.finish("cancelled");
      await persist("cancelled");
      emit("message.error", { code: "CANCELLED", message: "The generation was stopped." });
    } else {
      const normalized = actionableProviderFailure(toApiError(error), provider, model);
      const failureStatus =
        typeof (normalized.details as { status?: unknown } | undefined)?.status === "number"
          ? (normalized.details as { status: number }).status
          : "?";
      mark("Provider", "Request failed", `code=${normalized.code} status=${failureStatus} duration=${Date.now() - startedAt}ms`);
      generation.finish("error", normalized);
      await persist("interrupted");
      emit("message.interrupted", {
        messageId: message.id,
        content,
        reasoning: generation.reasoning,
        generationId,
        canResume: true,
      });
    }
  } finally {
    if (!res.writableEnded) res.end();
  }
}

async function handle(request: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const requestId = randomUUID();
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const method = request.method || "GET";

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Public routes (no auth)
  if (url.pathname === "/health" && method === "GET") {
    json(res, 200, {
      ok: true,
      service: "aegis-api",
      version: "0.3.0",
      status: "ready",
      timestamp: new Date().toISOString(),
    });
    return;
  }
  if (url.pathname === "/metrics" && method === "GET") {
    const auth = await requireUser(request, res);
    if (!auth) return;
    const memory = processMemorySample();
    json(res, 200, {
      ok: true,
      service: "aegis-api",
      version: "0.3.0",
      pid: process.pid,
      uptimeSeconds: Math.round(process.uptime()),
      memory,
      node: process.version,
      activeGenerations: activeGenerationCount(),
      timestamp: new Date().toISOString(),
    });
    return;
  }
  if (url.pathname === "/ready" && method === "GET") {
    try {
      await prisma.$queryRaw`SELECT 1`;
      json(res, 200, {
        ok: true,
        service: "aegis-api",
        version: "0.3.0",
        status: "ready",
        db: "connected",
        timestamp: new Date().toISOString(),
      });
    } catch {
      json(res, 503, {
        ok: false,
        service: "aegis-api",
        status: "unavailable",
        db: "disconnected",
        timestamp: new Date().toISOString(),
      });
    }
    return;
  }
  if (url.pathname === "/" && method === "GET") {
    json(res, 200, {
      service: "Aegis API",
      status: "running",
      health: "/health",
      ready: "/ready",
      version: "0.3.0",
    });
    return;
  }

  try {
    // ======== Auth routes ========
    if (url.pathname === "/auth/register" && method === "POST") {
      if (!allowAttempt(request)) {
        apiError(
          res,
          429,
          "RATE_LIMITED",
          "Too many authentication attempts. Try again later.",
          null,
          requestId,
        );
        return;
      }
      const input = registerSchema.parse(await body(request));
      const email = input.email.toLowerCase();
      if (await prisma.user.findUnique({ where: { email } })) {
        apiError(
          res,
          409,
          "EMAIL_ALREADY_EXISTS",
          "An account with this email already exists.",
          null,
          requestId,
        );
        return;
      }
      const user = await prisma.user.create({
        data: {
          email,
          displayName: input.displayName,
          passwordHash: await hashPassword(input.password),
          emailVerifiedAt: config.requireEmailVerification ? undefined : new Date(),
          providers: {
            create: defaultProviders.map((p) => ({
              providerKey: canonicalProviderKey(p.id),
              kind: p.kind,
              name: p.name,
              baseUrl: p.baseUrl,
              active: p.active,
            })),
          },
        },
      });
      if (config.requireEmailVerification) {
        const token = createToken();
        await prisma.emailVerificationToken.create({
          data: {
            tokenHash: hashToken(token),
            userId: user.id,
            expiresAt: new Date(Date.now() + 86_400_000),
          },
        });
        mailDev("verify-email", email, token);
        json(res, 201, {
          user: publicUser(user),
          emailVerificationRequired: true,
          message: "Account created. Verify your email before signing in.",
          requestId,
        });
        return;
      }
      const session = await createSession(user.id);
      json(
        res,
        201,
        { user: publicUser(user), emailVerificationRequired: false, message: "Account created." },
        {
          "Set-Cookie": cookie("aegis_session", session.token, config.sessionDays * 86400),
          "X-Request-Id": requestId,
        },
      );
      return;
    }

    if (url.pathname === "/auth/verify-email" && method === "POST") {
      const { token } = tokenSchema.parse(await body(request));
      const record = await prisma.emailVerificationToken.findUnique({
        where: { tokenHash: hashToken(token) },
      });
      if (!record || record.expiresAt < new Date()) {
        apiError(
          res,
          400,
          "VALIDATION_ERROR",
          "Verification link is invalid or expired.",
          null,
          requestId,
        );
        return;
      }
      const user = await prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      });
      await prisma.emailVerificationToken.delete({ where: { id: record.id } });
      const session = await createSession(user.id);
      json(
        res,
        200,
        { user: publicUser(user) },
        {
          "Set-Cookie": cookie("aegis_session", session.token, config.sessionDays * 86400),
          "X-Request-Id": requestId,
        },
      );
      return;
    }

    if (url.pathname === "/auth/login" && method === "POST") {
      if (!allowAttempt(request)) {
        apiError(
          res,
          429,
          "RATE_LIMITED",
          "Too many authentication attempts. Try again later.",
          null,
          requestId,
        );
        return;
      }
      const input = authSchema.parse(await body(request));
      const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
      if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
        apiError(res, 401, "INVALID_CREDENTIALS", "Invalid email or password.", null, requestId);
        return;
      }
      if (!user.emailVerifiedAt) {
        apiError(
          res,
          403,
          "VALIDATION_ERROR",
          "Verify your email before signing in.",
          null,
          requestId,
        );
        return;
      }
      const session = await createSession(user.id);
      json(
        res,
        200,
        { user: publicUser(user) },
        {
          "Set-Cookie": cookie("aegis_session", session.token, config.sessionDays * 86400),
          "X-Request-Id": requestId,
        },
      );
      return;
    }

    if (url.pathname === "/auth/logout" && method === "POST") {
      const auth = await currentUser(request);
      if (auth)
        await prisma.session.delete({ where: { id: auth.sessionId } }).catch(() => undefined);
      json(
        res,
        200,
        { ok: true },
        { "Set-Cookie": cookie("aegis_session", "", 0), "X-Request-Id": requestId },
      );
      return;
    }

    if (url.pathname === "/auth/me" && method === "GET") {
      const auth = await requireUser(request, res);
      if (auth) json(res, 200, { user: publicUser(auth.user) }, { "X-Request-Id": requestId });
      return;
    }

    if (url.pathname === "/auth/account" && (method === "PATCH" || method === "PUT")) {
      const auth = await requireUser(request, res);
      if (!auth) return;
      const input = accountSchema.parse(await body(request));
      const updated = await prisma.user.update({
        where: { id: auth.user.id },
        data: {
          displayName: input.displayName,
          preferencesJson: input.preferences ? JSON.stringify(input.preferences) : undefined,
        },
      });
      json(res, 200, { user: publicUser(updated) }, { "X-Request-Id": requestId });
      return;
    }
    if (url.pathname === "/auth/export" && method === "GET") {
      const auth = await requireUser(request, res);
      if (!auth) return;
      const [conversations, projects, providers] = await Promise.all([
        prisma.conversation.findMany({
          where: { userId: auth.user.id },
          include: {
            messages: true,
            attachments: {
              select: { id: true, name: true, mimeType: true, size: true, createdAt: true },
            },
          },
        }),
        prisma.project.findMany({ where: { userId: auth.user.id } }),
        prisma.provider.findMany({ where: { userId: auth.user.id } }),
      ]);
      json(
        res,
        200,
        {
          exportedAt: new Date().toISOString(),
          account: publicUser(auth.user),
          conversations,
          projects,
          providers: providers.map(providerView),
        },
        {
          "X-Request-Id": requestId,
          "Content-Disposition": "attachment; filename=aegis-data-export.json",
        },
      );
      return;
    }
    if (url.pathname === "/auth/conversations" && method === "DELETE") {
      const auth = await requireUser(request, res);
      if (!auth) return;
      const deleted = await prisma.conversation.deleteMany({ where: { userId: auth.user.id } });
      json(res, 200, { ok: true, deleted: deleted.count }, { "X-Request-Id": requestId });
      return;
    }
    if (url.pathname === "/auth/account" && method === "DELETE") {
      const auth = await requireUser(request, res);
      if (!auth) return;
      const input = z
        .object({ confirmation: z.string(), password: z.string().min(1) })
        .parse(await body(request));
      if (input.confirmation !== auth.user.email) {
        apiError(
          res,
          400,
          "VALIDATION_ERROR",
          "Enter your account email to confirm deletion.",
          null,
          requestId,
        );
        return;
      }
      if (!(await verifyPassword(input.password, auth.user.passwordHash))) {
        apiError(res, 401, "INVALID_CREDENTIALS", "The password is incorrect.", null, requestId);
        return;
      }
      await prisma.user.delete({ where: { id: auth.user.id } });
      res.setHeader("Set-Cookie", cookie("aegis_session", "", 0));
      json(res, 200, { ok: true }, { "X-Request-Id": requestId });
      return;
    }

    if (url.pathname === "/auth/password" && method === "PUT") {
      const auth = await requireUser(request, res);
      if (!auth) return;
      if (!allowAttempt(request)) {
        apiError(
          res,
          429,
          "RATE_LIMITED",
          "Too many password attempts. Try again later.",
          null,
          requestId,
        );
        return;
      }
      const input = passwordChangeSchema.parse(await body(request));
      const nextPassword = input.newPassword || input.password;
      if (input.currentPassword === undefined) {
        apiError(
          res,
          400,
          "VALIDATION_ERROR",
          "The current password is required.",
          null,
          requestId,
        );
        return;
      }
      if (!(await verifyPassword(input.currentPassword, auth.user.passwordHash))) {
        apiError(
          res,
          401,
          "INVALID_CREDENTIALS",
          "The current password is incorrect.",
          null,
          requestId,
        );
        return;
      }
      await prisma.user.update({
        where: { id: auth.user.id },
        data: { passwordHash: await hashPassword(nextPassword as string) },
      });
      await prisma.session.deleteMany({
        where: { userId: auth.user.id, id: { not: auth.sessionId } },
      });
      json(
        res,
        200,
        { ok: true, message: "Password changed. Other sessions were revoked." },
        { "X-Request-Id": requestId },
      );
      return;
    }

    if (url.pathname === "/auth/refresh" && method === "POST") {
      const auth = await requireUser(request, res);
      if (!auth) return;
      await prisma.session.delete({ where: { id: auth.sessionId } }).catch(() => undefined);
      const session = await createSession(auth.user.id);
      json(
        res,
        200,
        { user: publicUser(auth.user) },
        {
          "Set-Cookie": cookie("aegis_session", session.token, config.sessionDays * 86400),
          "X-Request-Id": requestId,
        },
      );
      return;
    }

    if (url.pathname === "/auth/forgot-password" && method === "POST") {
      const input = z.object({ email: z.string().email() }).parse(await body(request));
      const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
      if (user) {
        const token = createToken();
        await prisma.passwordResetToken.create({
          data: {
            tokenHash: hashToken(token),
            userId: user.id,
            expiresAt: new Date(Date.now() + 3_600_000),
          },
        });
        mailDev("reset-password", user.email, token);
      }
      json(
        res,
        200,
        { message: "If the account exists, a reset link was issued." },
        { "X-Request-Id": requestId },
      );
      return;
    }

    if (url.pathname === "/auth/reset-password" && method === "POST") {
      const input = tokenSchema
        .extend({ password: z.string().min(8).max(200) })
        .parse(await body(request));
      const record = await prisma.passwordResetToken.findUnique({
        where: { tokenHash: hashToken(input.token) },
      });
      if (!record || record.expiresAt < new Date()) {
        apiError(
          res,
          400,
          "VALIDATION_ERROR",
          "Reset link is invalid or expired.",
          null,
          requestId,
        );
        return;
      }
      await prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: await hashPassword(input.password) },
      });
      await prisma.passwordResetToken.delete({ where: { id: record.id } });
      await prisma.session.deleteMany({ where: { userId: record.userId } });
      json(res, 200, { message: "Password reset." }, { "X-Request-Id": requestId });
      return;
    }

    if ((url.pathname === "/auth/sessions" || url.pathname === "/sessions") && method === "GET") {
      const auth = await requireUser(request, res);
      if (!auth) return;
      const sessions = await prisma.session.findMany({
        where: { userId: auth.user.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          lastSeenAt: true,
          expiresAt: true,
          deviceName: true,
          ipAddress: true,
        },
      });
      json(
        res,
        200,
        {
          sessions: sessions.map((s) => ({
            id: s.id,
            current: s.id === auth.sessionId,
            deviceName: s.deviceName || "Aegis client",
            ipMasked: maskIp(s.ipAddress),
            createdAt: s.createdAt,
            lastSeenAt: s.lastSeenAt,
            expiresAt: s.expiresAt,
          })),
        },
        { "X-Request-Id": requestId },
      );
      return;
    }

    const sessionMatch = url.pathname.match(/^\/(?:auth\/)?sessions\/([^/]+)$/);
    if (sessionMatch && method === "DELETE") {
      const auth = await requireUser(request, res);
      if (!auth) return;
      if (sessionMatch[1] === auth.sessionId) {
        apiError(
          res,
          400,
          "VALIDATION_ERROR",
          "The current session cannot be revoked from itself.",
          null,
        );
        return;
      }
      const deleted = await prisma.session.deleteMany({
        where: { id: sessionMatch[1], userId: auth.user.id },
      });
      json(res, 200, { ok: true, revoked: deleted.count > 0 }, { "X-Request-Id": requestId });
      return;
    }

    // ======== Desktop auth ========
    if (url.pathname === "/auth/desktop/login" && method === "POST") {
      if (!allowAttempt(request)) {
        apiError(
          res,
          429,
          "RATE_LIMITED",
          "Too many authentication attempts. Try again later.",
          null,
          requestId,
        );
        return;
      }
      const input = z
        .object({
          email: z.string().email(),
          password: z.string().min(8),
          deviceName: z.string().max(120).optional(),
        })
        .parse(await body(request));
      const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
      if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
        apiError(res, 401, "INVALID_CREDENTIALS", "Invalid email or password.", null, requestId);
        return;
      }
      const accessToken = createToken();
      const refreshToken = createToken();
      const expiresAt = new Date(Date.now() + 86_400_000); // 24h
      const refreshExpiresAt = new Date(Date.now() + 30 * 86_400_000); // 30d
      const session = await prisma.session.create({
        data: {
          tokenHash: hashToken(accessToken),
          userId: user.id,
          expiresAt,
          deviceName: input.deviceName || "Aegis Desktop",
          ipAddress: request.socket.remoteAddress || null,
          refreshTokenHash: hashToken(refreshToken),
          refreshExpiresAt,
        },
      });
      json(
        res,
        200,
        {
          accessToken,
          refreshToken,
          expiresAt: expiresAt.toISOString(),
          refreshExpiresAt: refreshExpiresAt.toISOString(),
          user: publicUser(user),
        },
        { "X-Request-Id": requestId },
      );
      return;
    }

    if (url.pathname === "/auth/desktop/refresh" && method === "POST") {
      const input = z.object({ refreshToken: z.string().min(20) }).parse(await body(request));
      const session = await prisma.session.findUnique({
        where: { refreshTokenHash: hashToken(input.refreshToken) },
        include: { user: true },
      });
      if (!session || !session.refreshExpiresAt || session.refreshExpiresAt < new Date()) {
        apiError(
          res,
          401,
          "SESSION_EXPIRED",
          "Refresh token expired. Please log in again.",
          null,
          requestId,
        );
        return;
      }
      const newAccessToken = createToken();
      const newRefreshToken = createToken();
      const expiresAt = new Date(Date.now() + 86_400_000);
      const refreshExpiresAt = new Date(Date.now() + 30 * 86_400_000);
      await prisma.session.update({
        where: { id: session.id },
        data: {
          tokenHash: hashToken(newAccessToken),
          expiresAt,
          refreshTokenHash: hashToken(newRefreshToken),
          refreshExpiresAt,
          lastSeenAt: new Date(),
        },
      });
      json(
        res,
        200,
        {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiresAt: expiresAt.toISOString(),
          refreshExpiresAt: refreshExpiresAt.toISOString(),
          user: publicUser(session.user),
        },
        { "X-Request-Id": requestId },
      );
      return;
    }

    if (url.pathname === "/auth/desktop/logout" && method === "POST") {
      const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
      if (token)
        await prisma.session
          .deleteMany({ where: { tokenHash: hashToken(token) } })
          .catch(() => undefined);
      json(res, 200, { ok: true }, { "X-Request-Id": requestId });
      return;
    }

    // ======== Google Sign-In ========
    if (url.pathname === "/auth/google/start" && method === "POST") {
      const googleConfig = getGoogleOAuthConfig();
      if (!googleConfig.configured) {
        apiError(
          res,
          503,
          "INTEGRATION_NOT_CONFIGURED",
          "Google Sign-In is not configured.",
          null,
          requestId,
        );
        return;
      }
      const state = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + 10 * 60_000);
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.search = new URLSearchParams({
        client_id: googleConfig.clientId!,
        redirect_uri: googleConfig.redirectUri,
        response_type: "code",
        access_type: "offline",
        include_granted_scopes: "true",
        prompt: "consent",
        state,
        scope: "openid email profile",
      }).toString();
      json(
        res,
        200,
        { authorizationUrl: authUrl.toString(), state },
        { "X-Request-Id": requestId },
      );
      return;
    }

    if (url.pathname === "/auth/google/callback" && method === "GET") {
      const googleConfig = getGoogleOAuthConfig();
      const code = url.searchParams.get("code") || "";
      const state = url.searchParams.get("state") || "";
      const oauthError = url.searchParams.get("error");
      const failureUrl = `${googleConfig.webUrl}/login?error=google_failed`;
      if (oauthError || !code) {
        res.writeHead(302, { Location: `${googleConfig.webUrl}/login?error=access_denied` });
        res.end();
        return;
      }
      try {
        const tokens = await exchangeGoogleCode(googleConfig, code);
        const profile = await fetchGoogleUserInfo(tokens.access_token);
        const email = profile.email?.toLowerCase();
        let user = email ? await prisma.user.findUnique({ where: { email } }) : null;
        if (!user) {
          const password = randomBytes(32).toString("hex");
          user = await prisma.user.create({
            data: {
              email: email || `google-${profile.sub}@google.auth`,
              displayName: profile.name,
              passwordHash: await hashPassword(password),
              emailVerifiedAt: new Date(),
            },
          });
        }
        const session = await createSession(user.id);
        res.writeHead(302, {
          Location: `${googleConfig.webUrl}/chat`,
          "Set-Cookie": cookie("aegis_session", session.token, config.sessionDays * 86400),
        });
        res.end();
      } catch {
        res.writeHead(302, { Location: failureUrl });
        res.end();
      }
      return;
    }

    // ======== Device auth (legacy) ========
    if (url.pathname === "/auth/device/start" && method === "POST") {
      const deviceCode = createToken();
      const userCode = randomBytes(4).toString("hex").toUpperCase();
      const expiresAt = new Date(Date.now() + 10 * 60_000);
      await prisma.deviceCode.create({
        data: { deviceCodeHash: hashToken(deviceCode), userCode, expiresAt },
      });
      json(
        res,
        201,
        { deviceCode, userCode, expiresAt: expiresAt.toISOString(), interval: 5 },
        { "X-Request-Id": requestId },
      );
      return;
    }
    if (url.pathname === "/auth/device/approve" && method === "POST") {
      const auth = await requireUser(request, res);
      if (!auth) return;
      const input = z
        .object({ deviceCode: z.string().min(20), userCode: z.string().min(4).max(12).optional() })
        .parse(await body(request));
      const record = await prisma.deviceCode.findUnique({
        where: { deviceCodeHash: hashToken(input.deviceCode) },
      });
      if (
        !record ||
        record.expiresAt < new Date() ||
        record.status !== "pending" ||
        (input.userCode && input.userCode !== record.userCode)
      ) {
        apiError(res, 400, "VALIDATION_ERROR", "Device code is invalid or expired.", null);
        return;
      }
      await prisma.deviceCode.update({
        where: { id: record.id },
        data: { status: "approved", userId: auth.user.id, approvedAt: new Date() },
      });
      json(res, 200, { ok: true }, { "X-Request-Id": requestId });
      return;
    }
    if (url.pathname === "/auth/device/status" && method === "GET") {
      const deviceCode = url.searchParams.get("device_code") || "";
      const record = await prisma.deviceCode.findUnique({
        where: { deviceCodeHash: hashToken(deviceCode) },
        include: { user: true },
      });
      if (!record || record.expiresAt < new Date()) {
        json(res, 200, { status: "expired" }, { "X-Request-Id": requestId });
        return;
      }
      json(
        res,
        200,
        {
          status: record.status,
          user: record.user ? publicUser(record.user) : undefined,
          expiresAt: record.expiresAt.toISOString(),
        },
        { "X-Request-Id": requestId },
      );
      return;
    }
    if (url.pathname === "/auth/device/token" && method === "POST") {
      const input = z.object({ deviceCode: z.string().min(20) }).parse(await body(request));
      const record = await prisma.deviceCode.findUnique({
        where: { deviceCodeHash: hashToken(input.deviceCode) },
      });
      if (!record || record.expiresAt < new Date()) {
        apiError(
          res,
          400,
          "VALIDATION_ERROR",
          "Device code is invalid or expired.",
          null,
          requestId,
        );
        return;
      }
      if (record.status !== "approved" || !record.userId) {
        json(res, 202, { status: record.status }, { "X-Request-Id": requestId });
        return;
      }
      await prisma.deviceCode.update({
        where: { id: record.id },
        data: { status: "consumed", consumedAt: new Date() },
      });
      const session = await createSession(record.userId);
      json(
        res,
        200,
        {
          accessToken: session.token,
          tokenType: "Bearer",
          expiresAt: session.expiresAt.toISOString(),
        },
        { "X-Request-Id": requestId },
      );
      return;
    }

    // ======== Web Search ========
    if (
      await handleWebSearchRoute(request, res, url, method, requestId, () => currentUser(request))
    )
      return;

    // ======== Integrations ========
    if (
      await handleIntegrationRoute({
        request,
        response: res,
        url,
        method,
        requestId,
        prisma,
        currentUser: () => currentUser(request),
      })
    )
      return;

    // ======== Authenticated routes ========
    const auth = await requireUser(request, res);
    if (!auth) return;

    // ======== Providers ========
    if (url.pathname === "/providers" && method === "GET") {
      const providers = await prisma.provider.findMany({
        where: { userId: auth.user.id },
        include: { _count: { select: { models: true } } },
      });
      json(
        res,
        200,
        {
          providers: providers.map((provider) => ({
            ...providerView(provider),
            modelsCount: provider._count.models,
          })),
        },
        { "X-Request-Id": requestId },
      );
      return;
    }
    if (url.pathname === "/providers" && method === "POST") {
      const input = ProviderCreateSchema.parse(await body(request));
      const providerKey = canonicalProviderKey(
        input.providerKey ||
          input.id ||
          normalizeProviderKind(input.kind || input.type || "custom"),
      );
      const kind = [
        "openrouter",
        "nvidia-nim",
        "x-ai",
        "anthropic",
        "gemini",
        "openai",
        "mistral",
        "groq",
        "deepseek",
        "qwen",
        "meta",
        "together",
        "fireworks",
        "perplexity",
        "sambanova",
        "hyperbolic",
        "zhipu",
        "moonshot",
        "minimax",
        "novita",
        "huggingface",
      ].includes(providerKey)
        ? normalizeProviderKind(providerKey)
        : normalizeProviderKind(input.type || input.kind || providerKey);
      const data = {
        providerKey,
        kind,
        name: input.name,
        baseUrl: input.baseUrl,
        ...(input.apiKey === undefined ? {} : { apiKey: encryptProviderSecret(input.apiKey) }),
        defaultModel: input.defaultModel,
        optionsJson: input.options ? JSON.stringify(input.options) : undefined,
        active: input.enabled ?? input.active ?? true,
        userId: auth.user.id,
      };
      const existing = await prisma.provider.findFirst({
        where: { userId: auth.user.id, providerKey },
      });
      const saved = existing
        ? await prisma.provider.update({ where: { id: existing.id }, data })
        : await prisma.provider.create({ data });
      json(
        res,
        existing ? 200 : 201,
        { provider: providerView(saved) },
        { "X-Request-Id": requestId },
      );
      return;
    }
    if (url.pathname === "/providers/test" && method === "POST") {
      const input = z.object({ id: z.string().min(1) }).parse(await body(request));
      const provider = await prisma.provider.findFirst({
        where: { id: input.id, userId: auth.user.id },
      });
      if (!provider) {
        apiError(res, 404, "RESOURCE_NOT_FOUND", "Provider not found.", null, requestId);
        return;
      }
      const status = await testProvider(providerConfig(provider));
      json(
        res,
        status.ok ? 200 : 502,
        status.ok
          ? { ok: true, latencyMs: status.latencyMs, message: "Provider connection successful" }
          : {
              ok: false,
              code: "PROVIDER_AUTH_FAILED",
              latencyMs: status.latencyMs,
              message: status.message,
              requestId,
            },
        { "X-Request-Id": requestId },
      );
      return;
    }

    // ======== Cloud provider credentials ========
    // Canonical IDs are used by Web, Desktop contracts, persistence and model metadata.
    // The legacy `nvidia` alias delegates to the same handler and is not a second system.
    const cloudRoute = url.pathname.match(
      /^\/providers\/(nvidia-nim|nvidia|openrouter|x-ai|anthropic|gemini|openai|mistral|groq|deepseek|qwen|meta|together|fireworks|perplexity|sambanova|hyperbolic|zhipu|moonshot|minimax|novita|huggingface)\/(connect|test|refresh-models)$/,
    );
    const cloudDeleteRoute = url.pathname.match(
      /^\/providers\/(nvidia-nim|nvidia|openrouter|x-ai|anthropic|gemini|openai|mistral|groq|deepseek|qwen|meta|together|fireworks|perplexity|sambanova|hyperbolic|zhipu|moonshot|minimax|novita|huggingface)$/,
    );
    const cloudId = (
      cloudRoute?.[1] === "nvidia" || cloudDeleteRoute?.[1] === "nvidia"
        ? "nvidia-nim"
        : cloudRoute?.[1] || cloudDeleteRoute?.[1]
    ) as CloudProviderId | undefined;
    if (cloudRoute && cloudId && cloudRoute[2] === "connect" && method === "POST") {
      const input = cloudConnectSchema.parse(await body(request));
      json(res, 200, await connectCloudProvider(auth.user.id, cloudId, input), {
        "X-Request-Id": requestId,
      });
      return;
    }
    if (cloudRoute && cloudId && cloudRoute[2] === "test" && method === "POST") {
      const provider = await prisma.provider.findFirst({
        where: { userId: auth.user.id, providerKey: cloudId },
      });
      if (!provider || !decryptProviderSecret(provider.apiKey)) {
        apiError(
          res,
          409,
          "PROVIDER_NOT_CONFIGURED",
          `Add a ${cloudProviderSettings[cloudId].name} API key before testing this provider.`,
          null,
          requestId,
        );
        return;
      }
      const status = await testProvider(providerConfig(provider));
      if (!status.ok) {
        apiError(
          res,
          502,
          "PROVIDER_AUTH_FAILED",
          `The ${cloudProviderSettings[cloudId].name} API key was rejected.`,
          { latencyMs: status.latencyMs },
          requestId,
        );
        return;
      }
      json(
        res,
        200,
        { ok: true, latencyMs: status.latencyMs, message: "Connection successful" },
        { "X-Request-Id": requestId },
      );
      return;
    }
    if (cloudRoute && cloudId && cloudRoute[2] === "refresh-models" && method === "POST") {
      const provider = await prisma.provider.findFirst({
        where: { userId: auth.user.id, providerKey: cloudId },
      });
      if (!provider || !decryptProviderSecret(provider.apiKey)) {
        apiError(
          res,
          409,
          "PROVIDER_NOT_CONFIGURED",
          `Connect ${cloudProviderSettings[cloudId].name} before refreshing models.`,
          null,
          requestId,
        );
        return;
      }
      const models = await listProviderModels(providerConfig(provider));
      if (!models.length) {
        apiError(
          res,
          502,
          "NO_MODELS_AVAILABLE",
          "No compatible models were found.",
          null,
          requestId,
        );
        return;
      }
      await upsertDiscoveredModels(provider, models);
      json(res, 200, { modelsDiscovered: models.length, models }, { "X-Request-Id": requestId });
      return;
    }
    if (cloudDeleteRoute && cloudId && method === "DELETE") {
      const provider = await prisma.provider.findFirst({
        where: { userId: auth.user.id, providerKey: cloudId },
      });
      if (!provider) {
        apiError(
          res,
          404,
          "RESOURCE_NOT_FOUND",
          `${cloudProviderSettings[cloudId].name} provider not found.`,
          null,
          requestId,
        );
        return;
      }
      await prisma.$transaction([
        prisma.model.deleteMany({ where: { providerId: provider.id } }),
        prisma.provider.update({
          where: { id: provider.id },
          data: { apiKey: null, active: false, defaultModel: null },
        }),
      ]);
      json(
        res,
        200,
        { ok: true, provider: cloudId, secretConfigured: false },
        { "X-Request-Id": requestId },
      );
      return;
    }

    // ======== Generic provider routes ========
    const providerMatch = url.pathname.match(/^\/providers\/([^/]+)(?:\/(test|models|diagnose))?$/);
    if (
      providerMatch &&
      ![
        "nvidia",
        "openrouter",
        "x-ai",
        "anthropic",
        "gemini",
        "openai",
        "mistral",
        "groq",
        "deepseek",
        "qwen",
        "meta",
        "together",
        "fireworks",
        "perplexity",
        "sambanova",
        "hyperbolic",
        "zhipu",
        "moonshot",
        "minimax",
        "novita",
        "huggingface",
      ].includes(providerMatch[1])
    ) {
      const provider = await prisma.provider.findFirst({
        where: { id: providerMatch[1], userId: auth.user.id },
      });
      if (!provider) {
        apiError(res, 404, "RESOURCE_NOT_FOUND", "Provider not found.", null, requestId);
        return;
      }
      if (providerMatch[2] === "test" && method === "POST") {
        const status = await testProvider(providerConfig(provider));
        json(res, status.ok ? 200 : 502, status, { "X-Request-Id": requestId });
        return;
      }
      if (providerMatch[2] === "diagnose" && method === "POST") {
        const input = z.object({ model: z.string().min(1).max(200).optional() }).parse(await body(request));
        const started = Date.now();
        try {
          const diagnostic = await diagnoseProvider(providerConfig(provider), { model: input.model });
          console.log(`[${requestId}] [Provider] diagnose: ${provider.id} overall=${diagnostic.overall} duration=${Date.now() - started}ms`);
          json(res, 200, diagnostic, { "X-Request-Id": requestId });
        } catch (error) {
          const normalized = toApiError(error);
          console.log(`[${requestId}] [Provider] diagnose: ${provider.id} failed=${normalized.code} duration=${Date.now() - started}ms`);
          apiError(res, 502, "PROVIDER_DIAGNOSTIC_FAILED", normalized.message, null, requestId);
        }
        return;
      }
      if (providerMatch[2] === "models" && method === "GET") {
        const models = await listProviderModels(providerConfig(provider));
        await upsertDiscoveredModels(provider, models);
        json(res, 200, { models }, { "X-Request-Id": requestId });
        return;
      }
      if (!providerMatch[2] && method === "PATCH") {
        const input = providerPatchSchema.parse(await body(request));
        const updated = await prisma.provider.update({
          where: { id: provider.id },
          data: {
            ...(input.name === undefined ? {} : { name: input.name }),
            ...(input.baseUrl === undefined ? {} : { baseUrl: input.baseUrl }),
            ...(input.apiKey === undefined
              ? {}
              : { apiKey: input.apiKey === null ? null : encryptProviderSecret(input.apiKey) }),
            ...(input.defaultModel === undefined ? {} : { defaultModel: input.defaultModel }),
            ...(input.active === undefined && input.enabled === undefined
              ? {}
              : { active: input.enabled ?? input.active }),
            ...(input.kind || input.type
              ? { kind: normalizeProviderKind(input.kind || input.type || provider.kind) }
              : {}),
            ...(input.options === undefined ? {} : { optionsJson: JSON.stringify(input.options) }),
          },
        });
        json(res, 200, { provider: providerView(updated) }, { "X-Request-Id": requestId });
        return;
      }
      if (!providerMatch[2] && method === "DELETE") {
        await prisma.provider.delete({ where: { id: provider.id } });
        json(res, 200, { ok: true, deletedProviderId: provider.id }, { "X-Request-Id": requestId });
        return;
      }
    }

    // ======== Project-Conversation Linking ========
    const projectConvMatch = url.pathname.match(/^\/projects\/([^/]+)\/conversations\/([^/]+)$/);
    if (projectConvMatch && method === "POST") {
      const [_, projectId, conversationId] = projectConvMatch;
      const project = await prisma.project.findFirst({
        where: { id: projectId, userId: auth.user.id },
      });
      if (!project) {
        apiError(res, 404, "RESOURCE_NOT_FOUND", "Project not found.", null, requestId);
        return;
      }
      const conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, userId: auth.user.id },
      });
      if (!conversation) {
        apiError(res, 404, "RESOURCE_NOT_FOUND", "Conversation not found.", null, requestId);
        return;
      }
      await prisma.conversation.update({ where: { id: conversationId }, data: { projectId } });
      json(res, 200, { ok: true }, { "X-Request-Id": requestId });
      return;
    }
    if (projectConvMatch && method === "DELETE") {
      const [_, projectId, conversationId] = projectConvMatch;
      const project = await prisma.project.findFirst({
        where: { id: projectId, userId: auth.user.id },
      });
      if (!project) {
        apiError(res, 404, "RESOURCE_NOT_FOUND", "Project not found.", null, requestId);
        return;
      }
      const conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, userId: auth.user.id },
      });
      if (!conversation) {
        apiError(res, 404, "RESOURCE_NOT_FOUND", "Conversation not found.", null, requestId);
        return;
      }
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { projectId: null },
      });
      json(res, 200, { ok: true }, { "X-Request-Id": requestId });
      return;
    }

    // ======== Projects ========
    if (url.pathname === "/projects" && method === "GET") {
      const projects = await prisma.project.findMany({
        where: { userId: auth.user.id },
        include: { _count: { select: { conversations: true } } },
        orderBy: { updatedAt: "desc" },
      });
      json(
        res,
        200,
        {
          projects: projects.map(({ _count, toolsJson, ...project }) => ({
            ...project,
            tools: JSON.parse(toolsJson),
            conversationCount: _count.conversations,
          })),
        },
        { "X-Request-Id": requestId },
      );
      return;
    }
    if (url.pathname === "/projects" && method === "POST") {
      const input = projectSchema.parse(await body(request));
      const project = await prisma.project.create({ data: { ...input, userId: auth.user.id } });
      json(
        res,
        201,
        { project: { ...project, tools: [], conversationCount: 0 } },
        { "X-Request-Id": requestId },
      );
      return;
    }
    const projectMatch = url.pathname.match(/^\/projects\/([^/]+)$/);
    if (projectMatch) {
      const project = await prisma.project.findFirst({
        where: { id: projectMatch[1], userId: auth.user.id },
        include: { conversations: { orderBy: { updatedAt: "desc" }, take: 50 } },
      });
      if (!project) {
        apiError(res, 404, "RESOURCE_NOT_FOUND", "Project not found.", null, requestId);
        return;
      }
      if (method === "GET") {
        json(
          res,
          200,
          { project: { ...project, tools: JSON.parse(project.toolsJson) } },
          { "X-Request-Id": requestId },
        );
        return;
      }
      if (method === "PATCH") {
        const input = projectSchema.partial().parse(await body(request));
        const updated = await prisma.project.update({ where: { id: project.id }, data: input });
        json(
          res,
          200,
          { project: { ...updated, tools: JSON.parse(updated.toolsJson) } },
          { "X-Request-Id": requestId },
        );
        return;
      }
      if (method === "DELETE") {
        await prisma.project.delete({ where: { id: project.id } });
        json(res, 200, { ok: true }, { "X-Request-Id": requestId });
        return;
      }
    }

    // ======== Attachments ========
    if (url.pathname === "/attachments" && method === "POST") {
      const input = attachmentInput.parse(await body(request, 15 * 1024 * 1024));
      if (!allowedAttachmentTypes.has(input.mimeType)) {
        apiError(
          res,
          415,
          "UNSUPPORTED_ATTACHMENT",
          "This file type is not supported.",
          null,
          requestId,
        );
        return;
      }
      const bytes = Buffer.from(input.dataBase64, "base64");
      if (bytes.length !== input.size || bytes.length > MAX_ATTACHMENT_BYTES) {
        apiError(
          res,
          400,
          "INVALID_ATTACHMENT",
          "The uploaded file size is invalid.",
          null,
          requestId,
        );
        return;
      }
      const id = randomUUID();
      const userDirectory = path.join(attachmentRoot, auth.user.id);
      await mkdir(userDirectory, { recursive: true });
      const storagePath = path.join(userDirectory, id);
      await writeFile(storagePath, bytes, { flag: "wx" });
      const attachment = await prisma.attachment.create({
        data: {
          id,
          userId: auth.user.id,
          name: path.basename(input.name),
          mimeType: input.mimeType,
          size: bytes.length,
          storagePath,
          status: "ready",
        },
      });
      json(res, 201, { attachment: attachmentView(attachment) }, { "X-Request-Id": requestId });
      return;
    }
    const attachmentMatch = url.pathname.match(/^\/attachments\/([^/]+)(?:\/(extract))?$/);
    if (attachmentMatch) {
      const attachment = await prisma.attachment.findFirst({
        where: { id: attachmentMatch[1], userId: auth.user.id },
      });
      if (!attachment) {
        apiError(res, 404, "RESOURCE_NOT_FOUND", "Attachment not found.", null, requestId);
        return;
      }
      if (!attachmentMatch[2] && method === "GET") {
        json(res, 200, { attachment: attachmentView(attachment) }, { "X-Request-Id": requestId });
        return;
      }
      if (!attachmentMatch[2] && method === "DELETE") {
        await unlink(attachment.storagePath).catch(() => undefined);
        await prisma.attachment.delete({ where: { id: attachment.id } });
        json(res, 200, { ok: true }, { "X-Request-Id": requestId });
        return;
      }
      if (attachmentMatch[2] === "extract" && method === "POST") {
        if (
          !(attachment.mimeType.startsWith("text/") || attachment.mimeType === "application/json")
        ) {
          apiError(
            res,
            422,
            "ATTACHMENT_PARSER_UNAVAILABLE",
            "Text extraction is not available for this file format yet.",
            null,
            requestId,
          );
          return;
        }
        json(
          res,
          200,
          {
            attachment: attachmentView(attachment),
            text: (await readFile(attachment.storagePath, "utf8")).slice(0, 200_000),
          },
          { "X-Request-Id": requestId },
        );
        return;
      }
    }

    // ======== Models ========
    if (
      (url.pathname === "/models" || url.pathname === "/models/refresh") &&
      (method === "GET" || method === "POST")
    ) {
      const models = await listModelsForUser(auth.user.id, method === "POST");
      json(
        res,
        200,
        { models, refreshedAt: new Date().toISOString() },
        { "X-Request-Id": requestId },
      );
      return;
    }
    const modelMatch = url.pathname.match(/^\/models\/([^/]+)$/);
    if (modelMatch && method === "PATCH") {
      const input = z
        .object({
          favorite: z.boolean().optional(),
          visible: z.boolean().optional(),
          active: z.boolean().optional(),
          defaultForProvider: z.boolean().optional(),
        })
        .parse(await body(request));
      const model = await prisma.model.findFirst({
        where: { modelName: decodeURIComponent(modelMatch[1]), provider: { userId: auth.user.id } },
        include: { provider: true },
      });
      if (!model) {
        apiError(res, 404, "MODEL_NOT_FOUND", "Model not found.", null, requestId);
        return;
      }
      const providerOptions = parseModelMetadata(model.provider.optionsJson);
      const preferences =
        providerOptions.modelPreferences && typeof providerOptions.modelPreferences === "object"
          ? { ...(providerOptions.modelPreferences as Record<string, unknown>) }
          : {};
      if (input.favorite !== undefined) {
        if (input.favorite) preferences[model.modelName] = "favorite";
        else delete preferences[model.modelName];
      }
      const shouldUpdateProvider = input.favorite !== undefined || input.defaultForProvider;
      const nextProvider = shouldUpdateProvider
        ? await prisma.provider.update({
            where: { id: model.providerId },
            data: {
              ...(input.defaultForProvider ? { defaultModel: model.modelName } : {}),
              ...(input.favorite !== undefined
                ? {
                    optionsJson: JSON.stringify({
                      ...providerOptions,
                      modelPreferences: preferences,
                    }),
                  }
                : {}),
            },
          })
        : model.provider;
      const updated = await prisma.model.update({
        where: { id: model.id },
        data: {
          ...(input.visible === undefined && input.active === undefined
            ? {}
            : { active: input.visible ?? input.active }),
        },
        include: { provider: true },
      });
      json(
        res,
        200,
        { model: modelView({ ...updated, provider: nextProvider }) },
        { "X-Request-Id": requestId },
      );
      return;
    }

    // ======== Chat ========
    if (url.pathname === "/chat" && method === "POST") {
      const input = ChatRequestSchema.parse(await body(request));
      const providers = await prisma.provider.findMany({ where: { userId: auth.user.id } });
      const provider = resolveProvider(providers, input.providerId);
      if (!provider) {
        apiError(
          res,
          400,
          "PROVIDER_NOT_CONFIGURED",
          "No provider configured for this request.",
          null,
          requestId,
        );
        return;
      }
      const latest = input.messages[input.messages.length - 1];
      if (latest.role !== "user") {
        apiError(
          res,
          400,
          "VALIDATION_ERROR",
          "The last message must be from the user.",
          null,
          requestId,
        );
        return;
      }
      const conversation = input.conversationId
        ? await prisma.conversation.findFirst({
            where: { id: input.conversationId, userId: auth.user.id },
          })
        : await prisma.conversation.create({
            data: {
              title: latest.content.slice(0, 80) || "New conversation",
              userId: auth.user.id,
              providerId: provider.id,
              model: input.model,
            },
          });
      if (!conversation) {
        apiError(res, 404, "RESOURCE_NOT_FOUND", "Conversation not found.", null, requestId);
        return;
      }
      await prisma.message.create({
        data: { role: "user", content: latest.content, conversationId: conversation.id },
      });
      const result = await chatWithProvider({ config: providerConfig(provider), request: input });
      await prisma.message.create({
        data: { role: "assistant", content: result.content, conversationId: conversation.id },
      });
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });
      json(res, 200, { ...result, conversationId: conversation.id }, { "X-Request-Id": requestId });
      return;
    }

    if (url.pathname === "/chat/stream" && method === "POST") {
      await handleStream(request, res, requestId);
      return;
    }
    if (url.pathname === "/chat/cancel" && method === "POST") {
      const input = z
        .object({
          requestId: z.string().min(1).optional(),
          generationId: z.string().min(1).optional(),
        })
        .parse(await body(request));
      const generation = input.generationId
        ? getGeneration(input.generationId)
        : input.requestId
          ? getGenerationByRequestId(input.requestId)
          : undefined;
      if (generation && generation.alive) {
        generation.finish("cancelled");
        await prisma.message
          .update({
            where: { id: generation.messageId },
            data: { content: generation.content, status: "cancelled" },
          })
          .catch(() => undefined);
        generation.abort();
        generation.emit("message.error", { code: "CANCELLED", message: "The generation was stopped." });
      }
      json(res, 200, { ok: true }, { "X-Request-Id": requestId });
      return;
    }

    // ======== Resume an in-flight conversation generation ========
    // After a page refresh the conversation already contains the partially
    // generated assistant message (status "streaming"). This route re-attaches
    // the live provider stream: it replays the content persisted so far, then
    // keeps streaming deltas until the generation completes.
    if (url.pathname === "/chat/resume" && method === "POST") {
      const input = z
        .object({
          conversationId: z.string().min(1),
          clientMessageId: z.string().min(1).max(100).optional(),
        })
        .parse(await body(request));
      const conversation = await prisma.conversation.findFirst({
        where: { id: input.conversationId, userId: auth.user.id },
      });
      if (!conversation) {
        apiError(res, 404, "CONVERSATION_NOT_FOUND", "Conversation not found.", null, requestId);
        return;
      }
      const streamingMessage = await prisma.message.findFirst({
        where: { conversationId: conversation.id, role: "assistant", status: { in: ["streaming", "interrupted"] } },
        orderBy: { createdAt: "desc" },
      });
      if (!streamingMessage) {
        apiError(res, 404, "GENERATION_NOT_FOUND", "No generation is currently in progress.", null, requestId);
        return;
      }
      const generation = streamingMessage.generationId
        ? getGeneration(streamingMessage.generationId)
        : undefined;
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Request-Id": requestId,
      });
      if (generation && generation.alive) {
        console.log(`[resume] ${requestId} · generation=${generation.id} · status=${generation.status}`);
        let closed = false;
        const detach = generation.subscribe((name, data) => {
          if (res.writableEnded) {
            detach();
            return;
          }
          if (name === "message.completed" || name === "message.error") {
            sse(res, name, data);
            res.end();
            closed = true;
            detach();
            return;
          }
          sse(res, name, data);
        });
        sse(res, "message.resync", {
          content: generation.content,
          reasoning: generation.reasoning,
          status: generation.status,
          messageId: streamingMessage.id,
          generationId: generation.id,
        });
        sse(res, "generation.status", { status: "streaming", elapsedMs: 0 });
        if (generation.status === "completed" || generation.status === "error" || generation.status === "cancelled") {
          if (generation.status === "error" && generation.error)
            sse(res, "message.error", generation.error);
          sse(res, "message.completed", {
            conversationId: conversation.id,
            messageId: streamingMessage.id,
          });
          res.end();
        }
        res.on("close", () => detach());
      } else if (streamingMessage.status === "interrupted") {
        // The provider cut the stream mid-answer and the generation is no longer
        // active. The partial response was already preserved and marked
        // "interrupted" — resync it so the "Continuer" affordance reappears.
        sse(res, "message.resync", {
          content: streamingMessage.content,
          reasoning: undefined,
          status: "interrupted",
          messageId: streamingMessage.id,
        });
        sse(res, "message.interrupted", {
          messageId: streamingMessage.id,
          content: streamingMessage.content,
          generationId: streamingMessage.generationId,
          canResume: true,
        });
        res.end();
      } else {
        // The generation is no longer active (interrupted by a restart or an
        // aborted provider run). Preserve the partial content and surface it.
        await prisma.message
          .update({
            where: { id: streamingMessage.id },
            data: { status: "error", errorText: "The generation was interrupted. The partial response was preserved." },
          })
          .catch(() => undefined);
        sse(res, "message.resync", {
          content: streamingMessage.content,
          reasoning: undefined,
          status: "error",
          messageId: streamingMessage.id,
        });
        sse(res, "message.error", {
          code: "GENERATION_INTERRUPTED",
          message: "The generation was interrupted. The partial response was preserved.",
        });
        res.end();
      }
      return;
    }

    // ======== Continue an interrupted generation ========
    // The provider cut the stream mid-answer. The partial response is preserved
    // and marked "interrupted". This route resumes generation INTO THE SAME
    // message: the partial answer is passed back as context with a "continue"
    // instruction, and new deltas are appended to the existing row.
    if (url.pathname === "/chat/continue" && method === "POST") {
      await handleContinue(request, res, requestId);
      return;
    }

    // ======== Conversations ========
    if (url.pathname === "/conversations" && method === "GET") {
      const cursor = url.searchParams.get("cursor");
      const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20));
      const conversations = await prisma.conversation.findMany({
        where: { userId: auth.user.id },
        orderBy: [{ pinnedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      const hasMore = conversations.length > limit;
      if (hasMore) conversations.pop();
      json(
        res,
        200,
        {
          conversations,
          cursor: hasMore ? conversations[conversations.length - 1]?.id : undefined,
          hasMore,
        },
        { "X-Request-Id": requestId },
      );
      return;
    }

    if (url.pathname === "/conversations" && method === "POST") {
      const input = conversationSchema.parse(await body(request));
      const provider = await prisma.provider.findFirst({
        where: { id: input.providerId, userId: auth.user.id },
      });
      if (!provider) {
        apiError(res, 404, "RESOURCE_NOT_FOUND", "Provider not found.", null, requestId);
        return;
      }
      if (input.idempotencyKey) {
        const existing = await prisma.conversation.findFirst({
          where: { id: input.idempotencyKey, userId: auth.user.id },
        });
        if (existing) {
          json(res, 200, { conversation: existing }, { "X-Request-Id": requestId });
          return;
        }
      }
      const conversation = await prisma.conversation.create({
        data: {
          id: input.idempotencyKey || undefined,
          title: input.title || "New conversation",
          providerId: provider.id,
          model: input.model,
          userId: auth.user.id,
        },
      });
      json(res, 201, { conversation }, { "X-Request-Id": requestId });
      return;
    }

    // Must be registered before the /conversations/:id pattern below.
    if (url.pathname === "/conversations/search" && method === "GET") {
      const raw = url.searchParams.get("q")?.trim();
      if (!raw) {
        apiError(res, 400, "VALIDATION_ERROR", "A search query is required.", null, requestId);
        return;
      }
      const q = raw.slice(0, 200);
      const limit = Math.min(25, Math.max(1, Number(url.searchParams.get("limit")) || 10));
      const conversations = await prisma.conversation.findMany({
        where: {
          userId: auth.user.id,
          OR: [{ title: { contains: q } }, { messages: { some: { content: { contains: q } } } }],
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
      });
      json(res, 200, { conversations, hasMore: false }, { "X-Request-Id": requestId });
      return;
    }

    const conversationMatch = url.pathname.match(
      /^\/conversations\/([^/]+)(?:\/(messages|archive|pin))?$/,
    );
    if (conversationMatch) {
      const conversation = await prisma.conversation.findFirst({
        where: { id: conversationMatch[1], userId: auth.user.id },
      });
      if (!conversation) {
        apiError(res, 404, "RESOURCE_NOT_FOUND", "Conversation not found.", null, requestId);
        return;
      }

      if (conversationMatch[2] === "messages" && method === "GET") {
        const cursor = url.searchParams.get("cursor");
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
        const messages = await prisma.message.findMany({
          where: { conversationId: conversation.id },
          orderBy: { createdAt: "asc" },
          take: limit + 1,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        const hasMore = messages.length > limit;
        if (hasMore) messages.pop();
        json(
          res,
          200,
          { messages, cursor: hasMore ? messages[messages.length - 1]?.id : undefined, hasMore },
          { "X-Request-Id": requestId },
        );
        return;
      }

      if (conversationMatch[2] === "messages" && method === "POST") {
        const input = z
          .object({ content: z.string().min(1).max(200_000) })
          .parse(await body(request));
        const message = await prisma.message.create({
          data: { role: "user", content: input.content, conversationId: conversation.id },
        });
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { updatedAt: new Date() },
        });
        json(res, 201, { message }, { "X-Request-Id": requestId });
        return;
      }

      if (conversationMatch[2] === "archive" && method === "POST") {
        const updated = await prisma.conversation.update({
          where: { id: conversation.id },
          data: { archivedAt: conversation.archivedAt ? null : new Date() },
        });
        json(res, 200, { conversation: updated }, { "X-Request-Id": requestId });
        return;
      }

      if (conversationMatch[2] === "pin" && method === "POST") {
        const updated = await prisma.conversation.update({
          where: { id: conversation.id },
          data: { pinnedAt: conversation.pinnedAt ? null : new Date() },
        });
        json(res, 200, { conversation: updated }, { "X-Request-Id": requestId });
        return;
      }

      if (!conversationMatch[2] && method === "GET") {
        const messages = await prisma.message.findMany({
          where: { conversationId: conversation.id },
          orderBy: { createdAt: "asc" },
        });
        json(
          res,
          200,
          { conversation: { ...conversation, messages } },
          { "X-Request-Id": requestId },
        );
        return;
      }

      if (!conversationMatch[2] && method === "PATCH") {
        const input = conversationPatchSchema.parse(await body(request));
        const updated = await prisma.conversation.update({
          where: { id: conversation.id },
          data: { title: input.title || undefined, updatedAt: new Date() },
        });
        json(res, 200, { conversation: updated }, { "X-Request-Id": requestId });
        return;
      }

      if (!conversationMatch[2] && method === "DELETE") {
        await prisma.conversation.delete({ where: { id: conversation.id } });
        json(
          res,
          200,
          { ok: true, deletedConversationId: conversation.id },
          { "X-Request-Id": requestId },
        );
        return;
      }
    }

    // ======== Work Mode (Local Agent) ========
    const workModeSchema = z.object({
      root: z.string().min(1),
      mode: z.enum(["trusted", "restricted"]).default("restricted"),
    });
    const workModePatchSchema = z.object({ mode: z.enum(["trusted", "restricted"]) });
    const workCommandSchema = z.object({ command: z.string().min(1), cwd: z.string().optional() });
    const workMoveSchema = z.object({ from: z.string().min(1), to: z.string().min(1) });
    const workApprovalSchema = z.object({ approved: z.boolean() });
    const workAgentBodySchema = z.object({
      workspaceId: z.string().min(1),
      providerId: z.string().min(1),
      model: z.string().min(1).max(200),
      messages: z
        .array(
          z.object({
            role: z.enum(["system", "user", "assistant"]),
            content: z.string().max(200_000),
            reasoning: z.string().optional(),
            id: z.string().optional(),
            createdAt: z.string().optional(),
          }),
        )
        .min(1)
        .max(100),
      instructions: z.string().max(20_000).optional(),
      maxTurns: z.number().int().min(1).max(40).optional(),
      budget: z
        .object({
          total: z.number().int().min(1).max(10_000).optional(),
          hardTurns: z.number().int().min(1).max(1000).optional(),
          stallRepeats: z.number().int().min(2).max(50).optional(),
          warnAtFraction: z.number().min(0.05).max(0.9).optional(),
        })
        .optional(),
      resume: z
        .object({
          messages: z
            .array(
              z.object({
                role: z.enum(["system", "user", "assistant", "tool"]),
                content: z.string().max(200_000),
                id: z.string().optional(),
                createdAt: z.string().optional(),
                reasoning: z.string().optional(),
                toolCallId: z.string().optional(),
                toolCalls: z
                  .array(z.object({ id: z.string().optional(), name: z.string(), arguments: z.string() }))
                  .optional(),
              }),
            )
            .min(1)
            .max(100),
          changedFiles: z.array(z.string()).default([]),
        })
        .optional(),
      team: z
        .object({
          enabled: z.boolean().default(false),
          mode: z.enum(["auto", "custom"]).default("auto"),
          roles: z.array(z.enum(["dev", "design", "marketing", "content", "seo", "qa", "security", "data"])).min(0).max(5).default([]),
        })
        .optional(),
    });

    async function forwardWorkError(response: Response): Promise<void> {
      const data = (await response.json().catch(() => ({}))) as { code?: string; message?: string };
      apiError(
        res,
        response.status,
        data.code || "LOCAL_AGENT_ERROR",
        data.message || "The Local Agent returned an error.",
        null,
        requestId,
      );
    }

    if (url.pathname === "/work/token" && method === "POST") {
      const input = z
        .object({ token: z.string().trim().min(1).max(500) })
        .parse(await body(request));
      await setLocalAgentToken(input.token);
      json(res, 200, { ok: true }, { "X-Request-Id": requestId });
      return;
    }

    if (url.pathname === "/work/status" && method === "GET") {
      const agent = await localAgentStatusLayer();
      let workspaces: unknown[] = [];
      if (agent.connection === "connected") {
        const workspacesResponse = await localAgentFetch("/workspaces").catch(() => null);
        if (workspacesResponse?.ok) {
          const data = (await workspacesResponse.json().catch(() => ({}))) as { workspaces?: unknown[] };
          workspaces = data.workspaces ?? [];
        }
      }
      const providerRows = await prisma.provider.findMany({
        where: { userId: auth.user.id },
        select: { id: true, providerKey: true, kind: true, name: true, active: true, defaultModel: true, apiKey: true },
        orderBy: { id: "asc" },
      });
      const providers = providerRows.map((row) => {
        const hasSecret = Boolean(decryptProviderSecret(row.apiKey));
        return {
          id: row.id,
          providerKey: canonicalProviderKey(row.providerKey),
          kind: row.kind,
          name: row.name,
          enabled: row.active,
          configured: hasSecret,
          defaultModel: row.defaultModel,
        };
      });
      const providerStatus = providers.some((provider) => provider.enabled && provider.configured)
        ? "ready"
        : providers.some((provider) => provider.configured)
          ? "invalid"
          : "not_configured";
      json(
        res,
        200,
        {
          available: agent.connection === "connected",
          service: "aegis-local-agent",
          agent,
          health: agent.process === "online" ? { service: "aegis-local-agent", version: agent.version, port: agent.port } : null,
          workspaces,
          providers: {
            status: providerStatus,
            configured: providers.filter((provider) => provider.configured).length,
            enabled: providers.filter((provider) => provider.enabled).length,
            ready: providerStatus === "ready",
            list: providers,
          },
        },
        { "X-Request-Id": requestId },
      );
      return;
    }

    if (url.pathname === "/work/connect" && method === "POST") {
      try {
        const result = await connectLocalAgent();
        json(res, 200, { ...result, ok: true }, { "X-Request-Id": requestId });
      } catch (error) {
        if (error instanceof LocalAgentUnavailableError) {
          apiError(res, 502, error.code, error.message, null, requestId);
          return;
        }
        throw error;
      }
      return;
    }

    // ======== Work Mode: Sessions (server-persisted chat history) ========
    const workSessionCreateSchema = z.object({
      title: z.string().trim().min(1).max(120).optional(),
      workspaceId: z.string().max(500).nullable().optional(),
      providerId: z.string().nullable().optional(),
      model: z.string().max(200).nullable().optional(),
      projectId: z.string().nullable().optional(),
      messages: z.unknown().optional(),
    });
    const workSessionPatchSchema = z.object({
      title: z.string().trim().min(1).max(120).optional(),
      status: z.enum(["active", "archived"]).optional(),
      workspaceId: z.string().max(500).nullable().optional(),
      providerId: z.string().nullable().optional(),
      model: z.string().max(200).nullable().optional(),
      projectId: z.string().nullable().optional(),
      messages: z.unknown().optional(),
    });
    const userId = auth.user.id;
    async function getOwnedWorkSession(id: string) {
      return prisma.workSession.findFirst({ where: { id, userId: userId } });
    }
    async function assertOwnedProject(projectId: string | null | undefined): Promise<boolean> {
      if (!projectId) return true;
      const project = await prisma.project.findFirst({ where: { id: projectId, userId: userId } });
      return Boolean(project);
    }

    if (url.pathname === "/work/sessions" && method === "GET") {
      const sessions = await prisma.workSession.findMany({
        where: { userId: auth.user.id, status: "active" },
        select: {
          id: true,
          title: true,
          status: true,
          workspaceId: true,
          providerId: true,
          model: true,
          projectId: true,
          createdAt: true,
          updatedAt: true,
          project: { select: { id: true, name: true, color: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
      });
      json(res, 200, { sessions }, { "X-Request-Id": requestId });
      return;
    }

    if (url.pathname === "/work/sessions" && method === "POST") {
      const input = workSessionCreateSchema.parse(await body(request, 6_000_000));
      if (!(await assertOwnedProject(input.projectId))) {
        apiError(res, 404, "RESOURCE_NOT_FOUND", "Project not found.", null, requestId);
        return;
      }
      const session = await prisma.workSession.create({
        data: {
          title: input.title || "Nouvelle session",
          workspaceId: input.workspaceId ?? null,
          providerId: input.providerId ?? null,
          model: input.model ?? null,
          projectId: input.projectId ?? null,
          messages: input.messages as Prisma.InputJsonValue | undefined,
          userId: auth.user.id,
        },
      });
      json(res, 201, { session }, { "X-Request-Id": requestId });
      return;
    }

    const workSessionMatch = url.pathname.match(/^\/work\/sessions\/([^/]+)$/);
    if (workSessionMatch) {
      const session = await getOwnedWorkSession(workSessionMatch[1]);
      if (!session) {
        apiError(res, 404, "RESOURCE_NOT_FOUND", "Work session not found.", null, requestId);
        return;
      }
      if (method === "GET") {
        json(res, 200, { session }, { "X-Request-Id": requestId });
        return;
      }
      if (method === "PATCH") {
        const input = workSessionPatchSchema.parse(await body(request, 6_000_000));
        if (!(await assertOwnedProject(input.projectId))) {
          apiError(res, 404, "RESOURCE_NOT_FOUND", "Project not found.", null, requestId);
          return;
        }
        const updated = await prisma.workSession.update({
          where: { id: session.id },
          data: {
            title: input.title,
            status: input.status,
            workspaceId: input.workspaceId,
            providerId: input.providerId,
            model: input.model,
            projectId: input.projectId,
            messages: input.messages as Prisma.InputJsonValue | undefined,
            updatedAt: new Date(),
          },
        });
        json(res, 200, { session: updated }, { "X-Request-Id": requestId });
        return;
      }
      if (method === "DELETE") {
        await prisma.workSession.delete({ where: { id: session.id } });
        json(res, 200, { ok: true, deletedSessionId: session.id }, { "X-Request-Id": requestId });
        return;
      }
    }

    if (url.pathname === "/work/workspaces" && method === "GET") {
      const { status, data } = await localAgentJson("/workspaces");
      if (status !== 200) {
        await forwardWorkError({ status, json: async () => data } as Response);
        return;
      }
      json(res, 200, data, { "X-Request-Id": requestId });
      return;
    }

    if (url.pathname === "/work/workspaces" && method === "POST") {
      const input = workModeSchema.parse(await body(request));
      const { status, data } = await localAgentJson("/workspaces", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (status !== 201) {
        await forwardWorkError({ status, json: async () => data } as Response);
        return;
      }
      json(res, 201, data, { "X-Request-Id": requestId });
      return;
    }
    if (url.pathname === "/work/workspaces/pick" && method === "POST") {
      const { status, data } = await localAgentJson("/workspaces/pick", { method: "POST" });
      if (status !== 200) {
        await forwardWorkError({ status, json: async () => data } as Response);
        return;
      }
      json(res, 200, data, { "X-Request-Id": requestId });
      return;
    }

    const workSegments = url.pathname
      .replace(/^\/work\//, "")
      .split("/")
      .filter(Boolean);
    if (workSegments[0] === "workspaces" && workSegments.length >= 2) {
      const workspaceId = workSegments[1];
      const sub = workSegments[2];

      if (!sub && method === "DELETE") {
        const { status, data } = await localAgentJson(
          `/workspaces/${encodeURIComponent(workspaceId)}`,
          { method: "DELETE" },
        );
        if (status !== 200) {
          await forwardWorkError({ status, json: async () => data } as Response);
          return;
        }
        json(res, 200, data, { "X-Request-Id": requestId });
        return;
      }
      if (!sub && method === "PATCH") {
        const input = workModePatchSchema.parse(await body(request));
        const { status, data } = await localAgentJson(
          `/workspaces/${encodeURIComponent(workspaceId)}`,
          { method: "PATCH", body: JSON.stringify(input) },
        );
        if (status !== 200) {
          await forwardWorkError({ status, json: async () => data } as Response);
          return;
        }
        json(res, 200, data, { "X-Request-Id": requestId });
        return;
      }
      if (sub === "tree" && method === "GET") {
        const { status, data } = await localAgentJson(
          `/workspaces/${encodeURIComponent(workspaceId)}/tree`,
        );
        if (status !== 200) {
          await forwardWorkError({ status, json: async () => data } as Response);
          return;
        }
        json(res, 200, data, { "X-Request-Id": requestId });
        return;
      }
      if (sub === "file" && method === "GET") {
        const filePath = url.searchParams.get("path");
        if (!filePath) {
          apiError(res, 400, "VALIDATION_ERROR", "A file path is required.", null, requestId);
          return;
        }
        const { status, data } = await localAgentJson(
          `/workspaces/${encodeURIComponent(workspaceId)}/file?path=${encodeURIComponent(filePath)}`,
        );
        if (status !== 200) {
          await forwardWorkError({ status, json: async () => data } as Response);
          return;
        }
        json(res, 200, data, { "X-Request-Id": requestId });
        return;
      }
      if (sub === "file" && method === "POST") {
        const input = z.object({ path: z.string().min(1), content: z.string() }).parse(await body(request));
        const { status, data } = await localAgentJson(
          `/workspaces/${encodeURIComponent(workspaceId)}/file`,
          { method: "POST", body: JSON.stringify(input) },
        );
        if (status !== 200) {
          await forwardWorkError({ status, json: async () => data } as Response);
          return;
        }
        json(res, 200, data, { "X-Request-Id": requestId });
        return;
      }
      if (sub === "undo" && method === "POST") {
        const { status, data } = await localAgentJson(
          `/workspaces/${encodeURIComponent(workspaceId)}/undo`,
          { method: "POST", body: "{}" },
        );
        if (status !== 200) {
          await forwardWorkError({ status, json: async () => data } as Response);
          return;
        }
        json(res, 200, data, { "X-Request-Id": requestId });
        return;
      }
      if (sub === "search" && method === "GET") {
        const query = url.searchParams.get("query");
        if (!query) {
          apiError(res, 400, "VALIDATION_ERROR", "A search query is required.", null, requestId);
          return;
        }
        const pathFilter = url.searchParams.get("path") || undefined;
        const { status, data } = await localAgentJson(
          `/workspaces/${encodeURIComponent(workspaceId)}/search?query=${encodeURIComponent(query)}${pathFilter ? `&path=${encodeURIComponent(pathFilter)}` : ""}`,
        );
        if (status !== 200) {
          await forwardWorkError({ status, json: async () => data } as Response);
          return;
        }
        json(res, 200, data, { "X-Request-Id": requestId });
        return;
      }
      if (sub === "command" && method === "POST") {
        const input = workCommandSchema.parse(await body(request));
        const { status, data } = await localAgentJson(
          `/workspaces/${encodeURIComponent(workspaceId)}/command`,
          { method: "POST", body: JSON.stringify(input) },
        );
        if (status === 402) {
          apiError(
            res,
            402,
            "APPROVAL_REQUIRED",
            "This command requires explicit approval on the Local Agent.",
            (data as { details?: unknown })?.details ?? null,
            requestId,
          );
          return;
        }
        if (status !== 200) {
          await forwardWorkError({ status, json: async () => data } as Response);
          return;
        }
        json(res, 200, data, { "X-Request-Id": requestId });
        return;
      }
      if (sub === "file" && method === "DELETE") {
        const filePath = url.searchParams.get("path");
        if (!filePath) {
          apiError(res, 400, "VALIDATION_ERROR", "A file path is required.", null, requestId);
          return;
        }
        const { status, data } = await localAgentJson(
          `/workspaces/${encodeURIComponent(workspaceId)}/file?path=${encodeURIComponent(filePath)}`,
          { method: "DELETE" },
        );
        if (status !== 200) {
          await forwardWorkError({ status, json: async () => data } as Response);
          return;
        }
        json(res, 200, data, { "X-Request-Id": requestId });
        return;
      }
      if (sub === "move" && method === "POST") {
        const input = workMoveSchema.parse(await body(request));
        const { status, data } = await localAgentJson(
          `/workspaces/${encodeURIComponent(workspaceId)}/move`,
          { method: "POST", body: JSON.stringify(input) },
        );
        if (status !== 200) {
          await forwardWorkError({ status, json: async () => data } as Response);
          return;
        }
        json(res, 200, data, { "X-Request-Id": requestId });
        return;
      }
      if (sub === "reveal" && method === "POST") {
        const input = await body(request);
        const { status, data } = await localAgentJson(
          `/workspaces/${encodeURIComponent(workspaceId)}/reveal`,
          { method: "POST", body: JSON.stringify(input ?? {}) },
        );
        if (status !== 200) {
          await forwardWorkError({ status, json: async () => data } as Response);
          return;
        }
        json(res, 200, data, { "X-Request-Id": requestId });
        return;
      }
      if (sub === "git" && method === "GET") {
        const { status, data } = await localAgentJson(`/workspaces/${encodeURIComponent(workspaceId)}/git`);
        if (status !== 200) {
          await forwardWorkError({ status, json: async () => data } as Response);
          return;
        }
        json(res, 200, data, { "X-Request-Id": requestId });
        return;
      }
      if (sub === "approvals" && workSegments.length >= 4 && method === "POST") {
        const approvalId = workSegments[3];
        const input = workApprovalSchema.parse(await body(request));
        const { status, data } = await localAgentJson(
          `/approvals/${encodeURIComponent(approvalId)}`,
          { method: "POST", body: JSON.stringify(input) },
        );
        if (status !== 200) {
          await forwardWorkError({ status, json: async () => data } as Response);
          return;
        }
        json(res, 200, data, { "X-Request-Id": requestId });
        return;
      }
    }

    if (url.pathname === "/work/agent" && method === "POST") {
      const input = workAgentBodySchema.parse(await body(request, 10_000_000));
      const provider = await prisma.provider.findFirst({
        where: { id: input.providerId, userId: auth.user.id },
      });
      if (!provider) {
        apiError(res, 404, "RESOURCE_NOT_FOUND", "Provider not found.", null, requestId);
        return;
      }
      const providerConfigForWork = providerConfig(provider);
      const upstreamRequest = {
        workspaceId: input.workspaceId,
        model: input.model,
        provider: providerConfigForWork,
        messages: input.messages,
        instructions: input.instructions,
        maxTurns: input.maxTurns,
        budget: input.budget,
        resume: input.resume,
        team: input.team,
      };
      const upstream = await localAgentFetch("/agent", {
        method: "POST",
        body: JSON.stringify(upstreamRequest),
      });
      if (!upstream.ok || !upstream.body) {
        await forwardWorkError(upstream);
        return;
      }
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Request-Id": requestId,
      });
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      // Stop pulling from the Local Agent as soon as the browser leaves, so the
      // generation and its SSE stream are released instead of being kept alive.
      let clientGone = false;
      const onClientClose = () => {
        clientGone = true;
        void upstream.body?.cancel().catch(() => {});
      };
      guardRes(res);
      res.on("close", onClientClose);
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: !done });
          const chunks = buffer.split(/\r?\n\r?\n/);
          buffer = chunks.pop() ?? "";
          for (const chunk of chunks) {
            if (clientGone || res.destroyed || res.writableEnded) return;
            try {
              res.write(chunk + "\n\n");
            } catch {
              return;
            }
          }
        }
        if (buffer && !clientGone && !res.destroyed) {
          try {
            res.write(buffer + "\n\n");
          } catch {
            // client is gone
          }
        }
      } finally {
        res.off("close", onClientClose);
        reader.releaseLock();
        if (!res.writableEnded && !clientGone && !res.destroyed) res.end();
      }
      return;
    }

    apiError(res, 404, "RESOURCE_NOT_FOUND", "Route not found.", null, requestId);
  } catch (error) {
    if (error instanceof z.ZodError) {
      apiError(
        res,
        400,
        "VALIDATION_ERROR",
        "Request validation failed.",
        error.flatten(),
        requestId,
      );
      return;
    }
    if (error instanceof ProviderSecretError) {
      apiError(res, 500, error.code, error.message, null, requestId);
      return;
    }
    if (error instanceof RequestBodyError) {
      apiError(res, error.status, error.code, error.message, null, requestId);
      return;
    }
    const providerError = toApiError(error);
    const status =
      providerError.code === "PROVIDER_AUTH_FAILED"
        ? 401
        : providerError.code === "PROVIDER_RATE_LIMITED"
          ? 429
          : providerError.code === "PROVIDER_MODEL_UNAVAILABLE" ||
              providerError.code === "NO_MODELS_AVAILABLE"
            ? 422
            : providerError.code?.includes("TIMEOUT") ||
                providerError.code === "PROVIDER_UNAVAILABLE"
              ? 504
              : 502;
    apiError(
      res,
      status,
      providerError.code,
      providerError.message,
      providerError.details,
      requestId,
    );
  }
}

export const server = http.createServer((request, res) => {
  const origin = request.headers.origin;
  const allowedOrigins = new Set([
    config.webOrigin,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    config.desktopOrigin,
    "http://localhost:1420",
    "http://127.0.0.1:1420",
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost",
  ]);
  if (origin && allowedOrigins.has(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  void handle(request, res).catch((error) => {
    if (!res.headersSent)
      apiError(
        res,
        500,
        "INTERNAL_ERROR",
        error instanceof Error ? error.message : "Unexpected server error.",
      );
    else res.end();
  });
});

if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  server.on("error", (error: NodeJS.ErrnoException) => {
    console.error(`[api] server error: ${error.code ?? "UNKNOWN"} ${error.message}`);
    if (error.code === "EADDRINUSE") {
      console.error(`[api] port ${config.apiPort} is already in use. Is another Aegis API running?`);
      process.exit(1);
    }
  });

  // Persistent, structured crash + memory logging (logs/api.log and
  // logs/api.error.log). Crash records survive the console window closing.
  const aegisLogDir = process.env.AEGIS_LOG_DIR || path.resolve(process.cwd(), "logs");
  installCrashLogger({ service: "api", logDir: aegisLogDir });

  server.listen(config.apiPort, "127.0.0.1", () =>
    console.log(`Aegis API listening on http://127.0.0.1:${config.apiPort}`),
  );
}
