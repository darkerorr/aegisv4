"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Cable, CircleUserRound, Database, Download, KeyRound, LoaderCircle, MonitorSmartphone, Save, ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";
import { normalizeError } from "@/lib/api/errors";
import { Avatar } from "@/components/ui/avatar";
import { StatePanel } from "@/components/feedback/state-panel";
import { IntegrationIcon } from "@/components/brand/provider-icon";

export function AccountView() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const me = useQuery({ queryKey: queryKeys.me, queryFn: () => api.me() });
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => api.listSessions() });
  const google = useQuery({ queryKey: queryKeys.integrations, queryFn: () => api.getGoogleIntegration() });
  const user = me.data?.user;
  const [draft, setDraft] = useState({ displayName: "", language: "en", timezone: "" });
  const fingerprint = user ? `${user.id}|${user.displayName || ""}|${String(user.preferences?.language || "")}|${String(user.preferences?.timezone || "")}` : "";
  useEffect(() => {
    if (user) setDraft({ displayName: user.displayName || "", language: String(user.preferences?.language || "en"), timezone: String(user.preferences?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint]);
  const save = useMutation({ mutationFn: (values: { displayName: string; language: string; timezone: string }) => api.updateAccount({ displayName: values.displayName, preferences: { language: values.language, timezone: values.timezone } }), onSuccess: (data) => { queryClient.setQueryData(queryKeys.me, (old) => (old ? { ...old, user: data.user } : old)); queryClient.invalidateQueries({ queryKey: queryKeys.me }); } });
  const history = useMutation({ mutationFn: () => api.deleteConversationHistory(), onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.conversations }) });
  const remove = useMutation({ mutationFn: (form: FormData) => api.deleteAccount({ confirmation: String(form.get("confirmation")), password: String(form.get("password") || "") }), onSuccess: () => { router.push("/"); router.refresh(); } });
  if (me.isError) return <StatePanel state="error" title="Account unavailable" message={normalizeError(me.error).message} onRetry={() => me.refetch()} />;
  async function exportData() { const data = await api.exportAccountData(); const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "aegis-data-export.json"; anchor.click(); URL.revokeObjectURL(url); }

  return (
    <div className="aegis-settings-stack">
      <section className="aegis-page-hero" style={{ alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Avatar name={user?.displayName || user?.email || "Aegis"} size={68} />
          <div>
            <span className="page-kicker"><CircleUserRound size={12} />Account</span>
            <h2 style={{ margin: "6px 0 2px" }}>{user?.displayName || "Aegis account"}</h2>
            <p>{user?.email}</p>
          </div>
        </div>
        <span className={`aegis-provider-status`} data-state={user?.emailVerified ? "connected" : "error"} style={{ width: "fit-content" }}>
          <ShieldCheck size={12} />{user?.emailVerified ? "Verified" : "Verification required"}
        </span>
      </section>

      <div className="aegis-metric-row" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        <div className="aegis-metric"><b>{sessions.data?.sessions.length || 0}</b><span><Activity size={11} />Active sessions</span></div>
        <div className="aegis-metric"><b>JSON</b><span><Database size={11} />Export format</span></div>
        <div className="aegis-metric"><b>Ready</b><span><ShieldCheck size={11} />2FA support</span></div>
      </div>

      <section className="aegis-settings-panel">
        <header><CircleUserRound size={18} /><div><h2>Profile</h2><p>Identity and regional preferences.</p></div></header>
        <form className="aegis-form-grid" onSubmit={(event) => { event.preventDefault(); save.mutate(draft); }}>
          <label className="aegis-form-label">Display name<input className="aegis-field" name="displayName" value={draft.displayName} onChange={(event) => setDraft((prev) => ({ ...prev, displayName: event.target.value }))} /></label>
          <label className="aegis-form-label">Language<select className="aegis-field" name="language" value={draft.language} onChange={(event) => setDraft((prev) => ({ ...prev, language: event.target.value }))}><option value="en">English</option><option value="fr">Français</option></select></label>
          <label className="aegis-form-label">Timezone<input className="aegis-field" name="timezone" value={draft.timezone} onChange={(event) => setDraft((prev) => ({ ...prev, timezone: event.target.value }))} /></label>
          <div className="aegis-form-actions"><button type="submit" className="aegis-btn aegis-btn--primary" disabled={save.isPending}>{save.isPending ? <LoaderCircle size={14} className="spin" /> : <Save size={14} />}{save.isSuccess ? "Saved" : "Save profile"}</button></div>
        </form>
      </section>

      <section className="aegis-settings-panel">
        <header><KeyRound size={18} /><div><h2>Connected identities</h2><p>Methods that can access this account.</p></div></header>
        <div className="identity-list premium-list">
          <div><KeyRound size={18} /><span><strong>Email and password</strong><small>{user?.email}</small></span><b>Active</b></div>
          <div><IntegrationIcon integration="google" size={20} /><span><strong>Google</strong><small>{google.data?.integration.account?.email || "Not linked"}</small></span><Link href="/connections">{google.data?.integration.status === "connected" ? "Manage" : "Link"}</Link></div>
        </div>
      </section>

      <section className="aegis-settings-panel">
        <header><MonitorSmartphone size={18} /><div><h2>Sessions and devices</h2><p>Review and revoke signed-in devices.</p></div></header>
        <div className="session-list">
          {sessions.data?.sessions.map((session) => (
            <div key={session.id}><MonitorSmartphone size={17} /><span><strong>{readableDevice(session.deviceName)}</strong><small>{session.ipMasked || "Address unavailable"} · active {new Date(session.lastSeenAt).toLocaleString()}</small></span>{session.current ? <b>Current</b> : <button className="aegis-btn aegis-btn--sm" onClick={() => api.revokeSession(session.id).then(() => sessions.refetch())}><Trash2 size={13} />Revoke</button>}</div>
          ))}
        </div>
      </section>

      <section className="aegis-settings-panel">
        <header><Database size={18} /><div><h2>Data and privacy</h2><p>Portable data and direct controls.</p></div></header>
        <div className="aegis-form-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          <button className="aegis-btn" onClick={() => void exportData()}><Download size={14} />Export my data</button>
          <Link className="aegis-btn" href="/connections"><Cable size={14} />Connected tools</Link>
          <Link className="aegis-btn" href="/providers"><ShieldCheck size={14} />Providers</Link>
          <button className="aegis-btn" onClick={() => history.mutate()} disabled={history.isPending}><Trash2 size={14} />Delete chat history</button>
        </div>
      </section>

      <section className="aegis-settings-panel" style={{ borderColor: "rgba(255,255,255,0.14)" }}>
        <header><Trash2 size={18} style={{ color: "var(--aegis-danger)" }} /><div><h2>Danger zone</h2><p>Permanently delete the account and cascaded server data.</p></div></header>
        <form className="aegis-form-grid" action={(form) => remove.mutate(form)}>
          <label className="aegis-form-label">Type your account email<input className="aegis-field" name="confirmation" required /></label>
          <label className="aegis-form-label">Current password<input className="aegis-field" type="password" name="password" autoComplete="current-password" required /></label>
          {remove.isError && <p className="form-error">{normalizeError(remove.error).message}</p>}
          <div className="aegis-form-actions" style={{ justifyContent: "flex-start" }}><button className="aegis-btn aegis-btn--danger" disabled={remove.isPending}><Trash2 size={14} />Delete account</button></div>
        </form>
      </section>
    </div>
  );
}

function readableDevice(value: string) {
  const agent = value.toLowerCase();
  const browser = agent.includes("brave") ? "Brave" : agent.includes("edg/") ? "Edge" : agent.includes("chrome") ? "Chrome" : agent.includes("firefox") ? "Firefox" : agent.includes("aegis") ? "Aegis Desktop" : "Aegis client";
  const os = agent.includes("windows") ? "Windows" : agent.includes("android") ? "Android" : agent.includes("iphone") ? "iPhone" : agent.includes("mac os") ? "macOS" : "Unknown system";
  return `${browser} on ${os}`;
}
