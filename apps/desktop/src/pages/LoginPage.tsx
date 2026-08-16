import { useState, type FormEvent } from "react";
import { Eye, EyeOff, LockKeyhole, Server } from "lucide-react";
import { AuthShell } from "../components/AuthShell";
import { useAuth } from "../contexts/AuthContext";
import { useSidebar } from "../contexts/SidebarContext";
import { describeApiError } from "../api/client";

export function LoginPage() {
  const { login, goLocal, sessionExpired } = useAuth();
  const { navigate } = useSidebar();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setError(null); setLoading(true);
    try { await login(email, password); navigate("Chat"); }
    catch (err) { setError(describeApiError(err)); }
    finally { setLoading(false); }
  }

  return <AuthShell title="Welcome back to your workspace." description="Sync conversations, settings and devices across Aegis Web, App and CLI. Your local providers remain yours.">
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--aegis-text-muted)", fontSize: 12 }}><LockKeyhole size={15} color="var(--aegis-success)" /> Secure sign in</div>
    <h2 style={{ fontSize: 25, margin: "24px 0 6px" }}>Sign in</h2>
    {sessionExpired && <div className="aegis-alert" role="status" style={{ marginTop: 18, padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(248,120,8,.35)", background: "rgba(248,120,8,.1)", color: "var(--aegis-orange-light)", fontSize: 13 }}>Your session has expired.<br /><span style={{ color: "var(--aegis-text-muted)" }}>Sign in again to continue syncing your conversations.</span></div>}
    <p className="muted" style={{ margin: 0, fontSize: 13 }}>Continue to your Aegis workspace.</p>
    {error && <div className="aegis-alert aegis-alert-error" role="alert" style={{ marginTop: 18, padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(239,83,80,.35)", background: "rgba(239,83,80,.1)", color: "var(--aegis-error)", fontSize: 13, whiteSpace: "pre-line" }}>{error}</div>}
    <form onSubmit={handleSubmit} style={{ marginTop: 24, display: "grid", gap: 17 }}>
      <label className="aegis-field"><span>Email</span><input className="aegis-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" /></label>
      <label className="aegis-field"><span style={{ display: "flex", justifyContent: "space-between" }}>Password <button type="button" className="text-button" onClick={() => navigate("ForgotPassword")} style={{ margin: 0, fontSize: 12 }}>Forgot?</button></span><div style={{ position: "relative" }}><input className="aegis-input" style={{ paddingRight: 44, width: "100%" }} type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" required minLength={8} autoComplete="current-password" /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", border: 0, background: "transparent", color: "var(--aegis-text-muted)" }}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
      <button className="aegis-btn aegis-btn-primary aegis-btn-lg" type="submit" disabled={loading} style={{ width: "100%", padding: "13px 20px", marginTop: 4 }}>{loading ? "Connecting..." : "Sign in to Aegis"}</button>
    </form>
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "22px 0", color: "var(--aegis-text-muted)", fontSize: 11 }}><span style={{ height: 1, flex: 1, background: "var(--aegis-border)" }} /> OR <span style={{ height: 1, flex: 1, background: "var(--aegis-border)" }} /></div>
    <button className="aegis-btn aegis-btn-secondary" onClick={() => { goLocal(); navigate("Chat"); }} style={{ width: "100%", padding: "11px 16px" }}><Server size={16} /> Continue locally</button>
    <p style={{ textAlign: "center", fontSize: 13, margin: "18px 0 0" }}>New to Aegis? <button className="text-button" onClick={() => navigate("Register")} style={{ margin: 0 }}>Create an account</button></p>
  </AuthShell>;
}
