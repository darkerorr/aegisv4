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
          <p className="mt-3 max-w-xs text-sm text-zinc-500">L&apos;intelligence avec des limites claires. Le bon modèle pour chaque tâche — pas un seul modèle pour tout.</p>
          <a href="https://github.com/darkerorr/aegisv4" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white"><Github size={16} /> GitHub</a>
        </div>
        <div className="footer-links"><strong>Produit</strong><Link href="/product">Workspace</Link><Link href="/models">Modèles</Link><Link href="/download">Télécharger</Link></div>
        <div className="footer-links"><strong>Ressources</strong><Link href="/docs">Documentation</Link><Link href="/security">Sécurité</Link><Link href="/subprocessors">Sous-traitants</Link></div>
        <div className="footer-links"><strong>Légal</strong><Link href="/privacy">Confidentialité</Link><Link href="/legal">Légal</Link><Link href="/terms">Conditions</Link><Link href="/cookies">Cookies</Link></div>
      </div>
      <div className="shell mt-10 flex flex-wrap justify-between gap-3 border-t border-white/10 pt-5 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
        <span>© {year} Aegis</span>
        <span>Multi-providers · local-first · open source</span>
      </div>
    </footer>
  );
}