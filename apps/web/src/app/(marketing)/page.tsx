import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Box,
  Check,
  Code2,
  Download,
  Fingerprint,
  Gauge,
  HardDrive,
  MessagesSquare,
  Network,
  PenLine,
  Plug,
  SlidersHorizontal,
  Sparkles,
  TerminalSquare,
  Workflow,
} from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { ChatDemo } from "@/components/marketing/chat-demo";
import { ModelOrbit } from "@/components/marketing/model-orbit";
import { PrivacyVisual } from "@/components/marketing/privacy-visual";
import { HeroActions } from "@/components/marketing/hero-actions";

const capabilities = [
  { icon: Network, title: "Multi-providers", copy: "OpenAI, Anthropic, NVIDIA NIM, OpenRouter, Groq, Ollama et plus — gérez toutes vos clés depuis un seul endroit, chiffrées et stockées localement." },
  { icon: SlidersHorizontal, title: "Sélecteur de modèle", copy: "Choisissez le bon modèle pour chaque tâche, regroupé par capacité plutôt que par URL — avec les logos de vos providers." },
  { icon: PenLine, title: "Composer avancé", copy: "Outils, pièces jointes, images et recherche web — un composer qui conserve tout votre contexte, sans perdre le fil." },
  { icon: Plug, title: "Connecteurs", copy: "GitHub, Gmail, Drive et Calendar se connectent avec des états de permission explicites, révoquables à tout moment." },
  { icon: Bot, title: "Work Mode", copy: "Une surface dédiée aux sessions longues et aux tâches d'agent, avec historique, contexte et outils séparés." },
  { icon: HardDrive, title: "Local-first", copy: "Ollama et LM Studio tournent sur votre matériel, clairement identifiés — aucun envoi silencieux hors de votre machine." },
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
            <span className="lp-badge"><i />Multi-providers IA · Local-first</span>
            <h1 className="lp-hero__title">Tous vos modèles d&apos;IA.<br /><span className="lp-hero__accent">Une seule interface.</span></h1>
            <p className="lp-hero__lead">Orchestrez OpenAI, Anthropic, NVIDIA NIM, OpenRouter, Groq, Ollama et plus dans un workspace unique — avec le contrôle total de vos providers et une exécution locale possible.</p>
            <HeroActions />
            <div className="lp-hero__metrics">
              <div><strong>20+</strong><span>fournisseurs IA</span></div>
              <div><strong>3</strong><span>surfaces · web, desktop, CLI</span></div>
              <div><strong>MIT</strong><span>licence open source</span></div>
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
            <span className="lp-eyebrow">01 / Get started</span>
            <h2 className="lp-section-title">From zero to your first answer.</h2>
            <p className="lp-section-copy">Aegis is ready in three deliberate steps — no spreadsheets, no vendor lock-in.</p>
          </Reveal>
          <div className="lp-steps">
            {[
              { n: "01", icon: Network, title: "Connect a provider", copy: "Add a local runtime (Ollama, LM Studio) or a cloud provider (NVIDIA, OpenRouter) with your API key." },
              { n: "02", icon: Sparkles, title: "Choose your model", copy: "Aegis probes your credentials and only offers models you can actually reach — grouped by capability." },
              { n: "03", icon: MessagesSquare, title: "Start asking", copy: "Chat with context that persists. Attach projects, search your files and delegate real work." },
            ].map((step) => (
              <Reveal key={step.n} delay={Number(step.n[1]) * 0.05}>
                <article className="lp-step">
                  <span className="lp-step__icon"><step.icon size={18} /></span>
                  <em className="lp-step__n">{step.n}</em>
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section id="features" className="lp-features">
        <div className="shell">
          <Reveal className="lp-section-head">
            <span className="lp-eyebrow">02 / Fonctionnalités</span>
            <h2 className="lp-section-title">La puissance de tous vos modèles,<br /><span className="lp-accent">orchestrée.</span></h2>
            <p className="lp-section-copy">Un seul endroit pour piloter vos providers, choisir vos modèles et garder le contrôle de vos données.</p>
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
            <span className="lp-eyebrow">04 / Local + cloud</span>
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

      {/* Integrations */}
      <section id="integrations" className="lp-integrations">
        <div className="shell">
          <Reveal className="lp-section-head">
            <span className="lp-eyebrow">05 / Connected tools</span>
            <h2 className="lp-section-title">Context arrives with permission.</h2>
            <p className="lp-section-copy">Bring the work you choose from Google Workspace and GitHub. Keep scopes visible and control where intelligence reaches.</p>
          </Reveal>
          <div className="lp-marquee">
            {["Gmail", "Drive", "Calendar", "GitHub", "NVIDIA", "OpenRouter"].map((x, i) => <span key={x} style={{ "--n": i } as React.CSSProperties}>{x}</span>)}
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="lp-privacy">
        <div className="shell lp-privacy__grid">
          <Reveal>
            <span className="lp-eyebrow">06 / Privacy by choice</span>
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
            <span className="lp-eyebrow">07 / Everywhere you work</span>
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
            <span className="lp-eyebrow">08 / Developer workflow</span>
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
            <h2 className="lp-cta__title">Think beyond<br />one model.</h2>
            <p>Your models. Your tools. Your boundaries.</p>
            <div className="lp-cta__actions">
              <Link href="/register" className="button button-primary">Start free <ArrowRight size={17} /></Link>
              <Link href="/docs" className="button button-secondary"><HardDrive size={17} />Read the docs</Link>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
