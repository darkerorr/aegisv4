"use client";

import { useEffect } from "react";
import { AegisLoader } from "@aegis/shared-ui";
import { api } from "../../lib/api";

export default function LogoutPage() {
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    async function logout() {
      try { await api("/auth/logout", { method: "POST", signal: controller.signal }); }
      finally { if (active) window.location.replace("/"); }
    }
    void logout();
    return () => { active = false; controller.abort(); };
  }, []);
  return <main className="grid min-h-screen place-items-center bg-[var(--aegis-background)]"><div className="text-center"><AegisLoader state="connecting" /><p className="mt-4 text-sm text-[var(--aegis-text-muted)]">Signing you out...</p></div></main>;
}
