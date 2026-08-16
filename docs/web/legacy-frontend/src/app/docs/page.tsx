"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, Terminal, Monitor, Globe2, Shield, Cpu, PlugZap, HelpCircle } from "lucide-react";
import { SiteNav } from "../../components/SiteNav";

const sections = [
  { id: "introduction", icon: <BookOpen size={18} />, title: "Introduction" },
  { id: "installation", icon: <Monitor size={18} />, title: "Installation" },
  { id: "web", icon: <Globe2 size={18} />, title: "Aegis Web" },
  { id: "app", icon: <Monitor size={18} />, title: "Aegis App" },
  { id: "cli", icon: <Terminal size={18} />, title: "Aegis CLI" },
  { id: "accounts", icon: <Shield size={18} />, title: "Accounts" },
  { id: "providers", icon: <PlugZap size={18} />, title: "Providers" },
  { id: "nvidia-nim", icon: <Cpu size={18} />, title: "NVIDIA NIM" },
  { id: "openrouter", icon: <Cpu size={18} />, title: "OpenRouter" },
  { id: "ollama", icon: <Cpu size={18} />, title: "Ollama" },
  { id: "lmstudio", icon: <Cpu size={18} />, title: "LM Studio" },
  { id: "models", icon: <Cpu size={18} />, title: "Models" },
  { id: "privacy", icon: <Shield size={18} />, title: "Privacy" },
  { id: "troubleshooting", icon: <HelpCircle size={18} />, title: "Troubleshooting" },
  { id: "faq", icon: <HelpCircle size={18} />, title: "FAQ" },
];

