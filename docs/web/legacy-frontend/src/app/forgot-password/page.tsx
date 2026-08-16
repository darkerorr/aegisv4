"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { LoaderCircle, ShieldCheck, ArrowLeft } from "lucide-react";
import { AegisLogo } from "@aegis/shared-ui";
import { SiteNav } from "../../components/SiteNav";
import { api, formatApiError } from "../../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
      setSent(true);
    } catch (err) { setError(formatApiError(err)); }
    finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-[var(--aegis-background)]">
      <SiteNav />
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-5 py-12">
        <div className="surface w-full max-w-md rounded-3xl p-7 sm:p-8">
          <AegisLogo src="/aegis-logo.png" size={58} />
          <div className="mt-5 flex items-center gap-2 text-xs uppercase tracking-[.2em] text-[var(--aegis-orange)]"><ShieldCheck size={14} /> Reset password</div>
          <h1 className="mt-3 text-3xl font-semibold">Forgot password</h1>
          {sent ? (
            <div>
              <p className="mt-4 text-sm text-[var(--aegis-text-muted)]">If an account with that email exists, a reset link has been sent. Check your email.</p>
              <Link href="/login" className="mt-6 inline-flex items-center gap-1 text-sm text-[var(--aegis-blue-light)]"><ArrowLeft size={14} /> Back to login</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6">
              <label className="block text-sm text-slate-300">Email
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="control mt-2 w-full rounded-xl px-3 py-3 text-white" placeholder="you@example.com" />
              </label>
              {error && <div className="mt-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}
              <button disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--aegis-blue)] px-4 py-3 font-semibold text-white disabled:opacity-50">
                {busy && <LoaderCircle size={17} className="animate-spin" />}Send reset link
              </button>
              <Link href="/login" className="mt-4 flex items-center justify-center gap-1 text-sm text-[var(--aegis-text-muted)] hover:text-white"><ArrowLeft size={14} /> Back to login</Link>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
