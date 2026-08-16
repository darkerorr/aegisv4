import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AlertTriangle, CalendarDays, Check, Contact, ExternalLink, File, HardDrive, Inbox, Link2, LoaderCircle, Mail, RefreshCw, Search, ShieldCheck, Unplug, X } from "lucide-react";
import { api, describeApiError, type DriveFile, type GmailMessage, type GoogleIntegration } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { AegisBadge, AegisButton, AegisCard, AegisEmptyState, AegisErrorState, AegisInput, AegisStatus } from "../components/ui/AegisUI";
import { pollGoogleConnection } from "../integrations/googlePolling";

const DRIVE_READ_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

type WorkspaceView = "services" | "gmail" | "drive";

export function ConnectionsPage() {
  const { status } = useAuth();
  const [integration, setIntegration] = useState<GoogleIntegration | null>(null);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("services");
  const [connectionId, setConnectionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const result = await api.getGoogleIntegration(); setIntegration(result.integration); }
    catch (cause) { setError(describeApiError(cause)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (status === "authenticated") void load(); else setLoading(false); }, [load, status]);
  useEffect(() => {
    if (!connectionId) return;
    const controller = new AbortController();
    async function poll() {
      try {
        const result = await pollGoogleConnection(connectionId, (id) => api.getGoogleIntegrationStatus(id), { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (result.status === "completed") { setConnectionId(""); setNotice("Google Workspace connected successfully."); await load(); return; }
        setConnectionId(""); setError(result.status === "expired" ? "The Google connection expired. Please try again." : desktopGoogleOAuthMessage(result.errorCode));
      } catch (cause) { if (!controller.signal.aborted) { setConnectionId(""); setError(describeApiError(cause)); } }
    }
    void poll();
    return () => controller.abort();
  }, [connectionId, load]);

  async function connect(scopes?: string[]) {
    setBusy(scopes?.[0] || "connect"); setError(""); setNotice("");
    try {
      const result = await api.startGoogleIntegration({ returnTarget: "desktop", scopes });
      await invoke("open_external_url", { url: result.authorizationUrl });
      setConnectionId(result.connectionId);
      setNotice("Waiting for Google authorization in your system browser…");
    } catch (cause) { setError(describeApiError(cause)); }
    finally { setBusy(""); }
  }

  async function disconnect() {
    setBusy("disconnect"); setError("");
    try { await api.disconnectGoogle(); setConfirmDisconnect(false); setNotice("Google Workspace disconnected. Stored tokens were removed."); setWorkspaceView("services"); await load(); }
    catch (cause) { setError(describeApiError(cause)); }
    finally { setBusy(""); }
  }

  if (status !== "authenticated") return <AegisEmptyState title="Aegis account required" description="Google Workspace is shared through your Aegis account. Sign in to connect it; local models remain available without an account." icon={<Link2 size={24} />} />;
  if (workspaceView === "gmail") return <DesktopGmail onBack={() => setWorkspaceView("services")} />;
  if (workspaceView === "drive") return <DesktopDrive onBack={() => setWorkspaceView("services")} onGrant={() => void connect([DRIVE_READ_SCOPE])} />;

  const connected = integration?.status === "connected";
  return <div className="page-stack connections-page">
    <header className="page-heading"><div><p className="eyebrow">Workspace connections</p><h1>Connections</h1><p>One Google authorization for Gmail and Drive. OAuth always opens in your system browser.</p></div><AegisButton variant="secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""} /> Refresh</AegisButton></header>
    {error && <AegisErrorState title="Google connection needs attention" description={error} onRetry={() => void load()} />}
    {notice && <div className="desktop-notice success" role="status">{connectionId && <LoaderCircle size={16} className="spin" />}{notice}</div>}
    <AegisCard className="workspace-connection-card" raised>
      <div className="connection-card-head"><div className="connection-identity"><span className="google-mark">G</span><div><div className="connection-title"><h2>Google Workspace</h2>{connected ? <AegisStatus tone="success" label="Connected" /> : integration?.configured === false ? <AegisStatus tone="danger" label="Not configured" /> : <AegisStatus label="Disconnected" />}</div><p>{integration?.account?.email ? `Connected as ${integration.account.email}` : "Read-only Gmail and Drive access."}</p></div></div><div className="connection-actions">{connected ? <><AegisButton variant="secondary" onClick={() => void connect()}>Reconnect</AegisButton><AegisButton variant="danger" onClick={() => setConfirmDisconnect(true)}><Unplug size={15} /> Disconnect</AegisButton></> : <AegisButton onClick={() => void connect()} disabled={Boolean(busy) || integration?.configured === false}>{busy === "connect" ? <><LoaderCircle size={15} className="spin" /> Connecting…</> : "Connect Google"}</AegisButton>}</div></div>
      {integration?.configured === false && <div className="connection-warning"><AlertTriangle size={17} />Google OAuth is not configured on the Aegis API. The Desktop app does not contain Google credentials.</div>}
      <div className="connection-service-grid">
        <DesktopService icon={<Mail size={18} />} name="Gmail" status={integration?.services.gmail.status} description="Recent mail and search" onOpen={connected && integration?.services.gmail.available ? () => setWorkspaceView("gmail") : undefined} />
        <DesktopService icon={<HardDrive size={18} />} name="Drive" status={integration?.services.drive.status} description="Files and metadata" onOpen={connected && integration?.services.drive.available ? () => setWorkspaceView("drive") : undefined} action={connected && integration?.services.drive.available && !integration.services.drive.contentAvailable ? <button onClick={() => void connect([DRIVE_READ_SCOPE])}>Grant file access</button> : undefined} />
        <DesktopService icon={<CalendarDays size={18} />} name="Calendar" status={integration?.services.calendar.status} description="Planning" comingSoon />
        <DesktopService icon={<Contact size={18} />} name="Contacts" status={integration?.services.contacts.status} description="People" comingSoon />
      </div>
    </AegisCard>
    <AegisCard className="connection-privacy"><ShieldCheck size={20} /><div><h3>Server-side token protection</h3><p>Google tokens are encrypted by the Aegis API. No client secret or OAuth token is stored in this desktop binary.</p></div></AegisCard>
    {confirmDisconnect && <div className="desktop-modal-layer" role="dialog" aria-modal="true" aria-labelledby="desktop-disconnect-title"><AegisCard className="desktop-confirm" raised><button className="modal-close" onClick={() => setConfirmDisconnect(false)} aria-label="Close"><X size={17} /></button><span className="confirm-icon danger"><Unplug size={20} /></span><h2 id="desktop-disconnect-title">Disconnect Google Workspace?</h2><p>Google revocation will be attempted. Aegis will always remove the encrypted access and refresh tokens stored for this account.</p><div className="confirm-actions"><AegisButton variant="secondary" onClick={() => setConfirmDisconnect(false)}>Cancel</AegisButton><AegisButton variant="danger" onClick={() => void disconnect()} disabled={busy === "disconnect"}>{busy === "disconnect" ? "Disconnecting…" : "Disconnect"}</AegisButton></div></AegisCard></div>}
  </div>;
}

function desktopGoogleOAuthMessage(code?: string | null): string {
  if (code === "ACCESS_DENIED") return "Google authorization was cancelled.";
  if (code === "OAUTH_SESSION_EXPIRED") return "The Google connection expired. Please try again.";
  if (code === "INVALID_CLIENT") return "The configured Google OAuth client was refused.";
  if (code === "INVALID_GRANT") return "The Google authorization expired. Please reconnect.";
  if (code === "MISSING_SCOPE") return "Aegis needs an additional permission for this feature.";
  return "Google authorization could not be completed.";
}

function DesktopService({ icon, name, description, status, onOpen, action, comingSoon = false }: { icon: React.ReactNode; name: string; description: string; status?: string; onOpen?: () => void; action?: React.ReactNode; comingSoon?: boolean }) {
  return <div className="desktop-service"><div className="desktop-service-top"><span>{icon}</span>{comingSoon && <AegisBadge>À venir</AegisBadge>}</div><h3>{name}</h3><p>{description}</p><small className={status === "connected" ? "connected" : "permission"}>{status === "connected" ? "Connected" : "Permission required"}</small>{onOpen && <button onClick={onOpen}>Open <ExternalLink size={12} /></button>}{action}</div>;
}

function DesktopGmail({ onBack }: { onBack: () => void }) {
  const [query, setQuery] = useState(""); const [messages, setMessages] = useState<GmailMessage[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [selected, setSelected] = useState<GmailMessage | null>(null);
  const load = useCallback(async (q = "") => { setLoading(true); setError(""); try { const result = await api.listGmailMessages({ q, maxResults: 15 }); setMessages(result.messages); } catch (cause) { setError(describeApiError(cause)); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function open(message: GmailMessage) { try { const result = await api.getGmailMessage(message.id); setSelected(result.message); } catch (cause) { setError(describeApiError(cause)); } }
  return <div className="page-stack google-resource-page"><header className="page-heading"><div><button className="back-link" onClick={onBack}>← Connections</button><h1>Gmail</h1><p>Live mailbox access. Message bodies are not cached by Aegis.</p></div></header><form className="resource-search" onSubmit={(event) => { event.preventDefault(); void load(query.trim()); }}><Search size={16} /><AegisInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Gmail…" /><AegisButton>Search</AegisButton></form>{error && <AegisErrorState title="Gmail could not be loaded" description={error} onRetry={() => void load(query)} />}{loading ? <AegisCard className="resource-loading"><LoaderCircle className="spin" size={18} />Loading Gmail…</AegisCard> : !messages.length ? <AegisEmptyState icon={<Inbox size={23} />} title="No messages found" description="Try another Gmail search." /> : <AegisCard className="resource-list">{messages.map((message) => <button key={message.id} onClick={() => void open(message)}><span className="resource-icon"><Mail size={16} /></span><span><strong>{message.subject}</strong><small>{message.from} · {message.snippet}</small></span><time>{message.date ? new Date(message.date).toLocaleDateString() : ""}</time></button>)}</AegisCard>}{selected && <div className="desktop-modal-layer"><AegisCard className="resource-detail" raised><button className="modal-close" onClick={() => setSelected(null)}><X size={17} /></button><p className="eyebrow">Gmail message</p><h2>{selected.subject}</h2><small>{selected.from}</small><article>{selected.bodyText || selected.snippet}</article></AegisCard></div>}</div>;
}

function DesktopDrive({ onBack, onGrant }: { onBack: () => void; onGrant: () => void }) {
  const [query, setQuery] = useState(""); const [files, setFiles] = useState<DriveFile[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [permission, setPermission] = useState("");
  const load = useCallback(async (q = "") => { setLoading(true); setError(""); try { const result = q ? await api.searchDrive(q) : await api.listDriveFiles({ pageSize: 25 }); setFiles(result.files); setPermission(result.permissionMessage || ""); } catch (cause) { setError(describeApiError(cause)); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function open(url?: string) { if (!url) return; try { await invoke("open_external_url", { url }); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to open Google Drive."); } }
  return <div className="page-stack google-resource-page"><header className="page-heading"><div><button className="back-link" onClick={onBack}>← Connections</button><h1>Google Drive</h1><p>Live file metadata from your Google account.</p></div></header><form className="resource-search" onSubmit={(event) => { event.preventDefault(); void load(query.trim()); }}><Search size={16} /><AegisInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Drive by name…" /><AegisButton>Search</AegisButton></form>{permission && <div className="connection-warning"><AlertTriangle size={17} />{permission}<AegisButton onClick={onGrant}>Grant permission</AegisButton></div>}{error && <AegisErrorState title="Drive could not be loaded" description={error} onRetry={() => void load(query)} />}{loading ? <AegisCard className="resource-loading"><LoaderCircle className="spin" size={18} />Loading Drive…</AegisCard> : !files.length ? <AegisEmptyState icon={<HardDrive size={23} />} title="No files found" description="Try another file name." /> : <AegisCard className="resource-list">{files.map((file) => <button key={file.id} onClick={() => void open(file.webViewLink)} disabled={!file.webViewLink}><span className="resource-icon"><File size={16} /></span><span><strong>{file.name}</strong><small>{file.mimeType} · {file.owners?.[0]?.displayName || "Google Drive"}</small></span><ExternalLink size={14} /></button>)}</AegisCard>}</div>;
}
