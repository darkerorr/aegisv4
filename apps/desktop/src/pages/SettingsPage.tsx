import { useState } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  Bot,
  Cpu,
  Database,
  Eye,
  FolderOpen,
  Globe,
  Monitor,
  Moon,
  RefreshCw,
  Shield,
  Sun,
  Terminal,
  Trash2,
  Wifi,
} from "lucide-react";
import { useSettings, type VisualEffectsMode } from "../contexts/SettingsContext";
import { useAuth } from "../contexts/AuthContext";
import { useSidebar } from "../contexts/SidebarContext";
import { useModelStore } from "../features/models/modelStore";
import { AegisBadge, AegisButton, AegisCard, AegisSelect, AegisStatus } from "../components/ui/AegisUI";

type SettingsTab =
  | "General"
  | "Appearance"
  | "AI"
  | "Providers"
  | "Models"
  | "Projects"
  | "CLI"
  | "Notifications"
  | "Privacy"
  | "Account"
  | "Security"
  | "Advanced";

const TABS: Array<{ key: SettingsTab; icon: React.ReactNode; label: string }> = [
  { key: "General", icon: <Globe size={15} />, label: "General" },
  { key: "Appearance", icon: <Monitor size={15} />, label: "Appearance" },
  { key: "AI", icon: <Bot size={15} />, label: "AI" },
  { key: "Providers", icon: <Wifi size={15} />, label: "Providers" },
  { key: "Models", icon: <Cpu size={15} />, label: "Models" },
  { key: "Projects", icon: <FolderOpen size={15} />, label: "Projects" },
  { key: "CLI", icon: <Terminal size={15} />, label: "CLI" },
  { key: "Notifications", icon: <Bell size={15} />, label: "Notifications" },
  { key: "Privacy", icon: <Shield size={15} />, label: "Privacy" },
  { key: "Account", icon: <Globe size={15} />, label: "Account" },
  { key: "Security", icon: <Shield size={15} />, label: "Security" },
  { key: "Advanced", icon: <Database size={15} />, label: "Advanced" },
];

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>("General");
  const {
    theme,
    setTheme,
    visualEffects,
    setVisualEffects,
    autoStart,
    setAutoStart,
    safeMode,
    setSafeMode,
    streaming,
    setStreaming,
    telemetry,
    setTelemetry,
    language,
    setLanguage,
    fontSize,
    setFontSize,
  } = useSettings();
  const { user, logout } = useAuth();
  const { navigate } = useSidebar();
  const { providers, models } = useModelStore();
  const [cleared, setCleared] = useState(false);
  const [cliCopied, setCliCopied] = useState(false);

  return (
    <motion.div
      className="settings-page page-stack"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <header className="feature-heading">
        <div>
          <p className="eyebrow">Preferences</p>
          <h1>Settings</h1>
          <p>Manage appearance, AI behavior, providers and privacy.</p>
        </div>
      </header>

      <div className="settings-layout" style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        {/* Side tabs */}
        <nav className="settings-tabs" aria-label="Settings sections" style={{ width: 190, flexShrink: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`settings-tab ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
              aria-current={tab === t.key ? "page" : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                textAlign: "left",
                padding: "9px 13px",
                borderRadius: 10,
                border: "1px solid transparent",
                fontSize: 12.5,
                fontWeight: tab === t.key ? 600 : 450,
                color: tab === t.key ? "var(--aegis-text)" : "var(--aegis-text-muted)",
                background: tab === t.key ? "rgba(22,137,245,.1)" : "transparent",
                borderColor: tab === t.key ? "rgba(83,194,255,.15)" : "transparent",
                cursor: "pointer",
                transition: "background .15s ease, color .15s ease, border-color .15s ease",
              }}
              onMouseEnter={(e) => { if (tab !== t.key) { e.currentTarget.style.background = "rgba(255,255,255,.03)"; e.currentTarget.style.color = "var(--aegis-text)"; } }}
              onMouseLeave={(e) => { if (tab !== t.key) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--aegis-text-muted)"; } }}
            >
              <span style={{ color: tab === t.key ? "var(--aegis-blue-light)" : "inherit", opacity: tab === t.key ? 1 : 0.7 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="settings-content" style={{ flex: 1, maxWidth: 640, minWidth: 0 }}>
          {tab === "General" && (
            <AegisCard raised className="settings-card" style={{ marginTop: 0 }}>
              <div className="settings-card-title"><span className="card-icon"><Globe size={18} /></span><div><h2>General</h2><p>Language and reading preferences</p></div></div>
              <div className="settings-form">
                <SettingRow icon={<Globe size={16} />} label="Language" control={
                  <AegisSelect value={language} onChange={(e) => setLanguage(e.target.value)} style={{ minWidth: 140 }}>
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                  </AegisSelect>
                } />
                <SettingRow icon={<Monitor size={16} />} label="Font size" description={`${fontSize}px — applied to the whole interface`} control={
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <AegisButton variant="secondary" onClick={() => setFontSize(Math.max(12, fontSize - 1))} aria-label="Decrease font size">−</AegisButton>
                    <span style={{ fontSize: 13, minWidth: 28, textAlign: "center", fontWeight: 600 }}>{fontSize}</span>
                    <AegisButton variant="secondary" onClick={() => setFontSize(Math.min(22, fontSize + 1))} aria-label="Increase font size">+</AegisButton>
                  </div>
                } />
              </div>
            </AegisCard>
          )}

          {tab === "Appearance" && (
            <AegisCard raised className="settings-card" style={{ marginTop: 0 }}>
              <div className="settings-card-title"><span className="card-icon"><Monitor size={18} /></span><div><h2>Appearance</h2><p>Theme and visual effects</p></div></div>
              <div className="settings-form">
                <SettingRow icon={theme === "dark" ? <Moon size={16} /> : <Sun size={16} />} label="Theme" control={
                  <div style={{ display: "flex", gap: 6 }}>
                    <AegisButton variant={theme === "dark" ? "primary" : "secondary"} onClick={() => setTheme("dark")}><Moon size={14} /> Dark</AegisButton>
                    <AegisButton variant={theme === "light" ? "primary" : "secondary"} onClick={() => setTheme("light")}><Sun size={14} /> Light</AegisButton>
                  </div>
                } />
                <SettingRow icon={<Eye size={16} />} label="Visual effects" description="Control transitions and translucent floating surfaces" control={
                  <div style={{ display: "flex", gap: 6 }}>
                    {(["full", "reduced", "off"] as VisualEffectsMode[]).map((mode) => (
                      <AegisButton key={mode} variant={visualEffects === mode ? "primary" : "secondary"} onClick={() => setVisualEffects(mode)}>
                        {mode[0].toUpperCase() + mode.slice(1)}
                      </AegisButton>
                    ))}
                  </div>
                } />
                <SettingRow icon={<Monitor size={16} />} label="Auto-start" description="Launch Aegis when you sign in to Windows" control={
                  <Toggle checked={autoStart} onChange={setAutoStart} label={autoStart ? "Enabled" : "Disabled"} />
                } />
              </div>
            </AegisCard>
          )}

          {tab === "AI" && (
            <AegisCard raised className="settings-card" style={{ marginTop: 0 }}>
              <div className="settings-card-title"><span className="card-icon"><Bot size={18} /></span><div><h2>AI behavior</h2><p>Streaming and safety defaults</p></div></div>
              <div className="settings-form">
                <SettingRow icon={<RefreshCw size={16} />} label="Enable streaming" description="Show responses as they are generated" control={<Toggle checked={streaming} onChange={setStreaming} label={streaming ? "On" : "Off"} />} />
                <SettingRow icon={<Shield size={16} />} label="Safe mode" description="Require confirmation before tools execute" control={<Toggle checked={safeMode} onChange={setSafeMode} label={safeMode ? "On" : "Off"} />} />
              </div>
            </AegisCard>
          )}

          {tab === "Providers" && (
            <AegisCard raised className="settings-card" style={{ marginTop: 0 }}>
              <div className="settings-card-title"><span className="card-icon"><Wifi size={18} /></span><div><h2>Providers</h2><p>Connected model providers</p></div></div>
              <div className="settings-form">
                {providers.length === 0 ? (
                  <div style={{ padding: "18px 0", textAlign: "center", color: "var(--aegis-text-muted)", fontSize: 13 }}>
                    No providers configured yet.
                    <div style={{ marginTop: 12 }}><AegisButton variant="primary" onClick={() => navigate("Providers")}>Open providers</AegisButton></div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {providers.map((p) => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--aegis-border)", borderRadius: 11, background: "rgba(255,255,255,.02)" }}>
                        <span className="card-icon" style={{ width: 30, height: 30 }}>{p.kind === "ollama" ? <Bot size={14} /> : <Wifi size={14} />}</span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                        <AegisStatus tone={p.active ? "success" : "neutral"} label={p.active ? "Active" : "Inactive"} />
                      </div>
                    ))}
                  </div>
                )}
                <AegisButton variant="secondary" onClick={() => navigate("Providers")}>Manage providers</AegisButton>
              </div>
            </AegisCard>
          )}

          {tab === "Models" && (
            <AegisCard raised className="settings-card" style={{ marginTop: 0 }}>
              <div className="settings-card-title"><span className="card-icon"><Cpu size={18} /></span><div><h2>Models</h2><p>{models.length} models in the unified catalog</p></div></div>
              <div className="settings-form">
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <AegisBadge tone="blue">{models.filter((m) => m.local).length} local</AegisBadge>
                  <AegisBadge tone="orange">{models.filter((m) => !m.local).length} online</AegisBadge>
                </div>
                <AegisButton variant="secondary" onClick={() => navigate("Models")}>Browse model catalog</AegisButton>
              </div>
            </AegisCard>
          )}

          {tab === "Projects" && (
            <AegisCard raised className="settings-card" style={{ marginTop: 0 }}>
              <div className="settings-card-title"><span className="card-icon"><FolderOpen size={18} /></span><div><h2>Projects</h2><p>Local project references</p></div></div>
              <div className="settings-form">
                <p className="settings-note">Projects are stored on this device and are never synchronized automatically.</p>
                <AegisButton variant="secondary" onClick={() => navigate("Projects")}>Open projects</AegisButton>
              </div>
            </AegisCard>
          )}

          {tab === "CLI" && (
            <AegisCard raised className="settings-card" style={{ marginTop: 0 }}>
              <div className="settings-card-title"><span className="card-icon"><Terminal size={18} /></span><div><h2>CLI</h2><p>Terminal integration</p></div></div>
              <div className="settings-form">
                <p className="settings-note">Manage the Aegis CLI integration. Run commands directly from your terminal.</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <AegisButton variant="primary" onClick={async () => { await navigator.clipboard.writeText("npm install --global aegis"); setCliCopied(true); setTimeout(() => setCliCopied(false), 1800); }}>
                    <Terminal size={14} /> {cliCopied ? "Command copied" : "Copy install command"}
                  </AegisButton>
                  <AegisButton variant="secondary" disabled title="Available after the CLI has been detected">Repair CLI</AegisButton>
                  <AegisButton variant="secondary" disabled title="Available after the CLI has been detected">Update CLI</AegisButton>
                </div>
              </div>
            </AegisCard>
          )}

          {tab === "Notifications" && (
            <AegisCard raised className="settings-card" style={{ marginTop: 0 }}>
              <div className="settings-card-title"><span className="card-icon"><Bell size={18} /></span><div><h2>Notifications</h2><p>Desktop alerts</p></div></div>
              <div className="settings-form">
                <SettingRow icon={<Bell size={16} />} label="Streaming updates" description="Show a badge while a response is generating" control={<Toggle checked={streaming} onChange={setStreaming} label={streaming ? "On" : "Off"} />} />
                <p className="settings-note">More notification options will appear when the native notification bridge is available.</p>
              </div>
            </AegisCard>
          )}

          {tab === "Privacy" && (
            <AegisCard raised className="settings-card" style={{ marginTop: 0 }}>
              <div className="settings-card-title"><span className="card-icon"><Shield size={18} /></span><div><h2>Privacy</h2><p>Data controls</p></div></div>
              <div className="settings-form">
                <SettingRow icon={<Shield size={16} />} label="Telemetry" description="Send anonymous usage data to help improve Aegis" control={<Toggle checked={telemetry} onChange={setTelemetry} label={telemetry ? "On" : "Off"} />} />
                <SettingRow icon={<Database size={16} />} label="Local storage" description="Clear all locally stored data" control={
                  <AegisButton variant="danger" onClick={() => { localStorage.clear(); setCleared(true); setTimeout(() => setCleared(false), 2000); }}>
                    <Trash2 size={14} /> {cleared ? "Cleared!" : "Clear"}
                  </AegisButton>
                } />
              </div>
            </AegisCard>
          )}

          {tab === "Account" && (
            <AegisCard raised className="settings-card" style={{ marginTop: 0 }}>
              <div className="settings-card-title"><span className="card-icon"><Globe size={18} /></span><div><h2>Account</h2><p>{user?.email || "Local mode"}</p></div></div>
              <div className="settings-form">
                <SettingRow icon={<Globe size={16} />} label={user?.displayName || "Local profile"} description={user?.email || "No account is required for local models."} control={<AegisButton variant="secondary" onClick={() => navigate("Account")}>Open account</AegisButton>} />
              </div>
            </AegisCard>
          )}

          {tab === "Security" && (
            <AegisCard raised className="settings-card" style={{ marginTop: 0 }}>
              <div className="settings-card-title"><span className="card-icon"><Shield size={18} /></span><div><h2>Security</h2><p>Session and device management</p></div></div>
              <div className="settings-form">
                <SettingRow icon={<Shield size={16} />} label="Account" description={user?.email || "Local mode"} control={
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                    {user && <AegisButton variant="danger" onClick={() => logout()}>Sign out</AegisButton>}
                    <AegisButton variant="secondary" onClick={() => navigate("Security")}>Manage sessions</AegisButton>
                  </div>
                } />
              </div>
            </AegisCard>
          )}

          {tab === "Advanced" && (
            <AegisCard raised className="settings-card" style={{ marginTop: 0 }}>
              <div className="settings-card-title"><span className="card-icon"><Database size={18} /></span><div><h2>Advanced</h2><p>Technical settings</p></div></div>
              <div className="settings-form">
                <p className="settings-note">Advanced settings. Be careful — changes here may affect app behavior.</p>
                <div style={{ display: "grid", gap: 6, padding: "12px 14px", border: "1px solid var(--aegis-border)", borderRadius: 11, background: "rgba(0,0,0,.14)" }}>
                  <span style={{ fontSize: 10, color: "var(--aegis-text-muted)", textTransform: "uppercase", letterSpacing: ".08em" }}>API endpoint</span>
                  <code style={{ fontSize: 12, color: "#9ee1ff" }}>http://127.0.0.1:4000</code>
                </div>
              </div>
            </AegisCard>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 9,
        padding: "5px 10px 5px 5px",
        border: "1px solid var(--aegis-border)",
        borderRadius: 99,
        background: checked ? "rgba(22,137,245,.12)" : "rgba(255,255,255,.03)",
        color: "var(--aegis-text)",
        fontSize: 11.5,
        cursor: "pointer",
        transition: "background .15s ease, border-color .15s ease",
      }}
    >
      <span style={{
        width: 26,
        height: 16,
        borderRadius: 99,
        background: checked ? "var(--aegis-primary)" : "rgba(255,255,255,.12)",
        position: "relative",
        transition: "background .15s ease",
        flexShrink: 0,
      }}>
        <span style={{
          position: "absolute",
          top: 2,
          left: checked ? 12 : 2,
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: "white",
          boxShadow: "0 1px 3px rgba(0,0,0,.3)",
          transition: "left .15s ease",
        }} />
      </span>
      {label}
    </button>
  );
}

function SettingRow({ icon, label, description, control }: { icon: React.ReactNode; label: string; description?: string; control: React.ReactNode }) {
  return (
    <div className="setting-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "14px 0", borderBottom: "1px solid var(--aegis-border)" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
        <span style={{ color: "var(--aegis-blue-light)", opacity: 0.75, flexShrink: 0 }}>{icon}</span>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 550 }}>{label}</p>
          {description && <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "var(--aegis-text-muted)", lineHeight: 1.5 }}>{description}</p>}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>{control}</div>
    </div>
  );
}