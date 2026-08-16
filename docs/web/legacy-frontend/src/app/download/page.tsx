"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Download, Terminal, Monitor, Shield, Cpu, Wifi, Check } from "lucide-react";
import { SiteNav } from "../../components/SiteNav";

const fadeUp = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-60px" }, transition: { duration: .5 } };

export default function DownloadPage() {
  return (
    <main className="min-h-screen bg-[var(--aegis-background)]">
      <SiteNav />
      <div className="mx-auto max-w-6xl px-6 py-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <p className="text-sm uppercase tracking-[.28em] text-[var(--aegis-orange)]/80">Download</p>
          <h1 className="mt-4 text-5xl font-bold tracking-tight">Get Aegis</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-[var(--aegis-text-muted)]">Choose your surface. The CLI is available now. Desktop builds coming soon.</p>
        </motion.div>

        <div className="mt-16 grid gap-6 md:grid-cols-2">
          <motion.div {...fadeUp} className="surface rounded-2xl p-8">
            <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-[var(--aegis-blue)]/10 text-[var(--aegis-blue-light)]"><Monitor size={24} /></div>
            <h2 className="text-2xl font-semibold">Aegis Desktop</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--aegis-text-muted)]">Native Windows application with local model support, project management, and full system access.</p>
            <div className="mt-6 space-y-3">
              {["Local AI models (Ollama, LM Studio)", "Project workspace with git integration", "Terminal agent with file access", "Sync conversations across devices"].map((f) => (
                <div key={f} className="flex items-center gap-3 text-sm"><Check size={16} className="text-[var(--aegis-success)]" />{f}</div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <button disabled className="inline-flex items-center gap-2 rounded-lg bg-[var(--aegis-blue)]/50 px-6 py-3 font-semibold text-white/60 cursor-not-allowed">
                <Download size={18} /> Windows (Coming soon)
              </button>
              <button disabled className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-6 py-3 text-sm text-slate-400 cursor-not-allowed">
                macOS (Coming soon)
              </button>
            </div>
            <p className="mt-4 text-xs text-[var(--aegis-text-muted)]">Version 0.3.0 · Minimum Windows 10 · 64-bit</p>
          </motion.div>

          <motion.div {...fadeUp} className="surface rounded-2xl p-8" transition={{ delay: .1, duration: .5 }}>
            <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-[var(--aegis-orange)]/10 text-[var(--aegis-orange)]"><Terminal size={24} /></div>
            <h2 className="text-2xl font-semibold">Aegis CLI</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--aegis-text-muted)]">Focused terminal assistant with trust system, diffs, and approvals. Works in any project.</p>
            <div className="mt-6 space-y-3">
              {["Install via npm: npm install -g aegis-cli", "Works with any OpenAI-compatible API", "Privacy-first: local models stay local", "Automatic project context detection"].map((f) => (
                <div key={f} className="flex items-center gap-3 text-sm"><Check size={16} className="text-[var(--aegis-success)]" />{f}</div>
              ))}
            </div>
            <div className="mt-8">
              <div className="rounded-xl border border-white/10 bg-[#05070d] p-4 font-mono text-sm">
                <p className="text-[var(--aegis-text-muted)]"># Install globally</p>
                <p className="mt-1 text-[var(--aegis-blue-light)]">npm install -g aegis-cli</p>
                <p className="mt-3 text-[var(--aegis-text-muted)]"># Or run directly</p>
                <p className="mt-1 text-[var(--aegis-blue-light)]">npx aegis</p>
              </div>
            </div>
            <Link href="/docs" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--aegis-blue-light)]">
              Read the documentation <ArrowRight size={14} />
            </Link>
          </motion.div>
        </div>

        <motion.div {...fadeUp} className="surface mt-10 rounded-2xl p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold"><Shield size={18} className="text-[var(--aegis-success)]" /> System requirements</h3>
              <ul className="mt-4 space-y-2 text-sm text-[var(--aegis-text-muted)]">
                <li><span className="text-white">Node.js</span> 20 or later for CLI</li>
                <li><span className="text-white">Windows 10</span> 64-bit for Desktop app</li>
                <li><span className="text-white">8 GB RAM</span> minimum, 16 GB recommended for local models</li>
                <li><span className="text-white">Ollama</span> or <span className="text-white">LM Studio</span> for local providers</li>
              </ul>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-[var(--aegis-blue)]/10 px-4 py-3 text-sm"><Cpu size={16} className="text-[var(--aegis-blue-light)]" /> v0.3.0</div>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
