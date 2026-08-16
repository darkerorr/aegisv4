"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, MessageSquare, Cpu, PlugZap, Download, Settings, LogOut, Menu, X,
  FolderKanban, UserCircle, ShieldCheck, Link2, Mail, HardDrive, Search,
} from "lucide-react";
import { AegisLogo } from "@aegis/shared-ui";
import { api } from "../lib/api";

const links = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/search", label: "Search", icon: Search },
  { href: "/models", label: "Models", icon: Cpu },
  { href: "/providers", label: "Providers", icon: PlugZap },
  { href: "/connections", label: "Connections", icon: Link2 },
  { href: "/gmail", label: "Gmail", icon: Mail },
  { href: "/drive", label: "Drive", icon: HardDrive },
] as const;

const bottomLinks = [
  { href: "/download", label: "Downloads", icon: Download },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/account", label: "Account", icon: UserCircle },
  { href: "/security", label: "Security", icon: ShieldCheck },
] as const;

export function AppShell({ children, email, displayName }: { children: React.ReactNode; email?: string; displayName?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => { if (mobileOpen) document.body.style.overflow = "hidden"; else document.body.style.overflow = ""; return () => { document.body.style.overflow = ""; }; }, [mobileOpen]);

  async function logout() {
    try { await api("/auth/logout", { method: "POST" }); } finally { router.replace("/"); router.refresh(); }
  }

  function isActive(href: string) {
    if (href === "/chat") return pathname.startsWith("/chat");
    return pathname === href || pathname.startsWith(href + "/");
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href="/chat" className="flex items-center gap-2 font-semibold" aria-label="Aegis workspace">
        <AegisLogo src="/aegis-logo.png" size={30} />
        <span className="text-lg">Aegis</span>
      </Link>
      <nav className="mt-8 flex-1 space-y-1" role="navigation" aria-label="Workspace navigation">
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${isActive(href) ? "bg-[var(--aegis-blue)]/10 text-[var(--aegis-blue-light)]" : "text-[var(--aegis-text-muted)] hover:bg-white/5 hover:text-white"}`}
            aria-current={isActive(href) ? "page" : undefined}>
            <Icon size={17} />{label}
          </Link>
        ))}
      </nav>
      <div className="space-y-1 border-t border-white/10 pt-4">
        {bottomLinks.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${isActive(href) ? "bg-[var(--aegis-blue)]/10 text-[var(--aegis-blue-light)]" : "text-[var(--aegis-text-muted)] hover:bg-white/5 hover:text-white"}`}
            aria-current={isActive(href) ? "page" : undefined}>
            <Icon size={17} />{label}
          </Link>
        ))}
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[var(--aegis-text-muted)] hover:bg-white/5 hover:text-white" aria-label="Sign out">
          <LogOut size={17} />Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--aegis-background)] text-slate-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-white/10 bg-[#0b1220]/80 p-5 backdrop-blur-xl lg:flex lg:flex-col">
        {sidebar}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-white/10 bg-[#0b1220] p-5 transition-transform lg:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <button onClick={() => setMobileOpen(false)} className="absolute right-4 top-4 text-[var(--aegis-text-muted)] hover:text-white" aria-label="Close menu"><X size={20} /></button>
        {sidebar}
      </aside>

      {/* Main content */}
      <div className="min-h-screen lg:pl-60">
        <header className="flex items-center justify-between border-b border-white/10 bg-[#05070d]/80 px-4 py-3 backdrop-blur-xl lg:px-8">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden" aria-label="Open menu"><Menu size={20} /></button>
          <Link href="/chat" className="flex items-center gap-2 font-semibold lg:hidden"><AegisLogo src="/aegis-logo.png" size={24} />Aegis</Link>
          <span className="hidden text-sm text-[var(--aegis-text-muted)] sm:block">{displayName || email || "Workspace"}</span>
          <div className="ml-auto flex items-center gap-2 text-xs text-[var(--aegis-blue-light)]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--aegis-success)]" />
            Connected
          </div>
        </header>
        <div className="p-5 lg:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
