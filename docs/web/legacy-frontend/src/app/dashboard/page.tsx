"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, MessageSquare, PlugZap, Download, Activity, Lightbulb } from "lucide-react";
import { api } from "../../lib/api";
import { Protected } from "../../components/Protected";

type User = { id: string; email: string; displayName?: string | null; emailVerified: boolean };
type Conversation = { id: string; title: string; updatedAt: string; model: string };
type ProviderInfo = { id: string; name: string; kind: string; active: boolean };

export default function DashboardPage() {
  return <Protected><DashboardContent /></Protected>;
}

function DashboardContent() {
  const [user, setUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    async function loadDashboard() {
      const [userResult, conversationResult, providerResult] = await Promise.allSettled([
        api<{ user: User }>("/auth/me", { signal: controller.signal }),
        api<{ conversations: Conversation[] }>("/conversations", { signal: controller.signal }),
        api<{ providers: ProviderInfo[] }>("/providers", { signal: controller.signal }),
      ]);
      if (controller.signal.aborted) return;
      if (userResult.status === "fulfilled") setUser(userResult.value.user);
      else setError("Could not load user");
      if (conversationResult.status === "fulfilled") setConversations(conversationResult.value.conversations);
      if (providerResult.status === "fulfilled") setProviders(providerResult.value.providers);
      setLoading(false);
    }
    void loadDashboard();
    return () => controller.abort();
  }, []);

  if (loading) return <div className="grid min-h-[50vh] place-items-center text-sm text-[var(--aegis-text-muted)]"><Activity className="animate-pulse" size={24} /></div>;

  return (
    <div className="mx-auto max-w-6xl">
      {error && <p className="mb-6 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[.24em] text-[var(--aegis-orange)]/70">Workspace</p>
        <h1 className="mt-2 text-4xl font-semibold">Welcome back{user?.displayName ? `, ${user.displayName}` : ""}.</h1>
        <p className="mt-3 text-[var(--aegis-text-muted)]">{user?.email} • {user?.emailVerified ? "Verified" : "Email not verified"}</p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="surface rounded-xl p-4"><p className="text-xs uppercase tracking-wider text-[var(--aegis-text-muted)]">Conversations</p><p className="mt-1 text-2xl font-semibold">{conversations.length}</p></div>
        <div className="surface rounded-xl p-4"><p className="text-xs uppercase tracking-wider text-[var(--aegis-text-muted)]">Providers</p><p className="mt-1 text-2xl font-semibold">{providers.filter((p) => p.active).length}/{providers.length}</p></div>
        <div className="surface rounded-xl p-4"><p className="text-xs uppercase tracking-wider text-[var(--aegis-text-muted)]">Desktop</p><p className="mt-1 text-sm text-[var(--aegis-text-muted)]">Build not available yet</p></div>
        <div className="surface rounded-xl p-4"><p className="text-xs uppercase tracking-wider text-[var(--aegis-text-muted)]">CLI</p><p className="mt-1 text-sm text-[var(--aegis-text-muted)]">Run `aegis` in any terminal</p></div>
      </div>

      {/* Quick actions */}
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <Quick href="/chat" icon={<MessageSquare size={20} />} title="New chat" text="Start a conversation with a configured provider." />
        <Quick href="/providers" icon={<PlugZap size={20} />} title="Connect provider" text="Configure NVIDIA NIM, OpenRouter, Ollama or custom API." />
        <Quick href="/download" icon={<Download size={20} />} title="Get the CLI" text="Use Aegis from any project directory." />
      </div>

      {/* Recent conversations */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent conversations</h2>
          <Link className="text-sm text-[var(--aegis-blue-light)] hover:text-white" href="/chat">Open chat <ArrowUpRight size={14} className="inline" /></Link>
        </div>
        {conversations.length === 0 ? (
          <div className="surface flex flex-col items-center rounded-xl p-10 text-center text-sm text-[var(--aegis-text-muted)]">
            <Lightbulb size={32} className="mb-3 text-[var(--aegis-orange)]" />
            <p>No conversations yet.</p>
            <Link href="/chat" className="mt-3 text-[var(--aegis-blue-light)] hover:text-white">Start your first chat</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => (
              <Link key={conv.id} href={`/chat?conversation=${conv.id}`} className="surface flex items-center justify-between rounded-xl p-4 transition hover:border-[var(--aegis-blue)]/40">
                <div className="flex items-center gap-3">
                  <MessageSquare size={16} className="text-[var(--aegis-text-muted)]" />
                  <span className="text-sm">{conv.title}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-[var(--aegis-text-muted)]">
                  <span>{conv.model}</span>
                  <span>{new Date(conv.updatedAt).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Providers summary */}
      <section className="mt-8">
        <h2 className="mb-4 text-xl font-semibold">Configured providers</h2>
        {providers.length === 0 ? (
          <div className="surface rounded-xl p-6 text-sm text-[var(--aegis-text-muted)]">
            No providers configured. <Link href="/providers" className="text-[var(--aegis-blue-light)]">Add one now.</Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {providers.map((p) => (
              <div key={p.id} className="surface flex items-center justify-between rounded-xl p-4">
                <div><p className="font-medium text-sm">{p.name}</p><p className="text-xs text-[var(--aegis-text-muted)]">{p.kind}</p></div>
                <span className={`h-2 w-2 rounded-full ${p.active ? "bg-[var(--aegis-success)]" : "bg-[var(--aegis-offline)]"}`} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Quick({ href, icon, title, text }: { href: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <Link href={href} className="group surface rounded-xl p-5 transition hover:-translate-y-1 hover:border-[var(--aegis-blue)]/40">
      <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-[var(--aegis-blue)]/10 text-[var(--aegis-blue-light)]">{icon}</div>
      <div className="flex items-center justify-between font-semibold">{title}<ArrowUpRight size={16} className="opacity-0 transition group-hover:opacity-100" /></div>
      <p className="mt-2 text-sm leading-6 text-[var(--aegis-text-muted)]">{text}</p>
    </Link>
  );
}
