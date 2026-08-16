"use client";

import { useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ProviderSummary } from "@aegis/api-client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cable,
  ChevronDown,
  CircleCheck,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  Settings,
  TriangleAlert,
  Unplug,
  Zap,
} from "lucide-react";
import { ProviderIcon } from "@/components/brand/provider-icon";
import { StatePanel } from "@/components/feedback/state-panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Toast, ToastProvider, ToastViewport } from "@/components/ui/toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { hexToRgbTriplet } from "@/features/chat/model-brand";
import { normalizeError } from "@/lib/api/errors";
import { providersApi } from "@/lib/api/providers";
import { queryKeys } from "@/lib/query/keys";
import { cloudCatalog, cloudCatalogById, type CloudProviderId } from "./cloud-catalog";
import { ProviderCredentialDialog } from "./components/ProviderCredentialDialog";
import { ProviderDiagnosticsPanel } from "./provider-diagnostics";

type DialogTarget = { provider: CloudProviderId; configured: boolean } | null;
type Notice = { title: string; description: string } | null;

function cloudProviderId(provider: ProviderSummary): CloudProviderId | null {
  const value = `${provider.providerKey || ""} ${provider.kind}`.toLowerCase();
  if (value.includes("nvidia")) return "nvidia-nim";
  if (value.includes("openrouter")) return "openrouter";
  if (value.includes("x-ai") || value.includes("xai") || value.includes("grok")) return "x-ai";
  if (value.includes("anthropic") || value.includes("claude")) return "anthropic";
  if (value.includes("gemini") || value.includes("google")) return "gemini";
  if (value.includes("openai") && !value.includes("compatible")) return "openai";
  if (value.includes("mistral")) return "mistral";
  if (value.includes("groq")) return "groq";
  if (value.includes("deepseek")) return "deepseek";
  if (value.includes("qwen") || value.includes("dashscope")) return "qwen";
  if (value.includes("meta") || value.includes("llama")) return "meta";
  if (value.includes("together")) return "together";
  if (value.includes("fireworks")) return "fireworks";
  if (value.includes("perplexity")) return "perplexity";
  if (value.includes("sambanova") || value.includes("samba-nova")) return "sambanova";
  if (value.includes("hyperbolic")) return "hyperbolic";
  if (value.includes("zhipu") || value.includes("glm") || value.includes("bigmodel"))
    return "zhipu";
  if (value.includes("moonshot") || value.includes("kimi")) return "moonshot";
  if (value.includes("minimax")) return "minimax";
  if (value.includes("novita")) return "novita";
  if (value.includes("huggingface") || value.includes("hugging-face") || value.includes("hf"))
    return "huggingface";
  return null;
}

function brandSlug(provider: ProviderSummary) {
  const id = cloudProviderId(provider);
  if (id) return cloudCatalogById.get(id)?.brand ?? id;
  if (provider.kind.includes("ollama")) return "ollama";
  if (provider.kind.includes("studio")) return "lmstudio";
  return provider.kind;
}

function accentStyle(color: string): CSSProperties {
  return { "--card-accent": color, "--card-accent-rgb": hexToRgbTriplet(color) } as CSSProperties;
}

