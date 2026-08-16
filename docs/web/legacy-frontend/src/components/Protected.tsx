"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AegisLoader } from "@aegis/shared-ui";
import { checkApiHealth, formatApiError, restoreSession } from "../lib/api";
import { AppShell } from "./AppShell";

type User = { id: string; email: string; displayName?: string | null; emailVerified: boolean };

export function Protected({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function checkSession() {
      setLoading(true); setError("");
      try {
        await checkApiHealth(controller.signal);
        const result = await restoreSession(controller.signal);
        if (controller.signal.aborted) return;
        if (result.authenticated) setUser(result.user as User);
        else router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      } catch (err) {
        if (!controller.signal.aborted) setError(formatApiError(err));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void checkSession();
    return () => controller.abort();
  }, [pathname, retryKey, router]);

  if (loading) {
    return (
      <main className="grid-bg grid min-h-screen place-items-center">
        <div className="text-center">
          <AegisLoader state="connecting" />
          <p className="mt-4 text-sm text-[var(--aegis-text-muted)]">Loading workspace...</p>
        </div>
      </main>
    );
  }

  if (error) return <main className="grid-bg grid min-h-screen place-items-center px-5"><div className="surface max-w-md rounded-2xl p-8 text-center"><h1 className="text-2xl font-semibold">Aegis API is unavailable</h1><p className="mt-4 whitespace-pre-line text-sm leading-6 text-[var(--aegis-text-muted)]">{error}</p><button onClick={() => setRetryKey((value) => value + 1)} className="mt-6 rounded-xl bg-[var(--aegis-blue)] px-5 py-3 font-semibold text-white">Retry connection</button><a href="/docs#troubleshooting" className="mt-4 block text-sm text-[var(--aegis-blue-light)]">Open diagnostics</a></div></main>;

  return user ? <AppShell email={user.email} displayName={user.displayName}>{children}</AppShell> : null;
}
