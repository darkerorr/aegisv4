import type { ProviderConfig, ProviderDiagnostic, ProviderDiagnosticCheck } from "@aegis/types";
import { createProvider } from "./index.js";
import { ProviderError, providerRateLimitCategory } from "./common.js";

/** Detail fields carried by ProviderError from common.ts (not part of the public type). */
type ProviderErrorDetails = {
  status?: unknown;
  retryAfter?: unknown;
  providerCode?: unknown;
  errorType?: unknown;
  body?: unknown;
};

function detailValue(error: unknown, key: keyof ProviderErrorDetails): unknown {
  const details = (error as { details?: Record<string, unknown> } | null)?.details;
  return details && typeof details === "object" ? details[key] : undefined;
}

function asStatus(error: unknown): number | undefined {
  const raw = (error as { status?: unknown } | null)?.status ?? detailValue(error, "status");
  return typeof raw === "number" ? raw : undefined;
}

function classify(error: unknown): ProviderDiagnostic["overall"] {
  if (error instanceof ProviderError) {
    switch (error.code) {
      case "PROVIDER_AUTH_FAILED":
        return "auth";
      case "PROVIDER_RATE_LIMITED":
        return providerRateLimitCategory(error) === "account" ? "quota" : "rate-limited";
      case "PROVIDER_MODEL_NOT_FOUND":
      case "PROVIDER_MODEL_UNAVAILABLE":
        return "model-missing";
      case "PROVIDER_CONNECT_TIMEOUT":
      case "PROVIDER_FIRST_TOKEN_TIMEOUT":
        return "network";
      case "PROVIDER_UPSTREAM_ERROR":
      case "PROVIDER_OVERLOADED":
        return "server";
      default:
        return "unknown";
    }
  }
  if (error instanceof Error && (error.name === "TypeError" || error.name === "AbortError")) {
    return "network";
  }
  return "unknown";
}

/**
 * Secret-free provider diagnostics. Runs two checks:
 *   1. GET /models       — validates the key, endpoint and model availability.
 *   2. minimal chat probe — a tiny completion against the probe model to detect
 *      model-level rate limits (Mistral hosts third-party GLM models that are
 *      rate-limited independently of the account), quota exhaustion, retired
 *      models, timeouts, network errors and server errors.
 * The API key is used in requests but NEVER appears in the returned structure.
 */