export function ProvidersGrid() {
  const queryClient = useQueryClient();
  const [credentialProvider, setCredentialProvider] = useState<DialogTarget>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [latencies, setLatencies] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const query = useQuery({ queryKey: queryKeys.providers, queryFn: () => providersApi.list() });

  const toggleExpanded = (key: string) =>
    setExpanded((current) => ({ ...current, [key]: !current[key] }));

  const refreshData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.providers }),
      queryClient.invalidateQueries({ queryKey: queryKeys.models }),
    ]);
  };

  const testConnection = useMutation({
    mutationFn: ({ provider }: { provider: ProviderSummary }) => {
      const cloudId = cloudProviderId(provider);
      return cloudId ? providersApi.testCloud(cloudId) : providersApi.test(provider.id);
    },
    onSuccess: (result, { provider }) => {
      const latency = result.latencyMs;
      if (latency) setLatencies((current) => ({ ...current, [provider.id]: latency }));
      setNotice({
        title: "Connection successful",
        description: `${provider.name}${latency ? ` · ${latency} ms` : ""}`,
      });
    },
  });
  const toggle = useMutation({
    mutationFn: ({ provider, active }: { provider: ProviderSummary; active: boolean }) =>
      providersApi.update(provider.id, { active }),
    onSuccess: () => void refreshData(),
  });
  const refresh = useMutation({
    mutationFn: ({ providerId }: { providerId: CloudProviderId }) =>
      providersApi.refreshCloud(providerId),
    onSuccess: (result) => {
      setNotice({
        title: "Models refreshed",
        description: `${result.modelsDiscovered} models are available.`,
      });
      void refreshData();
    },
  });
  const disconnect = useMutation({
    mutationFn: ({ providerId }: { providerId: CloudProviderId }) =>
      providersApi.disconnectCloud(providerId),
    onSuccess: () => {
      setNotice({
        title: "Provider disconnected",
        description: "The stored credential and discovered models were removed.",
      });
      void refreshData();
    },
  });

  if (query.isError)
    return (
      <StatePanel
        state="offline"
        title="Providers unavailable"
        message={normalizeError(query.error).message}
        onRetry={() => query.refetch()}
      />
    );
  if (query.isLoading)
    return (
      <div className="aegis-providers__grid">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="aegis-providers__skeleton" />
        ))}
      </div>
    );

  const providers = query.data?.providers ?? [];
  const configuredByCloud = new Map<CloudProviderId, ProviderSummary>();
  const localProviders = providers.filter((provider) => {
    const cloudId = cloudProviderId(provider);
    if (cloudId) configuredByCloud.set(cloudId, provider);
    return !cloudId;
  });

  const connectedCount = providers.filter(
    (p) => p.active && (p.secretConfigured || ["ollama", "lmstudio"].includes(p.kind)),
  ).length;
  const availableCount = cloudCatalog.filter((entry) => !configuredByCloud.has(entry.id)).length;
  const totalModels = providers.reduce((acc, p) => acc + (p.modelsCount ?? 0), 0);

  return (
    <ToastProvider swipeDirection="right">
      <motion.section
        className="v3-page-hero"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <div>
          <span className="v3-kicker">Provider dashboard</span>
          <h2>Your runtimes, at a glance.</h2>
          <p>
            Connect local engines and cloud services, verify credentials and keep model discovery in
            sync.
          </p>
        </div>
        <div className="v3-page-hero__stats">
          <span className="v3-page-hero__stat">
            <b>{connectedCount}</b>
            <small>connected</small>
          </span>
          <span className="v3-page-hero__stat">
            <b>{availableCount}</b>
            <small>available</small>
          </span>
          <span className="v3-page-hero__stat">
            <b>{totalModels}</b>
            <small>models</small>
          </span>
        </div>
      </motion.section>

      <div className="aegis-providers__grid">
        <AnimatePresence mode="popLayout">
          {cloudCatalog.map((entry, index) => {
            const provider = configuredByCloud.get(entry.id);
            if (!provider) {
              const isExpanded = Boolean(expanded[entry.id]);
              return (
                <motion.article
                  key={entry.id}
                  className="aegis-provider is-available"
                  style={accentStyle(entry.color)}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  whileHover={{ y: -5 }}
                  transition={{
                    duration: 0.25,
                    ease: "easeOut",
                    delay: Math.min(index * 0.04, 0.3),
                  }}
                >
                  <button
                    type="button"
                    className="aegis-provider__reveal"
                    onClick={() => toggleExpanded(entry.id)}
                    aria-expanded={isExpanded}
                  >
                    <header className="aegis-provider__head">
                      <span className="aegis-provider__logo">
                        <ProviderIcon provider={entry.brand} size={24} variant="color" />
                      </span>
                      <span className={`aegis-provider__status ${isExpanded ? "is-expanded" : ""}`}>
                        <Unplug size={13} />
                        Not connected
                      </span>
                      <span
                        className={`aegis-provider__chevron ${isExpanded ? "is-open" : ""}`}
                        aria-hidden="true"
                      >
                        <ChevronDown size={14} />
                      </span>
                    </header>
                    <h3 className="aegis-provider__name">{entry.name}</h3>
                    <p className="aegis-provider__kind">{entry.tagline}</p>
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          className="aegis-provider__description"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: "easeOut" }}
                        >
                          <p>{entry.description}</p>
                          <a href={entry.keyUrl} target="_blank" rel="noreferrer">
                            Where can I create an API key?
                          </a>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                  <footer className="aegis-provider__actions">
                    <Button
                      type="button"
                      variant="primary"
                      className="aegis-provider__connect"
                      onClick={() =>
                        setCredentialProvider({ provider: entry.id, configured: false })
                      }
                    >
                      <KeyRound size={14} />
                      Connect {entry.shortName}
                    </Button>
                  </footer>
                </motion.article>
              );
            }

            const configured = provider.secretConfigured ?? provider.hasApiKey;
            const isOn = configured && provider.active;
            const isExpanded = Boolean(expanded[provider.id]);
            const testing =
              testConnection.isPending && testConnection.variables?.provider.id === provider.id;
            const testError =
              testConnection.isError && testConnection.variables?.provider.id === provider.id
                ? normalizeError(testConnection.error)
                : null;
            const actionPending = toggle.isPending || refresh.isPending || disconnect.isPending;
            const invalidCredential = testError?.code === "PROVIDER_AUTH_FAILED";
            const status =
              configured && provider.active
                ? "connected"
                : configured
                  ? "disabled"
                  : "not connected";
            const latency = latencies[provider.id];

            return (
              <motion.article
                key={entry.id}
                className={`aegis-provider ${isOn ? "is-on" : ""}`}
                style={accentStyle(entry.color)}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                whileHover={{ y: -5 }}
                transition={{ duration: 0.25, ease: "easeOut", delay: Math.min(index * 0.04, 0.3) }}
              >
                <button
                  type="button"
                  className="aegis-provider__reveal"
                  onClick={() => toggleExpanded(provider.id)}
                  aria-expanded={isExpanded}
                >
                  <header className="aegis-provider__head">
                    <span className="aegis-provider__logo">
                      <ProviderIcon provider={entry.brand} size={24} variant="color" />
                    </span>
                    <span className={`aegis-provider__status ${isOn ? "is-on" : ""}`}>
                      {isOn ? <CircleCheck size={13} /> : <Unplug size={13} />}
                      {status}
                    </span>
                    <span
                      className={`aegis-provider__chevron ${isExpanded ? "is-open" : ""}`}
                      aria-hidden="true"
                    >
                      <ChevronDown size={14} />
                    </span>
                  </header>
                  <h3 className="aegis-provider__name">{provider.name}</h3>
                  <p className="aegis-provider__kind">{entry.tagline}</p>
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        className="aegis-provider__description"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                      >
                        <p>{entry.description}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>

                <div className="aegis-provider__meta">
                  <span>
                    <KeyRound size={13} />
                    {configured ? "Credential configured" : "No credential"}
                  </span>
                  <span>
                    <Cable size={13} />
                    {provider.modelsCount ?? 0} models
                  </span>
                  {provider.defaultModel && (
                    <span title={provider.defaultModel}>
                      <Zap size={13} />
                      {provider.defaultModel}
                    </span>
                  )}
                  {latency !== undefined && (
                    <span className="aegis-provider__latency" title="Last test latency">
                      <Zap size={13} />
                      {latency} ms
                    </span>
                  )}
                </div>

                {testError && (
                  <p role="alert" className="aegis-provider__error">
                    <TriangleAlert size={13} />
                    {invalidCredential
                      ? `The ${provider.name} API key was rejected.`
                      : testError.message}
                  </p>
                )}

                <footer className="aegis-provider__actions">
                  {!configured && (
                    <Button
                      type="button"
                      variant="primary"
                      className="aegis-provider__connect"
                      onClick={() =>
                        setCredentialProvider({ provider: entry.id, configured: false })
                      }
                    >
                      Connect
                    </Button>
                  )}
                  {configured && (
                    <>
                      {!provider.active && (
                        <Button
                          type="button"
                          variant="primary"
                          disabled={actionPending}
                          onClick={() => toggle.mutate({ provider, active: true })}
                        >
                          Enable
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant={invalidCredential ? "primary" : "ghost"}
                        onClick={() =>
                          setCredentialProvider({ provider: entry.id, configured: true })
                        }
                      >
                        <Settings size={14} />
                        {invalidCredential ? "Fix API key" : "Configure"}
                      </Button>
                    </>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="aegis-provider__tooltip-anchor">
                        <Button
                          type="button"
                          onClick={() => testConnection.mutate({ provider })}
                          disabled={testing || !configured}
                          aria-disabled={!configured}
                        >
                          {testing ? (
                            <LoaderCircle className="spin" size={14} />
                          ) : (
                            <Zap size={14} />
                          )}
                          Test
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {!configured && (
                      <TooltipContent>Add an API key before testing this provider.</TooltipContent>
                    )}
                  </Tooltip>
                  {configured && (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={actionPending}
                      onClick={() => refresh.mutate({ providerId: entry.id })}
                    >
                      {refresh.isPending && refresh.variables?.providerId === entry.id ? (
                        <LoaderCircle className="spin" size={14} />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                      Models
                    </Button>
                  )}
                  {configured &&
                    (provider.active ? (
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={actionPending}
                        onClick={() => toggle.mutate({ provider, active: false })}
                      >
                        Disable
                      </Button>
                    ) : null)}
                  {configured && (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={actionPending}
                      onClick={() => disconnect.mutate({ providerId: entry.id })}
                    >
                      <Unplug size={14} />
                      Disconnect
                    </Button>
                  )}
                  {configured && (
                    <ProviderDiagnosticsPanel
                      providerId={provider.id}
                      providerName={provider.name}
                      defaultModel={provider.defaultModel}
                    />
                  )}
                </footer>
              </motion.article>
            );
          })}

          {localProviders.map((provider, index) => {
            const isExpanded = Boolean(expanded[provider.id]);
            const testing =
              testConnection.isPending && testConnection.variables?.provider.id === provider.id;
            const testError =
              testConnection.isError && testConnection.variables?.provider.id === provider.id
                ? normalizeError(testConnection.error)
                : null;
            const actionPending = toggle.isPending;
            const isOn = provider.active;
            const status = provider.active ? "enabled" : "disabled";
            const latency = latencies[provider.id];

            return (
              <motion.article
                key={provider.id}
                className={`aegis-provider ${isOn ? "is-on" : ""}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                whileHover={{ y: -5 }}
                transition={{ duration: 0.25, ease: "easeOut", delay: Math.min(index * 0.04, 0.3) }}
              >
                <button
                  type="button"
                  className="aegis-provider__reveal"
                  onClick={() => toggleExpanded(provider.id)}
                  aria-expanded={isExpanded}
                >
                  <header className="aegis-provider__head">
                    <span className="aegis-provider__logo">
                      <ProviderIcon provider={brandSlug(provider)} size={24} variant="monochrome" />
                    </span>
                    <span className={`aegis-provider__status ${isOn ? "is-on" : ""}`}>
                      {isOn ? <CircleCheck size={13} /> : <Unplug size={13} />}
                      {status}
                    </span>
                    <span
                      className={`aegis-provider__chevron ${isExpanded ? "is-open" : ""}`}
                      aria-hidden="true"
                    >
                      <ChevronDown size={14} />
                    </span>
                  </header>
                  <h3 className="aegis-provider__name">{provider.name}</h3>
                  <p className="aegis-provider__kind">{provider.kind}</p>
                </button>

                <div className="aegis-provider__meta">
                  <span>
                    <KeyRound size={13} />
                    Local endpoint
                  </span>
                  <span>
                    <Cable size={13} />
                    {provider.modelsCount ?? 0} models
                  </span>
                  {provider.defaultModel && (
                    <span title={provider.defaultModel}>
                      <Zap size={13} />
                      {provider.defaultModel}
                    </span>
                  )}
                  {latency !== undefined && (
                    <span className="aegis-provider__latency" title="Last test latency">
                      <Zap size={13} />
                      {latency} ms
                    </span>
                  )}
                </div>

                {testError && (
                  <p role="alert" className="aegis-provider__error">
                    <TriangleAlert size={13} />
                    {testError.message}
                  </p>
                )}

                <footer className="aegis-provider__actions">
                  {!provider.active && (
                    <Button
                      type="button"
                      variant="primary"
                      disabled={actionPending}
                      onClick={() => toggle.mutate({ provider, active: true })}
                    >
                      Enable
                    </Button>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="aegis-provider__tooltip-anchor">
                        <Button
                          type="button"
                          onClick={() => testConnection.mutate({ provider })}
                          disabled={testing}
                        >
                          {testing ? (
                            <LoaderCircle className="spin" size={14} />
                          ) : (
                            <Zap size={14} />
                          )}
                          Test
                        </Button>
                      </span>
                    </TooltipTrigger>
                  </Tooltip>
                  <ProviderDiagnosticsPanel
                    providerId={provider.id}
                    providerName={provider.name}
                    defaultModel={provider.defaultModel}
                  />
                </footer>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>

      {credentialProvider && (
        <ProviderCredentialDialog
          provider={credentialProvider.provider}
          configured={credentialProvider.configured}
          open
          onOpenChange={(open) => {
            if (!open) setCredentialProvider(null);
          }}
          onConnected={async (result) => {
            await refreshData();
            setNotice({
              title: `${cloudCatalogById.get(result.connection.provider as CloudProviderId)?.name ?? "Provider"} connected`,
              description: `${result.modelsDiscovered} models are now available in Aegis.`,
            });
          }}
        />
      )}
      {notice && (
        <Toast
          open
          onOpenChange={(open) => {
            if (!open) setNotice(null);
          }}
          title={notice.title}
          description={notice.description}
          duration={4200}
        />
      )}
      <ToastViewport />
    </ToastProvider>
  );
}
