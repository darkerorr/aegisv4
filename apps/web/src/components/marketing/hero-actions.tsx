"use client";

import Link from "next/link";
import { ArrowRight, Github, MessageSquareText, RefreshCw } from "lucide-react";
import { useAuth } from "@/features/auth/use-auth";

export function HeroActions() {
  const auth = useAuth();

  if (auth.status === "loading") {
    return <div className="hero-actions hero-actions-loading" aria-label="Checking your session"><span /><span /></div>;
  }

  if (auth.status === "error") {
    return <div className="hero-actions">
      <button className="button button-secondary" type="button" onClick={() => void auth.refresh()}><RefreshCw size={17} aria-hidden="true" /> Check session</button>
      <Link href="/docs" className="button button-secondary">Explore Aegis <ArrowRight size={17} aria-hidden="true" /></Link>
    </div>;
  }

  if (auth.status === "authenticated") {
    return <div className="hero-actions">
      <Link href="/chat" className="button button-primary">Open your workspace <ArrowRight size={17} aria-hidden="true" /></Link>
      <Link href="/chat" className="button button-secondary"><MessageSquareText size={17} aria-hidden="true" /> New conversation</Link>
    </div>;
  }

  return <div className="hero-actions">
    <Link href="/register" className="button button-primary">Start free <ArrowRight size={17} aria-hidden="true" /></Link>
    <a href="https://github.com/darkerorr/aegisv4" target="_blank" rel="noreferrer" className="button button-secondary"><Github size={17} aria-hidden="true" /> View on GitHub</a>
  </div>;
}