export async function diagnoseProvider(
  config: ProviderConfig,
  options: { model?: string; signal?: AbortSignal } = {},
): Promise<ProviderDiagnostic> {
  const startedAt = Date.now();
  const provider = createProvider(config);
  const keyConfigured = Boolean(config.apiKey?.trim());
  const checks: ProviderDiagnosticCheck[] = [];
  const sampleModels: string[] = [];
  let modelCount: number | undefined;
  let probeModel: string | undefined;
  let keyStatus: ProviderDiagnostic["keyStatus"] = keyConfigured ? "configured" : "missing";

  // ---- Check 1: model discovery (validates the key + endpoint) ----
  let check1Error: unknown;
  try {
    const models = await provider.listModels(options.signal);
    const names = models.map((model) => model.name);
    modelCount = names.length;
    sampleModels.push(...names.slice(0, 40));
    checks.push({
      name: "models",
      ok: true,
      status: 200,
      durationMs: Date.now() - startedAt,
    });
    const requested = options.model;
    if (requested) {
      probeModel = requested;
      if (modelCount > 0 && !names.includes(requested)) {
        checks.push({
          name: "model-availability",
          ok: false,
          status: 404,
          message: `Le modèle « ${requested} » n'est pas listé par ${config.name}. Il a peut-être été retiré, renommé ou n'est pas accessible pour cette clé.`,
        });
      }
    } else {
      probeModel =
        config.defaultModel && names.includes(config.defaultModel) ? config.defaultModel : names[0];
    }
  } catch (error) {
    check1Error = error;
    const status = asStatus(error);
    checks.push({
      name: "models",
      ok: false,
      status,
      durationMs: Date.now() - startedAt,
      providerCode: typeof detailValue(error, "providerCode") === "string" ? (detailValue(error, "providerCode") as string) : undefined,
      errorType: typeof detailValue(error, "errorType") === "string" ? (detailValue(error, "errorType") as string) : undefined,
      retryAfterSeconds: typeof detailValue(error, "retryAfter") === "number" ? (detailValue(error, "retryAfter") as number) : undefined,
      message: error instanceof Error ? error.message : "Provider unreachable.",
    });
    if (status === 401 || status === 403) keyStatus = "invalid";
    const body = String(detailValue(error, "body") ?? "");
    if (status === 401 && /expired|expire|revoked/i.test(body)) keyStatus = "expired";
  }

  let overall: ProviderDiagnostic["overall"] = "ok";
  let summary = "";

  const describeError = (error: unknown, scope: "models" | "chat-probe") => {
    const status = asStatus(error);
    const retryAfter = typeof detailValue(error, "retryAfter") === "number" ? (detailValue(error, "retryAfter") as number) : undefined;
    const providerCode = detailValue(error, "providerCode");
    const errorType = detailValue(error, "errorType");
    if (status === 401 || status === 403) {
      overall = "auth";
      summary =
        keyStatus === "expired"
          ? `La clé API ${config.name} a expiré (HTTP ${status}). Créez une nouvelle clé dans la console ${config.name} puis mettez-la à jour dans Paramètres → API.`
          : `La clé API ${config.name} a été rejetée (HTTP ${status}). Vérifiez la clé dans Paramètres → API.`;
      return;
    }
    if (status === 429) {
      overall = classify(error);
      if (overall === "quota") {
        summary = `Le compte ${config.name} a atteint sa limite (HTTP 429). Vérifiez le quota/le solde dans la console ${config.name}.`;
      } else if (scope === "chat-probe") {
        summary = `Le modèle « ${probeModel} » est actuellement limité par ${config.name} (HTTP 429, code ${String(providerCode ?? "?")} ${String(errorType ?? "")}). Choisissez un autre modèle de la liste (par ex. ${sampleModels.find((m) => m !== probeModel) ?? "le modèle par défaut du provider"}).${retryAfter ? ` Nouvelle tentative conseillée dans ${retryAfter}s.` : ""}`;
      } else {
        summary = `${config.name} est actuellement limité (HTTP 429${retryAfter ? ` — réessayez dans ${retryAfter}s` : ""}). Réessayez dans quelques instants.`;
      }
      return;
    }
    if (status === 404) {
      overall = "model-missing";
      summary =
        scope === "chat-probe"
          ? `Le modèle « ${probeModel} » n'est pas disponible sur ${config.name} (HTTP 404). Choisissez un modèle de la liste.`
          : `La liste des modèles n'a pas pu être chargée (HTTP 404) sur ${config.name}. Vérifiez l'URL de l'endpoint (${config.baseUrl}).`;
      return;
    }
    if (typeof status === "number" && status >= 500) {
      overall = "server";
      summary = `${config.name} a renvoyé une erreur serveur (HTTP ${status}). Réessayez dans quelques instants.`;
      return;
    }
    overall = classify(error);
    if (overall === "network") {
      summary = `Impossible de joindre ${config.name} (${error instanceof Error ? error.message : "erreur réseau"}). Vérifiez la connexion et l'URL de l'endpoint (${config.baseUrl}).`;
      return;
    }
    if (overall === "server") {
      summary = `${config.name} a renvoyé une erreur serveur. Réessayez dans quelques instants.`;
      return;
    }
    summary =
      scope === "chat-probe"
        ? `La requête minimale sur « ${probeModel} » a échoué : ${error instanceof Error ? error.message : "erreur inconnue"}.`
        : `La découverte des modèles a échoué : ${error instanceof Error ? error.message : "erreur inconnue"}.`;
  };

  // ---- Check 2: minimal chat probe ----
  if (keyConfigured && probeModel && modelCount !== 0 && !check1Error) {
    const probeStarted = Date.now();
    try {
      const response = await provider.chat(
        {
          providerId: config.id,
          model: probeModel,
          messages: [{ role: "user", content: "Answer with exactly one word: OK." }],
          privacyMode: "remote-provider",
          attachmentIds: [],
          toolMode: "auto",
          enabledTools: [],
        },
        options.signal,
      );
      checks.push({
        name: "chat-probe",
        ok: true,
        status: 200,
        durationMs: Date.now() - probeStarted,
        message: response.content ? undefined : "Réponse vide du modèle.",
      });
      overall = "ok";
      summary =
        modelCount !== undefined
          ? `${config.name} est accessible : ${modelCount} modèle(s) listé(s), probe sur « ${probeModel} » OK (${Date.now() - probeStarted} ms).`
          : `${config.name} est accessible (probe sur « ${probeModel} » OK).`;
    } catch (error) {
      const status = asStatus(error);
      checks.push({
        name: "chat-probe",
        ok: false,
        status,
        durationMs: Date.now() - probeStarted,
        providerCode: typeof detailValue(error, "providerCode") === "string" ? (detailValue(error, "providerCode") as string) : undefined,
        errorType: typeof detailValue(error, "errorType") === "string" ? (detailValue(error, "errorType") as string) : undefined,
        retryAfterSeconds: typeof detailValue(error, "retryAfter") === "number" ? (detailValue(error, "retryAfter") as number) : undefined,
        message: error instanceof Error ? error.message : "La requête minimale a échoué.",
      });
      describeError(error, "chat-probe");
    }
  } else if (check1Error) {
    describeError(check1Error, "models");
  } else if (!keyConfigured) {
    overall = "auth";
    summary = `Aucune clé API ${config.name} n'est configurée. Ajoutez une clé dans Paramètres → API.`;
  } else if (modelCount === 0 && !probeModel) {
    overall = "model-missing";
    summary = `Aucun modèle n'a été découvert pour ${config.name}. Rafraîchissez la liste des modèles.`;
  }

  return {
    providerId: config.id,
    providerName: config.name,
    kind: config.kind,
    baseUrl: config.baseUrl,
    keyConfigured,
    keyStatus,
    latencyMs: Date.now() - startedAt,
    checks,
    modelCount,
    sampleModels,
    probeModel,
    overall,
    summary,
  };
}

export { ProviderError };