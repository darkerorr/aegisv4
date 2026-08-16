"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Check, SkipForward, MessageSquare, Cpu, PlugZap, Shield, Download, Terminal } from "lucide-react";
import { AegisLogo } from "@aegis/shared-ui";
import { Protected } from "../../components/Protected";

const steps = [
  { id: "displayName", icon: null, title: "Your name", description: "How should we call you?" },
  { id: "usage", icon: <MessageSquare size={20} />, title: "Primary use", description: "What will you use Aegis for?" },
  { id: "provider", icon: <PlugZap size={20} />, title: "AI provider", description: "Connect your first provider." },
  { id: "model", icon: <Cpu size={20} />, title: "Default model", description: "Pick a starting model." },
  { id: "privacy", icon: <Shield size={20} />, title: "Privacy", description: "Set your default privacy mode." },
  { id: "app", icon: <Download size={20} />, title: "Desktop App", description: "Optional: install Aegis App." },
  { id: "cli", icon: <Terminal size={20} />, title: "CLI", description: "Optional: install Aegis CLI." },
  { id: "done", icon: null, title: "Ready", description: "Start your first conversation." },
];

const usages = ["Coding & development", "Research & analysis", "Writing & content", "General assistant", "Learning & education"];
const privacyModes = [
  { id: "local", label: "Local only", desc: "Data stays on your machine." },
  { id: "remote-provider", label: "Remote provider", desc: "Data goes through Aegis API." },
  { id: "private", label: "Private session", desc: "Nothing is stored." },
];

export default function OnboardingPage() {
  return <Protected><Onboarding /></Protected>;
}

