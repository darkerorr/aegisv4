"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, LoaderCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { AegisLogo } from "@aegis/shared-ui";
import { api, checkApiHealth, formatApiError, restoreSession } from "../lib/api";

type ServiceStatus = "checking" | "connected" | "unavailable";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [nextPath, setNextPath] = useState("/chat");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>("checking");

  useEffect(() => {
    const controller = new AbortController();
    const requested = new URLSearchParams(window.location.search).get("next");
    if (requested?.startsWith("/")) setNextPath(requested);

    async function initializeAuth() {
      try {
        await checkApiHealth(controller.signal);
        if (controller.signal.aborted) return;
        setServiceStatus("connected");
        const result = await restoreSession(controller.signal);
        if (!controller.signal.aborted && result.authenticated) router.replace("/chat");
      } catch {
        if (!controller.signal.aborted) setServiceStatus("unavailable");
      }
    }

    void initializeAuth();
    return () => controller.abort();
  }, [router]);

  const strongPassword = password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    if (mode === "register" && password !== confirmPassword) { setError("Passwords do not match."); setBusy(false); return; }
    if (mode === "register" && !strongPassword) { setError("Use at least 8 characters, one uppercase letter and one number."); setBusy(false); return; }
    try {
      const result = await api<{ message?: string; emailVerificationRequired?: boolean }>(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({ email, password, ...(mode === "register" ? { displayName: displayName || undefined } : {}) }),
      });
      if (mode === "login") {
        await api("/auth/me");
        router.replace(nextPath);
        return;
      }
      if (result.emailVerificationRequired) {
        router.replace(`/verify-email?email=${encodeURIComponent(email)}`);
      } else {
        await api("/auth/me");
        router.replace("/chat");
      }
    } catch (err) {
      setError(formatApiError(err));
    } finally { setBusy(false); }
  }

  async function googleSignIn() {
    setGoogleBusy(true);
    setError("");
    try {
      const result = await api<{ authorizationUrl: string }>("/auth/google/start", { method: "POST" });
      window.location.href = result.authorizationUrl;
    } catch (err) {
      setError(formatApiError(err));
      setGoogleBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <form onSubmit={submit} className="auth-card surface w-full max-w-md rounded-3xl p-7 sm:p-8" noValidate>
        <div className="mb-7">
          <AegisLogo src="/aegis-logo.png" size={58} />
          <div className="mt-5 flex items-center gap-2 text-xs uppercase tracking-[.2em] text-[var(--aegis-orange)]"><ShieldCheck size={14} /> Aegis account</div>
          <h1 className="mt-3 text-3xl font-semibold">{mode === "login" ? "Welcome back" : "Create your workspace"}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--aegis-text-muted)]">{mode === "login" ? "Sign in to continue to your synced AI workspace." : "One account for Aegis Web, App and CLI."}</p>
        </div>

        {/* Google Sign-In */}
        {mode === "login" && (
          <button type="button" onClick={googleSignIn} disabled={googleBusy}
            className="mb-5 flex w-full items-center justify-center gap-3 rounded-xl border border-white/20 bg-white/[.03] px-4 py-3 font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-50">
            {googleBusy ? <LoaderCircle size={18} className="animate-spin" /> : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {googleBusy ? "Connecting..." : `Continue with Google`}
          </button>
        )}

        {mode === "login" && <div className="mb-5 flex items-center gap-3"><hr className="flex-1 border-white/10" /><span className="text-xs text-[var(--aegis-text-muted)]">OR</span><hr className="flex-1 border-white/10" /></div>}

        {mode === "register" && <label className="mb-4 block text-sm text-slate-300">Display name <span className="text-[var(--aegis-text-muted)]">(optional)</span>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="control mt-2 w-full rounded-xl px-3 py-3 text-white" placeholder="Your name" autoComplete="name" />
        </label>}
        <label className="mb-4 block text-sm text-slate-300">Email
          <input required type="email" className="control mt-2 w-full rounded-xl px-3 py-3 text-white" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
        </label>
        <label className="mb-4 block text-sm text-slate-300">Password
          <div className="relative mt-2">
            <input required minLength={8} type={showPassword ? "text" : "password"} className="control w-full rounded-xl px-3 py-3 pr-11 text-white" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete={mode === "login" ? "current-password" : "new-password"} />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
          {mode === "register" && <span className={`mt-2 block text-xs ${strongPassword ? "text-[var(--aegis-success)]" : "text-[var(--aegis-text-muted)]"}`}>{strongPassword ? "Strong password" : "Use 8+ characters, one uppercase letter and one number."}</span>}
        </label>
        {mode === "register" && <label className="mb-5 block text-sm text-slate-300">Confirm password
          <input required minLength={8} type="password" className="control mt-2 w-full rounded-xl px-3 py-3 text-white" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat your password" autoComplete="new-password" />
        </label>}

        {error && <div role="alert" className="mb-4 whitespace-pre-line rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-100">{error}<button type="button" onClick={() => setError("")} className="ml-2 underline">Dismiss</button></div>}
        {message && <p role="status" className="mb-4 rounded-xl border border-blue-300/30 bg-blue-300/10 p-3 text-sm text-blue-100">{message}</p>}

        <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--aegis-blue)] px-4 py-3 font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:bg-[var(--aegis-blue-light)] hover:text-[#04101f] disabled:cursor-wait disabled:opacity-60" aria-busy={busy}>
          {busy && <LoaderCircle size={17} className="animate-spin" />}
          {busy ? (mode === "login" ? "Signing in..." : "Creating account...") : mode === "login" ? "Sign in" : "Create account"}
        </button>

        <div className="mt-5 flex flex-wrap justify-between gap-3 text-sm text-[var(--aegis-text-muted)]">
          {mode === "login" ? <><Link href="/register" className="hover:text-white">Create account</Link><Link href="/forgot-password" className="hover:text-white">Forgot password?</Link></> : <Link href="/login" className="hover:text-white">Already have an account?</Link>}
        </div>
        <div role="status" aria-live="polite" className="mt-6 flex items-center justify-center gap-2 text-xs text-[var(--aegis-text-muted)]">
          <span className={`h-2 w-2 rounded-full ${serviceStatus === "connected" ? "bg-emerald-400" : serviceStatus === "unavailable" ? "bg-red-400" : "animate-pulse bg-sky-300"}`} />
          {serviceStatus === "checking" ? "Checking Aegis services..." : serviceStatus === "connected" ? "Aegis services connected" : "Aegis services unavailable"}
        </div>
      </form>
    </div>
  );
}
