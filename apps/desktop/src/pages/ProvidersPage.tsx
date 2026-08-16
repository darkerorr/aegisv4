import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion } from "framer-motion";
import { Check, Cloud, Eye, EyeOff, HardDrive, LoaderCircle, Plus, RefreshCw, ShieldCheck, Trash2, WifiOff } from "lucide-react";
import { AegisBadge, AegisButton, AegisCard, AegisIconButton, AegisInput, AegisModal, AegisStatus, AegisToast } from "../components/ui/AegisUI";
import { useAuth } from "../contexts/AuthContext";
import { useModelStore } from "../features/models/modelStore";
import {
  isDesktopRuntime,
  onProviderConnectionProgress,
  ProviderCommandError,
  refreshProviderModels,
  removeProviderConnection,
  saveProviderConnection,
  testProviderConnection,
  type ProviderConnection,
  type ProviderKind,
} from "../features/providers/providerClient";

type ConnectState = "idle" | "validating" | "saving-secret" | "testing" | "discovering-models" | "connected" | "invalid-key" | "network-error" | "provider-error" | "no-models" | "cancelled";
type ConnectableProvider = { kind: "nvidia" | "openrouter" | "xai"; name: string; description: string; baseUrl: string; keyUrl: string };

const CATALOG: ConnectableProvider[] = [
  { kind: "nvidia", name: "NVIDIA", description: "Accelerated hosted models with your NVIDIA API key.", baseUrl: "https://integrate.api.nvidia.com/v1", keyUrl: "https://build.nvidia.com/settings/api-keys" },
  { kind: "openrouter", name: "OpenRouter", description: "One account for a broad catalog of online models.", baseUrl: "https://openrouter.ai/api/v1", keyUrl: "https://openrouter.ai/settings/keys" },
  { kind: "xai", name: "xAI", description: "Grok models hosted by xAI with your console API key.", baseUrl: "https://api.x.ai/v1", keyUrl: "https://console.x.ai/" },
];

const BUSY_STATES: ConnectState[] = ["validating", "saving-secret", "testing", "discovering-models"];

function messageFor(error: ProviderCommandError, providerName: string): string {
  if (error.category === "invalid-key") return `The ${providerName} API key was rejected.`;
  if (error.category === "network-error") return `${providerName} could not be reached.`;
  if (error.category === "timeout") return "The request timed out.";
  if (error.category === "no-models") return "No models are available for this account.";
  if (error.category === "desktop-required") return error.message;
  return `${providerName} returned an unexpected response.`;
}

function connectionFromView(provider: ReturnType<typeof useModelStore>["providers"][number]): ProviderConnection {
  return {
    connectionId: provider.id,
    provider: provider.kind as ProviderKind,
    displayName: provider.name,
    secretRef: provider.hasApiKey ? `aegis/providers/${provider.kind}/${provider.id}` : null,
    enabled: provider.active,
    defaultModel: provider.defaultModel,
    baseUrl: provider.baseUrl,
  };
}

