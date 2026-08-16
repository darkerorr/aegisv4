"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronDown,
  CircleUserRound,
  Github,
  LogOut,
  Menu,
  MessageSquareText,
  RefreshCw,
  Settings,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AegisLogo } from "@/components/brand/aegis-logo";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/features/auth/use-auth";

const links = [
  { label: "Features", href: "/#features" },
  { label: "Providers", href: "/#providers" },
  { label: "Documentation", href: "/docs" },
  { label: "GitHub", href: "https://github.com/darkerorr/aegisv4", external: true },
];

function SessionActions({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const auth = useAuth();
  const router = useRouter();

  if (auth.status === "loading") {
    return <div className="auth-nav-skeleton" aria-label="Checking your session"><span /><i /></div>;
  }

  if (auth.status === "error") {
    return <button className="auth-nav-error" type="button" onClick={() => void auth.refresh()}>
      <RefreshCw size={15} aria-hidden="true" /> Session unavailable <span>Retry</span>
    </button>;
  }

  if (auth.status !== "authenticated") {
    return <>
      <Link className={mobile ? undefined : "button button-secondary min-h-9 px-4 text-sm"} href="/login" onClick={onNavigate}>Sign in</Link>
      <Link className={mobile ? undefined : "button button-primary min-h-9 px-4 text-sm"} href="/register" onClick={onNavigate}>Get started</Link>
    </>;
  }

  const name = auth.user.displayName || auth.user.email.split("@")[0] || "Aegis User";
  const handleSignOut = async () => {
    await auth.signOut();
    onNavigate?.();
    router.push("/");
  };

  if (mobile) {
    return <>
      <div className="mobile-account-summary"><Avatar name={name} size={32} /><span><strong>{name}</strong><small>{auth.user.email}</small></span></div>
      <Link href="/chat" onClick={onNavigate}><MessageSquareText size={17} aria-hidden="true" /> Open workspace</Link>
      <Link href="/account" onClick={onNavigate}><CircleUserRound size={17} aria-hidden="true" /> Account</Link>
      <Link href="/settings" onClick={onNavigate}><Settings size={17} aria-hidden="true" /> Settings</Link>
      <button className="mobile-sign-out" type="button" onClick={() => void handleSignOut()}><LogOut size={17} aria-hidden="true" /> Sign out</button>
    </>;
  }

  return <>
    <Link className="button button-primary min-h-9 px-4 text-sm" href="/chat">Open workspace</Link>
    <DropdownMenu>
      <DropdownMenuTrigger className="marketing-account-button" aria-label={`${name}'s account menu`}>
        <Avatar name={name} size={30} /><ChevronDown size={14} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="marketing-account-summary"><strong>{name}</strong><span>{auth.user.email}</span></div>
        <DropdownMenuSeparator className="my-1 h-px bg-white/10" />
        <DropdownMenuItem asChild><Link href="/chat"><MessageSquareText size={16} aria-hidden="true" /> Open workspace</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/account"><CircleUserRound size={16} aria-hidden="true" /> Account</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/settings"><Settings size={16} aria-hidden="true" /> Settings</Link></DropdownMenuItem>
        <DropdownMenuSeparator className="my-1 h-px bg-white/10" />
        <DropdownMenuItem onSelect={() => void handleSignOut()}><LogOut size={16} aria-hidden="true" /> Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </>;
}

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const handler = () => setScrolled(scrollY > 24);
    handler();
    addEventListener("scroll", handler, { passive: true });
    return () => removeEventListener("scroll", handler);
  }, []);

  return <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3">
    <nav aria-label="Main" data-scrolled={scrolled} className="marketing-nav mx-auto flex h-14 max-w-[1180px] items-center justify-between rounded-2xl px-3">
      <Link href="/" className="focus-ring flex items-center gap-2 rounded-lg px-1.5 font-semibold"><AegisLogo size={29} priority /><span>Aegis</span></Link>
      <div className="hidden items-center gap-1 lg:flex">
        {links.map((link) => link.external ? (
          <a className="nav-link" href={link.href} key={link.label} target="_blank" rel="noreferrer"><Github size={15} aria-hidden="true" />{link.label}</a>
        ) : (
          <Link className="nav-link" href={link.href} key={link.label}>{link.label}</Link>
        ))}
      </div>
      <div className="marketing-auth-slot hidden items-center gap-2 lg:flex"><SessionActions /></div>
      <button aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? "Close menu" : "Open menu"} className="focus-ring rounded-lg p-2 lg:hidden" onClick={() => setOpen((value) => !value)}>{open ? <X size={20} /> : <Menu size={20} />}</button>
    </nav>
    <AnimatePresence>
      {open && (
        <motion.div
          id="mobile-nav"
          className="mobile-menu lg:hidden"
          initial={reduced ? false : { opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? undefined : { opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <Link href="/#features" onClick={() => setOpen(false)}>Features</Link>
          <Link href="/#providers" onClick={() => setOpen(false)}>Providers</Link>
          <Link href="/docs" onClick={() => setOpen(false)}>Documentation</Link>
          <a href="https://github.com/darkerorr/aegisv4" target="_blank" rel="noreferrer" onClick={() => setOpen(false)}><Github size={17} aria-hidden="true" /> GitHub</a>
          <div className="divider" />
          <SessionActions mobile onNavigate={() => setOpen(false)} />
        </motion.div>
      )}
    </AnimatePresence>
  </header>;
}