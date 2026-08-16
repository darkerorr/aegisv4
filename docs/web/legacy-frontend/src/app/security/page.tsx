"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Shield, Smartphone, Globe, Trash2, RefreshCw } from "lucide-react";
import { Protected } from "../../components/Protected";
import { api, formatApiError } from "../../lib/api";

type SessionInfo = { id: string; current: boolean; deviceName: string; ipMasked?: string; createdAt: string; lastSeenAt: string; expiresAt: string };

function SecurityContent() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const result = await api<{ sessions: SessionInfo[] }>("/auth/sessions", { signal });
      if (!signal?.aborted) setSessions(result.sessions);
    } catch { /* ignore */ } finally { if (!signal?.aborted) setLoading(false); }
  }, []);

  useEffect(() => { const c = new AbortController(); void load(c.signal); return () => c.abort(); }, [load]);

  async function revoke(id: string) {
    try {
      await api(`/auth/sessions/${id}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) { setError(formatApiError(err)); }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[.24em] text-[var(--aegis-orange)]">Security</p>
        <h1 className="mt-2 text-4xl font-semibold">Security</h1>
      </div>

      <div className="surface rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Smartphone size={18} /> Active sessions</h2>
          <button onClick={() => void load()} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:bg-white/5">
            <RefreshCw size={14} className="mr-1 inline" /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="grid place-items-center py-10"><LoaderCircle className="animate-spin" size={20} /></div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between rounded-xl border border-white/10 p-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--aegis-blue)]/10 text-[var(--aegis-blue-light)]">
                    <Globe size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{session.deviceName} {session.current && <span className="text-xs text-[var(--aegis-blue-light)]">(current)</span>}</p>
                    <p className="text-xs text-[var(--aegis-text-muted)]">IP: {session.ipMasked || "Unknown"} · Last seen: {new Date(session.lastSeenAt).toLocaleDateString()}</p>
                    <p className="text-xs text-[var(--aegis-text-muted)]">Expires: {new Date(session.expiresAt).toLocaleDateString()}</p>
                  </div>
                </div>
                {!session.current && (
                  <button onClick={() => revoke(session.id)} className="rounded-lg border border-red-400/20 px-3 py-1.5 text-xs text-red-300 hover:bg-red-400/10">
                    <Trash2 size={12} className="mr-1 inline" /> Revoke
                  </button>
                )}
              </div>
            ))}
            {sessions.length === 0 && <p className="py-6 text-center text-sm text-[var(--aegis-text-muted)]">No active sessions.</p>}
          </div>
        )}
      </div>

      {error && <div className="mt-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}
    </div>
  );
}

export default function SecurityPage() {
  return <Protected><SecurityContent /></Protected>;
}
