import { useState, type FormEvent } from "react";
import { Check, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { AuthShell } from "../components/AuthShell";
import { useAuth } from "../contexts/AuthContext";
import { useSidebar } from "../contexts/SidebarContext";
import { describeApiError } from "../api/client";

export function RegisterPage() {
  const { register, goLocal } = useAuth();
  const { navigate } = useSidebar();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(false); const [success, setSuccess] = useState(false);
  const strong = password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setError(null);
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (!strong) { setError("Use at least 8 characters, one uppercase letter and one number."); return; }
    setLoading(true);
    try {
      const result = await register(email, password, displayName || undefined);
      if (!result.verificationRequired) { navigate("Chat"); return; }
      setSuccess(true);
    }
    catch (err) { setError(describeApiError(err)); }
    finally { setLoading(false); }
  }

  if (success) return <AuthShell title="Your workspace is ready." description="Aegis is ready to keep your conversations and settings available across every surface."><div style={{ textAlign: "center" }}><div style={{ width: 62, height: 62, display: "grid", placeItems: "center", margin: "0 auto 20px", borderRadius: "50%", color: "var(--aegis-success)", background: "rgba(54,213,138,.13)", boxShadow: "0 0 30px rgba(54,213,138,.16)" }}><Check size={28} /></div><h2 style={{ fontSize: 25 }}>Account created</h2><p className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>Your account was created. Sign in to continue.</p><button className="aegis-btn aegis-btn-primary" onClick={() => navigate("Login")} style={{ width: "100%", marginTop: 22, padding: 13 }}>Continue to sign in</button></div></AuthShell>;

  return <AuthShell title="Build your guarded AI workspace." description="Create one account for Aegis Web, App and CLI. Use local mode anytime when you want your work to stay on this machine.">
    <div style={{ display: "flex", alignItems: "center", gap: 9, color: "var(--aegis-text-muted)", fontSize: 12 }}><ShieldCheck size={16} color="var(--aegis-blue-light)" /> Your account is protected by Aegis API</div>
    <h2 style={{ fontSize: 25, margin: "24px 0 6px" }}>Create account</h2><p className="muted" style={{ margin: 0, fontSize: 13 }}>Start with your shared workspace identity.</p>
    {error && <div role="alert" style={{ marginTop: 18, padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(239,83,80,.35)", background: "rgba(239,83,80,.1)", color: "var(--aegis-error)", fontSize: 13 }}>{error}</div>}
    <form onSubmit={handleSubmit} style={{ marginTop: 24, display: "grid", gap: 15 }}>
      <label className="aegis-field"><span>Display name <em className="muted">optional</em></span><input className="aegis-input" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" autoComplete="name" /></label>
      <label className="aegis-field"><span>Email</span><input className="aegis-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" /></label>
      <label className="aegis-field"><span>Password</span><div style={{ position: "relative" }}><input className="aegis-input" style={{ paddingRight: 44, width: "100%" }} type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" required autoComplete="new-password" /><button type="button" aria-label="Toggle password visibility" onClick={() => setShowPassword(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", border: 0, background: "transparent", color: "var(--aegis-text-muted)" }}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div><span style={{ display: "block", marginTop: 7, color: strong ? "var(--aegis-success)" : "var(--aegis-text-muted)", fontSize: 11 }}>{password ? (strong ? "Strong password" : "Use 8+ chars, uppercase and number") : "Use a strong password"}</span></label>
      <label className="aegis-field"><span>Confirm password</span><input className="aegis-input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat your password" required autoComplete="new-password" /></label>
      <button className="aegis-btn aegis-btn-primary aegis-btn-lg" type="submit" disabled={loading} style={{ width: "100%", padding: "13px 20px", marginTop: 4 }}>{loading ? "Creating workspace..." : "Create Aegis account"}</button>
    </form>
    <button className="aegis-btn aegis-btn-ghost" onClick={() => { goLocal(); navigate("Chat"); }} style={{ width: "100%", marginTop: 15 }}>Continue locally without an account</button>
    <p style={{ textAlign: "center", fontSize: 13, margin: "18px 0 0" }}>Already have an account? <button className="text-button" onClick={() => navigate("Login")} style={{ margin: 0 }}>Sign in</button></p>
  </AuthShell>;
}
