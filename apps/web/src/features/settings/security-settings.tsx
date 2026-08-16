"use client";
import { useState } from "react";
import { KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api/client";
import { normalizeError } from "@/lib/api/errors";

export function SecuritySettings() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const data = new FormData(e.currentTarget);
    try {
      await api.changePassword({ currentPassword: String(data.get("current")), newPassword: String(data.get("password")), confirmPassword: String(data.get("confirm")) });
      setMessage("Password changed successfully.");
      e.currentTarget.reset();
    } catch (cause) {
      setMessage(normalizeError(cause).message);
    } finally {
      setLoading(false);
    }
  }

  return <section className="aegis-settings-panel">
    <header><ShieldCheck size={18} /><div><h2>Change password</h2><p>Use at least eight characters and keep provider keys separate.</p></div></header>
    <form className="aegis-form-grid" onSubmit={submit}>
      <label className="aegis-form-label">Current password<input className="aegis-field" name="current" type="password" required /></label>
      <label className="aegis-form-label">New password<input className="aegis-field" name="password" minLength={8} type="password" required /></label>
      <label className="aegis-form-label">Confirm password<input className="aegis-field" name="confirm" minLength={8} type="password" required /></label>
      {message && <p className="form-error">{message}</p>}
      <div className="aegis-form-actions" style={{ justifyContent: "flex-start" }}>
        <button className="aegis-btn aegis-btn--primary" disabled={loading}>{loading ? <LoaderCircle size={14} className="spin" /> : <KeyRound size={14} />}Update password</button>
      </div>
    </form>
  </section>;
}
