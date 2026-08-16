"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  CircleUserRound,
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
  { label: "Models", href: "/models" },
  { label: "Integrations", href: "/#integrations" },
  { label: "Privacy", href: "/privacy" },
  { label: "Docs", href: "/docs" },
  { label: "Download", href: "/download" },
];

function SessionActions({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const auth = useAuth();
  const router = useRouter();

  if (auth.status === "loading") {
    return <div className="auth-nav-skeleton" aria-label="Checking your Aegis session"><span /><i /></div>;
  }

  if (auth.status === "error") {
    return <button className="auth-nav-error" type="button" onClick={() => void auth.refresh()}>
      <RefreshCw size={15} aria-hidden="true" /> Session unavailable <span>Retry</span>
    </button>;
  }

  if (auth.status !== "authenticated") {
    return <>
      <Link className={mobile ? undefined : "nav-link"} href="/login" onClick={onNavigate}>Sign in</Link>
      <Link className={mobile ? undefined : "button button-primary min-h-9 px-4 text-sm"} href="/register" onClick={onNavigate}>Start free</Link>
    </>;
  }

  const name = auth.user.displayName || auth.user.email.split("@")[0] || "Aegis user";
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
      <DropdownMenuTrigger className="marketing-account-button" aria-label={`Open account menu for ${name}`}>
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

  useEffect(() => {
    const handler = () => setScrolled(scrollY > 24);
    handler();
    addEventListener("scroll", handler, { passive: true });
    return () => removeEventListener("scroll", handler);
  }, []);

  return <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3">
    <nav aria-label="Primary" data-scrolled={scrolled} className="marketing-nav mx-auto flex h-14 max-w-[1180px] items-center justify-between rounded-2xl px-3">
      <Link href="/" className="focus-ring flex items-center gap-2 rounded-lg px-1.5 font-semibold"><AegisLogo size={29} priority /><span>Aegis</span></Link>
      <div className="hidden items-center gap-1 lg:flex">
        <DropdownMenu>
          <DropdownMenuTrigger className="nav-link">Product <ChevronDown size={14} aria-hidden="true" /></DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem asChild><Link href="/product">Aegis workspace</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/download">Desktop app</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/docs#cli">Command line</Link></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {links.map((link) => <Link className="nav-link" href={link.href} key={link.label}>{link.label}</Link>)}
      </div>
      <div className="marketing-auth-slot hidden items-center gap-2 lg:flex"><SessionActions /></div>
      <button aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? "Close menu" : "Open menu"} className="focus-ring rounded-lg p-2 lg:hidden" onClick={() => setOpen((value) => !value)}>{open ? <X size={20} /> : <Menu size={20} />}</button>
    </nav>
    {open && <div id="mobile-nav" className="mobile-menu lg:hidden">
      <Link href="/product" onClick={() => setOpen(false)}>Product</Link>
      {links.map((link) => <Link href={link.href} key={link.label} onClick={() => setOpen(false)}>{link.label}</Link>)}
      <div className="divider" />
      <SessionActions mobile onNavigate={() => setOpen(false)} />
    </div>}
  </header>;
}
