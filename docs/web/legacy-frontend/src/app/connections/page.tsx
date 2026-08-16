"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CalendarDays, Check, Contact, Github, HardDrive, Link2, LoaderCircle, Mail, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import type { GoogleIntegration } from "@aegis/api-client";
import { Protected } from "../../components/Protected";
import { api, formatApiError } from "../../lib/api";

const DRIVE_READ_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

type StatusMessage = { tone: "success" | "error"; message: string } | null;

function GoogleMark() {
  return <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-xl font-bold" aria-hidden="true"><span className="bg-gradient-to-br from-blue-500 via-red-500 to-amber-400 bg-clip-text text-transparent">G</span></span>;
}

function ConnectionsContent() {
  const searchParams = useSearchParams();
  const [integration, setIntegration] = useState<GoogleIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [message, setMessage] = useState<StatusMessage>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const result = await api<{ integration: GoogleIntegration }>("/integrations/google", { signal });
      if (!signal?.aborted) setIntegration(result.integration);
    } catch (cause) {
      if (!signal?.aborted) setMessage({ tone: "error", message: formatApiError(cause) });
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const status = searchParams.get("status");
    if (status === "connected") { sessionStorage.removeItem("aegis-google-connection-id"); setMessage({ tone: "success", message: "Google Workspace connected successfully." }); }
    if (status !== "error") return;
    const connectionId = sessionStorage.getItem("aegis-google-connection-id");
    if (!connectionId) { setMessage({ tone: "error", message: "Google authorization could not be completed. Please try again." }); return; }
    const controller = new AbortController();
    async function loadOAuthError() {
      try {
        const result = await api<{ errorCode?: string | null }>(`/integrations/google/status?connectionId=${encodeURIComponent(connectionId as string)}`, { signal: controller.signal });
        if (!controller.signal.aborted) setMessage({ tone: "error", message: googleOAuthMessage(result.errorCode) });
      } catch { if (!controller.signal.aborted) setMessage({ tone: "error", message: "Google authorization could not be completed. Please try again." }); }
      finally { sessionStorage.removeItem("aegis-google-connection-id"); }
    }
    void loadOAuthError();
    return () => controller.abort();
  }, [searchParams]);

  async function start(scopes?: string[]) {
    setBusy(scopes?.[0] || "connect");
    setMessage(null);
    try {
      const result = await api<{ authorizationUrl: string; connectionId: string }>("/integrations/google/start", {
        method: "POST",
        body: JSON.stringify({ returnTarget: "web", scopes }),
      });
      sessionStorage.setItem("aegis-google-connection-id", result.connectionId);
      window.location.assign(result.authorizationUrl);
    } catch (cause) {
      setMessage({ tone: "error", message: formatApiError(cause) });
      setBusy("");
    }
  }

  async function disconnect() {
    setBusy("disconnect");
    setMessage(null);
    try {
      await api("/integrations/google/disconnect", { method: "POST" });
      setConfirmDisconnect(false);
      setMessage({ tone: "success", message: "Google Workspace disconnected. Stored tokens were removed." });
      await load();
    } catch (cause) {
      setMessage({ tone: "error", message: formatApiError(cause) });
    } finally {
      setBusy("");
    }
  }

  const connected = integration?.status === "connected";
  const reconnect = integration?.status === "reconnection_required";

  return <div className="mx-auto max-w-6xl">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm uppercase tracking-[.24em] text-[var(--aegis-orange)]">Workspace connections</p><h1 className="mt-2 text-4xl font-semibold">Connections</h1><p className="mt-3 max-w-2xl text-[var(--aegis-text-muted)]">Connect Google Workspace once. Aegis requests read-only access first and never exposes your OAuth tokens to the browser.</p></div>
      <button onClick={() => void load()} disabled={loading} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white hover:bg-white/5 disabled:opacity-50"><RefreshCw size={16} className={`mr-2 inline ${loading ? "animate-spin" : ""}`} />Refresh</button>
    </header>

    {message && <div role={message.tone === "error" ? "alert" : "status"} className={`mt-6 rounded-2xl border p-4 text-sm ${message.tone === "error" ? "border-red-400/30 bg-red-400/10 text-red-100" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"}`}>{message.message}</div>}

    <section className="surface mt-8 overflow-hidden rounded-3xl">
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-white/10 p-6 lg:p-8">
        <div className="flex gap-4"><GoogleMark /><div><div className="flex flex-wrap items-center gap-3"><h2 className="text-2xl font-semibold">Google Workspace</h2>{connected ? <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300"><Check size={12} className="mr-1 inline" />Connected</span> : reconnect ? <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs text-amber-200">Reconnect required</span> : <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">{integration?.configured === false ? "Not configured" : "Disconnected"}</span>}</div><p className="mt-2 text-sm text-[var(--aegis-text-muted)]">{integration?.account?.email ? `Connected as ${integration.account.email}` : "Gmail and Drive read access with one secure Google account."}</p></div></div>
        <div className="flex flex-wrap gap-2">{connected && <button onClick={() => void start()} disabled={Boolean(busy)} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm hover:bg-white/5">Reconnect</button>}{connected && <button onClick={() => setConfirmDisconnect(true)} disabled={Boolean(busy)} className="rounded-xl border border-red-300/20 px-4 py-2.5 text-sm text-red-200 hover:bg-red-400/10"><Unplug size={15} className="mr-2 inline" />Disconnect</button>}{!connected && <button onClick={() => void start()} disabled={Boolean(busy) || integration?.configured === false} className="rounded-xl bg-[var(--aegis-blue)] px-5 py-2.5 font-semibold text-white shadow-lg shadow-blue-950/30 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">{busy === "connect" ? <><LoaderCircle size={16} className="mr-2 inline animate-spin" />Connecting…</> : reconnect ? "Reconnect Google" : "Connect Google"}</button>}</div>
      </div>
      {integration?.configured === false && <div className="flex gap-3 border-b border-amber-400/20 bg-amber-400/5 px-6 py-4 text-sm text-amber-100"><AlertTriangle size={18} className="shrink-0" /><p>Google OAuth is not configured on the Aegis API. No browser or Desktop secret is expected.</p></div>}
      <div className="grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-4 lg:p-8">
        <ServiceCard icon={<Mail size={20} />} name="Gmail" description="Recent mail and search" status={integration?.services.gmail.status} href={connected && integration?.services.gmail.available ? "/gmail" : undefined} />
        <ServiceCard icon={<HardDrive size={20} />} name="Drive" description="Files and metadata" status={integration?.services.drive.status} href={connected && integration?.services.drive.available ? "/drive" : undefined} action={connected && integration?.services.drive.available && !integration.services.drive.contentAvailable ? <button onClick={() => void start([DRIVE_READ_SCOPE])} className="text-xs font-semibold text-[var(--aegis-blue-light)]">Grant file content access</button> : undefined} />
        <ServiceCard icon={<CalendarDays size={20} />} name="Calendar" description="Planning and events" status={integration?.services.calendar.status} comingSoon />
        <ServiceCard icon={<Contact size={20} />} name="Contacts" description="People and addresses" status={integration?.services.contacts.status} comingSoon />
      </div>
    </section>

    <section className="mt-8 grid gap-4 md:grid-cols-2">
      <div className="surface rounded-2xl p-6"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/5"><Github size={20} /></span><div><h2 className="font-semibold">GitHub</h2><p className="text-sm text-[var(--aegis-text-muted)]">Repositories, issues and pull requests</p></div></div><span className="mt-5 inline-flex rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">À venir</span></div>
      <div className="surface rounded-2xl p-6"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-400/10 text-blue-200"><ShieldCheck size={20} /></span><div><h2 className="font-semibold">Privacy controls</h2><p className="text-sm text-[var(--aegis-text-muted)]">Read-only scopes first. Disconnect removes all stored Google tokens.</p></div></div><Link href="/security" className="mt-5 inline-flex text-sm font-semibold text-[var(--aegis-blue-light)]">Review account security</Link></div>
    </section>

    {confirmDisconnect && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="disconnect-title" onKeyDown={(event) => { if (event.key === "Escape") setConfirmDisconnect(false); }}><div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1424] p-6 shadow-2xl"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-red-400/10 text-red-200"><Unplug size={20} /></span><h2 id="disconnect-title" className="mt-4 text-xl font-semibold">Disconnect Google Workspace?</h2><p className="mt-3 text-sm leading-6 text-[var(--aegis-text-muted)]">Aegis will ask Google to revoke access, remove encrypted access and refresh tokens, and invalidate Gmail and Drive permissions.</p><div className="mt-6 flex justify-end gap-3"><button autoFocus onClick={() => setConfirmDisconnect(false)} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm">Cancel</button><button onClick={() => void disconnect()} disabled={busy === "disconnect"} className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === "disconnect" ? "Disconnecting…" : "Disconnect"}</button></div></div></div>}
  </div>;
}

function googleOAuthMessage(code?: string | null): string {
  if (code === "ACCESS_DENIED") return "Google authorization was cancelled.";
  if (code === "OAUTH_SESSION_EXPIRED") return "The Google connection expired. Please try again.";
  if (code === "INVALID_CLIENT") return "The configured Google OAuth client was refused.";
  if (code === "INVALID_GRANT") return "The Google authorization expired. Please reconnect.";
  if (code === "MISSING_SCOPE") return "Aegis needs an additional permission for this feature.";
  if (code === "GOOGLE_API_UNAVAILABLE") return "Google is temporarily unavailable.";
  return "Google authorization could not be completed. Please try again.";
}

function ServiceCard({ icon, name, description, status, href, action, comingSoon = false }: { icon: React.ReactNode; name: string; description: string; status?: string; href?: string; action?: React.ReactNode; comingSoon?: boolean }) {
  const body = <div className="rounded-2xl border border-white/10 bg-black/10 p-4 transition hover:border-white/20"><div className="flex items-start justify-between"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-400/10 text-blue-200">{icon}</span>{comingSoon ? <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] text-slate-400">À venir</span> : status === "connected" ? <Check size={16} className="text-emerald-300" /> : <Link2 size={15} className="text-slate-500" />}</div><h3 className="mt-4 font-semibold">{name}</h3><p className="mt-1 text-xs text-[var(--aegis-text-muted)]">{description}</p><p className={`mt-3 text-xs ${status === "connected" ? "text-emerald-300" : "text-amber-200"}`}>{status === "connected" ? "Connected" : "Permission required"}</p>{action && <div className="mt-3">{action}</div>}</div>;
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function ConnectionsPage() {
  return <Protected><Suspense fallback={<div className="p-8 text-sm text-[var(--aegis-text-muted)]">Loading connections…</div>}><ConnectionsContent /></Suspense></Protected>;
}
