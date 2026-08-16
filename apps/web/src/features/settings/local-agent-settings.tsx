"use client";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, HardDrive, KeyRound, Link2, LoaderCircle, RefreshCw, Server } from "lucide-react";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { normalizeError } from "@/lib/api/errors";

export function LocalAgentSettings() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState(false);
  const status = useQuery({ queryKey: ["work-status"], queryFn: () => api.workStatus(), refetchInterval: 15_000, retry: 0 });

  const agent = status.data?.agent;
  const health = status.data?.health as { service?: string; version?: string; port?: number; hostname?: string; platform?: string } | undefined;
  const processOnline = agent?.process === "online";
  const connected = agent?.connection === "connected";

  const save = useMutation({
    mutationFn: () => api.request("/work/token", { method: "POST", body: JSON.stringify({ token: token.trim() }) }),
    onSuccess: () => { setSaved(true); setToken(""); void queryClient.invalidateQueries({ queryKey: ["work-status"] }); setTimeout(() => setSaved(false), 2500); },
    onError: () => setSaved(false),
  });

  const connect = useMutation({
    mutationFn: () => api.workConnect(),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["work-status"] }); void queryClient.invalidateQueries({ queryKey: ["work-workspaces"] }); },
  });

  const url = useMemo(() => (typeof window !== "undefined" ? window.location.origin : ""), []);

  return (
    <div className="aegis-settings-stack">
      <section className="aegis-settings-panel">
        <header><HardDrive size={18} /><div><h2>Local agent connection</h2><p>The Aegis API bridges the web app to the local agent. The token authenticates the bridge to the agent on port 4150.</p></div></header>
        <div className="setting-facts">
          <span><Server size={16} />Endpoint <code style={{ color: "var(--aegis-fg)" }}>{processOnline ? `http://127.0.0.1:${agent?.port ?? health?.port ?? 4150}` : "http://127.0.0.1:4150"}</code></span>
          <span><KeyRound size={16} />Token source: <code style={{ color: "var(--aegis-fg)" }}>~/.aegis/local-agent/token</code> (or the AEGIS_LOCAL_AGENT_TOKEN env var)</span>
        </div>
        <div className="aegis-status-row" data-state={processOnline ? "ok" : "off"}>
          <i />
          <span>{processOnline ? `Agent online · ${health?.service ?? "local-agent"} ${health?.version ? `v${health.version}` : ""} on ${health?.platform ?? "this device"}` : "Agent offline — start it with pnpm dev:local-agent"}</span>
          <Button size="sm" variant="ghost" onClick={() => status.refetch()} disabled={status.isFetching}><RefreshCw size={13} className={status.isFetching ? "spin" : ""} />Refresh</Button>
        </div>
        <div className="aegis-status-row" data-state={connected ? "ok" : agent?.connection === "auth_required" ? "warn" : "off"}>
          <i />
          <span>{connected ? "Connected · the API holds a valid Local Agent token." : agent?.connection === "auth_required" ? agent?.authentication === "invalid" ? "Authentication invalid · the stored token was rejected by the agent." : "Authentication required · this device is not authenticated to the Local Agent." : "Connection unavailable · the Local Agent process is not reachable."}</span>
          {!connected && processOnline && (
            <Button size="sm" variant="primary" onClick={() => connect.mutate()} disabled={connect.isPending}>{connect.isPending ? <LoaderCircle size={13} className="spin" /> : <Link2 size={13} />}{connect.isPending ? "Connecting…" : "Connect Local Agent"}</Button>
          )}
        </div>
        {connect.isError && <p role="alert" className="form-error">{normalizeError(connect.error).message}</p>}
      </section>

      <section className="aegis-settings-panel">
        <header><KeyRound size={18} /><div><h2>Bridge token</h2><p>If the agent uses a custom token, set it here so the API can authenticate to it.</p></div></header>
        <form className="setting-form" onSubmit={(e) => { e.preventDefault(); if (token.trim()) save.mutate(); }}>
          <label>Token<input autoComplete="off" className="field" value={token} onChange={(e) => { setToken(e.target.value); setSaved(false); }} placeholder="Paste the token from ~/.aegis/local-agent/token" /></label>
          <div className="setting-form__actions">
            <Button type="submit" variant="primary" disabled={!token.trim() || save.isPending}>{save.isPending ? <LoaderCircle className="spin" size={14} /> : saved ? <Check size={14} /> : <KeyRound size={14} />}{saved ? "Saved" : "Save token"}</Button>
          </div>
          {save.isError && <p role="alert" className="form-error">{normalizeError(save.error).message}</p>}
        </form>
      </section>

      <section className="aegis-settings-panel">
        <header><Copy size={18} /><div><h2>Quick start</h2><p>Work Mode is served from this app and proxied through the API.</p></div></header>
        <div className="setting-facts">
          <span><HardDrive size={16} />Open <code style={{ color: "var(--aegis-fg)" }}>{url}/work</code> to manage trusted folders.</span>
          <span><Server size={16} />Start the agent once: <code style={{ color: "var(--aegis-fg)" }}>pnpm dev:local-agent</code> at the repo root.</span>
        </div>
      </section>
    </div>
  );
}
