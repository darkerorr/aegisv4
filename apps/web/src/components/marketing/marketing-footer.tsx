import Link from "next/link";
import { Github } from "lucide-react";
import { AegisLogo } from "@/components/brand/aegis-logo";

export function MarketingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-white/10 py-12">
      <div className="shell grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <span className="flex items-center gap-2 font-semibold"><AegisLogo size={28} />Aegis</span>
          <p className="mt-3 max-w-xs text-sm text-zinc-500">Intelligence with boundaries. The right model for every task — not just one model for everything.</p>
          <a href="https://github.com/darkerorr/aegisv4" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white"><Github size={16} /> GitHub</a>
        </div>
        <div className="footer-links"><strong>Product</strong><Link href="/product">Workspace</Link><Link href="/models">Models</Link><Link href="/download">Download</Link></div>
        <div className="footer-links"><strong>Resources</strong><Link href="/docs">Documentation</Link><Link href="/security">Security</Link><Link href="/subprocessors">Subprocessors</Link></div>
        <div className="footer-links"><strong>Legal</strong><Link href="/privacy">Privacy</Link><Link href="/legal">Legal</Link><Link href="/terms">Terms</Link><Link href="/cookies">Cookies</Link></div>
      </div>
      <div className="shell mt-10 flex flex-wrap justify-between gap-3 border-t border-white/10 pt-5 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
        <span>© {year} Aegis</span>
        <span>Multi-provider · local-first · open source</span>
      </div>
    </footer>
  );
}