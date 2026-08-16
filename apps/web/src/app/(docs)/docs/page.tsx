import Link from "next/link";
import { BookOpenText, Cable, ChevronRight, CircleHelp, Code2, Laptop, Network, TerminalSquare, Wrench } from "lucide-react";
import { FeatureStatus } from "@/components/docs/feature-status";
import { getAllDocs } from "@/lib/docs/content";

export const metadata = { title: "Aegis documentation", description: "Learn Aegis Web, Desktop, CLI, providers, integrations and API behavior." };

const quickStarts = [
  [BookOpenText, "Start with Aegis Web", "Create a conversation and choose a real model.", "5 min", "/docs/getting-started/first-conversation"],
  [Laptop, "Install Desktop", "Verify and install the Windows development build.", "8 min", "/docs/desktop/installation-windows"],
  [TerminalSquare, "Install the CLI", "Use the declared @aegis/cli package or repository build.", "4 min", "/docs/cli/installation"],
  [Network, "Connect NVIDIA", "Add the cloud provider and diagnose access errors.", "6 min", "/docs/providers/nvidia"],
  [Cable, "Use Gmail", "Understand connection, permission and mailbox boundaries.", "7 min", "/docs/integrations/gmail"],
  [CircleHelp, "Troubleshoot Aegis", "Check health, CORS, hosts and process readiness.", "6 min", "/docs/troubleshooting/api-unavailable"],
] as const;

export default async function DocsHome() {
  const articles = await getAllDocs();
  const recentlyUpdated = [...articles].sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 4);
  return <main id="main" className="docs-home">
    <section className="docs-home-hero"><span className="eyebrow"><BookOpenText size={15} /> Documentation · v0.4</span><h1>Build confidently<br /><span className="chrome-text">with Aegis.</span></h1><p>Learn the Web workspace, Desktop app, CLI, models, providers, connected tools and API—without presenting planned behavior as available.</p><div className="docs-hero-signals"><span><Code2 size={15} /> Source-aligned examples</span><span><Wrench size={15} /> Troubleshooting</span><span><TerminalSquare size={15} /> Copyable commands</span></div></section>
    <section className="docs-home-section"><header><span>Quick starts</span><h2>Move from setup to a working surface.</h2></header><div className="quickstart-grid">{quickStarts.map(([Icon, title, description, time, href]) => <Link href={href} key={title}><Icon size={21} /><span><strong>{title}</strong><small>{description}</small><em>{time}</em></span><ChevronRight size={16} /></Link>)}</div></section>
    <section className="docs-home-section docs-browse"><header><span>Browse by product</span><h2>Documentation with boundaries.</h2></header><div>{[
      ["Web workspace", "Chat, conversations, current attachment status", "/docs/web/chat", "stable"],
      ["Desktop", "Windows installation, updates and diagnostics", "/docs/desktop/installation-windows", "beta"],
      ["CLI", "Installation and commands registered by source", "/docs/cli/commands", "stable"],
      ["Providers", "Local runtimes, NVIDIA, OpenRouter and custom endpoints", "/docs/providers/overview", "beta"],
      ["Tools and agents", "Current availability and anti-hallucination requirements", "/docs/agents/automatic-tools", "planned"],
      ["API", "Credentialed streaming and normalized errors", "/docs/api/streaming", "beta"],
    ].map(([title, description, href, status], index) => <Link href={href} key={title}><b>{String(index + 1).padStart(2, "0")}</b><span><strong>{title}</strong><small>{description}</small></span><FeatureStatus status={status as "stable" | "beta" | "planned"} /><ChevronRight size={16} /></Link>)}</div></section>
    <section className="docs-home-section recent-docs"><header><span>Recently updated</span><h2>Built against the current repository.</h2></header><div>{recentlyUpdated.map((article) => <Link href={`/docs/${article.slug}`} key={article.slug}><span><small>{article.group}</small><strong>{article.title}</strong></span><time>{article.updated}</time><ChevronRight size={16} /></Link>)}</div></section>
  </main>;
}
