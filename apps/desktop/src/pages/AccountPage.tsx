import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Download, ImagePlus, Languages, MonitorSmartphone, Save, Trash2, UserRound } from "lucide-react";
import { api, describeApiError } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { AegisAvatar, AegisBadge, AegisButton, AegisCard, AegisInput, AegisSelect } from "../components/ui/AegisUI";

const AVATAR_KEY = "aegis-local-avatar";

export function AccountPage() {
  const { user, status, setUser } = useAuth();
  const { language, setLanguage } = useSettings();
  const [name, setName] = useState(user?.displayName || "");
  const [avatar, setAvatar] = useState<string | null>(() => { try { return localStorage.getItem(AVATAR_KEY); } catch { return null; } });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (status !== "authenticated") { setMessage("Profile identity remains local while you are in local mode."); return; }
    setBusy(true); setMessage("");
    try {
      const result = await api.updateAccount({ displayName: name.trim() || undefined, preferences: { ...(user?.preferences ?? {}), language } });
      setUser(result.user); setMessage("Account saved and synchronized.");
    } catch (error) { setMessage(describeApiError(error)); }
    finally { setBusy(false); }
  }

  function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2_000_000) { setMessage("Choose an image smaller than 2 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : null;
      setAvatar(value);
      try { if (value) localStorage.setItem(AVATAR_KEY, value); } catch { /* optional local preview */ }
      setMessage(status === "authenticated" ? "Avatar preview saved locally. Cloud avatar sync requires the documented API route." : "Avatar saved on this device.");
    };
    reader.readAsDataURL(file);
  }

  function removeAvatar() {
    setAvatar(null);
    try { localStorage.removeItem(AVATAR_KEY); } catch { /* optional local preview */ }
    if (fileRef.current) fileRef.current.value = "";
    setMessage("Avatar removed from this device.");
  }

  function exportLocalData() {
    if (status !== "local") { setMessage("Cloud account export requires the documented export API route."); return; }
    const data = { exportedAt: new Date().toISOString(), conversation: (() => { try { return JSON.parse(localStorage.getItem("aegis-local-conversation") || "[]") as unknown; } catch { return []; } })(), settings: (() => { try { return JSON.parse(localStorage.getItem("aegis-desktop-settings") || "{}") as unknown; } catch { return {}; } })() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `aegis-local-export-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
    setMessage("Local workspace exported.");
  }

  return <section className="feature-page account-page page-stack">
    <header className="feature-heading"><div><p className="eyebrow">Identity and device</p><h1>Account</h1><p>Manage your profile, language, current device and data controls.</p></div><AegisBadge tone={status === "local" ? "blue" : "success"}>{status === "local" ? "Local mode" : "Synced"}</AegisBadge></header>
    <div className="account-grid">
      <AegisCard raised className="settings-card account-profile-card"><div className="account-avatar-row"><AegisAvatar name={name || user?.email || "Aegis"} src={avatar} size={72} /><div><h2>Profile image</h2><p>PNG, JPEG or WebP · maximum 2 MB</p><span><AegisButton onClick={() => fileRef.current?.click()}><ImagePlus size={14} /> Upload</AegisButton><AegisButton variant="ghost" onClick={removeAvatar} disabled={!avatar}><Trash2 size={14} /> Remove</AegisButton></span><input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseAvatar} /></div></div>
        <form onSubmit={submit} className="settings-form"><label>Display name<AegisInput value={name} onChange={(event) => setName(event.target.value)} /></label><label>Email<AegisInput value={user?.email || (status === "local" ? "No account required" : "")} disabled /></label><label>Language<AegisSelect value={language} onChange={(event) => setLanguage(event.target.value)}><option value="en">English</option><option value="fr">Français</option></AegisSelect></label>{message && <p role="status" className="form-message">{message}</p>}<AegisButton variant="primary" disabled={busy}><Save size={15} />{busy ? "Saving…" : status === "local" ? "Save locally" : "Save changes"}</AegisButton></form>
      </AegisCard>
      <div className="account-side-stack">
        <AegisCard raised className="account-summary-card"><span className="card-icon"><MonitorSmartphone size={18} /></span><div><h2>Current device</h2><p>{navigator.platform || "Windows desktop"}</p><small>{status === "local" ? "Local workspace · no cloud session" : "Current synchronized session"}</small></div></AegisCard>
        <AegisCard raised className="account-summary-card"><span className="card-icon"><Languages size={18} /></span><div><h2>Language</h2><p>{language === "fr" ? "Français" : "English"}</p><small>Applied to local Desktop preferences.</small></div></AegisCard>
        <AegisCard raised className="account-data-card"><h2>Data controls</h2><p>{status === "local" ? "Export the local conversation and Desktop settings as JSON." : "Account-wide export and deletion require server-side routes; no fake success is shown."}</p><AegisButton onClick={exportLocalData}><Download size={14} /> Export data</AegisButton><AegisButton variant="danger" disabled title="Requires the account deletion API route"><Trash2 size={14} /> Delete account unavailable</AegisButton></AegisCard>
      </div>
    </div>
  </section>;
}
