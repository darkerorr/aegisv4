import { useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";
import { AegisButton, AegisEmptyState } from "../components/ui/AegisUI";

export function CLISessionsPage() {
  const [copied, setCopied] = useState(false);
  async function copyInstall() { await navigator.clipboard.writeText("pnpm add -g aegis"); setCopied(true); setTimeout(() => setCopied(false), 1800); }
  return <section className="feature-page"><header className="feature-heading"><div><p className="eyebrow">Terminal continuity</p><h1>CLI Sessions</h1><p>Resume terminal work linked to this Aegis workspace.</p></div><AegisButton variant="primary" onClick={() => void copyInstall()}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Command copied" : "Copy install command"}</AegisButton></header><AegisEmptyState icon={<Terminal size={24} />} title="No active CLI sessions" description="Install and start Aegis CLI in a project. Real sessions will appear here when the local bridge is available." action={<code className="install-command">pnpm add -g aegis</code>} /></section>;
}
