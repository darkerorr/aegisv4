"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Save, Sun, Moon, Monitor, Globe, Bell, Shield, Cpu, PlugZap, Link2, User, Key, ChevronRight } from "lucide-react";
import { Protected } from "../../components/Protected";
import { api, formatApiError } from "../../lib/api";

const categories = [
  { id: "general", label: "General", icon: Globe },
  { id: "appearance", label: "Appearance", icon: Sun },
  { id: "ai", label: "AI", icon: Cpu },
  { id: "providers", label: "Providers", icon: PlugZap },
  { id: "connections", label: "Connections", icon: Link2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "privacy", label: "Privacy", icon: Shield },
  { id: "account", label: "Account", icon: User },
  { id: "security", label: "Security", icon: Key },
  { id: "advanced", label: "Advanced", icon: Monitor },
] as const;

function SettingsContent() {
  const [activeCategory, setActiveCategory] = useState("general");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [preferences, setPreferences] = useState<Record<string, unknown>>({});

  useEffect(() => {
    async function load() {
      try {
        const result = await api<{ user: { preferences?: Record<string, unknown> } }>("/auth/me");
        setPreferences(result.user.preferences || {});
      } catch { /* ignore */ }
    }
    void load();
  }, []);

  async function save(key: string, value: unknown) {
    setSaving(true); setSaveError(""); setSaveSuccess(false);
    const next = { ...preferences, [key]: value };
    try {
      await api("/auth/account", { method: "PATCH", body: JSON.stringify({ preferences: next }) });
      setPreferences(next);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setSaveError(formatApiError(err));
    } finally { setSaving(false); }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[.24em] text-[var(--aegis-orange)]">Settings</p>
        <h1 className="mt-2 text-4xl font-semibold">Settings</h1>
      </div>

      <div className="flex flex-wrap gap-4 lg:flex-nowrap">
        {/* Sidebar */}
        <nav className="w-full lg:w-48 shrink-0 space-y-1" aria-label="Settings categories">
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${activeCategory === cat.id ? "bg-[var(--aegis-blue)]/10 text-[var(--aegis-blue-light)]" : "text-[var(--aegis-text-muted)] hover:bg-white/5 hover:text-white"}`}>
              <cat.icon size={16} />{cat.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="surface flex-1 rounded-2xl p-6 lg:p-8">
          {activeCategory === "general" && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">General</h2>
              <label className="block text-sm text-slate-300">Language<div className="mt-2"><select className="control rounded-xl px-3 py-2.5 text-sm text-white w-full max-w-xs"><option value="en">English</option><option value="fr">Français</option></select></div></label>
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium">Auto-save conversations</p><p className="text-xs text-[var(--aegis-text-muted)]">Save conversations automatically as you chat.</p></div>
                <button onClick={() => save("autoSave", !preferences.autoSave)} className={`relative h-6 w-11 rounded-full transition ${preferences.autoSave ? "bg-[var(--aegis-blue)]" : "bg-white/20"}`} role="switch" aria-checked={!!preferences.autoSave}>
                  <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${preferences.autoSave ? "translate-x-5" : ""}`} />
                </button>
              </div>
            </div>
          )}

          {activeCategory === "appearance" && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Appearance</h2>
              <label className="block text-sm text-slate-300">Theme<div className="mt-2 flex gap-3">
                {[{ value: "dark", icon: Moon }, { value: "light", icon: Sun }, { value: "system", icon: Monitor }].map((t) => (
                  <button key={t.value} onClick={() => save("theme", t.value)} className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm transition ${preferences.theme === t.value ? "border-[var(--aegis-blue)] bg-[var(--aegis-blue)]/10 text-[var(--aegis-blue-light)]" : "border-white/10 text-slate-300 hover:bg-white/5"}`}>
                    <t.icon size={16} />{t.value.charAt(0).toUpperCase() + t.value.slice(1)}
                  </button>
                ))}
              </div></label>
            </div>
          )}

          {activeCategory === "ai" && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">AI Settings</h2>
              <label className="block text-sm text-slate-300">Default model<div className="mt-2"><input className="control rounded-xl px-3 py-2.5 text-sm text-white w-full max-w-xs" placeholder="Select a model..." /></div></label>
              <label className="block text-sm text-slate-300">Temperature<div className="mt-2"><input type="range" min="0" max="2" step="0.1" className="w-full max-w-xs accent-[var(--aegis-blue)]" /></div></label>
            </div>
          )}

          {activeCategory === "privacy" && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Privacy</h2>
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium">Privacy mode</p><p className="text-xs text-[var(--aegis-text-muted)]">Choose how your data is handled.</p></div>
                <select className="control rounded-xl px-3 py-2.5 text-sm text-white">
                  <option>Remote provider</option>
                  <option>Local only</option>
                  <option>Synced</option>
                  <option>Private session</option>
                </select>
              </div>
            </div>
          )}

          {activeCategory === "account" && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Account</h2>
              <p className="text-sm text-[var(--aegis-text-muted)]">Manage your account settings from the Account page.</p>
              <a href="/account" className="inline-flex items-center gap-1 text-sm text-[var(--aegis-blue-light)]">Go to Account <ChevronRight size={14} /></a>
            </div>
          )}

          {activeCategory === "security" && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Security</h2>
              <p className="text-sm text-[var(--aegis-text-muted)]">Manage your security settings from the Security page.</p>
              <a href="/security" className="inline-flex items-center gap-1 text-sm text-[var(--aegis-blue-light)]">Go to Security <ChevronRight size={14} /></a>
            </div>
          )}

          {saveSuccess && <div className="mt-4 rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-200">Settings saved.</div>}
          {saveError && <div className="mt-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{saveError}</div>}
          {saving && <div className="mt-4 flex items-center gap-2 text-sm text-[var(--aegis-text-muted)]"><LoaderCircle className="animate-spin" size={14} />Saving...</div>}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return <Protected><SettingsContent /></Protected>;
}
