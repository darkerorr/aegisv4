"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Cable,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  CircleUserRound,
  Cpu,
  FolderKanban,
  Gauge,
  Github,
  Globe2,
  HardDrive,
  HelpCircle,
  Mail,
  MessageSquareText,
  Network,
  Search,
  Server,
  Settings,
  Sparkles,
  SquarePen,
  Wrench,
} from "lucide-react";
import { motion } from "framer-motion";
import { AegisLogo } from "@/components/brand/aegis-logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useModelSelection } from "@/features/chat/model-selection-store";
import { useAuth } from "@/features/auth/use-auth";
import { requestTour } from "@/features/onboarding/tour-steps";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";

type NavEntry = { href: string; icon: typeof MessageSquareText; label: string; badge?: string; statusKey?: "web" | "gh" | "google" };

const groups: { label: string; items: NavEntry[] }[] = [
  {
    label: "Workspace",
    items: [
      { href: "/chat", icon: MessageSquareText, label: "Chat" },
      { href: "/search", icon: Search, label: "Search" },
      { href: "/projects", icon: FolderKanban, label: "Projects" },
      { href: "/work", icon: Wrench, label: "Work Mode" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/workspace/models", icon: Cpu, label: "Models" },
      { href: "/providers", icon: Network, label: "Providers" },
    ],
  },
  {
    label: "Connected tools",
    items: [
      { href: "/github", icon: Github, label: "GitHub", statusKey: "gh" },
      { href: "/drive", icon: HardDrive, label: "Drive", statusKey: "google" },
      { href: "/gmail", icon: Mail, label: "Gmail", statusKey: "google" },
      { href: "/calendar", icon: CalendarDays, label: "Calendar", statusKey: "google" },
      { href: "/search?scope=web", icon: Globe2, label: "Web Search", statusKey: "web" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/settings", icon: Settings, label: "Settings" },
      { href: "/account", icon: CircleUserRound, label: "Account" },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  const withoutQuery = href.split("?")[0];
  if (withoutQuery === "/chat") return pathname === "/chat" || pathname.startsWith("/chat/");
  if (withoutQuery === "/settings") return pathname === "/settings" || pathname.startsWith("/settings/");
  if (withoutQuery === "/account") return pathname === "/account" || pathname.startsWith("/account/");
  return pathname === withoutQuery || pathname.startsWith(withoutQuery + "/");
}

export function WorkspaceSidebar({ collapsed, onCollapse, onNew, navOpen, onCloseNav }: {
  collapsed: boolean;
  onCollapse: () => void;
  onNew: () => void;
  navOpen?: boolean;
  onCloseNav?: () => void;
}) {
  const pathname = usePathname();
  const { selectedModel, selectModel, models } = useModelSelection();
  const { user } = useAuth();
  const [latency, setLatency] = useState<number | null>(null);
  const health = useQuery({
    queryKey: ["api-health"],
    queryFn: async () => {
      const started = performance.now();
      const result = await api.health();
      setLatency(Math.round(performance.now() - started));
      return result;
    },
    refetchInterval: 30_000,
    retry: 0,
  });
  const providers = useQuery({ queryKey: queryKeys.providers, queryFn: () => api.listProviders(), staleTime: 30_000 });
  const webSearch = useQuery({ queryKey: ["web-search-status"], queryFn: () => api.getWebSearchStatus(), staleTime: 60_000, retry: 0 });
  const github = useQuery({ queryKey: ["github-status"], queryFn: () => api.getGitHubStatus(), staleTime: 60_000, retry: 0 });
  const google = useQuery({ queryKey: queryKeys.integrations, queryFn: () => api.getGoogleIntegration(), staleTime: 60_000, retry: 0 });

  const activeCount = providers.data?.providers.filter((provider) => provider.active && (provider.secretConfigured || ["ollama", "lmstudio"].includes(provider.kind))).length ?? 0;
  const providerTotal = providers.data?.providers.length ?? 0;
  const apiState = health.isSuccess ? "ok" : health.isError ? "off" : "check";
  const mode = selectedModel?.local ? "LOCAL" : selectedModel ? "CLOUD" : "—";
  const webState = webSearch.isError ? "off" : webSearch.isLoading ? "check" : (webSearch.data?.available || webSearch.data?.configured) ? "ok" : "idle";
  const ghConnected = github.data?.status === "connected";
  const ghState = github.isError ? "off" : github.isLoading ? "check" : ghConnected ? "ok" : "idle";
  const googleConnected = google.data?.integration?.status === "connected";
  const googleState = google.isError ? "off" : google.isLoading ? "check" : googleConnected ? "ok" : "idle";

  const identity = (user?.displayName || user?.email || "").trim();
  const statusFor = (key?: "web" | "gh" | "google") => (key === "web" ? webState : key === "gh" ? ghState : key === "google" ? googleState : undefined);

  const connections: Array<{ id: string; icon: typeof Server; label: string; state: "ok" | "off" | "check" | "idle" }> = [
    { id: "api", icon: Server, label: "Aegis API", state: apiState },
    { id: "web", icon: Globe2, label: "Web search", state: webState },
    { id: "gh", icon: Github, label: "GitHub", state: ghState },
    { id: "google", icon: Mail, label: "Google", state: googleState },
  ];

  const cycleMode = () => {
    if (!models.length) return;
    const others = models.filter((model) => selectedModel ? model.local !== selectedModel.local : true);
    const next = others.length ? others[0] : models[0];
    if (next) selectModel(next);
  };

  const renderNavItem = (item: NavEntry) => {
    const active = isActive(pathname, item.href);
    const status = statusFor(item.statusKey);
    const icon = (
      <motion.a
        key={item.href}
        href={item.href}
        className="v3-nav-item"
        data-active={active}
        aria-current={active ? "page" : undefined}
        whileHover={{ x: collapsed ? 0 : 2 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
      >
        <span className="v3-nav-item__icon"><item.icon size={17} strokeWidth={1.8} /></span>
        {!collapsed && <span>{item.label}</span>}
        {status && status !== "idle" && <i className={`v3-sidebar__dot is-${status}`} aria-hidden="true" style={{ width: 5, height: 5, marginLeft: "auto", borderRadius: 99, background: "var(--v3-success)" }} />}
        {!collapsed && item.badge && <em className="v3-nav-item__badge">{item.badge}</em>}
        {active && !collapsed && <span className="v3-nav-item__indicator" aria-hidden="true" />}
      </motion.a>
    );
    if (!collapsed) return icon;
    return (
      <Tooltip key={item.href}>
        <TooltipTrigger asChild>{icon}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <aside className="v3-sidebar" data-collapsed={collapsed} data-nav-open={Boolean(navOpen)} aria-label="Workspace navigation">
      <div className="v3-sidebar-backdrop" aria-hidden="true" onClick={onCloseNav} />
      <div className="v3-sidebar__head">
        <div className="v3-sidebar__brand">
          <Link href="/chat" className="v3-sidebar__brand-logo" aria-label="Aegis home">
            <AegisLogo size={30} priority />
          </Link>
          {!collapsed && (
            <motion.div className="v3-sidebar__brand-text" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, ease: "easeOut" }}>
              <strong>Aegis</strong>
              <small>Every intelligence · one workspace</small>
            </motion.div>
          )}
          {!collapsed && <span className="v3-sidebar__version">PREMIUM</span>}
        </div>
        <button type="button" className="v3-new-chat" onClick={onNew}>
          <SquarePen size={15} />
          <span>New chat</span>
          <kbd>⌘ N</kbd>
        </button>
      </div>

      {!collapsed && selectedModel && (
        <div className="v3-sidebar__model">
          <div className="v3-sidebar__model-top">
            <span><Sparkles size={11} />Current model</span>
            <button
              type="button"
              className={`v3-badge ${selectedModel.local ? "v3-badge--local" : "v3-badge--cloud"}`}
              style={{ cursor: "pointer" }}
              onClick={(event) => { event.preventDefault(); event.stopPropagation(); cycleMode(); }}
              title="Switch between local and cloud"
            >
              {mode}
            </button>
          </div>
          <strong className="v3-sidebar__model-name" title={selectedModel.name}>{selectedModel.name}</strong>
          <span className="v3-sidebar__model-provider">{selectedModel.providerName}</span>
        </div>
      )}

      <nav className="v3-sidebar__nav" aria-label="Sections">
        {groups.map((group) => (
          <div className="v3-sidebar__group" key={group.label}>
            {!collapsed && <h3 className="v3-sidebar__group-label">{group.label}</h3>}
            {group.items.map(renderNavItem)}
          </div>
        ))}
      </nav>

      <div className="v3-sidebar__bottom">
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="v3-sidebar__status-pill" data-state={apiState === "ok" ? "online" : apiState === "off" ? "offline" : "checking"}>
              <i />{apiState === "ok" ? `API online · ${latency ?? "—"}ms` : apiState === "off" ? "API offline" : "Checking API"}
            </span>
            <span className="v3-sidebar__providers"><Gauge size={11} /><b>{activeCount}</b><em>/{providerTotal}</em></span>
          </div>
        )}

        {!collapsed && (
          <div className="v3-conn">
            <span className="v3-conn__label"><Wrench size={9} />Connections</span>
            {connections.map((conn) => (
              <motion.div
                key={conn.id}
                className="v3-conn__row"
                data-state={conn.state}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <conn.icon size={13} />
                <span>{conn.label}</span>
                <i />
              </motion.div>
            ))}
          </div>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Link className="v3-sidebar__user" href="/account">
              <span className="v3-sidebar__avatar" aria-hidden="true">{identity ? identity.slice(0, 2).toUpperCase() : "A"}</span>
              {!collapsed && (
                <div className="v3-sidebar__user-meta">
                  <strong title={identity}>{identity || "Guest"}</strong>
                  <small>{selectedModel?.providerName || "No provider selected"}</small>
                </div>
              )}
            </Link>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">{identity || "Guest"}</TooltipContent>}
        </Tooltip>

        {!collapsed ? (
          <div className="v3-sidebar__foot">
            <span className="v3-conn__label" style={{ padding: 0 }}><Cable size={11} />Providers ready</span>
            <span className="v3-sidebar__foot-actions">
              <button type="button" className="v3-sidebar__help" aria-label="Take the guided tour" onClick={() => requestTour()}>
                <HelpCircle size={15} />
              </button>
              <button type="button" className="v3-sidebar__collapse" aria-label="Collapse sidebar" onClick={onCollapse}>
                <ChevronsLeft size={15} />
              </button>
            </span>
          </div>
        ) : (
          <button type="button" className="v3-sidebar__collapse-float" aria-label="Expand sidebar" onClick={onCollapse}>
            <ChevronsRight size={15} />
          </button>
        )}
      </div>
    </aside>
  );
}
