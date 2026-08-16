import Link from "next/link";
import { Fragment } from "react";
import {
  ArrowRight,
  Bot,
  Box,
  Check,
  Code2,
  Download,
  Fingerprint,
  Gauge,
  Github,
  HardDrive,
  Network,
  PenLine,
  Plug,
  SlidersHorizontal,
  TerminalSquare,
  Workflow,
} from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { ChatDemo } from "@/components/marketing/chat-demo";
import { ModelOrbit } from "@/components/marketing/model-orbit";
import { PrivacyVisual } from "@/components/marketing/privacy-visual";
import { HeroActions } from "@/components/marketing/hero-actions";
import { ProviderIcon } from "@/components/brand/provider-icon";

const providers = [
  { slug: "openai", name: "OpenAI" },
  { slug: "anthropic", name: "Anthropic" },
  { slug: "gemini", name: "Google Gemini" },
  { slug: "nvidia", name: "NVIDIA NIM" },
  { slug: "openrouter", name: "OpenRouter" },
  { slug: "mistral", name: "Mistral" },
  { slug: "groq", name: "Groq" },
  { slug: "deepseek", name: "DeepSeek" },
  { slug: "qwen", name: "Qwen" },
  { slug: "meta", name: "Meta Llama" },
  { slug: "together", name: "Together AI" },
  { slug: "fireworks", name: "Fireworks AI" },
  { slug: "perplexity", name: "Perplexity" },
  { slug: "sambanova", name: "SambaNova" },
  { slug: "hyperbolic", name: "Hyperbolic" },
  { slug: "zhipu", name: "Zhipu AI" },
  { slug: "moonshot", name: "Moonshot AI" },
  { slug: "minimax", name: "MiniMax" },
  { slug: "novita", name: "Novita AI" },
  { slug: "hugging-face", name: "Hugging Face" },
  { slug: "xai", name: "xAI" },
  { slug: "ollama", name: "Ollama · local" },
  { slug: "lmstudio", name: "LM Studio · local" },
];

const steps = [
  { n: "01", icon: Network, title: "Connect your providers", copy: "Add an API key (OpenAI, Anthropic, NVIDIA, Groq…) or a local runtime (Ollama, LM Studio). Your keys stay encrypted on your machine." },
  { n: "02", icon: SlidersHorizontal, title: "Choose your model", copy: "Aegis probes your credentials and only offers models you can actually reach — grouped by capability, not by URL." },
  { n: "03", icon: Bot, title: "Chat or Work, with your tools", copy: "Talk in a persistent thread, or switch to Work Mode to delegate real tasks to the agent — GitHub, Drive and Calendar included." },
];

const capabilities = [
  { icon: Network, title: "Multi-provider", copy: "OpenAI, Anthropic, NVIDIA NIM, OpenRouter, Groq, Ollama and more — manage every key from one place, encrypted and stored locally." },
  { icon: SlidersHorizontal, title: "Model picker", copy: "Choose the right model for each task, grouped by capability instead of URL — with your providers' logos." },
  { icon: PenLine, title: "Advanced composer", copy: "Tools, attachments, images and web search — a composer that keeps your whole context, without losing the thread." },
  { icon: Plug, title: "Connectors", copy: "GitHub, Gmail, Drive and Calendar connect with explicit permission states you can revoke at any time." },
  { icon: Bot, title: "Work Mode", copy: "A dedicated surface for long sessions and agent tasks, with separate history, context and tools." },
  { icon: HardDrive, title: "Local-first", copy: "Ollama and LM Studio run on hardware you control, clearly labeled — nothing leaves your machine silently." },
];

