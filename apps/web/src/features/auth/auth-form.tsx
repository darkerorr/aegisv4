"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Github, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import { authApi } from "@/lib/api/auth";
import { normalizeError } from "@/lib/api/errors";
import { loginSchema, registerSchema } from "@/lib/validation/auth";
import { ProviderIcon } from "@/components/brand/provider-icon";
import { useAuth } from "./use-auth";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const auth = useAuth();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const result = (mode === "login" ? loginSchema : registerSchema).safeParse(data);
    if (!result.success) { setError(result.error.issues[0]?.message || "Check the form."); return; }
    setLoading(true);
    try {
      const response = mode === "login" ? await authApi.login({ email: String(data.email), password: String(data.password) }) : await authApi.register({ email: String(data.email), password: String(data.password), displayName: String(data.displayName) });
      auth.authenticate(response.user);
      router.push("/chat");
      router.refresh();
    } catch (cause) { setError(normalizeError(cause).message); } finally { setLoading(false); }
  }
  async function google() {
    setLoading(true);
    setError("");
    try { const result = await authApi.google(); location.href = result.authorizationUrl; } catch (cause) { setError(normalizeError(cause).message); setLoading(false); }
  }
  return <div className="auth-card-2026">
    <span className="eyebrow"><ShieldCheck size={14} /> {mode === "login" ? "Welcome back" : "Create protected workspace"}</span>
    <h1>{mode === "login" ? "Sign in to Aegis." : "Build your Aegis workspace."}</h1>
    <p className="auth-intro">{mode === "login" ? "Resume your conversations, providers and connected tools." : "Start with one premium workspace for local models, cloud providers and connected work."}</p>
    <div className="oauth-row">
      <button className="google-button focus-ring" onClick={google} disabled={loading}><ProviderIcon provider="google" size={18} variant="color" />Google</button>
      <button className="google-button focus-ring" disabled><Github size={18} />GitHub</button>
    </div>
    <div className="auth-separator"><span>or continue with email</span></div>
    <form onSubmit={submit} noValidate>
      {mode === "register" && <label>Full name<input className="field" name="displayName" autoComplete="name" required /></label>}
      <label>Email address<span className="input-shell"><Mail size={16} /><input className="field" name="email" type="email" autoComplete="email" required /></span></label>
      <label>Password<span className="password-field input-shell"><input className="field" name="password" type={show ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} required /><button type="button" onClick={() => setShow((value) => !value)} aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
      {mode === "register" && <label>Confirm password<input className="field" name="confirmPassword" type="password" autoComplete="new-password" required /></label>}
      {mode === "login" && <Link className="forgot-link" href="/forgot-password">Forgot password?</Link>}
      {error && <div role="alert" className="form-error">{error}</div>}
      <button className="button button-primary w-full" disabled={loading}>{loading ? <LoaderCircle className="spin" size={17} /> : <>{mode === "login" ? "Enter workspace" : "Create account"}<ArrowRight size={17} /></>}</button>
    </form>
    <p className="auth-switch">{mode === "login" ? "New to Aegis?" : "Already have an account?"} <Link href={mode === "login" ? "/register" : "/login"}>{mode === "login" ? "Create an account" : "Sign in"}</Link></p>
  </div>;
}
