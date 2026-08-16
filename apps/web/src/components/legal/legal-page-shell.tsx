import type { LucideIcon } from "lucide-react";
import { LegalReviewNotice } from "./legal-notice";

export function LegalPageShell({ eyebrow, title, intro, icon: Icon, configured, children }: { eyebrow: string; title: string; intro: string; icon: LucideIcon; configured: boolean; children: React.ReactNode }) {
  return <main id="main" className="legal-page public-rich-page"><header className="legal-hero shell"><span className="eyebrow"><Icon size={16} /> {eyebrow}</span><h1>{title}</h1><p>{intro}</p><LegalReviewNotice configured={configured} /></header><div className="legal-document shell">{children}</div></main>;
}
