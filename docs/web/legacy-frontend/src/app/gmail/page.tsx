"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { LoaderCircle, Mail, Search, RefreshCw, AlertTriangle, Inbox, ChevronLeft, ChevronRight, Paperclip } from "lucide-react";
import { Protected } from "../../components/Protected";
import { api, formatApiError } from "../../lib/api";
import type { GmailMessage, GoogleIntegration } from "@aegis/api-client";

function GmailContent() {
  const [integration, setIntegration] = useState<GoogleIntegration | null>(null);
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [nextToken, setNextToken] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (signal?: AbortSignal, pageToken?: string) => {
    setBusy(true); setError("");
    try {
      const [intResult, msgResult] = await Promise.all([
        api<{ integration: GoogleIntegration }>("/integrations/google", { signal }),
        api<{ messages: GmailMessage[]; nextPageToken?: string }>(`/integrations/google/gmail/messages?maxResults=20${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`, { signal }),
      ]);
      if (!signal?.aborted) {
        setIntegration(intResult.integration);
        setMessages(pageToken ? [...messages, ...msgResult.messages] : msgResult.messages);
        setNextToken(msgResult.nextPageToken);
      }
    } catch (err) { if (!signal?.aborted) setError(formatApiError(err)); }
    finally { if (!signal?.aborted) { setBusy(false); setLoading(false); } }
  }, []);

  useEffect(() => { const c = new AbortController(); void load(c.signal); return () => c.abort(); }, []);

  async function doSearch() {
    if (!search.trim()) return;
    setBusy(true);
    try {
      const result = await api<{ messages: GmailMessage[]; nextPageToken?: string }>(`/integrations/google/gmail/search?q=${encodeURIComponent(search)}`);
      setMessages(result.messages);
      setNextToken(result.nextPageToken);
    } catch (err) { setError(formatApiError(err)); } finally { setBusy(false); }
  }

  if (!integration?.configured) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="surface rounded-2xl p-8 text-center">
          <Mail size={48} className="mx-auto mb-4 text-[var(--aegis-text-muted)]" />
          <h2 className="text-xl font-semibold">Google not configured</h2>
          <p className="mt-2 text-sm text-[var(--aegis-text-muted)]">Connect Google Workspace to access Gmail.</p>
        </div>
      </div>
    );
  }
  if (integration?.status !== "connected") {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="surface rounded-2xl p-8 text-center">
          <AlertTriangle size={48} className="mx-auto mb-4 text-[var(--aegis-orange)]" />
          <h2 className="text-xl font-semibold">Google not connected</h2>
          <p className="mt-2 text-sm text-[var(--aegis-text-muted)]">Connect Google Workspace from the Connections page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[.24em] text-[var(--aegis-orange)]">Gmail</p>
          <h1 className="mt-2 text-4xl font-semibold">Gmail</h1>
          <p className="mt-3 text-sm text-[var(--aegis-text-muted)]">{integration?.account?.email || "Loading..."}</p>
        </div>
        <button onClick={() => void load()} disabled={busy} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm hover:bg-white/5 disabled:opacity-50">
          <RefreshCw size={16} className={`mr-2 inline ${busy ? "animate-spin" : ""}`} />Refresh
        </button>
      </div>

      <div className="mt-6 flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--aegis-text-muted)]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doSearch(); }} className="control w-full rounded-xl py-2.5 pl-9 pr-3 text-sm" placeholder="Search Gmail..." />
        </div>
        <button onClick={doSearch} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm hover:bg-white/5">Search</button>
      </div>

      {loading ? (
        <div className="mt-20 grid place-items-center text-[var(--aegis-text-muted)]"><LoaderCircle className="animate-spin" size={24} /></div>
      ) : (
        <div className="mt-6 space-y-2">
          {messages.map((msg) => (
            <div key={msg.id} className="surface rounded-xl p-4 transition hover:border-[var(--aegis-blue)]/30">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{msg.from}</span>
                    {msg.unread && <span className="shrink-0 h-2 w-2 rounded-full bg-[var(--aegis-blue)]" />}
                  </div>
                  <p className="mt-1 text-sm text-white truncate">{msg.subject}</p>
                  <p className="mt-1 text-xs text-[var(--aegis-text-muted)] line-clamp-2">{msg.snippet}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-[var(--aegis-text-muted)]">
                    <span>{msg.date ? new Date(msg.date).toLocaleDateString() : ""}</span>
                    {msg.attachments.length > 0 && <span className="flex items-center gap-1"><Paperclip size={12} />{msg.attachments.length}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {messages.length === 0 && (
            <div className="mt-10 grid place-items-center text-[var(--aegis-text-muted)]">
              <Inbox size={40} className="mb-4 opacity-30" />
              <p className="text-sm">No messages found.</p>
            </div>
          )}
        </div>
      )}
      {nextToken && (
        <div className="mt-6 flex justify-center">
          <button onClick={() => void load(undefined, nextToken)} disabled={busy} className="rounded-xl border border-white/10 px-6 py-2.5 text-sm hover:bg-white/5">
            {busy ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function GmailPage() {
  return <Protected><Suspense fallback={<div className="p-8 text-sm text-[var(--aegis-text-muted)]">Loading Gmail...</div>}><GmailContent /></Suspense></Protected>;
}
