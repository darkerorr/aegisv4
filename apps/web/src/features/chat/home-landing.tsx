"use client";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Cpu,
  FolderKanban,
  Gauge,
  Github,
  Globe2,
  Layers3,
  Mail,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  LibraryBig,
  Cloud,
  Laptop,
  SquarePen,
  Network,
  HardDrive,
  CalendarDays,
  Search,
} from "lucide-react";
import type { Model } from "@aegis/types";
import { AegisLogo } from "@/components/brand/aegis-logo";
import { api } from "@/lib/api/client";
import { conversationsApi } from "@/lib/api/conversations";
import { queryKeys } from "@/lib/query/keys";

type Props = {
  model: Model | null;
  modelHydrationStatus: string;
  onPick: (value: string) => void;
};

const suggestions: Array<[string, string, LucideIcon]> = [
  ["Plan a project", "Create a structured plan with milestones, deliverables and risks.", Layers3],
  ["Continue working", "Summarize the current state of my work and suggest next steps.", Sparkles],
  ["Debug this code", "Help me debug the error in this code and explain the fix.", WandSparkles],
  ["Research the web", "Search the web for the latest developments in this area.", Globe2],
  ["Understand my inbox", "Summarize the important threads in my Gmail inbox.", Mail],
  ["Inspect a repository", "Show me the structure and recent activity of my GitHub repos.", Github],
];

function formatTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`;
  return String(value);
}

export function HomeLanding({ model, modelHydrationStatus, onPick }: Props) {
  const router = useRouter();
  const recentChats = useQuery({ queryKey: queryKeys.conversations, queryFn: () => conversationsApi.list(), staleTime: 30_000 });
  const recentProjects = useQuery({ queryKey: ["projects"], queryFn: () => api.listProjects(), staleTime: 30_000 });
  const providers = useQuery({ queryKey: queryKeys.providers, queryFn: () => api.listProviders(), staleTime: 30_000 });
  const webSearch = useQuery({ queryKey: ["web-search-status"], queryFn: () => api.getWebSearchStatus(), staleTime: 60_000, retry: 0 });
  const github = useQuery({ queryKey: ["github-status"], queryFn: () => api.getGitHubStatus(), staleTime: 60_000, retry: 0 });
  const google = useQuery({ queryKey: queryKeys.integrations, queryFn: () => api.getGoogleIntegration(), staleTime: 60_000, retry: 0 });

  const chats = recentChats.data?.conversations.slice(0, 4) ?? [];
  const projects = recentProjects.data?.projects.slice(0, 3) ?? [];
  const connected = providers.data?.providers.filter((p) => p.active && (p.secretConfigured || ["ollama", "lmstudio"].includes(p.kind))).length ?? 0;
  const modelCount = providers.data?.providers.reduce((acc, p) => acc + (p.modelsCount ?? 0), 0) ?? 0;
  const webReady = !webSearch.isError && Boolean(webSearch.data?.available || webSearch.data?.configured);
  const ghReady = github.data?.status === "connected";
  const googleReady = google.data?.integration?.status === "connected";

  const accounts: Array<{ icon: LucideIcon; label: string; detail: string; on: boolean }> = [
    { icon: Globe2, label: "Web search", detail: webSearch.isLoading ? "Checking…" : webReady ? "Available" : "Not configured", on: webReady },
    { icon: Github, label: "GitHub", detail: github.isLoading ? "Checking…" : ghReady ? (github.data?.account?.login ?? "Connected") : "Not connected", on: ghReady },
    { icon: Mail, label: "Gmail", detail: google.isLoading ? "Checking…" : googleReady ? "Connected" : "Not connected", on: googleReady },
    { icon: HardDrive, label: "Drive", detail: google.isLoading ? "Checking…" : googleReady ? "Connected" : "Not connected", on: googleReady },
    { icon: CalendarDays, label: "Calendar", detail: google.isLoading ? "Checking…" : googleReady ? "Connected" : "Not connected", on: googleReady },
  ];

  const stats: Array<[LucideIcon, string, string]> = [
    [Cpu, String(providers.data?.providers.length ?? 0), "providers"],
    [Gauge, String(connected), "active"],
    [Sparkles, modelCount ? `${modelCount}+` : "—", "models"],
    [ShieldCheck, "100%", "local-first"],
  ];

  const quick: Array<{ label: string; hint: string; icon: LucideIcon; href: string; accent: string }> = [
    { label: "New chat", hint: "Start a fresh conversation", icon: SquarePen, href: "/chat", accent: "cyan" },
    { label: "Models library", hint: "Browse every intelligence", icon: Cpu, href: "/workspace/models", accent: "violet" },
    { label: "Providers", hint: "Connect and manage providers", icon: Network, href: "/providers", accent: "blue" },
    { label: "Web search", hint: "Current public information", icon: Globe2, href: "/search?scope=web", accent: "ember" },
    { label: "GitHub", hint: "Repositories and issues", icon: Github, href: "/github", accent: "ghost" },
    { label: "Gmail", hint: "Read and search email", icon: Mail, href: "/gmail", accent: "ghost" },
    { label: "Drive", hint: "Files and documents", icon: HardDrive, href: "/drive", accent: "ghost" },
    { label: "Calendar", hint: "Schedule and events", icon: CalendarDays, href: "/calendar", accent: "ghost" },
  ];

  return (
    <div className="v3-home">
      <div className="v3-home__core">
        <motion.div className="v3-home__logo" initial={{ scale: 0.82, opacity: 0, rotate: -6 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 170, damping: 16 }}>
          <span className="v3-home__logo-halo" />
          <span className="v3-home__logo-ring" />
          <span className="v3-home__logo-ring v3-home__logo-ring--second" />
          <AegisLogo size={50} />
        </motion.div>

        <span className="v3-kicker">Aegis · Premium AI workspace</span>
        <motion.h1 className="v3-home__title" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06, duration: 0.5, ease: "easeOut" }}>
          Every intelligence.<br /><span className="v3-home__title-accent">One private workspace.</span>
        </motion.h1>
        <motion.p className="v3-home__subtitle" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.5, ease: "easeOut" }}>
          Choose a model, connect your tools, and let Aegis keep provider boundaries, context and execution visible while you work.
        </motion.p>

        {model && (
          <motion.div className="v3-home__model-pill" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.4 }}>
            <span className={`v3-badge ${model.local ? "v3-badge--local" : "v3-badge--cloud"}`}>{model.local ? <Laptop size={10} /> : <Cloud size={10} />}{model.local ? "LOCAL" : "CLOUD"}</span>
            <b>{model.name}</b>
            <small>{model.providerName}</small>
            {model.contextLength ? <em>{formatTokens(model.contextLength)} ctx</em> : null}
          </motion.div>
        )}
        {!model && (
          <motion.div className="v3-home__model-pill" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.4 }}>
            <span className="v3-badge"><Cloud size={10} /></span>
            <b>{modelHydrationStatus === "loading" ? "Loading models…" : "No model selected — pick one to begin"}</b>
          </motion.div>
        )}

        <div className="v3-home__stats">
          {stats.map(([Icon, value, label], i) => (
            <motion.div className="v3-home__stat" key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 + i * 0.05, duration: 0.4 }}>
              <Icon size={13} /><b>{value}</b><span>{label}</span>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="v3-home__actions">
        {suggestions.map(([label, prompt, Icon], i) => (
          <motion.button type="button" className="v3-home__prompt" key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05, duration: 0.35 }} onClick={() => onPick(prompt)}>
            <Icon size={16} /><span><strong>{label}</strong><small>{prompt}</small></span>
          </motion.button>
        ))}
      </div>

      <div className="v3-home__quick">
        {quick.map(({ label, hint, icon: Icon, href, accent }, i) => (
          <motion.a
            key={href}
            href={href}
            className="v3-home__quick-tile"
            data-accent={accent}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.46 + i * 0.035, duration: 0.35 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="v3-home__quick-icon"><Icon size={17} /></span>
            <span className="v3-home__quick-text"><strong>{label}</strong><small>{hint}</small></span>
            <Search size={13} className="v3-home__quick-arrow" />
          </motion.a>
        ))}
      </div>

      <div className="v3-home__signals">
        {([["Provider explicit", "Every model runs on the provider you choose."], ["Context controlled", "Attachments and tools stay visible while you work."], ["Tool aware", "Web, GitHub, Gmail and Drive are first-class tools."]] as const).map(([title, copy]) => (
          <span key={title}><LibraryBig size={13} /><b>{title}</b><small>{copy}</small></span>
        ))}
      </div>

      <div className="v3-home__panels">
        {chats.length > 0 && (
          <motion.section className="v3-home__panel" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42, duration: 0.4 }}>
            <header><MessageSquareText size={13} />Recent conversations</header>
            <div className="v3-home__list">
              {chats.map((chat) => (
                <button key={chat.id} type="button" className="v3-home__list-item" onClick={() => router.push(`/chat/${chat.id}`)}>
                  <span><MessageSquareText size={13} /></span>
                  <div><b>{chat.title}</b><small>{chat.model} · {new Date(chat.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small></div>
                </button>
              ))}
            </div>
          </motion.section>
        )}
        {projects.length > 0 && (
          <motion.section className="v3-home__panel" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.46, duration: 0.4 }}>
            <header><FolderKanban size={13} />Recent projects</header>
            <div className="v3-home__list">
              {projects.map((project) => (
                <button key={project.id} type="button" className="v3-home__list-item" onClick={() => router.push(`/projects/${project.id}`)}>
                  <span><FolderKanban size={13} /></span>
                  <div><b>{project.name}</b><small>{project.conversationCount ?? 0} conversations</small></div>
                </button>
              ))}
            </div>
          </motion.section>
        )}
        {providers.data && providers.data.providers.length > 0 && (
          <motion.section className="v3-home__panel" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.4 }}>
            <header><Cloud size={13} />Connected providers</header>
            <div className="v3-home__list">
              {providers.data.providers.filter((p) => p.active).slice(0, 5).map((provider) => (
                <div key={provider.id} className="v3-home__provider-item">
                  <span className="v3-home__dot" data-on={provider.secretConfigured || ["ollama", "lmstudio"].includes(provider.kind)} />
                  <div style={{ minWidth: 0 }}><b>{provider.name}</b><small>{provider.modelsCount ?? 0} models</small></div>
                </div>
              ))}
            </div>
          </motion.section>
        )}
        <motion.section className="v3-home__panel" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.54, duration: 0.4 }}>
          <header><Globe2 size={13} />Connected accounts</header>
          <div className="v3-home__list">
            {accounts.map((account) => (
              <div key={account.label} className="v3-home__provider-item">
                <span className="v3-home__dot" data-on={account.on} />
                <div style={{ minWidth: 0 }}><b>{account.label}</b><small>{account.detail}</small></div>
              </div>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
