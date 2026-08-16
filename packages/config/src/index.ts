import { z } from "zod";

export const runtimeConfigSchema = z.object({
  apiPort: z.coerce.number().int().positive().default(4000),
  apiUrl: z.string().url().default("http://127.0.0.1:4000"),
  databaseUrl: z.string().default("file:./dev.db"),
  webOrigin: z.string().url().default("http://127.0.0.1:3000"),
  desktopOrigin: z.string().url().default("http://localhost:1420"),
  mailMode: z.enum(["console", "smtp"]).default("console"),
  requireEmailVerification: z.boolean().default(false),
  sessionDays: z.coerce.number().int().positive().max(365).default(30),
  sessionSecret: z.string().min(16).default("aegis-development-secret-change-me"),
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().int().positive().default(587),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  openRouterBaseUrl: z.string().url().default("https://openrouter.ai/api/v1"),
  nvidiaNimBaseUrl: z.string().url().default("https://integrate.api.nvidia.com/v1"),
  xaiBaseUrl: z.string().url().default("https://api.x.ai/v1"),
});

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

export function getRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  return runtimeConfigSchema.parse({
    apiPort: env.AEGIS_API_PORT,
    apiUrl: env.AEGIS_API_URL,
    databaseUrl: env.DATABASE_URL,
    webOrigin: env.AEGIS_WEB_ORIGIN,
    desktopOrigin: env.AEGIS_DESKTOP_ORIGIN,
    mailMode: env.AEGIS_MAIL_MODE,
    requireEmailVerification: env.REQUIRE_EMAIL_VERIFICATION === undefined ? undefined : env.REQUIRE_EMAIL_VERIFICATION.toLowerCase() === "true",
    sessionDays: env.AEGIS_SESSION_DAYS,
    sessionSecret: env.AEGIS_SESSION_SECRET,
    smtpHost: env.AEGIS_SMTP_HOST,
    smtpPort: env.AEGIS_SMTP_PORT,
    smtpUser: env.AEGIS_SMTP_USER,
    smtpPassword: env.AEGIS_SMTP_PASSWORD,
    openRouterBaseUrl: env.OPENROUTER_BASE_URL,
    nvidiaNimBaseUrl: env.NVIDIA_NIM_BASE_URL,
    xaiBaseUrl: env.XAI_BASE_URL,
  });
}

export const defaultProviders = [
  { id: "ollama", kind: "ollama" as const, name: "Ollama Local", baseUrl: "http://127.0.0.1:11434", active: true },
  { id: "lmstudio", kind: "lmstudio" as const, name: "LM Studio Local", baseUrl: "http://127.0.0.1:1234/v1", active: true },
  { id: "nvidia-nim", kind: "nvidia-nim" as const, name: "NVIDIA NIM", baseUrl: "https://integrate.api.nvidia.com/v1", active: false },
  { id: "openrouter", kind: "openrouter" as const, name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", active: false },
  { id: "x-ai", kind: "x-ai" as const, name: "xAI", baseUrl: "https://api.x.ai/v1", active: false },
  { id: "huggingface", kind: "huggingface" as const, name: "Hugging Face", baseUrl: "https://router.huggingface.co/v1", active: false },
];
