import Link from "next/link";
import { ArrowLeft, LockKeyhole, Sparkles, Zap } from "lucide-react";
import { AegisLogo } from "@/components/brand/aegis-logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main id="main" className="auth-layout auth-2026">
    <section className="auth-form-side">
      <Link href="/" className="focus-ring auth-brand"><AegisLogo size={32} priority /><span>Aegis</span></Link>
      <div className="auth-form-wrap">{children}</div>
      <p className="auth-legal">By continuing, you agree to the <Link href="/terms">Terms</Link> and acknowledge the <Link href="/privacy">Privacy approach</Link>.</p>
    </section>
    <aside className="auth-art auth-stage" aria-hidden="true">
      <div className="auth-grid" />
      <div className="auth-orb"><span /><i /><b /></div>
      <div className="auth-floating-card card-a"><Sparkles size={15} /><strong>Multi-provider</strong><span>Local and cloud routing</span></div>
      <div className="auth-floating-card card-b"><LockKeyhole size={15} /><strong>Explicit privacy</strong><span>Provider boundaries visible</span></div>
      <div className="auth-floating-card card-c"><Zap size={15} /><strong>Fast workspace</strong><span>Prepared for real work</span></div>
      <div className="auth-quote"><span className="eyebrow">Aegis / Protected choice</span><strong>One place to think<br />beyond one model.</strong><p>Bring models, tools and context into a workspace that feels deliberate from the first click.</p><Link href="/" className="auth-return"><ArrowLeft size={14} />Back to product</Link></div>
    </aside>
  </main>;
}
