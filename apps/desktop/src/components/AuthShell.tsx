import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Activity, ShieldCheck, Sparkles } from "lucide-react";
import logoUrl from "../assets/aegis-logo.png";

export function AuthShell({ children, title, description }: { children: ReactNode; title: string; description: string }) {
  return (
    <div className="auth-page" style={{ minHeight: "100vh", padding: 32, display: "grid", placeItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 1080, display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(360px, 460px)", gap: 28, alignItems: "center" }}>
        <motion.section initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .45 }} style={{ padding: "28px 12px" }}>
          <img src={logoUrl} alt="Aegis" width={58} height={58} style={{ filter: "drop-shadow(0 0 22px rgba(67,199,255,.3))" }} />
          <p className="eyebrow" style={{ marginTop: 34 }}>Aegis workspace</p>
          <h1 style={{ fontSize: "clamp(42px, 6vw, 72px)", maxWidth: 560, margin: "12px 0 0" }}>{title}</h1>
          <p className="lede" style={{ marginTop: 20, maxWidth: 500 }}>{description}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 32 }}>
            <span className="badge" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><ShieldCheck size={14} color="var(--aegis-success)" /> Secure by design</span>
            <span className="badge" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Activity size={14} color="var(--aegis-blue-light)" /> Local + remote</span>
            <span className="badge" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Sparkles size={14} color="var(--aegis-orange-light)" /> One workspace</span>
          </div>
        </motion.section>
        <motion.section className="auth-card" initial={{ opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: .08, duration: .42 }} style={{ padding: 30, border: "1px solid var(--aegis-border-highlight)", borderRadius: 28, background: "var(--aegis-glass-strong)", boxShadow: "var(--aegis-shadow), inset 0 1px 0 rgba(255,255,255,.12)", backdropFilter: "blur(28px) saturate(140%)" }}>
          {children}
        </motion.section>
      </div>
    </div>
  );
}
