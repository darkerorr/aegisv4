import { motion } from "framer-motion";
import { useSidebar } from "../contexts/SidebarContext";
import logoUrl from "../assets/aegis-logo.png";

export function NotFoundPage() {
  const { navigate } = useSidebar();

  return (
    <motion.div
      className="not-found-page"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        textAlign: "center",
        gap: 16,
      }}
    >
      <img src={logoUrl} alt="Aegis" width={48} height={48} style={{ opacity: 0.4 }} />
      <h1 style={{ fontSize: 48, margin: 0, fontWeight: 700, color: "var(--aegis-text-muted)" }}>404</h1>
      <p style={{ fontSize: 15, color: "var(--aegis-text-muted)", maxWidth: 360, lineHeight: 1.6 }}>
        This page doesn't exist yet in Aegis App.
      </p>
      <button className="aegis-btn aegis-btn-primary" onClick={() => navigate("Home")}>
        Back to Home
      </button>
    </motion.div>
  );
}
