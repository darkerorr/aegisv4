"use client";
import Link from "next/link";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Bell, BrainCircuit, Cpu, Fingerprint, FlaskConical, HardDrive, Keyboard, Monitor, Palette, ShieldCheck, Sparkles } from "lucide-react";
import { Toast, ToastProvider, ToastViewport } from "@/components/ui/toast";

type SettingsItem = { href: string | null; Icon: LucideIcon; label: string; copy: string; badge: string };

const items: SettingsItem[] = [
  { href: "/settings/appearance", Icon: Palette, label: "Appearance", copy: "Theme, motion, wallpaper and accent color", badge: "Visual" },
  { href: "/settings/ai", Icon: BrainCircuit, label: "AI Settings", copy: "Models, reasoning, memory and tool behavior", badge: "Core" },
  { href: "/settings/privacy", Icon: Fingerprint, label: "Privacy", copy: "History, providers and data controls", badge: "Trust" },
  { href: "/account/security", Icon: ShieldCheck, label: "Security", copy: "Password, sessions and device access", badge: "Account" },
  { href: "/settings/local-agent", Icon: HardDrive, label: "Local Agent", copy: "Work Mode bridge, token and local workspaces", badge: "Work" },
  { href: "/providers", Icon: Cpu, label: "API", copy: "Provider keys, latency and model discovery", badge: "Infra" },
  { href: null, Icon: Keyboard, label: "Shortcuts", copy: "Keyboard workflows and command palette", badge: "Desktop" },
  { href: null, Icon: Bell, label: "Notifications", copy: "Alerts, desktop and quiet hours", badge: "System" },
  { href: null, Icon: FlaskConical, label: "Labs", copy: "Experimental tools and early capabilities", badge: "Beta" },
];

export function SettingsNav() {
  const [notice, setNotice] = useState<{ title: string; description: string } | null>(null);
  return <ToastProvider swipeDirection="right">
    <div className="aegis-settings-stack">
      <section className="aegis-page-hero" style={{ alignItems: "center" }}>
        <div><span className="page-kicker"><Sparkles size={12} />Control center</span><h2 style={{ margin: "6px 0 2px" }}>Tune Aegis around how you think.</h2><p>Everything from motion to AI defaults, organized as a premium settings cockpit.</p></div>
        <span className="aegis-chip" style={{ width: "fit-content" }}><Monitor size={12} />Desktop ready</span>
      </section>
      <nav className="aegis-settings-grid" aria-label="Settings sections">
        {items.map(({ href, Icon, label, copy, badge }) => href
          ? <Link href={href} key={href}><Icon size={19} /><span><strong>{label}</strong><small>{copy}</small></span><b>{badge}</b></Link>
          : <button type="button" key={label} onClick={() => setNotice({ title: `${label} — coming soon`, description: "This surface is on the roadmap and is not wired up yet. It will light up in an upcoming release." })}><Icon size={19} /><span><strong>{label}</strong><small>{copy}</small></span><b>{badge}</b></button>)}
      </nav>
    </div>
    {notice && <Toast open onOpenChange={(open) => { if (!open) setNotice(null); }} title={notice.title} description={notice.description} duration={4200} />}
    <ToastViewport />
  </ToastProvider>;
}
