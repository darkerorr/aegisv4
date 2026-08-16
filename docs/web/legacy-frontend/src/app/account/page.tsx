"use client";

import { FormEvent, useEffect, useState } from "react";
import { LoaderCircle, User, Save, Mail, ChevronRight, LogOut, Trash2 } from "lucide-react";
import { Protected } from "../../components/Protected";
import { api, formatApiError } from "../../lib/api";

function AccountContent() {
  const [user, setUser] = useState<{ id: string; email: string; displayName?: string | null; emailVerified: boolean; preferences?: Record<string, unknown> } | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const result = await api<{ user: typeof user }>("/auth/me");
        if (result.user) { setUser(result.user); setDisplayName(result.user.displayName || ""); }
      } catch { /* ignore */ }
    }
    void load();
  }, []);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setSaveError(""); setSaveSuccess(false);
    try {
      const result = await api<{ user: typeof user }>("/auth/account", { method: "PATCH", body: JSON.stringify({ displayName: displayName.trim() || undefined }) });
      setUser(result.user);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) { setSaveError(formatApiError(err)); }
    finally { setSaving(false); }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[.24em] text-[var(--aegis-orange)]">Account</p>
        <h1 className="mt-2 text-4xl font-semibold">Account</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile */}
        <div className="surface rounded-2xl p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><User size={18} /> Profile</h2>
          <form onSubmit={saveProfile} className="mt-5 space-y-4">
            <label className="block text-sm text-slate-300">Display name
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="control mt-2 w-full rounded-xl px-3 py-3 text-white" placeholder="Your name" />
            </label>
            <label className="block text-sm text-slate-300">Email
              <div className="control mt-2 flex items-center justify-between rounded-xl px-3 py-3">
                <span className="text-white">{user?.email}</span>
                <Mail size={16} className="text-[var(--aegis-text-muted)]" />
              </div>
            </label>
            <div className="flex items-center gap-2 text-xs text-[var(--aegis-text-muted)]">
              <span className={`h-2 w-2 rounded-full ${user?.emailVerified ? "bg-[var(--aegis-success)]" : "bg-amber-400"}`} />
              {user?.emailVerified ? "Email verified" : "Email not verified"}
            </div>
            {saveError && <div className="rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{saveError}</div>}
            {saveSuccess && <div className="rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-200">Profile saved.</div>}
            <button disabled={saving} className="flex items-center gap-2 rounded-xl bg-[var(--aegis-blue)] px-5 py-3 font-semibold text-white hover:brightness-110 disabled:opacity-50">
              {saving && <LoaderCircle size={16} className="animate-spin" />}Save
            </button>
          </form>
        </div>

        {/* Sessions */}
        <div className="surface rounded-2xl p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><LogOut size={18} /> Sessions</h2>
          <p className="mt-2 text-sm text-[var(--aegis-text-muted)]">Manage your active sessions.</p>
          <a href="/security" className="mt-4 inline-flex items-center gap-1 text-sm text-[var(--aegis-blue-light)]">Manage sessions <ChevronRight size={14} /></a>
        </div>

        {/* Linked accounts */}
        <div className="surface rounded-2xl p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">🔗 Linked accounts</h2>
          <p className="mt-2 text-sm text-[var(--aegis-text-muted)]">Connect Google, GitHub and more from the Connections page.</p>
          <a href="/connections" className="mt-4 inline-flex items-center gap-1 text-sm text-[var(--aegis-blue-light)]">Go to Connections <ChevronRight size={14} /></a>
        </div>

        {/* Danger zone */}
        <div className="surface rounded-2xl p-6 border-red-400/20">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-red-300"><Trash2 size={18} /> Danger zone</h2>
          <p className="mt-2 text-sm text-[var(--aegis-text-muted)]">Permanently delete your account and all data.</p>
          <button disabled className="mt-4 rounded-xl border border-red-400/30 px-5 py-2.5 text-sm text-red-300 opacity-50 cursor-not-allowed">Delete account</button>
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  return <Protected><AccountContent /></Protected>;
}