function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [usage, setUsage] = useState("");
  const [privacy, setPrivacy] = useState("local");
  const [busy, setBusy] = useState(false);

  function next() { if (step < steps.length - 1) setStep(step + 1); }
  function skip() { if (step < steps.length - 1) setStep(step + 1); else router.push("/dashboard"); }
  function prev() { if (step > 0) setStep(step - 1); }

  async function finish() {
    setBusy(true);
    await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: name || undefined }) }).catch(() => undefined);
    router.push("/chat");
  }

  const current = steps[step];

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
      <div className="mb-10 flex items-center gap-2 text-sm text-[var(--aegis-text-muted)]">
        {steps.map((s, i) => (
          <span key={s.id} className={`flex items-center gap-2 ${i <= step ? "text-[var(--aegis-blue-light)]" : ""}`}>
            {i > 0 && <span className="w-6 border-t border-white/10" />}
            <span className={`grid h-7 w-7 place-items-center rounded-full text-xs ${i < step ? "bg-[var(--aegis-blue)] text-white" : i === step ? "border border-[var(--aegis-blue-light)] text-[var(--aegis-blue-light)]" : "border border-white/10 text-[var(--aegis-text-muted)]"}`}>
              {i < step ? <Check size={14} /> : i + 1}
            </span>
          </span>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: .3 }}>
          {current.id === "displayName" && (
            <div className="surface rounded-2xl p-8">
              <h2 className="text-2xl font-semibold">{current.title}</h2>
              <p className="mt-2 text-sm text-[var(--aegis-text-muted)]">{current.description}</p>
              <input value={name} onChange={(e) => setName(e.target.value)} className="control mt-6 w-full rounded-lg px-4 py-3 text-lg" placeholder="Your display name" autoFocus />
              <div className="mt-8 flex items-center justify-between">
                <button onClick={skip} className="flex items-center gap-1 text-sm text-[var(--aegis-text-muted)] hover:text-white"><SkipForward size={14} /> Skip</button>
                <button onClick={next} className="flex items-center gap-2 rounded-lg bg-[var(--aegis-orange)] px-5 py-2.5 font-medium text-white transition hover:brightness-110">Next <ArrowRight size={16} /></button>
              </div>
            </div>
          )}

          {current.id === "usage" && (
            <div className="surface rounded-2xl p-8">
              <h2 className="text-2xl font-semibold">{current.title}</h2>
              <p className="mt-2 text-sm text-[var(--aegis-text-muted)]">{current.description}</p>
              <div className="mt-6 space-y-2">
                {usages.map((u) => (
                  <button key={u} onClick={() => { setUsage(u); next(); }} className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${usage === u ? "border-[var(--aegis-blue)] bg-[var(--aegis-blue)]/10" : "border-white/10 hover:border-white/20"}`}>
                    {u}
                  </button>
                ))}
              </div>
              <button onClick={skip} className="mt-6 flex items-center gap-1 text-sm text-[var(--aegis-text-muted)] hover:text-white"><SkipForward size={14} /> Skip</button>
            </div>
          )}

          {current.id === "provider" && (
            <div className="surface rounded-2xl p-8">
              <h2 className="text-2xl font-semibold">{current.title}</h2>
              <p className="mt-2 text-sm text-[var(--aegis-text-muted)]">Add providers later from the Providers page. Default providers are pre-configured.</p>
              <div className="mt-6 space-y-3">
                {[
                  { name: "NVIDIA NIM", desc: "Optimized inference through NVIDIA" },
                  { name: "OpenRouter", desc: "200+ models, single API" },
                  { name: "Ollama", desc: "Local models on your machine" },
                  { name: "LM Studio", desc: "Local models via LM Studio" },
                ].map((p) => (
                  <div key={p.name} className="flex items-center justify-between rounded-xl border border-white/10 p-4">
                    <div><p className="font-medium text-sm">{p.name}</p><p className="text-xs text-[var(--aegis-text-muted)]">{p.desc}</p></div>
                    <span className="text-xs text-[var(--aegis-blue-light)]">Configure</span>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex items-center justify-between">
                <button onClick={prev} className="flex items-center gap-1 text-sm text-[var(--aegis-text-muted)] hover:text-white"><ArrowLeft size={14} /> Back</button>
                <button onClick={next} className="flex items-center gap-2 rounded-lg bg-[var(--aegis-orange)] px-5 py-2.5 font-medium text-white transition hover:brightness-110">Next <ArrowRight size={16} /></button>
              </div>
            </div>
          )}

          {current.id === "model" && (
            <div className="surface rounded-2xl p-8">
              <h2 className="text-2xl font-semibold">{current.title}</h2>
              <p className="mt-2 text-sm text-[var(--aegis-text-muted)]">Pick a default model. You can change it anytime.</p>
              <div className="mt-6 space-y-2">
                {["Llama 3.1 70B", "Mistral Large", "Claude 3.5 Sonnet", "GPT-4o", "DeepSeek V3"].map((m) => (
                  <button key={m} className="w-full rounded-xl border border-white/10 px-4 py-3 text-left text-sm hover:border-white/20">{m}</button>
                ))}
              </div>
              <div className="mt-8 flex items-center justify-between">
                <button onClick={prev} className="flex items-center gap-1 text-sm text-[var(--aegis-text-muted)] hover:text-white"><ArrowLeft size={14} /> Back</button>
                <button onClick={next} className="flex items-center gap-2 rounded-lg bg-[var(--aegis-orange)] px-5 py-2.5 font-medium text-white transition hover:brightness-110">Next <ArrowRight size={16} /></button>
              </div>
            </div>
          )}

          {current.id === "privacy" && (
            <div className="surface rounded-2xl p-8">
              <h2 className="text-2xl font-semibold">{current.title}</h2>
              <p className="mt-2 text-sm text-[var(--aegis-text-muted)]">{current.description}</p>
              <div className="mt-6 space-y-3">
                {privacyModes.map((p) => (
                  <button key={p.id} onClick={() => setPrivacy(p.id)} className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition ${privacy === p.id ? "border-[var(--aegis-blue)] bg-[var(--aegis-blue)]/10" : "border-white/10 hover:border-white/20"}`}>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${privacy === p.id ? "border-[var(--aegis-blue)] bg-[var(--aegis-blue)]" : "border-white/20"}`}>{privacy === p.id && <Check size={12} />}</span>
                    <div><p className="font-medium text-sm">{p.label}</p><p className="text-xs text-[var(--aegis-text-muted)]">{p.desc}</p></div>
                  </button>
                ))}
              </div>
              <div className="mt-8 flex items-center justify-between">
                <button onClick={prev} className="flex items-center gap-1 text-sm text-[var(--aegis-text-muted)] hover:text-white"><ArrowLeft size={14} /> Back</button>
                <button onClick={next} className="flex items-center gap-2 rounded-lg bg-[var(--aegis-orange)] px-5 py-2.5 font-medium text-white transition hover:brightness-110">Next <ArrowRight size={16} /></button>
              </div>
            </div>
          )}

          {current.id === "app" && (
            <div className="surface rounded-2xl p-8">
              <h2 className="text-2xl font-semibold">{current.title}</h2>
              <p className="mt-2 text-sm text-[var(--aegis-text-muted)]">Aegis App gives you native project access, local model detection and CLI integration.</p>
              <Link href="/download" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[var(--aegis-orange)] px-5 py-2.5 font-medium text-white transition hover:brightness-110"><Download size={16} /> Download Aegis App</Link>
              <div className="mt-8 flex items-center justify-between">
                <button onClick={prev} className="flex items-center gap-1 text-sm text-[var(--aegis-text-muted)] hover:text-white"><ArrowLeft size={14} /> Back</button>
                <button onClick={next} className="flex items-center gap-1 text-sm text-[var(--aegis-blue-light)] hover:text-white">Skip this step <ArrowRight size={14} /></button>
              </div>
            </div>
          )}

          {current.id === "cli" && (
            <div className="surface rounded-2xl p-8">
              <h2 className="text-2xl font-semibold">{current.title}</h2>
              <p className="mt-2 text-sm text-[var(--aegis-text-muted)]">Aegis CLI works from any project directory. Run `aegis` to start an interactive session.</p>
              <code className="mt-6 block rounded-lg bg-[#05070d] p-4 text-sm text-[var(--aegis-blue-light)]">npm install -g aegis-cli</code>
              <div className="mt-8 flex items-center justify-between">
                <button onClick={prev} className="flex items-center gap-1 text-sm text-[var(--aegis-text-muted)] hover:text-white"><ArrowLeft size={14} /> Back</button>
                <button onClick={next} className="flex items-center gap-1 text-sm text-[var(--aegis-blue-light)] hover:text-white">Skip this step <ArrowRight size={14} /></button>
              </div>
            </div>
          )}

          {current.id === "done" && (
            <div className="surface rounded-2xl p-8 text-center">
              <AegisLogo size={72} className="mx-auto mb-5" />
              <h2 className="text-2xl font-semibold">You are all set{name ? `, ${name}` : ""}.</h2>
              <p className="mt-3 text-[var(--aegis-text-muted)]">Your workspace is ready. Start a conversation or explore your dashboard.</p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <button onClick={finish} disabled={busy} className="flex items-center gap-2 rounded-lg bg-[var(--aegis-orange)] px-6 py-3 font-semibold text-white transition hover:brightness-110">
                  {busy ? "Starting..." : "Start chatting"} <ArrowRight size={16} />
                </button>
                <Link href="/dashboard" className="flex items-center gap-2 rounded-lg border border-white/10 px-6 py-3 text-sm text-slate-300 transition hover:bg-white/5">Go to dashboard</Link>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
