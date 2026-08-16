import { useState } from "react";
import { motion } from "framer-motion";
import { Activity, ArrowRight, RefreshCw, WifiOff, Wrench } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useSidebar } from "../contexts/SidebarContext";
import { api, describeApiError } from "../api/client";

export function ConnectionPage() {
  const { connectionError, retryConnection, goLocal, apiUrl, setApiUrl } = useAuth();
  const { navigate } = useSidebar();
  const [server, setServer] = useState(apiUrl);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function retry() {
    setChecking(true); setResult(null);
    await retryConnection();
    setResult("Connection check finished.");
    setChecking(false);
  }

  async function saveServer() {
    setApiUrl(server);
    setChecking(true);
    try { await api.health(); setResult("Aegis API is reachable."); await retryConnection(); }
    catch (error) { setResult(describeApiError(error)); }
    finally { setChecking(false); }
  }

  return (
    <motion.div className="connection-screen" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="connection-orbit" />
      <div className="connection-card aegis-glass-card">
        <div className="connection-icon"><WifiOff size={24} /></div>
        <p className="eyebrow">Aegis services</p>
        <h1>Connection paused</h1>
        <p className="connection-copy">{connectionError || "Aegis services are currently unavailable."}</p>
        <div className="connection-status"><span className="status-dot offline" /> You can retry or continue with local models.</div>
        <div className="connection-actions">
          <button className="aegis-btn aegis-btn-primary" onClick={() => void retry()} disabled={checking}><RefreshCw size={16} className={checking ? "spin" : ""} /> Retry</button>
          <button className="aegis-btn aegis-btn-secondary" onClick={() => { goLocal(); navigate("Chat"); }}><ArrowRight size={16} /> Continue locally</button>
        </div>
        <details className="connection-settings"><summary className="connection-settings-title"><Wrench size={15} /> Advanced diagnostics</summary><div className="connection-server-row"><input value={server} onChange={(event) => setServer(event.target.value)} aria-label="Aegis API server URL" /><button className="aegis-btn aegis-btn-ghost aegis-btn-sm" onClick={() => void saveServer()} disabled={checking}>Check</button></div><button className="diagnostics-link" onClick={() => navigate("Help")}><Activity size={14} /> View technical details</button><code style={{ display: "block", marginTop: 8, color: "var(--aegis-text-muted)", fontSize: 11 }}>{apiUrl}</code></details>
        {result && <p className="connection-result">{result}</p>}
      </div>
    </motion.div>
  );
}
