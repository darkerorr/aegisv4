"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { LoaderCircle, PlugZap, Cpu, RefreshCw, Check, X, AlertTriangle, Trash2, Wifi, Globe, Plus, Eye, EyeOff } from "lucide-react";
import { Protected } from "../../components/Protected";
import { api, formatApiError } from "../../lib/api";

type ProviderInfo = { id: string; providerKey: string; kind: string; name: string; baseUrl: string; defaultModel?: string; active: boolean; hasApiKey: boolean; maskedApiKey?: string; options?: Record<string, unknown> };

function ProvidersContent() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string>("");
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; latencyMs?: number; message?: string }>>({});
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectProvider, setConnectProvider] = useState<"nvidia" | "openrouter">("nvidia");
  const [apiKey, setApiKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [showKey, setShowKey] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const result = await api<{ providers: ProviderInfo[] }>("/providers", { signal });
      if (!signal?.aborted) setProviders(result.providers);
    } catch { /* ignore */ } finally { if (!signal?.aborted) setLoading(false); }
  }, []);

  useEffect(() => { const c = new AbortController(); void load(c.signal); return () => c.abort(); }, [load]);

  async function testProvider(id: string) {
    setTesting(id);
    setTestResult((prev) => ({ ...prev, [id]: { ok: false, message: "Testing..." } }));
    try {
      const result = await api<{ ok: boolean; latencyMs?: number; message?: string }>(`/providers/${id}/test`, { method: "POST" });
      setTestResult((prev) => ({ ...prev, [id]: result }));
    } catch (err) {
      setTestResult((prev) => ({ ...prev, [id]: { ok: false, message: formatApiError(err) } }));
    } finally { setTesting(""); }
  }

  async function connectProviderAction() {
    setConnecting(true); setConnectError("");
    try {
      const endpoint = connectProvider === "nvidia" ? "/providers/nvidia/connect" : "/providers/openrouter/connect";
      const result = await api(endpoint, { method: "POST", body: JSON.stringify({ apiKey, displayName: displayName || undefined }) });
      setShowConnectModal(false);
      setApiKey("");
      setDisplayName("");
      await load();
    } catch (err) { setConnectError(formatApiError(err)); } finally { setConnecting(false); }
  }

  async function deleteProvider(id: string) {
    try {
      await api(`/providers/${id}`, { method: "DELETE" });
      await load();
    } catch (err) { /* ignore */ }
  }

  const connectedProviders = providers.filter((p) => p.active);
  const availableConnections = [
    { key: "nvidia" as const, name: "NVIDIA NIM", desc: "Optimized inference with NVIDIA's accelerated microservices.", connected: providers.some((p) => p.providerKey === "nvidia-nim" && p.active) },
    { key: "openrouter" as const, name: "OpenRouter", desc: "Single API for 200+ models.", connected: providers.some((p) => p.providerKey === "openrouter" && p.active) },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[.24em] text-[var(--aegis-orange)]">Providers</p>
          <h1 className="mt-2 text-4xl font-semibold">AI Providers</h1>
          <p className="mt-3 max-w-2xl text-[var(--aegis-text-muted)]">Connect and manage AI model providers. Local providers (Ollama, LM Studio) are auto-detected.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white hover:bg-white/5 disabled:opacity-50"><RefreshCw size={16} className={`mr-2 inline ${loading ? "animate-spin" : ""}`} />Refresh</button>
      </div>

      {/* Connected providers */}
      {connectedProviders.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--aegis-text-muted)]">Connected</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {connectedProviders.map((provider) => (
              <div key={provider.id} className="surface rounded-2xl p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--aegis-blue)]/10 text-[var(--aegis-blue-light)]">
                      {provider.kind === "ollama" || provider.kind === "lmstudio" ? <Wifi size={20} /> : <Globe size={20} />}
                    </span>
                    <div>
                      <h3 className="font-semibold">{provider.name}</h3>
                      <p className="text-xs text-[var(--aegis-text-muted)]">{provider.kind}{provider.defaultModel ? ` · ${provider.defaultModel}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`flex h-2 w-2 rounded-full ${provider.active ? "bg-[var(--aegis-success)]" : "bg-red-400"}`} />
                    <span className="text-xs text-[var(--aegis-text-muted)]">{provider.active ? "Active" : "Inactive"}</span>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button onClick={() => testProvider(provider.id)} disabled={testing === provider.id} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:bg-white/5">
                    {testing === provider.id ? <><LoaderCircle size={12} className="mr-1 inline animate-spin" /> Testing</> : "Test"}
                  </button>
                  <button onClick={() => deleteProvider(provider.id)} className="rounded-lg border border-red-400/20 px-3 py-1.5 text-xs text-red-300 hover:bg-red-400/10">
                    <Trash2 size={12} className="mr-1 inline" /> Remove
                  </button>
                </div>
                {testResult[provider.id] && (
                  <div className={`mt-3 rounded-lg p-2 text-xs ${testResult[provider.id].ok ? "bg-emerald-400/10 text-emerald-200" : "bg-red-400/10 text-red-200"}`}>
                    {testResult[provider.id].ok
                      ? `Connected (${testResult[provider.id].latencyMs}ms)`
                      : testResult[provider.id].message || "Connection failed"}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Available connections */}
      <section className="mt-10">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--aegis-text-muted)]">Available</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {availableConnections.map((conn) => (
            <div key={conn.key} className="surface rounded-2xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{conn.name}</h3>
                  <p className="mt-1 text-sm text-[var(--aegis-text-muted)]">{conn.desc}</p>
                </div>
                {conn.connected ? (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300"><Check size={12} /> Connected</span>
                ) : (
                  <button onClick={() => { setConnectProvider(conn.key); setShowConnectModal(true); }} className="rounded-lg bg-[var(--aegis-blue)] px-4 py-2 text-xs font-semibold text-white hover:brightness-110">
                    <Plus size={14} className="mr-1 inline" /> Connect
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Local providers note */}
      <div className="surface mt-8 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[var(--aegis-orange)]" />
          <div>
            <h3 className="font-semibold">Local providers are auto-configured</h3>
            <p className="mt-1 text-sm text-[var(--aegis-text-muted)]">Ollama (port 11434) and LM Studio (port 1234) are automatically added on registration. Make sure the local server is running.</p>
          </div>
        </div>
      </div>

      {/* Connect modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" onKeyDown={(e) => { if (e.key === "Escape") setShowConnectModal(false); }}>
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1424] p-6 shadow-2xl">
            <h2 className="text-xl font-semibold">Connect {connectProvider === "nvidia" ? "NVIDIA NIM" : "OpenRouter"}</h2>
            <p className="mt-2 text-sm text-[var(--aegis-text-muted)]">Enter your API key. It will be encrypted and stored securely on the server.</p>
            <div className="mt-5 space-y-4">
              <label className="block text-sm text-slate-300">API Key
                <div className="relative mt-2">
                  <input type={showKey ? "text" : "password"} value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="control w-full rounded-xl px-3 py-3 pr-11 text-white" placeholder={connectProvider === "nvidia" ? "nvapi-..." : "sk-or-..."} />
                  <button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"><Eye size={18} /></button>
                </div>
              </label>
              <label className="block text-sm text-slate-300">Display name <span className="text-[var(--aegis-text-muted)]">(optional)</span>
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="control mt-2 w-full rounded-xl px-3 py-3 text-white" placeholder={connectProvider === "nvidia" ? "NVIDIA NIM" : "OpenRouter"} />
              </label>
            </div>
            {connectError && <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-100">{connectError}</div>}
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowConnectModal(false)} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm">Cancel</button>
              <button onClick={connectProviderAction} disabled={!apiKey || connecting} className="rounded-xl bg-[var(--aegis-blue)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {connecting ? <><LoaderCircle size={16} className="mr-2 inline animate-spin" /> Connecting...</> : "Connect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProvidersPage() {
  return <Protected><ProvidersContent /></Protected>;
}
