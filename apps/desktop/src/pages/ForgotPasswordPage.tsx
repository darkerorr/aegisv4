import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { useSidebar } from "../contexts/SidebarContext";
import { api } from "../api/client";

export function ForgotPasswordPage() {
  const { navigate } = useSidebar();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <motion.div
        className="auth-page"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: 40,
        }}
      >
        <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(67, 199, 255, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              fontSize: 24,
              color: "var(--aegis-blue-light)",
            }}
          >
            ✓
          </div>
          <h1 style={{ fontSize: 24, margin: 0 }}>Check your email</h1>
          <p style={{ color: "var(--aegis-text-muted)", marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
            If an account exists for <strong>{email}</strong>, we sent a reset link.
          </p>
          <button
            className="aegis-btn aegis-btn-primary aegis-btn-lg"
            onClick={() => navigate("Login")}
            style={{ marginTop: 24, width: "100%" }}
          >
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
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: 40,
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <h1 style={{ fontSize: 32, margin: 0 }}>Reset password</h1>
        <p style={{ color: "var(--aegis-text-muted)", marginTop: 8, fontSize: 15 }}>
          Enter your email and we'll send you a reset link.
        </p>

        {error && (
          <div
            className="aegis-alert aegis-alert-error"
            style={{
              marginTop: 20,
              padding: "12px 16px",
              borderRadius: 10,
              border: "1px solid rgba(239, 83, 80, 0.3)",
              background: "rgba(239, 83, 80, 0.08)",
              color: "var(--aegis-error)",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="aegis-field">
            <label style={{ display: "block", fontSize: 13, color: "var(--aegis-text-muted)", marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="aegis-input"
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid var(--aegis-border)",
                borderRadius: 10,
                background: "var(--aegis-surface)",
                color: "var(--aegis-text)",
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          <button
            type="submit"
            className="aegis-btn aegis-btn-primary aegis-btn-lg"
            disabled={loading}
            style={{ width: "100%", marginTop: 8, padding: "12px 20px" }}
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: "center" }}>
          <button
            className="aegis-btn aegis-btn-ghost"
            onClick={() => navigate("Login")}
            style={{ color: "var(--aegis-blue-light)", fontSize: 13, border: "none" }}
          >
            Back to sign in
          </button>
        </div>
      </div>
    </motion.div>
  );
}
