"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { AegisLogo } from "@aegis/shared-ui";
import { checkApiHealth, restoreSession } from "../lib/api";

const links = [
  { href: "/#features", label: "Product" },
  { href: "/#app", label: "App" },
  { href: "/download#cli", label: "CLI" },
  { href: "/#models", label: "Models" },
  { href: "/#privacy", label: "Privacy" },
  { href: "/docs", label: "Docs" },
  { href: "/download", label: "Download" },
];

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const controller = new AbortController();
    async function loadSession() {
      try {
        await checkApiHealth(controller.signal);
        const result = await restoreSession(controller.signal);
        if (!controller.signal.aborted) setSignedIn(result.authenticated);
      } catch {
        if (!controller.signal.aborted) setSignedIn(false);
      }
    }
    void loadSession();
    return () => controller.abort();
  }, [pathname]);
  useEffect(() => { if (open) document.body.style.overflow = "hidden"; else document.body.style.overflow = ""; return () => { document.body.style.overflow = ""; }; }, [open]);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    if (href.startsWith("/#")) return false;
    return pathname.startsWith(href.split("#")[0]);
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#05070d]/90 backdrop-blur-xl" role="navigation" aria-label="Main navigation">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-wide" aria-label="Aegis home">
          <AegisLogo src="/aegis-logo.png" size={32} />
          <span className="hidden sm:inline">Aegis</span>
        </Link>
        <div className="hidden items-center gap-1 text-sm text-slate-300 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 transition hover:bg-white/5 hover:text-white ${isActive(link.href) ? "bg-white/10 text-white" : ""}`}
              aria-current={isActive(link.href) ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="hidden items-center gap-2 text-sm md:flex">
          <Link href="/login" className="rounded-lg px-4 py-2 text-slate-300 transition hover:bg-white/5 hover:text-white" aria-label="Sign in to your account">Sign in</Link>
          <Link href={signedIn ? "/chat" : "/register"} className="rounded-lg bg-[var(--aegis-blue)] px-4 py-2 font-medium text-white transition hover:brightness-110" aria-label={signedIn ? "Open Aegis chat" : "Create a new account"}>{signedIn ? "Open workspace" : "Get started"}</Link>
        </div>
        <button onClick={() => setOpen(!open)} className="flex items-center justify-center rounded-lg p-2 text-slate-300 md:hidden hover:bg-white/5" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <div className="border-t border-white/10 bg-[#0b1220] md:hidden" role="menu">
          <div className="space-y-1 px-4 py-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`flex rounded-lg px-3 py-3 text-sm transition ${isActive(link.href) ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5"}`}
                role="menuitem"
              >
                {link.label}
              </Link>
            ))}
            <hr className="my-3 border-white/10" />
            <Link href="/login" onClick={() => setOpen(false)} className="flex rounded-lg px-3 py-3 text-sm text-slate-300 hover:bg-white/5" role="menuitem">Sign in</Link>
            <Link href={signedIn ? "/chat" : "/register"} onClick={() => setOpen(false)} className="flex rounded-lg bg-[var(--aegis-blue)] px-3 py-3 text-sm font-medium text-white" role="menuitem">{signedIn ? "Open workspace" : "Get started"}</Link>
          </div>
        </div>
      )}
    </nav>
  );
}
