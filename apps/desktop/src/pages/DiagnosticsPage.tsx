import { useEffect, useState } from "react";
import { Activity, Clipboard, Cloud, FileText, HardDrive, RefreshCw, ShieldCheck, TerminalSquare } from "lucide-react";
import { api } from "../api/client";
import { AegisBadge, AegisButton, AegisCard, AegisStatus } from "../components/ui/AegisUI";
import { useAuth } from "../contexts/AuthContext";
import { useModelStore } from "../features/models/modelStore";
import { readDiagnosticsLogPath, readDiagnosticsLogs, testProviderConnection } from "../features/providers/providerClient";

export function DiagnosticsPage() {
  const { status, apiAvailable } = useAuth();
  const { providers, models } = useModelStore();
  const [logs, setLogs] = useState("");
  const [logPath, setLogPath] = useState("");
  const [remoteHealth, setRemoteHealth] = useState<"ready" | "offline" | "checking">(apiAvailable ? "ready" : "offline");
  const [localHealth, setLocalHealth] = useState<Record<string, "ready" | "stopped" | "checking">>({});

  async function load() {
    const [content, path] = await Promise.all([readDiagnosticsLogs(), readDiagnosticsLogPath()]);
    setLogs(content);
    setLogPath(path);
  }

  async function checkRemote() {
    setRemoteHealth("checking");
    try { await api.health(); setRemoteHealth("ready"); } catch { setRemoteHealth("offline"); }
  }

  async function checkLocal(connectionId: string) {
    setLocalHealth((current) => ({ ...current, [connectionId]: "checking" }));
    try { await testProviderConnection(connectionId); setLocalHealth((current) => ({ ...current, [connectionId]: "ready" })); }
    catch { setLocalHealth((current) => ({ ...current, [connectionId]: "stopped" })); }
  }

  useEffect(() => { void load(); }, []);

  return <section className="feature-page diagnostics-page page-stack">
    <header className="feature-heading"><div><p className="eyebrow">Native runtime</p><h1>Diagnostics</h1><p>Inspect Aegis health without exposing provider credentials or frontend debug data.</p></div><AegisBadge tone={status === "local" ? "blue" : "success"}>{status === "local" ? "Local mode" : "Aegis Cloud"}</AegisBadge></header>
    <div className="diagnostic-grid">
      <AegisCard raised className="diagnostic-card"><span className="card-icon"><TerminalSquare size={18} /></span><div><h2>Startup processes</h2><p>Aegis native process + WebView2. No Node sidecar, batch file, Next.js server or separate local API.</p></div><AegisStatus tone="success" label="Native only" /></AegisCard>
      <AegisCard raised className="diagnostic-card"><span className="card-icon"><Cloud size={18} /></span><div><h2>Aegis API</h2><p>Remote authentication, synchronization and integrations.</p></div><AegisStatus tone={remoteHealth === "ready" ? "success" : remoteHealth === "checking" ? "orange" : "danger"} label={remoteHealth === "ready" ? "Ready" : remoteHealth === "checking" ? "Checking" : "Offline"} /><AegisButton onClick={() => void checkRemote()}><RefreshCw size={14} /> Test</AegisButton></AegisCard>
      {providers.filter((provider) => provider.kind === "ollama" || provider.kind === "lm-studio" || provider.kind === "lmstudio").map((provider) => { const health = localHealth[provider.id] || (models.some((model) => model.providerId === provider.id) ? "ready" : "stopped"); return <AegisCard raised className="diagnostic-card" key={provider.id}><span className="card-icon"><HardDrive size={18} /></span><div><h2>{provider.name}</h2><p>{models.filter((model) => model.providerId === provider.id).length} cached models · loopback only</p></div><AegisStatus tone={health === "ready" ? "success" : health === "checking" ? "orange" : "danger"} label={health === "ready" ? "Ready" : health === "checking" ? "Checking" : "Stopped"} /><AegisButton onClick={() => void checkLocal(provider.id)}><RefreshCw size={14} /> Test</AegisButton></AegisCard>; })}
    </div>
    <AegisCard raised className="diagnostic-log-card"><header><div><FileText size={17} /><span><h2>Technical log</h2><p>{logPath}</p></span></div><div><AegisButton onClick={() => void navigator.clipboard.writeText(logs)}><Clipboard size={14} /> Copy</AegisButton><AegisButton onClick={() => void load()}><RefreshCw size={14} /> Refresh</AegisButton></div></header><pre>{logs || "No technical events recorded yet."}</pre><footer><ShieldCheck size={13} /> API keys and credentials are never written to this log.</footer></AegisCard>
  </section>;
}