const content: Record<string, { title: string; body: string[] }> = {
  introduction: {
    title: "Introduction",
    body: [
      "Aegis is a secure AI workspace that works across three surfaces: Web, App and CLI.",
      "Chat on the web. Build from the terminal. Run local or remote models through one secure workspace.",
      "Aegis is designed around privacy and control: local models stay on your machine, remote connections are clearly indicated, and every file change requires approval.",
    ],
  },
  installation: {
    title: "Installation",
    body: [
      "Aegis CLI: `npm install -g aegis-cli` then run `aegis` in any project directory.",
      "Aegis Web: No installation needed. Visit the web app and create an account.",
      "Aegis App: Desktop builds are in development. Requires Rust and Tauri toolchain. Clone the repository and run `pnpm --filter @aegis/desktop tauri:dev`.",
      "Requirements: Node.js 20+, pnpm 10+.",
    ],
  },
  web: {
    title: "Aegis Web",
    body: [
      "Aegis Web is the browser-based workspace. It provides account management, conversations, model selection and provider configuration.",
      "The Web cannot access local providers (Ollama, LM Studio) directly. Use Aegis App or CLI for local model access.",
      "Routes: /dashboard, /chat, /providers, /models, /settings, /account, /security.",
    ],
  },
  app: {
    title: "Aegis App",
    body: [
      "Aegis App is a native desktop application built with Tauri 2, React and TypeScript.",
      "Features: local project scanning, Ollama/LM Studio detection, terminal, notifications, system keychain, CLI sessions.",
      "Desktop builds are scaffolded but not yet available as downloadable binaries. Build from source.",
    ],
  },
  cli: {
    title: "Aegis CLI",
    body: [
      "Aegis CLI is a global terminal assistant. Run `aegis` in any project directory to start an interactive session.",
      "Commands: /model (change model), /edit (edit files), /analyze (analyze project), /help, /exit.",
      "The CLI can work without an account using local providers. An account enables identity, preferences and optional sync.",
    ],
  },
  accounts: {
    title: "Accounts",
    body: [
      "Create an account with email and password. In development mode, email verification can be skipped.",
      "Set `REQUIRE_EMAIL_VERIFICATION=false` in your environment to skip email verification during development.",
      "Account features: profile management, password change, active sessions, device management.",
    ],
  },
  providers: {
    title: "Providers",
    body: [
      "Aegis supports multiple AI providers: NVIDIA NIM, OpenRouter, OpenAI-compatible APIs, Ollama and LM Studio.",
      "Provider configuration includes: name, base URL, API key, kind and active status.",
      "API keys are sent only to the Aegis API and are never stored in the browser's localStorage.",
      "Use the /providers page to add, test, enable/disable and remove providers.",
    ],
  },
  "nvidia-nim": {
    title: "NVIDIA NIM",
    body: [
      "NVIDIA NIM provides optimized inference through NVIDIA's accelerated microservices.",
      "Default endpoint: https://integrate.api.nvidia.com/v1",
      "Requires an NVIDIA API key. Available through the Aegis cloud API.",
    ],
  },
  openrouter: {
    title: "OpenRouter",
    body: [
      "OpenRouter provides a single API for 200+ models from every major provider.",
      "Default endpoint: https://openrouter.ai/api/v1",
      "Requires an OpenRouter API key. Provides access to models from OpenAI, Anthropic, Google, Meta, Mistral and more.",
    ],
  },
  ollama: {
    title: "Ollama",
    body: [
      "Ollama runs models entirely on your machine. No data leaves your computer.",
      "Default endpoint: http://127.0.0.1:11434/v1",
      "The browser cannot connect to Ollama directly. Use Aegis App or Aegis CLI for local Ollama access.",
      "Install Ollama from https://ollama.ai and pull models with `ollama pull <model>`.",
    ],
  },
  lmstudio: {
    title: "LM Studio",
    body: [
      "LM Studio runs local models through a user-friendly desktop interface.",
      "Default endpoint: http://127.0.0.1:1234/v1",
      "Like Ollama, the browser cannot connect to LM Studio directly. Use Aegis App or CLI.",
    ],
  },
  models: {
    title: "Models",
    body: [
      "Models are discovered automatically from your configured providers.",
      "Each model has: name, type (chat, code, embedding), provider and active status.",
      "Filter models by: Coding, Reasoning, Vision, Fast, Free, provider or favorites.",
      "You can mark models as favorites for quick access.",
    ],
  },
  privacy: {
    title: "Privacy",
    body: [
      "Aegis offers four privacy modes:",
      "Local: Data goes directly to your local provider. Aegis servers never see it.",
      "Remote provider: Data routes through Aegis to your configured provider. Encrypted in transit.",
      "Synced: Messages and metadata are stored on Aegis servers for cross-device access.",
      "Private session: Temporary conversation. Nothing is stored.",
      "API keys are never stored in localStorage. They are stored server-side with the Aegis API.",
    ],
  },
  troubleshooting: {
    title: "Troubleshooting",
    body: [
      "Provider not connecting: Verify the base URL and API key. Test the connection from the Providers page.",
      "Local provider not detected: Ensure Ollama or LM Studio is running. Check that the endpoint is correct.",
      "Chat not responding: Check that a provider is active and has a valid model selected.",
      "Build errors: Ensure Node.js 20+ is installed. Run `pnpm install` before building.",
      "For more help, check the GitHub repository issues.",
    ],
  },
  faq: {
    title: "FAQ",
    body: [
      "Q: Do I need an account to use Aegis? A: The CLI can work without an account using local providers. Web requires an account.",
      "Q: Where are my API keys stored? A: API keys are sent to the Aegis API and stored server-side. They are never in localStorage.",
      "Q: Can Aegis access local files? A: Only through the App or CLI with explicit workspace trust. The Web never reads local files.",
      "Q: Is my code sent to external servers? A: Only when using remote providers. Local providers (Ollama, LM Studio) keep everything on your machine.",
    ],
  },
};

export default function DocsPage() {
  const [active, setActive] = useState("introduction");
  const section = content[active];

  return (
    <main className="min-h-screen bg-[var(--aegis-background)]">
      <SiteNav />
      <div className="mx-auto flex max-w-6xl gap-8 px-6 pb-24 pt-8">
        {/* Sidebar */}
        <nav className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-20 space-y-1">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${active === s.id ? "bg-white/10 text-white" : "text-[var(--aegis-text-muted)] hover:bg-white/5 hover:text-white"}`}
              >
                <span className="shrink-0">{s.icon}</span>
                {s.title}
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <article className="min-w-0 flex-1">
          <motion.div key={active} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
            <h1 className="text-4xl font-semibold">{section.title}</h1>
            <div className="mt-6 space-y-4 text-base leading-7 text-slate-300">
              {section.body.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
            <div className="mt-12 flex flex-wrap gap-3">
              {active !== "introduction" && <button onClick={() => setActive("introduction")} className="text-sm text-[var(--aegis-blue-light)] hover:text-white">← Back to introduction</button>}
              <Link href="/download" className="text-sm text-[var(--aegis-blue-light)] hover:text-white">Installation guide →</Link>
            </div>
          </motion.div>
        </article>
      </div>
    </main>
  );
}
