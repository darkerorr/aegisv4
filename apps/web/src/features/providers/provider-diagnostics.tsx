"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { ProviderDiagnostic } from "@aegis/types";
import { providersApi } from "@/lib/api/providers";
import { normalizeError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import {
  KeyRound,
  LoaderCircle,
  Search,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";

const OVERALL_META: Record<
  ProviderDiagnostic["overall"],
  { label: string; tone: "ok" | "bad" | "warn" }
> = {
  ok: { label: "Provider sain", tone: "ok" },
  auth: { label: "Clé API rejetée", tone: "bad" },
  "rate-limited": { label: "Modèle limité (429)", tone: "warn" },
  quota: { label: "Quota épuisé", tone: "bad" },
  "model-missing": { label: "Modèle indisponible", tone: "bad" },
  network: { label: "Réseau inaccessible", tone: "warn" },
  server: { label: "Erreur serveur", tone: "warn" },
  unknown: { label: "État inconnu", tone: "warn" },
};

const KEY_STATUS_LABEL: Record<ProviderDiagnostic["keyStatus"], string> = {
  configured: "valide",
  missing: "manquante",
  invalid: "rejetée",
  expired: "expirée",
  unknown: "état inconnu",
};

const CHECK_LABEL: Record<string, string> = {
  models: "Liste des modèles",
  "model-availability": "Disponibilité du modèle",
  "chat-probe": "Requête minimale (probe)",
};

export function ProviderDiagnosticsPanel({
  providerId,
  providerName,
  defaultModel,
}: {
  providerId: string;
  providerName: string;
  defaultModel?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const diagnose = useMutation({
    mutationFn: () => providersApi.diagnose(providerId, defaultModel ?? undefined),
  });
  const result = diagnose.data;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !diagnose.data && !diagnose.isPending) diagnose.mutate();
  };

  return (
    <div className="aegis-diagnostics">
      <Button type="button" variant="ghost" onClick={toggle} disabled={diagnose.isPending}>
        {diagnose.isPending ? (
          <LoaderCircle className="spin" size={14} />
        ) : (
          <Search size={14} />
        )}
        Diagnostic
      </Button>
      {open && (
        <div className="aegis-diagnostics__panel">
          <button
            type="button"
            className="aegis-diagnostics__close"
            onClick={() => setOpen(false)}
            aria-label="Fermer le diagnostic"
          >
            <X size={14} />
          </button>
          {diagnose.isPending && (
            <p className="aegis-diagnostics__pending">
              Analyse de {providerName} en cours… (connexion, clé, modèles, requête minimale)
            </p>
          )}
          {diagnose.isError && (
            <p role="alert" className="aegis-provider__error">
              <TriangleAlert size={13} />
              {normalizeError(diagnose.error).message}
            </p>
          )}
          {result && (
            <>
              <div className={`aegis-diagnostics__overall is-${OVERALL_META[result.overall].tone}`}>
                {result.overall === "ok" ? (
                  <ShieldCheck size={16} />
                ) : (
                  <TriangleAlert size={16} />
                )}
                <div>
                  <b>{OVERALL_META[result.overall].label}</b>
                  <span>{result.summary}</span>
                </div>
              </div>
              <dl className="aegis-diagnostics__facts">
                <div>
                  <dt>Endpoint</dt>
                  <dd>{result.baseUrl}</dd>
                </div>
                <div>
                  <dt>Clé API</dt>
                  <dd>
                    {result.keyConfigured
                      ? `Configurée${
                          result.keyStatus !== "configured"
                            ? ` — ${KEY_STATUS_LABEL[result.keyStatus]}`
                            : ""
                        }`
                      : "Manquante"}
                  </dd>
                </div>
                <div>
                  <dt>Modèles</dt>
                  <dd>
                    {result.modelCount ?? 0} découverts
                    {result.probeModel ? ` · probe « ${result.probeModel} »` : ""}
                  </dd>
                </div>
                <div>
                  <dt>Latence</dt>
                  <dd>{result.latencyMs} ms</dd>
                </div>
              </dl>
              {result.sampleModels && result.sampleModels.length > 0 && (
                <div className="aegis-diagnostics__models">
                  {result.sampleModels.map((model) => (
                    <code key={model}>{model}</code>
                  ))}
                </div>
              )}
              <div className="aegis-diagnostics__checks">
                {result.checks.map((check) => (
                  <div
                    key={check.name}
                    className={`aegis-diagnostics__check is-${check.ok ? "ok" : "bad"}`}
                  >
                    <b>{CHECK_LABEL[check.name] ?? check.name}</b>
                    <span>
                      {check.ok ? "Réussi" : "Échec"}
                      {check.status != null ? ` · HTTP ${check.status}` : ""}
                      {check.durationMs != null ? ` · ${check.durationMs} ms` : ""}
                      {check.providerCode ? ` · code ${check.providerCode}` : ""}
                      {check.errorType ? ` · ${check.errorType}` : ""}
                      {check.retryAfterSeconds != null
                        ? ` · réessayez dans ${check.retryAfterSeconds}s`
                        : ""}
                    </span>
                    {check.message && <small>{check.message}</small>}
                  </div>
                ))}
              </div>
              <p className="aegis-diagnostics__security">
                <KeyRound size={12} />
                {"Le diagnostic s'exécute côté serveur : la clé API n'est jamais transmise ni affichée."}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
