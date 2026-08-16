"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Globe2, Laptop, Terminal, Shield, Key, Download, BookOpen, Cpu, Workflow, Lock, Eye } from "lucide-react";
import { AegisLogo } from "@aegis/shared-ui";
import { SiteNav } from "../components/SiteNav";

const fadeUp = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-60px" }, transition: { duration: .5 } };

export default function Home() {
  return (
    <main className="min-h-screen">
      <SiteNav />

      {/* Hero */}
      <section className="aegis-hero-grid relative overflow-hidden px-6 pb-20 pt-16 text-center lg:pt-28">
        <div className="aegis-glow-hero" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6 }} className="relative mx-auto max-w-4xl">
          <AegisLogo src="/aegis-logo.png" size={80} className="mx-auto mb-6" />
          <p className="mb-4 text-sm uppercase tracking-[.28em] text-[var(--aegis-orange)]/80">The guarded AI workspace</p>
          <h1 className="text-5xl font-bold leading-[1.04] tracking-tight md:text-7xl">
            Your AI workspace<br /><span className="aegis-gradient-text">everywhere.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[var(--aegis-text-muted)]">
            Chat on the web. Build from the terminal. Run local or remote models through one secure workspace.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-[var(--aegis-orange)] px-6 py-3.5 font-semibold text-white transition hover:brightness-110">
              Start using Aegis <ArrowRight size={18} />
            </Link>
            <Link href="/download" className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-6 py-3.5 font-medium text-slate-100 transition hover:bg-white/10">
              Download <Download size={18} />
            </Link>
            <Link href="/chat" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-6 py-3.5 text-slate-300 transition hover:bg-white/5">
              Open Web Chat
            </Link>
          </div>
        </motion.div>

        {/* Terminal demo */}
        <motion.div id="app" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2, duration: .7 }} className="hero-terminal mx-auto mt-16 max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220] text-left shadow-2xl shadow-blue-950/20">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5 text-xs text-slate-500">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
            <span className="ml-2">AEGIS CLI — local workspace</span>
          </div>
          <div className="min-h-[240px] p-5 font-mono text-sm leading-7">
            <p className="text-slate-600">$ cd my-project</p>
            <p className="text-[var(--aegis-blue-light)]">$ aegis</p>
            <p className="mt-4 text-[var(--aegis-text-muted)]">Aegis is ready. Scanning project context...</p>
            <p className="mt-2 text-green-400">✓ 2 providers detected (Ollama, LM Studio)</p>
            <p className="mt-4 text-slate-400">&gt; <span className="text-white">review the auth flow and show me a diff</span><span className="typing-cursor" /></p>
            <p className="mt-4 text-[var(--aegis-orange)]">Aegis is reading relevant files...</p>
            <p className="text-[var(--aegis-text-muted)]">2 files in context — no secrets read</p>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 pb-24">
        <motion.div {...fadeUp} className="mb-12 text-center">
          <p className="text-sm uppercase tracking-[.25em] text-[var(--aegis-orange)]/70">Three surfaces</p>
          <h2 className="mt-3 text-3xl font-semibold">One workspace, every surface.</h2>
        </motion.div>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { icon: <Globe2 size={24} />, title: "Aegis Web", text: "Account, conversations, models and providers in the browser. No install required.", href: "/chat" },
            { icon: <Laptop size={24} />, title: "Aegis App", text: "Native workspace for local projects, agents and CLI sessions with full system access.", href: "/download#app" },
            { icon: <Terminal size={24} />, title: "Aegis CLI", text: "Focused terminal assistant with trust, diffs and approvals. Works in any project.", href: "/download#cli" },
          ].map((item) => (
            <motion.div key={item.title} {...fadeUp} className="group surface rounded-xl p-6 transition hover:-translate-y-1 hover:border-[var(--aegis-blue)]/40">
              <div className="mb-5 grid h-11 w-11 place-items-center rounded-lg bg-[var(--aegis-blue)]/10 text-[var(--aegis-blue-light)]">{item.icon}</div>
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--aegis-text-muted)]">{item.text}</p>
              <Link href={item.href} className="mt-4 inline-flex items-center gap-1 text-sm text-[var(--aegis-blue-light)] opacity-0 transition group-hover:opacity-100">
                Learn more <ArrowRight size={14} />
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Providers */}
      <section id="models" className="border-y border-white/10 bg-[#0b1220]/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <motion.div {...fadeUp} className="mb-12 text-center">
            <p className="text-sm uppercase tracking-[.25em] text-[var(--aegis-orange)]/70">Providers</p>
            <h2 className="mt-3 text-3xl font-semibold">Connect any model provider.</h2>
          </motion.div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: <Cpu size={20} />, title: "NVIDIA NIM", text: "Optimized inference with NVIDIA's accelerated microservices." },
              { icon: <Workflow size={20} />, title: "OpenRouter", text: "Single API for 200+ models from every major provider." },
              { icon: <Key size={20} />, title: "OpenAI-compatible", text: "Any API that speaks the OpenAI chat completions format." },
            ].map((item) => (
              <div key={item.title} className="surface rounded-xl p-5">
                <div className="mb-3 flex items-center gap-3 text-[var(--aegis-orange)]"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--aegis-orange)]/10">{item.icon}</span><h3 className="font-semibold">{item.title}</h3></div>
                <p className="text-sm leading-6 text-[var(--aegis-text-muted)]">{item.text}</p>
                <Link href="/providers" className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--aegis-blue-light)]">Configure <ArrowRight size={12} /></Link>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="surface rounded-xl p-5">
              <h3 className="font-semibold text-[var(--aegis-blue-light)]">Local models</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--aegis-text-muted)]">Run Ollama or LM Studio entirely on your machine. No data leaves your computer when using local providers.</p>
            </div>
            <div className="surface rounded-xl p-5">
              <h3 className="font-semibold text-[var(--aegis-orange)]">Custom providers</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--aegis-text-muted)]">Add any OpenAI-compatible endpoint with your own base URL and API key.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy & Security */}
      <section id="privacy" className="mx-auto max-w-6xl px-6 py-20">
        <motion.div {...fadeUp} className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-sm uppercase tracking-[.25em] text-[var(--aegis-orange)]/70">Built around control</p>
            <h2 className="mt-3 text-3xl font-semibold">Local by default. Clear when remote.</h2>
            <ul className="mt-7 space-y-4">
              {[
                { icon: <Shield size={18} />, text: "Ollama and LM Studio stay entirely on your machine." },
                { icon: <Eye size={18} />, text: "Every file change is shown before approval." },
                { icon: <Lock size={18} />, text: "Sync conversations only when you choose it." },
                { icon: <Key size={18} />, text: "API keys are never stored in localStorage." },
              ].map((item) => (
                <li key={item.text} className="flex gap-3 text-sm leading-6 text-[var(--aegis-text-muted)]">
                  <span className="mt-0.5 text-[var(--aegis-blue-light)]">{item.icon}</span>{item.text}
                </li>
              ))}
            </ul>
          </div>
          <div className="surface rounded-2xl p-7">
            <h3 className="text-lg font-semibold">Privacy modes</h3>
            <div className="mt-5 space-y-4">
              {[
                { label: "Local", desc: "Data goes directly to your local provider. Aegis servers never see it.", color: "var(--aegis-blue-light)" },
                { label: "Remote provider", desc: "Data routes through Aegis to your configured provider. Securely encrypted.", color: "var(--aegis-orange)" },
                { label: "Private session", desc: "Temporary conversation. Nothing is stored.", color: "var(--aegis-success)" },
              ].map((item) => (
                <div key={item.label} className="flex gap-3 border-b border-white/5 pb-4 last:border-0 last:pb-0">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: item.color }} />
                  <div><p className="font-medium text-sm">{item.label}</p><p className="text-xs text-[var(--aegis-text-muted)]">{item.desc}</p></div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Download */}
      <section className="border-y border-white/10 bg-[#0b1220]/60">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center">
          <motion.div {...fadeUp}>
            <p className="text-sm uppercase tracking-[.25em] text-[var(--aegis-orange)]/70">Get started</p>
            <h2 className="mt-3 text-3xl font-semibold">Download Aegis.</h2>
            <p className="mx-auto mt-4 max-w-xl text-[var(--aegis-text-muted)]">Choose your surface. The CLI is available now. Desktop builds coming soon.</p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link href="/download" className="inline-flex items-center gap-2 rounded-lg bg-[var(--aegis-orange)] px-6 py-3.5 font-semibold text-white transition hover:brightness-110">
                <Download size={18} /> Download App
              </Link>
              <Link href="/download#cli" className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-6 py-3.5 font-medium text-slate-100 transition hover:bg-white/10">
                <Terminal size={18} /> Download CLI
              </Link>
              <Link href="/docs" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-6 py-3.5 text-slate-300 transition hover:bg-white/5">
                <BookOpen size={18} /> View Docs
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-10 text-sm text-[var(--aegis-text-muted)]">
        <div className="flex items-center gap-2">
          <AegisLogo src="/aegis-logo.png" size={20} />
          <span>Aegis — AI workspace everywhere.</span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/download" className="hover:text-white">Download</Link>
          <Link href="/docs" className="hover:text-white">Documentation</Link>
          <Link href="/#models" className="hover:text-white">Models</Link>
          <Link href="/login?next=/providers" className="hover:text-white">Providers</Link>
          <Link href="/login" className="hover:text-white">Sign in</Link>
          <Link href="/register" className="hover:text-white">Create account</Link>
        </div>
      </footer>
    </main>
  );
}
