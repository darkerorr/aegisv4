import Link from "next/link";
import { FolderOpen, Laptop, ShieldCheck } from "lucide-react";
import { Protected } from "../../components/Protected";

function ProjectsContent() {
  return <div className="mx-auto max-w-5xl">
    <p className="text-sm uppercase tracking-[.24em] text-[var(--aegis-orange)]/70">Workspace context</p>
    <h1 className="mt-2 text-4xl font-semibold">Projects</h1>
    <p className="mt-3 max-w-2xl text-[var(--aegis-text-muted)]">Projects are opened and trusted by Aegis App or CLI. The Web keeps your account and conversations synchronized without uploading local files.</p>
    <div className="mt-8 grid gap-4 md:grid-cols-3">
      <div className="surface rounded-2xl p-6"><FolderOpen className="text-[var(--aegis-blue-light)]" size={24} /><h2 className="mt-5 font-semibold">Open locally</h2><p className="mt-2 text-sm leading-6 text-[var(--aegis-text-muted)]">Choose a folder in the desktop app and approve its workspace trust before files are read.</p><Link href="/download#app" className="mt-5 inline-flex text-sm text-[var(--aegis-blue-light)]">Get the App →</Link></div>
      <div className="surface rounded-2xl p-6"><Laptop className="text-[var(--aegis-orange)]" size={24} /><h2 className="mt-5 font-semibold">Use the CLI</h2><p className="mt-2 text-sm leading-6 text-[var(--aegis-text-muted)]">Run <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs">aegis</code> in a trusted project directory for diffs and approvals.</p><Link href="/download#cli" className="mt-5 inline-flex text-sm text-[var(--aegis-blue-light)]">Install CLI →</Link></div>
      <div className="surface rounded-2xl p-6"><ShieldCheck className="text-[var(--aegis-success)]" size={24} /><h2 className="mt-5 font-semibold">Privacy first</h2><p className="mt-2 text-sm leading-6 text-[var(--aegis-text-muted)]">Only project metadata is synchronized when enabled. File contents stay local unless you explicitly send context.</p><Link href="/security" className="mt-5 inline-flex text-sm text-[var(--aegis-blue-light)]">Review security →</Link></div>
    </div>
    <div className="surface mt-6 rounded-2xl p-8 text-center"><p className="text-sm text-[var(--aegis-text-muted)]">No projects synchronized yet.</p><Link href="/chat" className="mt-4 inline-flex rounded-xl bg-[var(--aegis-blue)] px-5 py-3 text-sm font-semibold text-white">Start a conversation</Link></div>
  </div>;
}

export default function ProjectsPage() { return <Protected><ProjectsContent /></Protected>; }
