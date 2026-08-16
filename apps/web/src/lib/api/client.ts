import { AegisApiClient } from "@aegis/api-client";
import { env } from "@/lib/config/env";

export const api = new AegisApiClient({ baseUrl: env.apiUrl, credentials: "include", timeoutMs: 15_000, retries: 1 });
