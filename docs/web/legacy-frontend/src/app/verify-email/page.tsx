"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";
import { SiteNav } from "../../components/SiteNav";
import { AegisLogo } from "@aegis/shared-ui";

export default function VerifyEmailPage() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("Click verify to confirm your email address.");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setToken(new URLSearchParams(window.location.search).get("token") || ""); }, []);

  async function verify() {
    setBusy(true);
    try {
      await api("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) });
      setStatus("Email verified. Redirecting to sign in...");
      window.setTimeout(() => { window.location.href = "/login"; }, 700);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--aegis-background)]"><SiteNav />
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-5">
        <div className="surface max-w-md rounded-2xl p-8 text-center">
          <AegisLogo src="/aegis-logo.png" size={58} /><h1 className="mt-5 text-3xl font-semibold">Verify your email</h1>
          <p className="mt-4 text-[var(--aegis-text-muted)]">Confirm your email address to activate your account.</p>
          <p className="mt-6 text-sm text-blue-100" role="status">{status}</p>
          <button
            disabled={busy || !token}
            onClick={verify}
            className="mt-7 w-full rounded-lg bg-[var(--aegis-orange)] px-4 py-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            aria-busy={busy}
          >
            {busy ? "Verifying..." : "Verify email"}
          </button>
          <Link href="/login" className="mt-5 block text-sm text-[var(--aegis-text-muted)] hover:text-white">Back to sign in</Link>
        </div>
      </div>
    </main>
  );
}
