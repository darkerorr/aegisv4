import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Check, Eye, EyeOff, KeyRound } from "lucide-react";
import { useSidebar } from "../contexts/SidebarContext";
import { api } from "../api/client";

export function ResetPasswordPage() {
  const { navigate } = useSidebar();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strong = password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (!strong) { setError("Use at least 8 characters, one uppercase letter and one number."); return; }
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <motion.div
        className="auth-page"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 40 }}
      >
        <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(54,213,138,.13)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: "var(--aegis-success)", boxShadow: "0 0 30px rgba(54,213,138,.16)" }}>
            <Check size={26} />
          </div>
          <h1 style={{ fontSize: 24, margin: 0 }}>Password updated</h1>
          <p style={{ color: "var(--aegis-text-muted)", marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
            Your password has been reset. Sign in with your new password.
          </p>
          <button className="aegis-btn aegis-btn-primary aegis-btn-lg" onClick={() => navigate("Login")} style={{ marginTop: 24, width: "100%" }}>
            Back to sign in
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="auth-page"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 40 }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--aegis-text-muted)", fontSize: 12 }}>
          <KeyRound size={15} color="var(--aegis-blue-light)" /> Account recovery
        </div>
        <h1 style={{ fontSize: 32, margin: "16px 0 0" }}>Set a new password</h1>
        <p style={{ color: "var(--aegis-text-muted)", marginTop: 8, fontSize: 15 }}>
          Enter the reset token from your email and choose a new password.
        </p>

        {error && (
          <div role="alert" style={{ marginTop: 20, padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(239,83,80,.3)", background: "rgba(239,83,80,.08)", color: "var(--aegis-error)", fontSize: 13 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="aegis-field">
            <label style={{ display: "block", fontSize: 13, color: "var(--aegis-text-muted)", marginBottom: 6 }}>Reset token</label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste the token from your email"
              required
              className="aegis-input"
              style={{ width: "100%", padding: "12px 14px", border: "1px solid var(--aegis-border)", borderRadius: 10, background: "var(--aegis-surface)", color: "var(--aegis-text)", fontSize: 14, outline: "none" }}
            />
          </div>

          <div className="aegis-field">
            <label style={{ display: "block", fontSize: 13, color: "var(--aegis-text-muted)", marginBottom: 6 }}>New password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                className="aegis-input"
                style={{ width: "100%", padding: "12px 44px 12px 14px", border: "1px solid var(--aegis-border)", borderRadius: 10, background: "var(--aegis-surface)", color: "var(--aegis-text)", fontSize: 14, outline: "none" }}
              />
              <button type="button" aria-label="Toggle password visibility" onClick={() => setShowPassword(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", border: 0, background: "transparent", color: "var(--aegis-text-muted)" }}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <span style={{ display: "block", marginTop: 7, color: strong ? "var(--aegis-success)" : "var(--aegis-text-muted)", fontSize: 11 }}>
              {password ? (strong ? "Strong password" : "Use 8+ chars, uppercase and number") : "Use a strong password"}
            </span>
          </div>

          <div className="aegis-field">
            <label style={{ display: "block", fontSize: 13, color: "var(--aegis-text-muted)", marginBottom: 6 }}>Confirm new password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat your new password"
              required
              className="aegis-input"
              style={{ width: "100%", padding: "12px 14px", border: "1px solid var(--aegis-border)", borderRadius: 10, background: "var(--aegis-surface)", color: "var(--aegis-text)", fontSize: 14, outline: "none" }}
            />
          </div>

          <button type="submit" className="aegis-btn aegis-btn-primary aegis-btn-lg" disabled={loading} style={{ width: "100%", marginTop: 8, padding: "12px 20px" }}>
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: "center" }}>
          <button className="aegis-btn aegis-btn-ghost" onClick={() => navigate("Login")} style={{ color: "var(--aegis-blue-light)", fontSize: 13, border: "none" }}>
            Back to sign in
          </button>
        </div>
      </div>
    </motion.div>
  );
}