export default function Landing() {
  return (
    <main id="main" className="lp">
      {/* Hero */}
      <section className="lp-hero">
        <div className="lp-hero__grid" />
        <div className="lp-hero__glow" aria-hidden="true" />
        <div className="shell lp-hero__inner">
          <div className="lp-hero__copy">
            <span className="lp-badge"><i />Multi-provider AI · Local-first</span>
            <h1 className="lp-hero__title">Every model you use.<br /><span className="lp-hero__accent">One deliberate workspace.</span></h1>
            <p className="lp-hero__lead">Orchestrate OpenAI, Anthropic, NVIDIA NIM, OpenRouter, Groq, Ollama and more from a single workspace — with full control over your providers and local execution when you want it.</p>
            <HeroActions />
            <div className="lp-hero__metrics">
              <div><strong>20+</strong><span>AI providers</span></div>
              <div><strong>3</strong><span>surfaces · web, desktop, CLI</span></div>
              <div><strong>MIT</strong><span>open-source license</span></div>
              <div><strong>Local-first</strong><span>Ollama &amp; LM Studio</span></div>
            </div>
          </div>
          <div className="lp-hero__visual"><ChatDemo /></div>
        </div>
        <div className="lp-hero__fade" />
      </section>

      {/* Getting started */}
      <section className="lp-start">
        <div className="shell">
          <Reveal className="lp-section-head">
            <span className="lp-eyebrow">01 / How it works</span>
            <h2 className="lp-section-title">Ready in three <span className="lp-accent">steps.</span></h2>
            <p className="lp-section-copy">No spreadsheets, no endless setup — Aegis starts in three deliberate moves.</p>
          </Reveal>
          <div className="lp-steps">
            <span className="lp-steps__line" aria-hidden="true" />
            {steps.map((step, i) => (
              <Fragment key={step.n}>
                {i > 0 && <span className="lp-step__link" aria-hidden="true" />}
                <Reveal delay={i * 0.06}>
                  <article className="lp-step">
                    <span className="lp-step__icon"><step.icon size={18} /></span>
                    <em className="lp-step__n">STEP {step.n}</em>
                    <h3>{step.title}</h3>
                    <p>{step.copy}</p>
                  </article>
                </Reveal>
              </Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section id="features" className="lp-features">
        <div className="shell">
          <Reveal className="lp-section-head">
            <span className="lp-eyebrow">02 / Capabilities</span>
            <h2 className="lp-section-title">The power of every model,<br /><span className="lp-accent">orchestrated.</span></h2>
            <p className="lp-section-copy">One place to drive your providers, choose your models and keep control of your data.</p>
          </Reveal>
          <div className="lp-features__grid">
            {capabilities.map((feature, i) => (
              <Reveal key={feature.title} delay={i * 0.06}>
                <article className="lp-feature">
                  <span className="lp-feature__icon"><feature.icon size={18} /></span>
                  <h3>{feature.title}</h3>
                  <p>{feature.copy}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Models */}
      <section className="lp-models">
        <div className="shell lp-models__grid">
          <Reveal><ModelOrbit /></Reveal>
          <Reveal>
            <span className="lp-eyebrow">03 / Local + cloud</span>
            <h2 className="lp-section-title">The model becomes a choice — not a constraint.</h2>
            <p className="lp-section-copy">Local privacy, frontier reasoning, vision and coding — all organized by capability instead of technical URLs.</p>
            <div className="lp-chips">
              {["Local", "Cloud", "Coding", "Reasoning", "Vision", "Tools"].map((x) => <span key={x}>{x}</span>)}
            </div>
            <div className="lp-lines">
              {[[Workflow, "One continuous context"], [Gauge, "Capability-aware selection"], [Fingerprint, "Explicit provider boundaries"]].map(([Icon, label]) => (
                <div key={String(label)}><Icon size={18} /><span>{label as string}</span><Check size={14} /></div>
              ))}
            </div>
            <Link href="/models" className="lp-link">Explore models <ArrowRight size={16} /></Link>
          </Reveal>
        </div>
      </section>

      {/* Providers */}
      <section id="providers" className="lp-providers">
        <div className="shell">
          <Reveal className="lp-section-head">
            <span className="lp-eyebrow">04 / Supported providers</span>
            <h2 className="lp-section-title">Use any model you <span className="lp-accent">want.</span></h2>
            <p className="lp-section-copy">Twenty-three providers — from frontier reasoning to local on your machine — driven from a single interface.</p>
          </Reveal>
          <div className="lp-provider-cloud">
            {providers.map((p, i) => (
              <Reveal key={p.slug} delay={i * 0.02}>
                <span className="lp-provider-chip">
                  <ProviderIcon provider={p.slug} variant="color" size={20} />
                  <span>{p.name}</span>
                </span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="lp-privacy">
        <div className="shell lp-privacy__grid">
          <Reveal>
            <span className="lp-eyebrow">05 / Privacy by choice</span>
            <h2 className="lp-section-title">Nothing moves silently.</h2>
            <p className="lp-section-copy">Aegis separates local execution from cloud providers and makes integration permissions visible. You choose the model and the tools in each workflow.</p>
            <div className="lp-privacy__points">
              <span>Local models stay on your configured runtime.</span>
              <span>Cloud requests go only to the provider you choose.</span>
              <span>Connected tools expose explicit permission states.</span>
            </div>
            <Link href="/privacy" className="lp-link"><Fingerprint size={16} />Read our privacy approach</Link>
          </Reveal>
          <Reveal delay={0.12}><PrivacyVisual /></Reveal>
        </div>
      </section>

      {/* Surfaces */}
      <section className="lp-surfaces">
        <div className="shell">
          <Reveal className="lp-section-head">
            <span className="lp-eyebrow">06 / Everywhere you work</span>
            <h2 className="lp-section-title">One workspace.<br />Three deliberate surfaces.</h2>
          </Reveal>
          <div className="lp-triptych">
            <Reveal><article><span><Box size={20} />Web</span><h3>Focus without setup.</h3><p>Start from any browser with the complete Aegis workspace.</p><Link href="/register">Open Aegis <ArrowRight size={15} /></Link></article></Reveal>
            <Reveal delay={0.08}><article><span><Download size={20} />Desktop</span><h3>Local intelligence, closer.</h3><p>Connect on-device runtimes and keep long sessions at hand.</p><Link href="/download">Download <ArrowRight size={15} /></Link></article></Reveal>
            <Reveal delay={0.16}><article><span><TerminalSquare size={20} />CLI</span><h3>Intelligence in the flow.</h3><p>Bring Aegis into repositories, scripts and terminal workflows.</p><Link href="/docs#cli">Read CLI docs <ArrowRight size={15} /></Link></article></Reveal>
          </div>
        </div>
      </section>

      {/* Developer */}
      <section className="lp-dev">
        <div className="shell">
          <Reveal className="lp-section-head">
            <span className="lp-eyebrow">07 / Developer workflow</span>
            <h2 className="lp-section-title">Browser, desktop and terminal — one deliberate system.</h2>
          </Reveal>
          <div className="lp-dev__cards">
            <Link href="/download"><Download size={21} /><strong>Desktop App</strong><span>Local runtimes and native workspace access.</span><ArrowRight size={15} /></Link>
            <Link href="/docs"><Code2 size={21} /><strong>Documentation</strong><span>Providers, tools, privacy and troubleshooting.</span><ArrowRight size={15} /></Link>
            <Link href="/docs/cli/installation"><TerminalSquare size={21} /><strong>CLI</strong><span>Install and work directly from a repository.</span><ArrowRight size={15} /></Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="lp-cta">
        <div className="shell">
          <Reveal>
            <span className="lp-eyebrow">Built for deliberate intelligence</span>
            <h2 className="lp-cta__title">Every model you use.<br /><span className="lp-accent">One interface.</span></h2>
            <p>Your models. Your tools. Your boundaries — in an open-source workspace.</p>
            <div className="lp-cta__actions">
              <Link href="/register" className="button button-primary">Start free <ArrowRight size={17} /></Link>
              <a href="https://github.com/darkerorr/aegisv4" target="_blank" rel="noreferrer" className="button button-secondary"><Github size={17} />View on GitHub</a>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
