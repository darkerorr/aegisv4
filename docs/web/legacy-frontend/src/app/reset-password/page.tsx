"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api, formatApiError } from "../../lib/api";
import { SiteNav } from "../../components/SiteNav";
import { AegisLogo } from "@aegis/shared-ui";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setToken(new URLSearchParams(window.location.search).get("token") || ""); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const data = await api<{ message: string }>("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) });
      setMessage(data.message);
    } catch (err) {
      setMessage(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--aegis-background)]"><SiteNav />
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-5">
        <form onSubmit={submit} className="surface max-w-md rounded-2xl p-8">
          <AegisLogo src="/aegis-logo.png" size={58} /><h1 className="mt-5 text-3xl font-semibold">Choose a new password</h1>
          <p className="mt-3 text-sm text-[var(--aegis-text-muted)]">Must be at least 8 characters.</p>
          <input required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="control mt-6 w-full rounded-lg px-3 py-3" placeholder="New password" autoComplete="new-password" />
          <button disabled={busy} className="mt-4 w-full rounded-lg bg-[var(--aegis-orange)] px-4 py-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
            {busy ? "Resetting..." : "Reset password"}
          </button>
          {message && <p className="mt-4 text-sm text-blue-100" role="status">{message}</p>}
          <Link href="/login" className="mt-5 flex items-center gap-1 text-sm text-[var(--aegis-text-muted)] hover:text-white"><ArrowLeft size={14} /> Back to sign in</Link>
        </form>
      </div>
    </main>
  );
}