export function ProvidersPage() {
  const { status, goLocal } = useAuth();
  const { providers, models, refresh, ingestLocalConnection, removeLocalConnection } = useModelStore();
  const [selected, setSelected] = useState<ConnectableProvider | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [connectState, setConnectState] = useState<ConnectState>("idle");
  const [error, setError] = useState<ProviderCommandError | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<Record<string, "ready" | "stopped" | "checking">>({});
  const [success, setSuccess] = useState<{ name: string; models: number } | null>(null);
  const busy = BUSY_STATES.includes(connectState);
  const modelCounts = useMemo(() => Object.fromEntries(providers.map((provider) => [provider.id, models.filter((model) => model.providerId === provider.id).length])), [models, providers]);

  useEffect(() => {
    let unlisten: () => void = () => undefined;
    void onProviderConnectionProgress((event) => {
      if (BUSY_STATES.includes(event.state as ConnectState) || event.state === "connected") setConnectState(event.state as ConnectState);
    }).then((dispose) => { unlisten = dispose; });
    return () => unlisten();
  }, []);

  function openProvider(provider: ConnectableProvider) {
    setSelected(provider);
    setApiKey("");
    setShowKey(false);
    setAdvanced(false);
    setBaseUrl(provider.baseUrl);
    setConnectState("idle");
    setError(null);
  }

  function closeProvider() {
    if (busy) return;
    setSelected(null);
    setApiKey("");
    setError(null);
    setConnectState("cancelled");
  }

  async function openKeyPage() {
    if (!selected) return;
    try { await invoke("open_external_url", { url: selected.keyUrl }); } catch { /* the link remains non-critical */ }
  }

  async function connect() {
    if (!selected || busy) return;
    setError(null);
    setConnectState("validating");
    if (!apiKey.trim()) {
      const validationError = new ProviderCommandError({ category: "validation", message: "Enter an API key." });
      setError(validationError);
      setConnectState("provider-error");
      return;
    }
    try {
      setConnectState("saving-secret");
      const result = await saveProviderConnection({
        connectionId: `${selected.kind}-default`,
        provider: selected.kind,
        displayName: selected.name,
        apiKey: apiKey.trim(),
        baseUrl: advanced ? baseUrl.trim() : selected.baseUrl,
      });
      ingestLocalConnection(result.connection, result.models);
      setConnectState("connected");
      setSuccess({ name: selected.name, models: result.models.length });
      setApiKey("");
      window.setTimeout(() => setSelected(null), 500);
    } catch (cause) {
      const providerError = cause instanceof ProviderCommandError ? cause : new ProviderCommandError(String(cause));
      setError(providerError);
      setConnectState((providerError.category === "timeout" ? "network-error" : providerError.category) as ConnectState);
    }
  }

  async function test(connectionId: string) {
    setConnectionStatus((current) => ({ ...current, [connectionId]: "checking" }));
    try {
      await testProviderConnection(connectionId);
      const discovered = await refreshProviderModels(connectionId);
      await refresh(connectionId);
      setConnectionStatus((current) => ({ ...current, [connectionId]: "ready" }));
      const providerName = providers.find((provider) => provider.id === connectionId)?.name || "Provider";
      setSuccess({ name: providerName, models: discovered.length });
    } catch {
      setConnectionStatus((current) => ({ ...current, [connectionId]: "stopped" }));
    }
  }

  async function remove(connectionId: string, displayName: string) {
    if (!window.confirm(`Remove ${displayName} and its saved credential?`)) return;
    try {
      await removeProviderConnection(connectionId);
      removeLocalConnection(connectionId);
      setSuccess({ name: `${displayName} removed`, models: 0 });
    } catch (cause) {
      setError(cause instanceof ProviderCommandError ? cause : new ProviderCommandError(String(cause)));
    }
  }

  return <motion.div className="providers-page page-stack" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
    <div className="section-heading">
      <div><p className="eyebrow">Local AI connections</p><h1>Providers</h1><p className="muted">Secrets stay in your system credential vault and requests run through the native Rust backend.</p></div>
      {status !== "local" ? <AegisButton variant="primary" onClick={goLocal}><HardDrive size={15} /> Continue locally</AegisButton> : <AegisButton variant="primary" onClick={() => openProvider(CATALOG[0])}><Plus size={15} /> Connect provider</AegisButton>}
    </div>

    {!isDesktopRuntime() && <div className="aegis-alert aegis-alert-warning"><ShieldCheck size={15} /> Secure BYOK connections are available in the installed Aegis Desktop runtime.</div>}
    {success && <div className="toast-stack"><AegisToast title={`${success.name}${success.name.endsWith("removed") ? "" : " connected"}`} description={success.models ? `${success.models} models available` : undefined} onClose={() => setSuccess(null)} /></div>}

    <section className="provider-catalog-grid" aria-label="Available providers">
      {CATALOG.map((provider) => {
        const connected = providers.find((item) => item.kind === provider.kind);
        return <AegisCard key={provider.kind} raised className="commercial-card provider-product-card" tabIndex={0}>
          <div className="card-icon online"><Cloud size={19} /></div><div className="card-copy"><div><h2>{provider.name}</h2><AegisBadge tone={connected ? "success" : "neutral"}>{connected ? "Connected" : "Online"}</AegisBadge></div><p>{provider.description}</p></div>
          <footer>{connected ? <><AegisStatus tone="success" label={`${modelCounts[connected.id] || 0} models`} /><AegisButton onClick={() => void test(connected.id)} disabled={connectionStatus[connected.id] === "checking"}>{connectionStatus[connected.id] === "checking" ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />} Refresh</AegisButton><AegisIconButton label={`Remove ${provider.name}`} onClick={() => void remove(connected.id, provider.name)}><Trash2 size={15} /></AegisIconButton></> : <AegisButton onClick={() => openProvider(provider)}>Connect</AegisButton>}</footer>
        </AegisCard>;
      })}
      {providers.filter((provider) => provider.kind === "ollama" || provider.kind === "lm-studio" || provider.kind === "lmstudio").map((provider) => {
        const state = connectionStatus[provider.id] || (modelCounts[provider.id] ? "ready" : "stopped");
        return <AegisCard key={provider.id} raised className="commercial-card provider-product-card" tabIndex={0}>
          <div className="card-icon local"><HardDrive size={19} /></div><div className="card-copy"><div><h2>{provider.name}</h2><AegisBadge tone="blue">Local</AegisBadge></div><p>{provider.kind === "ollama" ? "Private models installed through Ollama." : "Models currently exposed by LM Studio."}</p></div>
          <footer><AegisStatus tone={state === "ready" ? "success" : state === "checking" ? "orange" : "danger"} label={state === "ready" ? "Ready" : state === "checking" ? "Checking" : "Stopped"} /><span className="muted card-model-count">{modelCounts[provider.id] || 0} models</span><AegisButton onClick={() => void test(provider.id)} disabled={state === "checking"}><RefreshCw size={15} /> Refresh</AegisButton></footer>
        </AegisCard>;
      })}
    </section>

    <AegisModal open={Boolean(selected)} title={`Connect ${selected?.name || "provider"}`} description={selected?.description} onClose={closeProvider} className="provider-connect-modal">
      {selected && <div className="provider-connect-form">
        {connectState === "connected" ? <div className="provider-connected-state"><Check size={24} /><strong>{selected.name} connected</strong><span>{models.filter((model) => model.providerKind === selected.kind).length} models available</span></div> : <>
          <label><span>{selected.name} API key</span><div className="secret-input"><AegisInput autoFocus type={showKey ? "text" : "password"} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="••••••••••••••••••" autoComplete="new-password" disabled={busy} /><AegisIconButton label={showKey ? "Hide API key" : "Show API key"} onClick={() => setShowKey((visible) => !visible)}>{showKey ? <EyeOff size={15} /> : <Eye size={15} />}</AegisIconButton></div></label>
          <div className="provider-help-row"><button type="button" className="text-button" onClick={() => void openKeyPage()}>Where can I create a key?</button><button type="button" className="text-button" onClick={() => setAdvanced((open) => !open)}>Advanced options</button></div>
          {advanced && <label className="advanced-provider-options"><span>Base URL</span><AegisInput value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} disabled={busy} /><small>Use the official endpoint unless your organization supplied another compatible gateway.</small></label>}
          {error && <div className="provider-inline-error" role="alert"><WifiOff size={16} /><span><strong>{messageFor(error, selected.name)}</strong>{import.meta.env.DEV && <details><summary>View technical details</summary><dl><div><dt>Category</dt><dd>{error.category}</dd></div><div><dt>HTTP status</dt><dd>{error.status ?? "—"}</dd></div><div><dt>Request ID</dt><dd>{error.requestId ?? "—"}</dd></div><div><dt>Endpoint</dt><dd>{error.endpoint ?? "—"}</dd></div><div><dt>Duration</dt><dd>{error.durationMs != null ? `${error.durationMs} ms` : "—"}</dd></div></dl></details>}</span></div>}
          <AegisButton variant="primary" className="provider-connect-submit" onClick={() => void connect()} disabled={busy || !apiKey.trim()}>{busy && <LoaderCircle size={16} className="spin" />}{connectState === "saving-secret" ? "Saving securely…" : connectState === "testing" ? "Testing NVIDIA…" : connectState === "discovering-models" ? "Discovering models…" : `Connect ${selected.name}`}</AegisButton>
        </>}
      </div>}
    </AegisModal>
  </motion.div>;
}
